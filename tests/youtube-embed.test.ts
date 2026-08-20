import { describe, expect, it } from "vitest";
import { getYouTubeEmbedUrl, getYouTubeVideoId } from "../lib/youtube";

describe("central YouTube URL parsing", () => {
  const id = "aB3_dE-4567";
  it.each([
    `https://www.youtube.com/shorts/${id}`,
    `https://youtu.be/${id}`,
    `https://www.youtube.com/watch?v=${id}`,
  ])("extracts a valid video id from %s", (url) => {
    expect(getYouTubeVideoId(url)).toBe(id);
    expect(getYouTubeEmbedUrl(url)).toContain(`/embed/${id}`);
  });

  it("rejects malformed and non-YouTube URLs", () => {
    expect(getYouTubeVideoId("https://example.com/watch?v=abc1234")).toBeNull();
    expect(getYouTubeEmbedUrl("not a url")).toBeNull();
  });
});
