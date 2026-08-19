import { describe, expect, it } from "vitest";

import { optionalMediaUrl } from "../server/routers";

describe("managed media URL validation", () => {
  it("accepts signed external media and server-managed upload paths", () => {
    expect(optionalMediaUrl.safeParse("https://cdn.example.com/lecture.mp4").success).toBe(true);
    expect(optionalMediaUrl.safeParse("/manus-storage/learning-media/2/video_lecture.mp4").success).toBe(true);
  });

  it("rejects malformed and non-HTTP external media references", () => {
    expect(optionalMediaUrl.safeParse("not-a-url").success).toBe(false);
    expect(optionalMediaUrl.safeParse("file:///private/lecture.mp4").success).toBe(false);
  });
});
