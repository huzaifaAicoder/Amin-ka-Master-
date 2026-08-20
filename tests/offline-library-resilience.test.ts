import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Protected offline library resilience", () => {
  const helper = readFileSync("lib/offline-resources.ts", "utf8");
  const course = readFileSync("app/course/[slug].tsx", "utf8");
  const downloads = readFileSync("app/(tabs)/downloads.tsx", "utf8");

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
});
