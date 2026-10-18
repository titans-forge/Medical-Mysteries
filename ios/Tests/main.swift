import Foundation

let root = FileManager.default.temporaryDirectory.appendingPathComponent("mm-store-tests-" + UUID().uuidString)
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
let file = root.appendingPathComponent("progress.sqlite3")
var tests = 0
func check(_ value: Bool, _ name: String) { precondition(value, name); tests += 1; print("PASS " + name) }
func parse(_ value: String) -> [String: Any] { try! JSONSerialization.jsonObject(with: Data(value.utf8)) as! [String: Any] }
func request(_ db: NativeStore, _ op: String, _ key: String? = nil, _ value: String? = nil) -> [String: Any] {
 var body: [String: Any] = ["op":op]; body["key"] = key; body["value"] = value
 return parse(db.reply(to: String(data: try! JSONSerialization.data(withJSONObject:body),encoding:.utf8)!))
}
var db: NativeStore? = try NativeStore(url:file)
check(request(db!,"set","mmStorySession:v2:one","{\"answers\":[\"first\"]}")["ok"] as? Bool == true,"committed story save")
check(request(db!,"get","mmStorySession:v2:one")["value"] as? String == "{\"answers\":[\"first\"]}","exact stored bytes")
db = nil; db = try NativeStore(url:file)
check(request(db!,"get","mmStorySession:v2:one")["value"] as? String == "{\"answers\":[\"first\"]}","cold reopen retains save")
let escaped = String(repeating:"🩺\n\"\\",count:220000)
check(request(db!,"set","mmInvestigationJournal:preserved:v1:test",escaped)["ok"] as? Bool == true,"large escaped Unicode recovery record")
check(request(db!,"get","mmInvestigationJournal:preserved:v1:test")["value"] as? String == escaped,"large recovery bytes round-trip")
let readonly = try NativeStore(url:file,readOnly:true)
check(request(readonly,"set","mmStorySession:v2:one","changed")["ok"] as? Bool == false,"write failure is reported")
check(request(db!,"get","mmStorySession:v2:one")["value"] as? String == "{\"answers\":[\"first\"]}","failed save never replaces prior answers")
check(request(db!,"set","foreign-key","no")["ok"] as? Bool == false,"foreign key rejected")
check(request(db!,"set","mmOversized",String(repeating:"x",count:4*1024*1024+1))["name"] as? String == "QuotaExceededError","per-value limit enforced")
check(request(db!,"get","mmOversized")["value"] is NSNull,"failed oversized save absent")
let quota = try NativeStore(url:root.appendingPathComponent("quota.sqlite3"),maxBytes:100)
check(request(quota,"set","mmOriginal","first answers")["ok"] as? Bool == true,"small database initial save")
check(request(quota,"set","mmOriginal",String(repeating:"x",count:101))["name"] as? String == "QuotaExceededError","total limit rolls back replacement")
check(request(quota,"get","mmOriginal")["value"] as? String == "first answers","quota rollback retains original")
check(parse(db!.reply(to:"not json"))["ok"] as? Bool == false,"malformed envelope fails closed")
check((try db!.perform(["op":"length"]) as? Int) == 2,"storage length")
check((try db!.perform(["op":"key","key":0]) as? String)?.hasPrefix("mm") == true,"storage key enumeration")
_ = request(db!,"remove","mmInvestigationJournal:preserved:v1:test")
check((try db!.perform(["op":"length"]) as? Int) == 1,"remove only selected record")
_ = request(db!,"clear")
check((try db!.perform(["op":"length"]) as? Int) == 0,"explicit clear")
let backupStore = try NativeStore(url:root.appendingPathComponent("backup.sqlite3"))
let quotes = String(repeating:"\"",count:4*1024*1024)
for index in 0..<5 { _ = try backupStore.perform(["op":"set","key":"mmBackup:\(index)","value":quotes]) }
let backup = root.appendingPathComponent("backup.json")
try backupStore.exportBackup(to:backup)
check(try Data(contentsOf:backup).count > 32 * 1024 * 1024,"backup exceeds former 32 MiB limit without losing records")
let exported = try JSONSerialization.jsonObject(with:Data(contentsOf:backup)) as! [String:Any]
let rows = exported["records"] as! [[String:String]]
check(rows.count == 5 && rows.allSatisfy { $0["raw"] == quotes },"streamed backup preserves all raw values")
check((try backupStore.perform(["op":"length"]) as? Int) == 5,"export leaves progress untouched")
print("Verified \(tests) native storage scenarios.")
