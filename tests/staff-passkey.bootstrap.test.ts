import { describe, expect, it } from "vitest";

import { isStaffPasskeyBootstrapConfigured, verifyStaffPasskeyBootstrap } from "../server/staff-passkey";

describe("staff passkey bootstrap secret", () => {
  it("recognizes the securely configured bootstrap passkey only on the server", () => {
    const configuredSecret = process.env.STAFF_PASSKEY_BOOTSTRAP;
    expect(isStaffPasskeyBootstrapConfigured()).toBe(true);
    expect(verifyStaffPasskeyBootstrap(configuredSecret ?? "")).toBe(true);
    expect(verifyStaffPasskeyBootstrap("not-the-configured-passkey")).toBe(false);
  });
});
