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
const teacherWithoutGrant = { ...student, id: 903, openId: "security-test-teacher", email: "teacher-security@example.com", role: "teacher" as const };
const developer = { ...student, id: 904, openId: "security-test-developer", email: "developer-security@example.com", role: "developer" as const };

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
    await expect(caller.student.savedShorts()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.student.toggleShortLike({ shortId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.student.toggleShortSave({ shortId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.student.requestResourceDownload({ resourceId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.student.askAi({ question: "How do I calculate a field area?" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("does not let staff use the student PDF-download endpoint", async () => {
    const caller = appRouter.createCaller(createContext(admin));
    await expect(caller.student.requestResourceDownload({ resourceId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps Short comments and student submissions inside the student learning role", async () => {
    const staffCaller = appRouter.createCaller(createContext(admin));
    await expect(staffCaller.student.shortComments({ shortId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staffCaller.student.addShortComment({ shortId: 1, body: "Helpful explanation" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staffCaller.student.submitShort({ title: "My field tip", contentUrl: "/manus-storage/fake.mp4", storageKey: "student-short-submissions/902/fake.mp4", provider: "managed_storage", mimeType: "video/mp4", durationSeconds: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("isolates private Developer procedures from Student, Admin, and Operations access", async () => {
    const studentCaller = appRouter.createCaller(createContext(student));
    const adminCaller = appRouter.createCaller(createContext(admin));
    const developerCaller = appRouter.createCaller(createContext(developer));
    await expect(studentCaller.developer.integrationStatus()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(adminCaller.developer.settings()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(developerCaller.operations.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(developerCaller.developer.integrationStatus()).resolves.toEqual(expect.objectContaining({ developerPortalPasskeyConfigured: expect.any(Boolean), geminiConfigured: expect.any(Boolean), razorpayConfigured: expect.any(Boolean) }));
  });

  it("limits the AI placeholder to students and returns a provider-safe response", async () => {
    const staffCaller = appRouter.createCaller(createContext(admin));
    const studentCaller = appRouter.createCaller(createContext(student));
    await expect(staffCaller.student.askAi({ question: "Explain chain surveying" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(studentCaller.student.askAi({ question: "Explain chain surveying" })).resolves.toEqual(expect.objectContaining({ mode: "placeholder", answer: expect.stringContaining("AI is thinking") }));
  });

  it("rejects initial Super Admin setup without the private owner code", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.auth.claimInitialOwner({ fullName: "Unapproved Owner", email: "owner-claim-test@example.com", mobile: "", password: "AminOwner!2026", staffPasskey: "AminStaffPasskey!2026", staffPasskeyConfirmation: "AminStaffPasskey!2026", ownerSetupCode: "incorrect-owner-code" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects Staff/Admin account creation without the current Staff Passkey", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.auth.registerStaff({ fullName: "Unapproved Staff", email: "staff-passkey-test@example.com", mobile: "", password: "AminStaff!2026", staffPasskey: "incorrect-staff-passkey" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects owner sign-in without the Private Owner Setup Code", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.auth.ownerLogin({ email: "owner-login-test@example.com", password: "AminOwner!2026", ownerSetupCode: "incorrect-owner-code" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a student attempting to enter the operations dashboard", async () => {
    const caller = appRouter.createCaller(createContext(student));
    await expect(caller.operations.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a complete numeric Operations summary for an authorized Admin", async () => {
    const caller = appRouter.createCaller(createContext(admin));
    await expect(caller.operations.summary()).resolves.toEqual(expect.objectContaining({
      students: expect.any(Number),
      courses: expect.any(Number),
      enrollments: expect.any(Number),
      upcomingLiveClasses: expect.any(Number),
    }));
  });

  it("accepts numeric course prices and persists an explicitly selected course status", async () => {
    const caller = appRouter.createCaller(createContext(admin));
    const managedCourses = await caller.operations.courses();
    expect(managedCourses.length).toBeGreaterThan(0);
    const course = managedCourses[0].course;
    await expect(caller.operations.updateCourse({
      courseId: course.id,
      categoryId: course.categoryId,
      title: course.title,
      slug: course.slug,
      shortDescription: course.shortDescription,
      mrp: Number(course.mrp),
      sellingPrice: Number(course.sellingPrice),
      accessType: course.accessType,
      accessDurationDays: course.accessDurationDays,
      status: course.status,
    })).resolves.toEqual({ success: true });
  });

  it("reserves PDF download-event monitoring for Admin and Super Admin roles", async () => {
    const studentCaller = appRouter.createCaller(createContext(student));
    const teacherCaller = appRouter.createCaller(createContext(teacherWithoutGrant));
    const adminCaller = appRouter.createCaller(createContext(admin));
    await expect(studentCaller.operations.resourceDownloadEvents()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(teacherCaller.operations.resourceDownloadEvents()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const result = await adminCaller.operations.resourceDownloadEvents();
    expect(result.events).toEqual(expect.any(Array));
    expect(result.nextCursor === null || typeof result.nextCursor === "number").toBe(true);
  });

  it("reserves pending Short moderation for Admin and Super Admin roles", async () => {
    const studentCaller = appRouter.createCaller(createContext(student));
    const teacherCaller = appRouter.createCaller(createContext(teacherWithoutGrant));
    const adminCaller = appRouter.createCaller(createContext(admin));
    await expect(studentCaller.operations.pendingShorts()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(teacherCaller.operations.pendingShorts()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(adminCaller.operations.pendingShorts()).resolves.toEqual(expect.any(Array));
  });

  it("rejects an untrusted external Short source before media persistence", async () => {
    const caller = appRouter.createCaller(createContext(admin));
    await expect(caller.operations.saveShort({ title: "Blocked source", description: "Unsafe URL should be rejected", sourceType: "youtube", contentUrl: "https://example.invalid/not-youtube", durationSeconds: 0, status: "draft", displayOrder: 0 })).rejects.toBeDefined();
  });

  it("rejects a student attempting to manage assessments or live classes", async () => {
    const caller = appRouter.createCaller(createContext(student));
    await expect(caller.operations.tests()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.liveClasses()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires explicit Teacher grants for course and media operations", async () => {
    const caller = appRouter.createCaller(createContext(teacherWithoutGrant));
    await expect(caller.operations.courses()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.freePlaylists()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reserves owner controls for Super Admin and rejects an ordinary Admin", async () => {
    const caller = appRouter.createCaller(createContext(admin));
    await expect(caller.operations.masterSettings()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.auditLogs()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.rotateStaffPasskey({ currentPasskey: "current-passkey", nextPasskey: "a-strong-next-passkey", confirmation: "a-strong-next-passkey" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.createStaffAccount({ fullName: "Unapproved Staff", email: "unapproved@example.com", mobile: "", password: "AminStaff!2026", role: "teacher" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.setTeacherPermission({ userId: 903, permission: "courses.manage", granted: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
