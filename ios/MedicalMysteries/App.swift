import UIKit
import WebKit
import UniformTypeIdentifiers

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Game", sessionRole: session.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        window.rootViewController = GameController()
        window.makeKeyAndVisible(); self.window = window
    }
}

final class BundledGame: NSObject, WKURLSchemeHandler {
    let root: URL
    init(root: URL) { self.root = root.standardizedFileURL }
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        do {
            guard let url = task.request.url, url.scheme == "forge", url.host == "medical-mysteries",
                  let path = url.path.removingPercentEncoding, !path.contains("\u{0}") else { throw CocoaError(.fileReadNoPermission) }
            let file = root.appendingPathComponent(path == "/" ? "index.html" : String(path.dropFirst())).standardizedFileURL.resolvingSymlinksInPath()
            guard file.path.hasPrefix(root.path + "/"), file.isFileURL else { throw CocoaError(.fileReadNoPermission) }
            let mime: String
            switch file.pathExtension.lowercased() {
            case "mjs", "js": mime = "text/javascript"
            case "css": mime = "text/css"
            case "html": mime = "text/html"
            case "svg": mime = "image/svg+xml"
            case "json": mime = "application/json"
            default: mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            }
            let data = try Data(contentsOf: file)
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: [
                "Content-Type": mime + (mime.hasPrefix("text/") ? "; charset=utf-8" : ""),
                "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store"
            ])!
            task.didReceive(response); task.didReceive(data); task.didFinish()
        } catch { task.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

final class GameController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
    private var web: WKWebView!
    private var store: NativeStore?
    private var sharing = false
    private let home = URL(string: "forge://medical-mysteries/index.html")!
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 20/255, green: 23/255, blue: 25/255, alpha: 1)
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(BundledGame(root: Bundle.main.url(forResource: "Game", withExtension: nil)!), forURLScheme: "forge")
        let script = WKUserScript(source: "Object.defineProperty(window, '__MM_NATIVE__', {value: true});", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        configuration.userContentController.addUserScript(script)
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "exportJSON")
        web = WKWebView(frame: .zero, configuration: configuration)
        web.isOpaque = false; web.backgroundColor = view.backgroundColor
        web.scrollView.backgroundColor = view.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = self; web.uiDelegate = self
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([web.leadingAnchor.constraint(equalTo: view.leadingAnchor), web.trailingAnchor.constraint(equalTo: view.trailingAnchor), web.topAnchor.constraint(equalTo: view.topAnchor), web.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
        do {
            let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            store = try NativeStore(url: support.appendingPathComponent("MedicalMysteries/progress.sqlite3"))
        } catch { store = nil } // The bridge reports failure; never silently creates empty substitute saves.
        web.load(URLRequest(url: home))
    }
    private func trusted(_ frame: WKFrameInfo) -> Bool {
        frame.isMainFrame && frame.request.url?.scheme == home.scheme && frame.request.url?.host == home.host
    }
    private func openReference(_ url: URL) {
        guard ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host != nil else { return }
        // Opens the user's selected browser; the game remains on its own screen.
        UIApplication.shared.open(url)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == home.scheme && url.host == home.host {
            if webView !== web {
                if url.path == "/index.html" || url.path == "/" {
                    dismiss(animated: true); decisionHandler(.cancel); return
                }
                guard url.path == "/FORGE-LICENSING.html" else { decisionHandler(.cancel); return }
            }
            decisionHandler(.allow)
        } else {
            if action.navigationType == .linkActivated { openReference(url) }
            decisionHandler(.cancel)
        }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard action.navigationType == .linkActivated, let url = action.request.url else { return nil }
        if url.scheme == home.scheme && url.host == home.host {
            guard webView === web, url.path == "/FORGE-LICENSING.html" else { return nil }
            // Bundled license pages remain local and have a native Done button.
            let viewer = UIViewController()
            let config = WKWebViewConfiguration()
            config.setURLSchemeHandler(BundledGame(root: Bundle.main.url(forResource: "Game", withExtension: nil)!), forURLScheme: "forge")
            let local = WKWebView(frame: .zero, configuration: config)
            local.navigationDelegate = self; local.uiDelegate = nil
            viewer.view = local
            viewer.navigationItem.rightBarButtonItem = UIBarButtonItem(systemItem: .done, primaryAction: UIAction { [weak self] _ in self?.dismiss(animated: true) })
            local.load(URLRequest(url: url))
            let navigation = UINavigationController(rootViewController: viewer); navigation.overrideUserInterfaceStyle = .dark
            present(navigation, animated: true)
        } else { openReference(url) }
        return nil
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        guard webView === web, prompt == "__MM_STORAGE_V1__", trusted(frame), let payload = defaultText else { completionHandler(nil); return }
        completionHandler(store?.reply(to: payload) ?? "{\"ok\":false,\"name\":\"InvalidStateError\",\"error\":\"Device storage is unavailable.\"}")
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard presentedViewController == nil else { completionHandler(); return }
        let alert = UIAlertController(title: "Medical Mysteries", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard presentedViewController == nil else { completionHandler(false); return }
        let alert = UIAlertController(title: "Medical Mysteries", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in completionHandler(true) }); present(alert, animated: true)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard trusted(message.frameInfo), !sharing, presentedViewController == nil, let body = message.body as? [String: Any],
              let filename = body["filename"] as? String, filename.range(of: "^[a-zA-Z0-9_-]{1,120}\\.json$", options: .regularExpression) != nil else { replyHandler(nil, "Export unavailable"); return }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let file = directory.appendingPathComponent(filename)
            if body["backup"] as? Bool == true {
                guard ["medical-mysteries-story-history.json", "medical-mysteries-learning-journal.json"].contains(filename), let store else { throw NativeStore.Failure.unavailable }
                try store.exportBackup(to: file)
                try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: file.path)
            } else {
                guard let text = body["text"] as? String, text.utf8.count <= 4 * 1024 * 1024, let data = text.data(using: .utf8) else { throw NativeStore.Failure.invalidRequest }
                try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            }
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = web
            sheet.popoverPresentationController?.sourceRect = CGRect(x: web.bounds.midX, y: web.bounds.midY, width: 1, height: 1)
            sharing = true
            sheet.completionWithItemsHandler = { [weak self] _, completed, _, error in
                self?.sharing = false; try? FileManager.default.removeItem(at: directory)
                if error != nil { replyHandler(nil, "Export unavailable") } else { replyHandler(["completed": completed], nil) }
            }
            present(sheet, animated: true)
        } catch { try? FileManager.default.removeItem(at: directory); replyHandler(nil, "Export unavailable") }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}
