import { describe, expect, it } from "vitest";

import { isDeveloperPortalConfigured, verifyDeveloperPortalPasskey } from "../server/developer-portal";

describe("Developer Portal Passkey configuration", () => {
  it("is configured and accepted only by the server-side verifier", () => {
    const configured = process.env.DEVELOPER_PORTAL_PASSKEY?.trim() ?? "";
    expect(configured.length).toBeGreaterThanOrEqual(16);
    expect(isDeveloperPortalConfigured()).toBe(true);
    expect(verifyDeveloperPortalPasskey(configured)).toBe(true);
    expect(verifyDeveloperPortalPasskey(`${configured}-incorrect`)).toBe(false);
  });
});
