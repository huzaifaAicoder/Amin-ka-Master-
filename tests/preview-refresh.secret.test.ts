import { describe, expect, it } from "vitest";

describe("preview refresh marker", () => {
  it("can call the lightweight API health endpoint with the configured marker", async () => {
    expect(process.env.PREVIEW_REFRESH_MARKER).toBe("completed");
    const response = await fetch("http://127.0.0.1:3000/api/health", {
      headers: { "x-preview-refresh-marker": process.env.PREVIEW_REFRESH_MARKER ?? "" },
    });
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});
