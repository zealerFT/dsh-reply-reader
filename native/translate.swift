import AppKit
import Darwin
import Foundation
import NaturalLanguage
import SwiftUI
import Translation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data(("DSH:" + message).utf8))
    exit(1)
}

func finish(_ text: String) -> Never {
    FileHandle.standardOutput.write(Data(text.utf8))
    exit(0)
}

@MainActor
struct TranslationView: View {
    let text: String
    let source: Locale.Language
    let target: Locale.Language

    var body: some View {
        ProgressView("正在使用系统翻译…")
            .padding(24)
            .translationTask(source: source, target: target) { session in
                do {
                    finish(try await session.translate(text).targetText)
                } catch {
                    fail("系统翻译未完成。请检查已下载语言，或在「翻译与朗读」设置中改用 API。")
                }
            }
    }
}

@main
struct Translate {
    @MainActor static func main() async {
        let data = FileHandle.standardInput.readDataToEndOfFile()
        guard let text = String(data: data, encoding: .utf8), !text.isEmpty,
              let detected = NLLanguageRecognizer.dominantLanguage(for: text) else { fail("无法识别这段文字的语言。") }
        let source = Locale.Language(identifier: detected.rawValue)
        let choice = CommandLine.arguments.dropFirst().first ?? "auto"
        let target = Locale.Language(identifier: choice == "auto" ? (source.languageCode == "zh" ? "en" : "zh-Hans") : choice)
        if source.isEquivalent(to: target) { finish(text) }
        let status = await LanguageAvailability().status(from: source, to: target)
        guard status == .installed else {
            fail(status == .supported ? "请先在 macOS「系统设置 → 通用 → 语言与地区 → 翻译语言」下载源语言和目标语言，或改用 API。" : "系统翻译不支持这组语言，请更改目标语言或改用 API。")
        }
        if #available(macOS 26, *) {
            do { finish(try await TranslationSession(installedSource: source, target: target).translate(text).targetText) }
            catch { fail("系统翻译失败，请检查已下载的语言或改用 API。") }
        }
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let window = NSWindow(contentViewController: NSHostingController(rootView: TranslationView(text: text, source: source, target: target)))
        window.title = "DSH 翻译"
        window.center()
        window.orderFrontRegardless()
        app.run()
    }
}
