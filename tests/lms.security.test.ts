import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { hashPassword, verifyPassword } from "../server/db";

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

describe("LMS security boundaries", () => {
  it("stores a password as a salted one-way hash and validates only the correct value", () => {
    const hash = hashPassword("AminMaster!2026");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(hash).not.toContain("AminMaster!2026");
    expect(verifyPassword("AminMaster!2026", hash)).toBe(true);
    expect(verifyPassword("incorrect-password", hash)).toBe(false);
  });

  it("rejects protected learning requests without an authenticated server session", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.student.learning()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a student attempting to enter the operations dashboard", async () => {
    const caller = appRouter.createCaller(createContext(student));
    await expect(caller.operations.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
