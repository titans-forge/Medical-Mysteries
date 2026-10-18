import Foundation
import SQLite3

// Application Support is backed up with the app, unlike disposable web caches.
// SQLite FULL commits complete before the synchronous JavaScript call returns.
final class NativeStore {
    private var db: OpaquePointer?
    private let maxBytes: Int
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    enum Failure: Error { case unavailable, invalidRequest, quota }

    init(url: URL, maxBytes: Int = 64 * 1024 * 1024, readOnly: Bool = false) throws {
        self.maxBytes = maxBytes
        if !readOnly {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            #if os(iOS)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.deletingLastPathComponent().path)
            #endif
        }
        let flags = readOnly ? SQLITE_OPEN_READONLY : SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE
        guard sqlite3_open_v2(url.path, &db, flags | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            if let db { sqlite3_close(db) }; db = nil; throw Failure.unavailable
        }
        sqlite3_busy_timeout(db, 1500)
        do {
            let version = try scalar("PRAGMA user_version")
            guard version <= 1 else { throw Failure.unavailable }
            if !readOnly {
                try execute("PRAGMA journal_mode=WAL")
                try execute("PRAGMA synchronous=FULL")
                try execute("CREATE TABLE IF NOT EXISTS saves (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)")
                try execute("PRAGMA user_version=1")
            }
        } catch { sqlite3_close(db); db = nil; throw error }
    }
    deinit { sqlite3_close(db) }
    private func execute(_ sql: String) throws {
        guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw Failure.unavailable }
    }
    private func statement(_ sql: String, _ args: [String] = []) throws -> OpaquePointer {
        var query: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &query, nil) == SQLITE_OK, let query else { throw Failure.unavailable }
        for (i, arg) in args.enumerated() {
            if sqlite3_bind_text(query, Int32(i + 1), arg, -1, transient) != SQLITE_OK { sqlite3_finalize(query); throw Failure.unavailable }
        }
        return query
    }
    private func scalar(_ sql: String, _ args: [String] = []) throws -> Int {
        let query = try statement(sql, args); defer { sqlite3_finalize(query) }
        guard sqlite3_step(query) == SQLITE_ROW else { throw Failure.unavailable }
        return Int(sqlite3_column_int64(query, 0))
    }
    private func string(_ sql: String, _ args: [String] = []) throws -> Any {
        let query = try statement(sql, args); defer { sqlite3_finalize(query) }
        let result = sqlite3_step(query)
        if result == SQLITE_DONE { return NSNull() }
        guard result == SQLITE_ROW, let text = sqlite3_column_text(query, 0) else { throw Failure.unavailable }
        return String(cString: text)
    }
    private func validKey(_ key: String?) throws -> String {
        guard let key, key.hasPrefix("mm"), !key.utf8.contains(0), key.utf8.count <= 1024 else { throw Failure.invalidRequest }
        return key
    }
    func perform(_ request: [String: Any]) throws -> Any {
        guard let op = request["op"] as? String else { throw Failure.invalidRequest }
        switch op {
        case "length": return try scalar("SELECT COUNT(*) FROM saves")
        case "key":
            guard let index = request["key"] as? Int, index >= 0, index <= 10000 else { return NSNull() }
            return try string("SELECT key FROM saves ORDER BY key LIMIT 1 OFFSET \(index)")
        case "get": return try string("SELECT value FROM saves WHERE key=?", [validKey(request["key"] as? String)])
        case "remove":
            let query = try statement("DELETE FROM saves WHERE key=?", [validKey(request["key"] as? String)])
            defer { sqlite3_finalize(query) }
            guard sqlite3_step(query) == SQLITE_DONE else { throw Failure.unavailable }; return NSNull()
        case "clear": try execute("DELETE FROM saves"); return NSNull()
        case "set":
            let key = try validKey(request["key"] as? String)
            guard let value = request["value"] as? String, !value.utf8.contains(0) else { throw Failure.invalidRequest }
            guard value.utf8.count <= 4 * 1024 * 1024 else { throw Failure.quota }
            try execute("BEGIN IMMEDIATE")
            do {
                let total = try scalar("SELECT COALESCE(SUM(length(CAST(key AS BLOB))+length(CAST(value AS BLOB))),0) FROM saves WHERE key<>?", [key])
                let rows = try scalar("SELECT COUNT(*) FROM saves WHERE key<>?", [key])
                guard total + key.utf8.count + value.utf8.count <= maxBytes, rows < 10000 else { throw Failure.quota }
                let query = try statement("INSERT INTO saves(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key, value])
                defer { sqlite3_finalize(query) }
                guard sqlite3_step(query) == SQLITE_DONE else { throw Failure.unavailable }
                try execute("COMMIT")
                return NSNull()
            } catch { try? execute("ROLLBACK"); throw error }
        default: throw Failure.invalidRequest
        }
    }
    func reply(to payload: String) -> String {
        let envelope: [String: Any]
        do {
            // A 4 MiB value can need up to six times as many JSON bytes.
            guard payload.utf8.count <= 26 * 1024 * 1024,
                  let data = payload.data(using: .utf8),
                  let request = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw Failure.invalidRequest }
            envelope = ["ok": true, "value": try perform(request)]
        } catch {
            envelope = ["ok": false, "name": (error as? Failure) == .quota ? "QuotaExceededError" : "InvalidStateError",
                        "error": "Device storage could not save or read this record. Existing saves have not been replaced."]
        }
        let data = try! JSONSerialization.data(withJSONObject: envelope, options: [.sortedKeys])
        return String(data: data, encoding: .utf8)!
    }
    // Stream a consistent snapshot, one bounded record at a time. This supports
    // the full accepted store without a second, smaller backup-size limit.
    func exportBackup(to url: URL) throws {
        guard FileManager.default.createFile(atPath: url.path, contents: nil) else { throw Failure.unavailable }
        let file = try FileHandle(forWritingTo: url)
        defer { try? file.close() }
        try execute("BEGIN")
        do {
            try file.write(contentsOf: Data("{\"schema\":\"medical-mysteries-native-backup-v1\",\"version\":\"1.0.0\",\"records\":[".utf8))
            let query = try statement("SELECT key,value FROM saves ORDER BY key")
            defer { sqlite3_finalize(query) }
            var first = true
            while true {
                let status = sqlite3_step(query)
                if status == SQLITE_DONE { break }
                guard status == SQLITE_ROW, let key = sqlite3_column_text(query, 0), let value = sqlite3_column_text(query, 1) else { throw Failure.unavailable }
                if !first { try file.write(contentsOf: Data(",".utf8)) }; first = false
                let data = try JSONSerialization.data(withJSONObject: ["key": String(cString:key), "raw": String(cString:value)], options: [.sortedKeys])
                try file.write(contentsOf: data)
            }
            try file.write(contentsOf: Data("]}".utf8))
            try file.synchronize()
            try execute("COMMIT")
        } catch { try? execute("ROLLBACK"); throw error }
    }
}
