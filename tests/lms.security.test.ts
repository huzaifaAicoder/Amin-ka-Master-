import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { getOtpVerificationState, hashPassword, OTP_MAX_ATTEMPTS, resetPasswordWithToken, verifyPassword } from "../server/db";

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    sessionId: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

const student = {
  id: 901,
  openId: "security-test-student",
  fullName: "Security Test Student",
  email: "security-test@example.com",
  mobile: null,
  passwordHash: null,
  loginMethod: "password",
  role: "student" as const,
  status: "active" as const,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const admin = { ...student, id: 902, openId: "security-test-admin", email: "admin-security@example.com", role: "admin" as const };

describe("LMS security boundaries", () => {
  it("stores a password as a salted one-way hash and validates only the correct value", () => {
    const hash = hashPassword("AminMaster!2026");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(hash).not.toContain("AminMaster!2026");
    expect(verifyPassword("AminMaster!2026", hash)).toBe(true);
    expect(verifyPassword("incorrect-password", hash)).toBe(false);
  });

  it("rejects expired and already-consumed OTP challenges", () => {
    const now = new Date("2026-08-19T00:00:00.000Z");
    expect(getOtpVerificationState({ expiresAt: new Date(now.getTime() - 1), consumedAt: null, attemptCount: 0, codeMatches: true, now })).toBe("expired_or_invalid");
    expect(getOtpVerificationState({ expiresAt: new Date(now.getTime() + 60_000), consumedAt: now, attemptCount: 0, codeMatches: true, now })).toBe("expired_or_invalid");
  });

  it("blocks OTP brute-force attempts at the configured limit", () => {
    const now = new Date("2026-08-19T00:00:00.000Z");
    expect(getOtpVerificationState({ expiresAt: new Date(now.getTime() + 60_000), consumedAt: null, attemptCount: OTP_MAX_ATTEMPTS - 1, codeMatches: false, now })).toBe("attempt_limit");
    expect(getOtpVerificationState({ expiresAt: new Date(now.getTime() + 60_000), consumedAt: null, attemptCount: OTP_MAX_ATTEMPTS, codeMatches: true, now })).toBe("attempt_limit");
  });

  it("permits only an active OTP with the exact code", () => {
    const now = new Date("2026-08-19T00:00:00.000Z");
    expect(getOtpVerificationState({ expiresAt: new Date(now.getTime() + 60_000), consumedAt: null, attemptCount: 0, codeMatches: false, now })).toBe("invalid");
    expect(getOtpVerificationState({ expiresAt: new Date(now.getTime() + 60_000), consumedAt: null, attemptCount: 0, codeMatches: true, now })).toBe("verified");
  });

  it("does not reset a password without a valid one-time recovery token", async () => {
    await expect(resetPasswordWithToken("invalid-recovery-token", "AminMaster!2026")).resolves.toEqual({ status: "invalid_or_expired" });
  });

  it("rejects protected learning requests without an authenticated server session", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.student.learning()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a student attempting to enter the operations dashboard", async () => {
    const caller = appRouter.createCaller(createContext(student));
    await expect(caller.operations.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a student attempting to manage assessments or live classes", async () => {
    const caller = appRouter.createCaller(createContext(student));
    await expect(caller.operations.tests()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.liveClasses()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reserves owner controls for Super Admin and rejects an ordinary Admin", async () => {
    const caller = appRouter.createCaller(createContext(admin));
    await expect(caller.operations.masterSettings()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.auditLogs()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.rotateStaffPasskey({ currentPasskey: "current-passkey", nextPasskey: "a-strong-next-passkey", confirmation: "a-strong-next-passkey" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.createStaffAccount({ fullName: "Unapproved Staff", email: "unapproved@example.com", mobile: "", password: "AminStaff!2026", role: "teacher" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
