import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("isolated navigation, keyboard, and YouTube playback repairs", () => {
  it("uses a safe entry-route fallback when Developer login has no navigation history", () => {
    const portal = read("app/dev-portal.tsx");
    expect(portal).toContain("router.canGoBack()");
    expect(portal).toContain('router.replace("/")');
    expect(portal).toContain("onPress={returnToEntry}");
  });

  it("keeps the AI chat composer inside a full-height keyboard-aware shell and enables Android resize", () => {
    const ai = read("app/ask-ai.tsx");
    const config = read("app.config.ts");
    expect(ai).toContain('behavior={Platform.OS === "ios" ? "padding" : "height"}');
    expect(ai).toContain("style={styles.keyboardAvoider}");
    expect(ai).toContain("chatShell: { flex: 1, minHeight: 0 }");
    expect(config).toContain('softwareKeyboardLayoutMode: "resize"');
  });

  it("normalizes YouTube Shorts through the canonical embed URL and enables WebView script, storage, and provider headers", () => {
    const player = read("components/external-media-player.tsx");
    const youtube = read("lib/youtube.ts");
    expect(player).toContain("getYouTubeEmbedUrl(url)");
    expect(player).toContain("javaScriptEnabled");
    expect(player).toContain("javaScriptCanOpenWindowsAutomatically");
    expect(player).toContain('Referer: "https://www.youtube.com/"');
    expect(youtube).toContain("enablejsapi=1");
    expect(youtube).toContain("origin=https%3A%2F%2Fwww.youtube.com");
  });
});
