import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Protected offline library resilience", () => {
  const helper = readFileSync("lib/offline-resources.ts", "utf8");
  const course = readFileSync("app/course/[slug].tsx", "utf8");
  const downloads = readFileSync("app/(tabs)/downloads.tsx", "utf8");
  const savedShorts = readFileSync("app/saved-shorts.tsx", "utf8");
  const mediaStudio = readFileSync("app/operations/media.tsx", "utf8");
  const structure = readFileSync("app/operations/structure.tsx", "utf8");
  const picker = readFileSync("lib/media-picker.ts", "utf8");

  it("uses one completion-only private-storage downloader and cleans up incomplete temporary files", () => {
    expect(helper).toContain(".pending-");
    expect(helper).toContain("FileSystem.moveAsync");
    expect(helper).toContain("FileSystem.deleteAsync(pendingUri");
    expect(course).toContain("downloadAuthorizedOfflineResource");
    expect(course).not.toContain("FileSystem.downloadAsync");
  });

  it("keeps failed records local and retries only after a fresh server-authorized URL is issued", () => {
    expect(helper).toContain("amin-offline.failed-downloads.v1");
    expect(helper).toContain("resourceId");
    expect(helper).not.toContain("signedUrl: string; message");
    expect(downloads).toContain("requestResourceDownload.useMutation");
    expect(downloads).toContain("Retry download");
    expect(downloads).toContain("clearOfflineDownloadFailure");
  });

  it("filters completed and failed titles locally without a network search", () => {
    expect(downloads).toContain("matchesOfflineSearch");
    expect(downloads).toContain("Search downloaded files");
    expect(downloads).not.toContain("catalog.search");
  });

  it("lets a managed Saved Short promote into the same completion-only private file cache", () => {
    expect(helper).toContain("amin-offline.media-index.v1");
    expect(helper).toContain("loadOfflineMediaIndex");
    expect(helper).toContain("identity?: Pick<OfflineMediaEntry");
    expect(savedShorts).toContain("requestShortDownload.useMutation");
    expect(savedShorts).toContain('source: "reel"');
    expect(savedShorts).toContain("offlineUri ?? item.videoUrl");
    expect(savedShorts).toContain("External media");
  });

  it("offers Gallery for videos and Files/Drive for videos or PDF documents in both staff media workflows", () => {
    expect(picker).toContain("launchImageLibraryAsync");
    expect(picker).toContain("getDocumentAsync");
    for (const screen of [mediaStudio, structure]) {
      expect(screen).toContain("pickVideoFromGallery");
      expect(screen).toContain("pickMediaFromFiles");
      expect(screen).toContain("Files / Drive");
    }
  });
});
