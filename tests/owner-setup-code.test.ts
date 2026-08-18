import { describe, expect, it } from "vitest";

import { isOwnerSetupConfigured, verifyOwnerSetupCode } from "../server/owner-setup";

describe("owner setup code", () => {
  it("recognizes only the securely configured one-time owner setup code on the server", () => {
    const configuredCode = process.env.OWNER_SETUP_CODE;
    expect(isOwnerSetupConfigured()).toBe(true);
    expect(verifyOwnerSetupCode(configuredCode ?? "")).toBe(true);
    expect(verifyOwnerSetupCode("incorrect-owner-setup-code")).toBe(false);
  });
});
