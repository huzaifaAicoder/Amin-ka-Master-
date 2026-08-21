import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("isolated preview feedback enhancements", () => {
  it("shows loading feedback for managed and provider-hosted Reels without changing feed paging", () => {
    const shorts = read("app/(tabs)/shorts.tsx");
    const player = read("components/external-media-player.tsx");
    expect(shorts).toContain('useEvent(player, "statusChange"');
    expect(shorts).toContain("Buffering Short…");
    expect(shorts).toContain('status === "error"');
    expect(shorts).toContain("Retry Short playback");
    expect(shorts).toContain("player.replaceAsync(item.videoUrl)");
    expect(shorts).toContain("pagingEnabled");
    expect(player).toContain("ProviderLoadingOverlay");
    expect(player).toContain("onLoadEnd={() => setLoading(false)}");
  });

  it("preserves the existing accessible typing feedback and clear-history control instead of duplicating chat state", () => {
    const ai = read("app/ask-ai.tsx");
    expect(ai).toContain("GEMINI IS THINKING");
    expect(ai).toContain('accessibilityRole="progressbar"');
    expect(ai).toContain("Clear Doubt Solver conversation");
    expect(ai).toContain("onPress={() => setMessages([])}");
  });
});
