import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Reels performance and Student Hub preservation", () => {
  it("keeps active-only playback and bounded paging while retaining refresh and social actions", () => {
    const shorts = read("app/(tabs)/shorts.tsx");
    expect(shorts).toContain("pagingEnabled");
    expect(shorts).toContain('snapToAlignment="start"');
    expect(shorts).toContain('decelerationRate="fast"');
    expect(shorts).toContain("getItemLayout");
    expect(shorts).toContain("windowSize={3}");
    expect(shorts).toContain("updateCellsBatchingPeriod={50}");
    expect(shorts).toContain("if (active) { player.play();");
    expect(shorts).toContain("player.pause();");
    for (const action of ["Like", "Comment", "Share", "Save", "Download"]) expect(shorts).toContain(action);
    expect(shorts).toContain("RefreshControl");
  });

  it("loads external thumbnails before active embed mounting and preserves graceful fallback", () => {
    const shorts = read("app/(tabs)/shorts.tsx");
    expect(shorts).toContain("getYouTubeThumbnailUrl");
    expect(shorts).toContain("!active && thumbnailUrl");
    expect(shorts).toContain("active && !embedFailed");
    expect(shorts).toContain("playback is unavailable");
    expect(shorts).toContain("Share link");
  });

  it("keeps Short downloads managed-only and routes through authorized signed storage", () => {
    const shorts = read("app/(tabs)/shorts.tsx");
    const router = read("server/routers.ts");
    const db = read("server/db.ts");
    expect(shorts).toContain('item.sourceType !== "managed"');
    expect(shorts).toContain("requestShortDownload");
    expect(shorts).toContain("downloadAuthorizedOfflineResource");
    expect(router).toContain("requestShortDownload");
    expect(router).toContain("External media cannot be downloaded directly.");
    expect(db).toContain("getAuthorizedShortDownload");
    expect(db).toContain('short.sourceType !== "managed"');
  });

  it("uses server-persisted liked and saved history plus private offline viewers in the Hub", () => {
    const hub = read("app/reels-hub.tsx");
    const router = read("server/routers.ts");
    expect(router).toContain("likedShorts");
    expect(hub).toContain("trpc.student.likedShorts");
    expect(hub).toContain("trpc.student.savedShorts");
    for (const tab of ["Liked", "Saved", "Offline"]) expect(hub).toContain(tab);
    expect(hub).toContain("protected-resources/");
    expect(hub).toContain("/offline-media");
    expect(hub).toContain("/pdf-reader");
  });

  it("keeps the Hub discoverable without removing the existing Saved Shorts route", () => {
    const account = read("app/(tabs)/account.tsx");
    expect(account).toContain('label="Reels Hub"');
    expect(account).toContain('label="Saved Shorts"');
    expect(account).toContain('router.push("/reels-hub"');
    expect(account).toContain('router.push("/saved-shorts"');
  });
});
