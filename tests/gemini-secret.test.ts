import { describe, expect, it } from "vitest";

describe("Gemini credential boundary", () => {
  it("accepts the configured server-only Gemini key", async () => {
    const key = process.env.GEMINI_API_KEY?.trim();
    expect(key, "GEMINI_API_KEY must be configured for this validation").toBeTruthy();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key!)}`);
    expect(response.status, await response.text()).toBe(200);
  }, 20_000);
});
