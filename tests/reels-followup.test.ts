import { describe, expect, it } from "vitest";
import { inferReelsSubject, formatOfflineSize, REELS_SUBJECTS } from "../lib/reels-catalogue";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const shortsSource = readFileSync(resolve(process.cwd(), "app/(tabs)/shorts.tsx"), "utf8");
const hubSource = readFileSync(resolve(process.cwd(), "app/reels-hub.tsx"), "utf8");

describe("Reels follow-up improvements", () => {
  it("keeps a bounded subject catalogue and infers learning categories locally", () => {
    expect(REELS_SUBJECTS).toContain("All");
    expect(inferReelsSubject("GPS plot area", "Survey perimeter practice")).toBe("Surveying");
    expect(inferReelsSubject("Bhulekh Khatauni", "Land record revision")).toBe("Land Records");
    expect(inferReelsSubject("Unknown quick tip", null)).toBe("General");
  });

  it("renders subject filtering without replacing the existing feed dataset", () => {
    expect(shortsSource).toContain("SUBJECT_FILTERS.map");
    expect(shortsSource).toContain("filteredItems");
    expect(shortsSource).toContain("inferReelsSubject(item.title, item.description)");
    expect(shortsSource).toContain("pagingEnabled");
  });

  it("keeps Reels Hub sorting and truthful private storage indicators local", () => {
    expect(hubSource).toContain("sortMode");
    expect(hubSource).toContain("sortedShorts");
    expect(hubSource).toContain("sortedOffline");
    expect(hubSource).toContain("Private storage:");
    expect(hubSource).toContain("protected-resources");
  });

  it("formats storage sizes without fabricating unavailable storage quotas", () => {
    expect(formatOfflineSize(0)).toBe("0 B");
    expect(formatOfflineSize(1024 * 1024)).toBe("1.0 MB");
  });
});
