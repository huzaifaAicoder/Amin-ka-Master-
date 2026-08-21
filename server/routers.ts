import { GoogleGenerativeAI } from "@google/generative-ai";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { isDeveloperPortalConfigured, verifyDeveloperPortalPasskey } from "./developer-portal";
import { deliverPasswordResetOtp, isOtpDeliveryConfigured } from "./otp-delivery";
import { verifyOwnerSetupCode } from "./owner-setup";
import { verifyStaffPasskeyBootstrap } from "./staff-passkey";
import { ownerProcedure, protectedProcedure, publicProcedure, requireRoles, router, studentProcedure } from "./_core/trpc";
import * as db from "./db";

const mobileSchema = z.string().trim().regex(/^\+?[0-9][0-9\-\s]{7,20}$/, "Enter a valid mobile number");
const credentialSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(160),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  mobile: mobileSchema.optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
}).superRefine((value, ctx) => {
  if (!value.email && !value.mobile) {
    ctx.addIssue({ code: "custom", message: "Provide an email address or mobile number", path: ["email"] });
  }
});
const passwordResetIdentitySchema = z.object({ identity: z.string().trim().min(3).max(320) });
const verifyOtpSchema = passwordResetIdentitySchema.extend({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });
const resetPasswordSchema = z.object({
  resetToken: z.string().min(32).max(256),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
const aiQuizQuestionSchema = z.object({
  question: z.string().trim().min(8).max(600),
  options: z.array(z.string().trim().min(1).max(300)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(8).max(900),
});
const aiQuizResponseSchema = z.object({ questions: z.array(aiQuizQuestionSchema).min(2).max(10) });
const aiQuizReviewSubmissionSchema = z.object({ topic: z.string().trim().min(2).max(160), difficulty: z.enum(["beginner", "intermediate", "advanced"]), language: z.enum(["English", "Hindi-English"]), questions: z.array(aiQuizQuestionSchema).min(2).max(10) });
const ownerSetupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(160),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  mobile: mobileSchema.optional().or(z.literal("")),
  password: z.string().min(12, "Use a password of at least 12 characters").max(128),
  staffPasskey: z.string().min(12, "Use a Staff Passkey of at least 12 characters").max(256),
  staffPasskeyConfirmation: z.string().min(12).max(256),
  ownerSetupCode: z.string().min(1).max(256),
}).superRefine((value, ctx) => {
  if (!value.email && !value.mobile) ctx.addIssue({ code: "custom", message: "Provide an email address or mobile number", path: ["email"] });
  if (value.staffPasskey !== value.staffPasskeyConfirmation) ctx.addIssue({ code: "custom", message: "The Staff Passkey confirmation does not match", path: ["staffPasskeyConfirmation"] });
});
const staffRegistrationSchema = credentialSchema.safeExtend({
  staffPasskey: z.string().min(1, "A Staff Passkey is required").max(256),
});
const ownerLoginSchema = z.object({
  email: z.string().trim().email("Enter the owner email address").max(320),
  password: z.string().min(1, "Enter your password").max(128),
  ownerSetupCode: z.string().min(1, "The Private Owner Passkey/Code is required").max(256),
});
const developerSetupSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(128),
  developerPasskey: z.string().min(12).max(256),
});
const developerLoginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
  developerPasskey: z.string().min(1).max(256),
});

function authTelemetryStatus(error: unknown) {
  if (!(error instanceof TRPCError)) return 500;
  if (error.code === "UNAUTHORIZED") return 401;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "BAD_REQUEST") return 400;
  if (error.code === "CONFLICT") return 409;
  return 500;
}

/** Records only one fixed `auth` hourly aggregate after Staff/Student or Developer authentication completes. It deliberately excludes identity, portal, passkey, password, route, message, and all request input. */
async function measureAuthenticationLatency<T>(action: () => Promise<T>) {
  const startedAt = Date.now();
  let statusCode = 200;
  try { return await action(); }
  catch (error) { statusCode = authTelemetryStatus(error); throw error; }
  finally { void db.recordApiLatencyMeasurement({ routeGroup: "auth", statusCode, durationMs: Date.now() - startedAt }).catch(() => undefined); }
}

const optionalUrl = z.string().trim().url().max(2048).optional().or(z.literal(""));
const moneySchema = z.union([
  z.number().finite().nonnegative(),
  z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
]).transform((value) => typeof value === "number" ? value.toFixed(2) : value);
export const optionalMediaUrl = z.string().trim().max(2048).refine((value) => {
  if (value === "" || value.startsWith("/manus-storage/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}, "Provide an HTTPS/HTTP media URL or a managed upload path").optional().or(z.literal(""));
const mediaReferenceSchema = z.object({
  contentUrl: optionalMediaUrl,
  storageKey: z.string().trim().max(1024).optional().or(z.literal("")),
  provider: z.string().trim().max(64).optional().or(z.literal("")),
  mimeType: z.string().trim().max(160).optional().or(z.literal("")),
  sizeBytes: z.number().int().min(0).max(150 * 1024 * 1024).optional(),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).default(0),
  thumbnailUrl: optionalUrl,
}).superRefine((value, ctx) => {
  if (!value.contentUrl && !value.storageKey) ctx.addIssue({ code: "custom", message: "Upload a file or provide a media URL", path: ["contentUrl"] });
});
const moduleResourceSchema = mediaReferenceSchema.safeExtend({
  resourceId: z.number().int().positive().optional(), moduleId: z.number().int().positive(), title: z.string().trim().min(3).max(220), description: z.string().trim().max(10000).optional(), resourceType: z.enum(["video", "pdf"]), isPublished: z.boolean(), downloadAllowed: z.boolean().default(false), displayOrder: z.number().int().min(0).max(10000),
}).superRefine((value, ctx) => {
});
const freePlaylistSchema = z.object({
  playlistId: z.number().int().positive().optional(), title: z.string().trim().min(3).max(220), description: z.string().trim().max(10000).optional(), thumbnailUrl: optionalUrl, isPublished: z.boolean(), displayOrder: z.number().int().min(0).max(10000),
});
const freePlaylistItemSchema = mediaReferenceSchema.safeExtend({
  itemId: z.number().int().positive().optional(), playlistId: z.number().int().positive(), title: z.string().trim().min(3).max(220), description: z.string().trim().max(10000).optional(), contentType: z.enum(["video", "pdf"]), sourceType: z.enum(["managed", "youtube", "instagram"]).default("managed"), isPublished: z.boolean(), displayOrder: z.number().int().min(0).max(10000),
}).superRefine((value, ctx) => {
  const url = value.contentUrl || "";
  if (value.sourceType === "managed" && !value.storageKey && !url.startsWith("/manus-storage/")) ctx.addIssue({ code: "custom", message: "Managed playlist resources must use a protected uploaded file.", path: ["contentUrl"] });
  if (value.sourceType !== "managed" && value.contentType !== "video") ctx.addIssue({ code: "custom", message: "External links are available only for video resources.", path: ["sourceType"] });
  if (value.sourceType === "youtube" && !/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url)) ctx.addIssue({ code: "custom", message: "Provide a valid YouTube video or Short URL.", path: ["contentUrl"] });
  if (value.sourceType === "instagram" && !/^https:\/\/(?:www\.)?instagram\.com\/(?:reel|p|tv)\//i.test(url)) ctx.addIssue({ code: "custom", message: "Provide a valid Instagram Reel or video URL.", path: ["contentUrl"] });
});
const educationalShortSchema = mediaReferenceSchema.safeExtend({
  shortId: z.number().int().positive().optional(), title: z.string().trim().min(3).max(220), description: z.string().trim().max(1000).optional(), sourceType: z.enum(["managed", "youtube", "instagram"]).default("managed"), status: z.enum(["draft", "published", "archived"]), displayOrder: z.number().int().min(0).max(10000),
}).superRefine((value, ctx) => {
  const url = value.contentUrl || "";
  if (value.sourceType === "managed" && !value.storageKey && !url.startsWith("/manus-storage/")) ctx.addIssue({ code: "custom", message: "Managed Shorts must use a protected uploaded video.", path: ["contentUrl"] });
  if (value.sourceType === "youtube" && !/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url)) ctx.addIssue({ code: "custom", message: "Provide a valid YouTube video or Short URL.", path: ["contentUrl"] });
  if (value.sourceType === "instagram" && !/^https:\/\/(?:www\.)?instagram\.com\/reel\//i.test(url)) ctx.addIssue({ code: "custom", message: "Provide a valid public Instagram Reel URL.", path: ["contentUrl"] });
  if (value.sourceType !== "managed" && value.storageKey) ctx.addIssue({ code: "custom", message: "External Short links cannot include a managed storage key.", path: ["storageKey"] });
});
const testDetailsSchema = z.object({
  courseId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(3).max(220),
  description: z.string().trim().max(10000).optional(),
  durationMinutes: z.number().int().min(1).max(720),
  passingMarks: z.number().int().min(0).max(10000),
});
const liveClassDetailsSchema = z.object({
  courseId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(3).max(220),
  description: z.string().trim().max(10000).optional(),
  startsAt: z.date(),
  endsAt: z.date().nullable().optional(),
  meetingUrl: optionalUrl,
  recordingUrl: optionalUrl,
}).superRefine((value, ctx) => {
  if (value.endsAt && value.endsAt <= value.startsAt) {
    ctx.addIssue({ code: "custom", message: "Class end time must be after start time", path: ["endsAt"] });
  }
});

function safeUser(user: NonNullable<Awaited<ReturnType<typeof db.getUserByOpenId>>>) {
  return {
    id: user.id,
    openId: user.openId,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    loginMethod: user.loginMethod,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

function requireStaffAccess(role: "developer" | "student" | "teacher" | "admin" | "super_admin") {
  if (role !== "teacher" && role !== "admin" && role !== "super_admin") throw new TRPCError({ code: "FORBIDDEN", message: "Staff access is required" });
}

function requireStudentAccess(role: "developer" | "student" | "teacher" | "admin" | "super_admin") {
  if (role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "This action is available only in the student learning experience." });
}

async function requireDelegatedPermission(
  user: NonNullable<Awaited<ReturnType<typeof db.getUserByOpenId>>>,
  permission: string,
) {
  requireStaffAccess(user.role);
  if (user.role === "teacher" && !(await db.hasPermission(user, permission))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your account has not been granted this teaching permission" });
  }
}

async function requireContentManagementPermission(user: NonNullable<Awaited<ReturnType<typeof db.getUserByOpenId>>>) {
  await requireAnyDelegatedPermission(user, ["courses.manage", "course_content.manage"]);
}

async function requireAnyDelegatedPermission(
  user: NonNullable<Awaited<ReturnType<typeof db.getUserByOpenId>>>,
  permissions: readonly string[],
) {
  requireStaffAccess(user.role);
  if (user.role === "teacher" && !(await db.hasAnyPermission(user, permissions))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your account has not been granted this teaching permission" });
  }
}

async function requireGrowthSuiteFeature(key: "feature.study_coach_enabled" | "feature.learning_operations_enabled" | "feature.guardian_reports_enabled") {
  const settings = await db.getManagedSettings();
  if (settings[key] === false) throw new TRPCError({ code: "FORBIDDEN", message: "This feature is temporarily unavailable because the Developer has paused it." });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    ownerSetupStatus: publicProcedure.query(async () => ({ available: await db.isInitialOwnerSetupAvailable() })),
    claimInitialOwner: publicProcedure.input(ownerSetupSchema).mutation(async ({ input, ctx }) => {
      if (!verifyOwnerSetupCode(input.ownerSetupCode)) throw new TRPCError({ code: "FORBIDDEN", message: "Initial owner setup is unavailable or the setup code is incorrect." });
      const result = await db.claimInitialOwnerAccount({ fullName: input.fullName, email: input.email || undefined, mobile: input.mobile || undefined, password: input.password, staffPasskey: input.staffPasskey });
      if (result.status === "identity_exists") throw new TRPCError({ code: "CONFLICT", message: "An account already exists for that email or mobile number." });
      if (result.status !== "claimed" || !result.user) throw new TRPCError({ code: "FORBIDDEN", message: "Initial owner setup is unavailable or has already been completed." });
      await db.writeAudit({ actorUserId: result.user.id, action: "owner_setup.claimed", entityType: "user", entityId: result.user.id, metadata: { role: "super_admin" } });
      const session = await db.createSession(result.user.id, ctx.req.headers["user-agent"]);
      return { user: safeUser(result.user), session };
    }),
    registerStaff: publicProcedure.input(staffRegistrationSchema).mutation(async ({ input, ctx }) => {
      if (!(await db.verifyActiveStaffPasskey(input.staffPasskey))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "The Staff Passkey is incorrect or has been rotated." });
      }
      const user = await db.createStaffCredentialUser({
        fullName: input.fullName,
        email: input.email || undefined,
        mobile: input.mobile || undefined,
        password: input.password,
        role: "teacher",
      });
      if (!user) throw new Error("Could not create your staff account");
      await db.writeAudit({ actorUserId: user.id, action: "staff.self_registered", entityType: "user", entityId: user.id, metadata: { role: "teacher", verifiedBy: "staff_passkey" } });
      const session = await db.createSession(user.id, ctx.req.headers["user-agent"]);
      return { user: safeUser(user), session };
    }),
    ownerLogin: publicProcedure.input(ownerLoginSchema).mutation(async ({ input, ctx }) => {
      if (!verifyOwnerSetupCode(input.ownerSetupCode)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "The Private Owner Passkey/Code is incorrect." });
      }
      const user = await db.authenticateCredentialUser(input.email, input.password);
      if (!user || user.role !== "super_admin") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "The owner email or password is incorrect." });
      }
      const session = await db.createSession(user.id, ctx.req.headers["user-agent"]);
      return { user: safeUser(user), session };
    }),
    developerSetupStatus: publicProcedure.query(async () => ({ configured: isDeveloperPortalConfigured(), available: isDeveloperPortalConfigured() && await db.isInitialDeveloperSetupAvailable() })),
    claimInitialDeveloper: publicProcedure.input(developerSetupSchema).mutation(async ({ input, ctx }) => {
      if (!verifyDeveloperPortalPasskey(input.developerPasskey)) throw new TRPCError({ code: "FORBIDDEN", message: "Developer setup is unavailable or the Developer Passkey is incorrect." });
      const result = await db.createInitialDeveloperCredentialUser({ fullName: input.fullName, email: input.email, password: input.password });
      if (result.status === "identity_exists") throw new TRPCError({ code: "CONFLICT", message: "An account already exists for that email." });
      if (result.status !== "claimed" || !result.user) throw new TRPCError({ code: "FORBIDDEN", message: "Developer setup has already been completed." });
      await db.writeAudit({ actorUserId: result.user.id, action: "developer_setup.claimed", entityType: "user", entityId: result.user.id, metadata: { role: "developer" } });
      const session = await db.createSession(result.user.id, ctx.req.headers["user-agent"]);
      return { user: safeUser(result.user), session };
    }),
    developerLogin: publicProcedure.input(developerLoginSchema).mutation(({ input, ctx }) => measureAuthenticationLatency(async () => {
      if (!verifyDeveloperPortalPasskey(input.developerPasskey)) throw new TRPCError({ code: "UNAUTHORIZED", message: "The Developer Passkey is incorrect." });
      const user = await db.authenticateCredentialUser(input.email, input.password);
      if (!user || user.role !== "developer") throw new TRPCError({ code: "UNAUTHORIZED", message: "The developer email or password is incorrect." });
      const session = await db.createSession(user.id, ctx.req.headers["user-agent"]);
      return { user: safeUser(user), session };
    })),
    register: publicProcedure.input(credentialSchema).mutation(async ({ input, ctx }) => {
      const user = await db.registerCredentialUser({
        fullName: input.fullName,
        email: input.email || undefined,
        mobile: input.mobile || undefined,
        password: input.password,
      });
      if (!user) throw new Error("Could not create your account");
      const session = await db.createSession(user.id, ctx.req.headers["user-agent"]);
      return { user: safeUser(user), session };
    }),
    login: publicProcedure.input(z.object({ identity: z.string().trim().min(3).max(320), password: z.string().min(1).max(128), portal: z.enum(["student", "staff"]), staffPasskey: z.string().min(1).max(256).optional() })).mutation(({ input, ctx }) => measureAuthenticationLatency(async () => {
      const user = await db.authenticateCredentialUser(input.identity, input.password);
      if (!user) throw new Error("Incorrect credentials or inactive account");
      if (input.portal === "student" && user.role !== "student") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This account belongs to the Staff / Admin portal. Please use Staff / Admin Login." });
      }
      if (input.portal === "staff" && user.role === "student") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This account is not authorized for the Staff / Admin portal." });
      }
      if (user.role === "developer") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Developer accounts must use the private Developer Portal." });
      }
      if (user.role === "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner accounts must use the Owner Portal and Private Owner Passkey/Code." });
      }
      if (input.portal === "staff") {
        if (!input.staffPasskey) throw new TRPCError({ code: "UNAUTHORIZED", message: "A valid Staff Passkey is required for Staff / Admin Login." });
        const staffPasskeyValid = await db.verifyActiveStaffPasskey(input.staffPasskey);
        if (!staffPasskeyValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "The Staff Passkey is invalid or has been rotated." });
      }
      const session = await db.createSession(user.id, ctx.req.headers["user-agent"]);
      return { user: safeUser(user), session };
    })),
    requestPasswordReset: publicProcedure.input(passwordResetIdentitySchema).mutation(async ({ input }) => {
      if (!isOtpDeliveryConfigured()) return { accepted: true as const, delivery: "unconfigured" as const };
      const user = await db.getUserByIdentity(input.identity);
      const genericResponse = { accepted: true as const, delivery: "sent" as const };
      if (!user || user.status !== "active" || !user.passwordHash) return genericResponse;

      const destination = user.email ?? user.mobile;
      if (!destination) return genericResponse;
      const challenge = await db.createOtpChallenge({ userId: user.id, purpose: "password_reset", destination });
      if (challenge.status === "rate_limited") return genericResponse;

      const result = await deliverPasswordResetOtp({
        destination,
        code: challenge.code,
        expiresInMinutes: Math.round(db.OTP_CODE_TTL_MS / 60_000),
      });
      if (!result.delivered) {
        await db.consumeOtpChallenge(challenge.challengeId);
        return genericResponse;
      }
      return genericResponse;
    }),
    verifyOtp: publicProcedure.input(verifyOtpSchema).mutation(async ({ input }) => {
      const user = await db.getUserByIdentity(input.identity);
      if (!user || user.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "The recovery code is invalid or has expired" });
      const result = await db.verifyOtpChallenge({ userId: user.id, purpose: "password_reset", code: input.code });
      if (result.status !== "verified") {
        const message = result.status === "attempt_limit"
          ? "Too many incorrect attempts. Request a new recovery code."
          : "The recovery code is invalid or has expired";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
      const reset = await db.createPasswordResetToken(result.challengeId);
      return { resetToken: reset.token, expiresAt: reset.expiresAt };
    }),
    resetPassword: publicProcedure.input(resetPasswordSchema).mutation(async ({ input }) => {
      const result = await db.resetPasswordWithToken(input.resetToken, input.password);
      if (result.status !== "reset") throw new TRPCError({ code: "BAD_REQUEST", message: "This recovery session has expired. Request a new code." });
      return { success: true as const };
    }),
    me: publicProcedure.query((opts) => (opts.ctx.user ? safeUser(opts.ctx.user) : null)),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await db.revokeSession(ctx.sessionId);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    sessions: protectedProcedure.query(({ ctx }) => db.listActiveSessions(ctx.user.id)),
    logoutEverywhere: protectedProcedure.mutation(async ({ ctx }) => {
      await db.revokeAllSessions(ctx.user.id);
      return { success: true } as const;
    }),
  }),
  catalog: router({
    categories: publicProcedure.query(() => db.listPublicCategories()),
    uiSettings: publicProcedure.query(() => db.getManagedSettings()),
    courses: publicProcedure.input(z.object({ search: z.string().max(100).optional(), categorySlug: z.string().max(140).optional() }).optional()).query(({ input }) => db.listPublishedCourses(input?.search, input?.categorySlug)),
    course: publicProcedure.input(z.object({ slug: z.string().min(1).max(240) })).query(async ({ input }) => {
      const result = await db.getPublishedCourseBySlug(input.slug);
      if (!result) throw new Error("Course was not found");
      return result;
    }),
  }),
  student: router({
    featureOverrides: studentProcedure.query(({ ctx }) => db.getStudentFeatureOverrides(ctx.user.id)),
    enrollFree: studentProcedure.input(z.object({ courseId: z.number().int().positive() })).mutation(({ ctx, input }) => db.createFreeEnrollment(ctx.user.id, input.courseId)),
    learning: studentProcedure.query(({ ctx }) => db.listMyLearning(ctx.user.id)),
    certificates: studentProcedure.query(({ ctx }) => db.listMyCertificates(ctx.user.id)),
    certificate: studentProcedure.input(z.object({ certificateId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const certificate = await db.getMyCertificate(ctx.user.id, input.certificateId);
      if (!certificate) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate was not found." });
      return certificate;
    }),
    courseLearning: studentProcedure.input(z.object({ courseId: z.number().int().positive() })).query(({ ctx, input }) => db.getCourseLearning(ctx.user.id, input.courseId)),
    requestResourceDownload: studentProcedure.input(z.object({ resourceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await db.getAuthorizedResourceDownload(ctx.user.id, input.resourceId);
      if (result.status === "not_enrolled") throw new TRPCError({ code: "FORBIDDEN", message: "An active course enrollment is required to download this material." });
      if (result.status !== "authorized") throw new TRPCError({ code: "NOT_FOUND", message: "This approved course resource is unavailable for offline download." });
      return result;
    }),
    requestShortDownload: studentProcedure.input(z.object({ shortId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await db.getAuthorizedShortDownload(ctx.user.id, input.shortId);
      if (result.status === "external") throw new TRPCError({ code: "BAD_REQUEST", message: "External media cannot be downloaded directly." });
      if (result.status !== "authorized") throw new TRPCError({ code: "NOT_FOUND", message: "This managed Short is unavailable for offline download." });
      return result;
    }),
    lesson: studentProcedure.input(z.object({ lessonId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const lesson = await db.getAuthorizedLesson(ctx.user.id, input.lessonId);
      if (!lesson) throw new Error("Lesson was not found");
      return lesson;
    }),
    updateProgress: studentProcedure.input(z.object({ courseId: z.number().int().positive(), lessonId: z.number().int().positive(), watchedSeconds: z.number().int().min(0).max(24 * 60 * 60), completed: z.boolean() })).mutation(async ({ ctx, input }) => {
      const lesson = await db.getAuthorizedLesson(ctx.user.id, input.lessonId);
      if (!lesson?.authorized || lesson.course.id !== input.courseId) throw new Error("You do not have access to this lesson");
      await db.updateLessonProgress(ctx.user.id, input);
      return { success: true } as const;
    }),
    saveNote: studentProcedure.input(z.object({ lessonId: z.number().int().positive(), body: z.string().trim().min(1).max(6000) })).mutation(async ({ ctx, input }) => {
      const lesson = await db.getAuthorizedLesson(ctx.user.id, input.lessonId);
      if (!lesson?.authorized) throw new Error("You do not have access to this lesson");
      await db.savePersonalNote(ctx.user.id, input.lessonId, input.body);
      return { success: true } as const;
    }),
    toggleBookmark: studentProcedure.input(z.object({ lessonId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const lesson = await db.getAuthorizedLesson(ctx.user.id, input.lessonId);
      if (!lesson?.authorized) throw new Error("You do not have access to this lesson");
      return { bookmarked: await db.toggleBookmark(ctx.user.id, input.lessonId) };
    }),
    tests: protectedProcedure.query(({ ctx }) => {
      requireStudentAccess(ctx.user.role);
      return db.listAvailableTests(ctx.user.id);
    }),
    startTest: protectedProcedure.input(z.object({ testId: z.number().int().positive() })).mutation(({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      return db.startTestAttempt(ctx.user.id, input.testId);
    }),
    submitTest: protectedProcedure.input(z.object({ attemptId: z.number().int().positive(), answers: z.array(z.object({ questionId: z.number().int().positive(), selectedOptionIndex: z.number().int().min(0).max(20).nullable() })).max(250) })).mutation(({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      return db.submitTestAttempt(ctx.user.id, input.attemptId, input.answers);
    }),
    testHistory: protectedProcedure.query(({ ctx }) => {
      requireStudentAccess(ctx.user.role);
      return db.listMyTestAttempts(ctx.user.id);
    }),
    testAttemptReview: protectedProcedure.input(z.object({ attemptId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      const review = await db.getMyTestAttemptReview(ctx.user.id, input.attemptId);
      if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "This assessment attempt was not found." });
      return review;
    }),
    notifications: studentProcedure.query(({ ctx }) => db.listMyNotifications(ctx.user.id)),
    markNotificationRead: studentProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.markNotificationRead(ctx.user.id, input.notificationId);
      return { success: true } as const;
    }),
    liveClasses: studentProcedure.query(({ ctx }) => db.listMyLiveClasses(ctx.user.id)),
    freePlaylists: studentProcedure.query(() => db.listPublishedFreePlaylists()),
    shorts: studentProcedure.query(({ ctx }) => db.listPublishedShorts(ctx.user.id)),
    savedShorts: studentProcedure.query(({ ctx }) => db.listSavedShorts(ctx.user.id)),
    likedShorts: studentProcedure.query(({ ctx }) => db.listLikedShorts(ctx.user.id)),
    toggleShortLike: protectedProcedure.input(z.object({ shortId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      const result = await db.toggleShortLike(ctx.user.id, input.shortId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "This Short is no longer available." });
      return result;
    }),
    toggleShortSave: protectedProcedure.input(z.object({ shortId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      const result = await db.toggleShortSave(ctx.user.id, input.shortId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "This Short is no longer available." });
      return result;
    }),
    shortComments: protectedProcedure.input(z.object({ shortId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      const comments = await db.listShortComments(input.shortId);
      if (!comments) throw new TRPCError({ code: "NOT_FOUND", message: "This Short is no longer available." });
      return comments;
    }),
    addShortComment: protectedProcedure.input(z.object({ shortId: z.number().int().positive(), body: z.string().trim().min(1).max(1000) })).mutation(async ({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      const comment = await db.addShortComment(ctx.user.id, input.shortId, input.body);
      if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "This Short is no longer available." });
      return comment;
    }),
    submitShort: protectedProcedure.input(mediaReferenceSchema.safeExtend({ title: z.string().trim().min(3).max(220), description: z.string().trim().max(1000).optional(), subjectCategory: z.string().trim().min(2).max(80).default("General") }).superRefine((value, ctx) => {
      if (!value.storageKey || !(value.contentUrl ?? "").startsWith("/manus-storage/")) ctx.addIssue({ code: "custom", message: "Upload a managed video before submitting a Short.", path: ["contentUrl"] });
      if (value.mimeType && !value.mimeType.startsWith("video/")) ctx.addIssue({ code: "custom", message: "Student submissions must be video files.", path: ["mimeType"] });
    })).mutation(async ({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      const access = await db.getStudentShortUploadAccess(ctx.user.id);
      if (!access.canUploadShorts) throw new TRPCError({ code: "FORBIDDEN", message: "Short uploads are not enabled for your student account." });
      const videoUrl = input.contentUrl ?? "";
      const storageKey = input.storageKey ?? "";
      if (!storageKey || !videoUrl.startsWith("/manus-storage/")) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a managed video before submitting a Short." });
      const shortId = await db.submitStudentShort({ userId: ctx.user.id, title: input.title, description: input.description, subjectCategory: input.subjectCategory, videoUrl, storageKey, provider: input.provider || undefined, mimeType: input.mimeType || undefined, sizeBytes: input.sizeBytes, durationSeconds: input.durationSeconds, thumbnailUrl: input.thumbnailUrl || undefined });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "student_short.submitted", entityType: "educational_short", entityId: shortId, metadata: { status: "pending", subjectCategory: input.subjectCategory } });
      return { shortId, status: "pending" as const };
    }),
    myShortSubmissions: protectedProcedure.query(async ({ ctx }) => {
      requireStudentAccess(ctx.user.role);
      return db.listMyShortSubmissions(ctx.user.id);
    }),
    shortUploadAccess: protectedProcedure.query(async ({ ctx }) => {
      requireStudentAccess(ctx.user.role);
      return db.getStudentShortUploadAccess(ctx.user.id);
    }),
    askAi: protectedProcedure.input(z.object({ question: z.string().trim().min(3, "Type at least three characters").max(1500, "Keep one doubt under 1,500 characters"), image: z.object({ base64: z.string().min(32).max(3_500_000), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]) }).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "The Doubt Solver is available in the student learning experience." });
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) return { answer: "AI is temporarily in study mode. Please review the lesson notes and try again shortly.", mode: "fallback" as const, question: input.question };
      try {
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({ model: "gemini-flash-lite-latest", systemInstruction: "You are a Universal Helpful Assistant for Amin Ka Master. Help Students with general knowledge, mathematics, science, writing, exam preparation, Indian land measurement, surveying, revenue records, and practical study questions. Answer clearly and safely, show steps when useful, ask a brief clarifying question when needed, and politely refuse unsafe or disallowed requests. When a Student supplies an image, analyze the inline image together with the question, describe only visible details relevant to the request, state uncertainty clearly, and never present your answer as official land-record verification, legal advice, ownership proof, or a certified survey.", generationConfig: { maxOutputTokens: 900, temperature: 0.3 } });
        const prompt = input.image ? [{ text: `${input.question}\n\nAn image is attached as inline base64 data. Use both the text and image to answer. If the image is unclear, say what cannot be determined. Do not identify people or make legal, ownership, or official-record claims.` }, { inlineData: { data: input.image.base64.replace(/^data:[^;]+;base64,/, ""), mimeType: input.image.mimeType } }] : input.question;
        const result = await model.generateContent(prompt);
        const answer = result.response.text().trim();
        if (!answer) throw new Error("Gemini returned an empty response");
        return { answer, mode: "gemini" as const, question: input.question, analyzedImage: Boolean(input.image) };
      } catch (error) {
        console.error("Gemini Doubt Solver request failed", error instanceof Error ? error.message : "unknown provider error");
        return { answer: "I could not reach the AI tutor right now. Please check the relevant lesson notes and try again.", mode: "fallback" as const, question: input.question };
      }
    }),
    generateAiQuiz: protectedProcedure.input(z.object({
      topic: z.string().trim().min(2, "Enter a topic").max(160),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
      questionCount: z.number().int().min(2).max(10),
      language: z.enum(["English", "Hindi-English"]).default("Hindi-English"),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "AI Quiz is available in the student learning experience." });
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI Quiz is not configured right now. Please try again later." });
      try {
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({ model: "gemini-flash-lite-latest", systemInstruction: "You create safe educational multiple-choice practice only for Amin Ka Master. Focus on Indian land measurement, surveying, revenue records, and exam preparation. Return valid JSON only. Never present generated content as an official exam or publish it to a staff question bank.", generationConfig: { maxOutputTokens: 3600, temperature: 0.2 } });
        const prompt = `Create exactly ${input.questionCount} ${input.difficulty} multiple-choice practice questions about ${input.topic}. Use ${input.language}. Return exactly this JSON shape: {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}. Each question must have exactly four distinct plausible options, one correct zero-based index, and a concise educational explanation.`;
        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim();
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const parsed = aiQuizResponseSchema.parse(JSON.parse(match?.[1] ?? raw));
        if (parsed.questions.length !== input.questionCount) throw new Error("Gemini returned an incomplete quiz");
        return { ...parsed, topic: input.topic, difficulty: input.difficulty, language: input.language, mode: "gemini" as const };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Gemini AI Quiz request failed", error instanceof Error ? error.message : "unknown provider error");
        throw new TRPCError({ code: "BAD_GATEWAY", message: "AI Quiz could not be generated right now. Please try again." });
      }
    }),
    saveAiQuizAttempt: protectedProcedure.input(z.object({
      topic: z.string().trim().min(2).max(160),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
      questionCount: z.number().int().min(2).max(10),
      correctAnswers: z.number().int().min(0).max(10),
      scorePercent: z.number().int().min(0).max(100),
      durationSeconds: z.number().int().min(0).max(60 * 60),
    }).superRefine((value, ctx) => {
      if (value.correctAnswers > value.questionCount) ctx.addIssue({ code: "custom", message: "Correct answer count cannot exceed question count.", path: ["correctAnswers"] });
      const expectedScore = Math.round((value.correctAnswers / value.questionCount) * 100);
      if (value.scorePercent !== expectedScore) ctx.addIssue({ code: "custom", message: "Quiz score does not match the submitted result.", path: ["scorePercent"] });
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "Only Students can save AI Quiz practice results." });
      const attemptId = await db.saveAiQuizAttempt({ ...input, userId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "ai_quiz.attempt_saved", entityType: "ai_quiz_attempt", entityId: attemptId, metadata: { topic: input.topic, difficulty: input.difficulty, questionCount: input.questionCount, scorePercent: input.scorePercent, durationSeconds: input.durationSeconds } });
      return { attemptId };
    }),
    aiQuizStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "AI Quiz analytics are available in the student learning experience." });
      return db.getStudentAiQuizStats(ctx.user.id);
    }),
    aiQuizHistory: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "AI Quiz history is available in the student learning experience." });
      return db.listStudentAiQuizAttempts(ctx.user.id);
    }),
    studyCoach: protectedProcedure.query(async ({ ctx }) => {
      requireStudentAccess(ctx.user.role);
      await requireGrowthSuiteFeature("feature.study_coach_enabled");
      return db.getStudentStudyCoachData(ctx.user.id);
    }),
    studyCoachNoticePreference: protectedProcedure.query(async ({ ctx }) => {
      requireStudentAccess(ctx.user.role);
      await requireGrowthSuiteFeature("feature.study_coach_enabled");
      return db.getStudyCoachNoticePreference(ctx.user.id);
    }),
    setStudyCoachNoticePreference: protectedProcedure.input(z.object({ noticesEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      await requireGrowthSuiteFeature("feature.study_coach_enabled");
      const previous = await db.getStudyCoachNoticePreference(ctx.user.id);
      await db.setStudyCoachNoticePreference(ctx.user.id, input.noticesEnabled);
      const notificationId = input.noticesEnabled && !previous.noticesEnabled ? await db.createStudyCoachNoticeConfirmation(ctx.user.id) : null;
      await db.writeAudit({ actorUserId: ctx.user.id, action: "study_coach.notice_preference_updated", entityType: "study_coach_preference", entityId: ctx.user.id, metadata: { noticesEnabled: input.noticesEnabled, notificationId } });
      return { success: true as const, notificationId };
    }),
    guardianReportPreference: protectedProcedure.query(async ({ ctx }) => {
      requireStudentAccess(ctx.user.role);
      await requireGrowthSuiteFeature("feature.guardian_reports_enabled");
      return db.getGuardianReportPreference(ctx.user.id);
    }),
    setGuardianReportPreference: protectedProcedure.input(z.object({ guardianName: z.string().trim().max(160), guardianEmail: z.string().trim().email().max(320).optional().or(z.literal("")), guardianMobile: z.string().trim().max(24).optional().or(z.literal("")), consentGranted: z.boolean() }).superRefine((input, validation) => {
      if (input.consentGranted && input.guardianName.length < 2) validation.addIssue({ code: "custom", path: ["guardianName"], message: "Enter the guardian's name before granting consent." });
      if (input.consentGranted && !input.guardianEmail && !input.guardianMobile) validation.addIssue({ code: "custom", path: ["guardianEmail"], message: "Provide a guardian email or mobile number before granting consent." });
    })).mutation(async ({ ctx, input }) => {
      requireStudentAccess(ctx.user.role);
      await requireGrowthSuiteFeature("feature.guardian_reports_enabled");
      await db.setGuardianReportPreference({ userId: ctx.user.id, ...input });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "guardian_report.preference_updated", entityType: "guardian_report_preference", entityId: ctx.user.id, metadata: { consentGranted: input.consentGranted, contactMethod: input.guardianEmail ? "email" : input.guardianMobile ? "mobile" : "none" } });
      return { success: true as const };
    }),
    submitAiQuizForReview: protectedProcedure.input(aiQuizReviewSubmissionSchema).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "Only Students can submit a private AI Quiz for teacher review." });
      const submissionId = await db.createAiQuizReviewSubmission({ ...input, submittedByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "ai_quiz.submitted_for_review", entityType: "ai_quiz_review_submission", entityId: submissionId, metadata: { questionCount: input.questions.length, topic: input.topic } });
      return { submissionId };
    }),
  }),
  telemetry: router({
    config: protectedProcedure.query(() => db.getTelemetryConfiguration()),
    reportCrash: protectedProcedure.input(z.object({ platform: z.enum(["android", "ios", "web", "unknown"]), routeGroup: z.enum(["auth", "student", "staff", "developer", "other"]), errorClass: z.enum(["unhandled_error", "unhandled_rejection", "react_render"]) })).mutation(async ({ input }) => {
      await db.recordCrashMeasurement(input);
      return { accepted: true as const };
    }),
  }),
  developer: router({
    settings: requireRoles(["developer"]).query(() => db.getDeveloperManagedSettings()),
    templates: requireRoles(["developer"]).query(({ ctx }) => db.listMasterTemplates(ctx.user.id)),
    clientProjects: requireRoles(["developer"]).query(() => db.listClientProjects()),
    clientHealth: requireRoles(["developer"]).query(async () => ({
      ...(await db.getDeveloperClientHealth()),
      integrations: {
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()),
        note: "Provider secrets are server-only and are never returned to the Developer client.",
      },
    })),
    clientProject: requireRoles(["developer"]).input(z.object({ clientProjectId: z.number().int().positive() })).query(({ input }) => db.getClientProject(input.clientProjectId)),
    createClientProject: requireRoles(["developer"]).input(z.object({
      templateId: z.number().int().positive(),
      name: z.string().trim().min(2).max(160),
      slug: z.string().trim().regex(/^[a-z0-9-]+$/).min(2).max(120),
      appName: z.string().trim().min(2).max(80),
      tagline: z.string().trim().max(160).optional(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      supportEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
    })).mutation(async ({ ctx, input }) => {
      const clientProjectId = await db.createClientProject({ ...input, supportEmail: input.supportEmail || undefined, createdByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_client_project.created", entityType: "client_project", entityId: clientProjectId, metadata: { templateId: input.templateId, name: input.name, slug: input.slug, isolatedFromMasterData: true } });
      return { clientProjectId };
    }),
    generateClientProjectBlueprint: requireRoles(["developer"]).input(z.object({ brief: z.string().trim().min(12).max(1600) })).mutation(async ({ ctx, input }) => {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI configuration is not available because the server-side Gemini provider is not configured." });
      try {
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({ model: "gemini-flash-lite-latest", systemInstruction: "You are a white-label education product configuration assistant. Return only valid JSON that follows the requested schema. Produce visual and feature configuration suggestions only. Never request, generate, infer, or include passwords, API keys, payment credentials, database information, existing users, private URLs, or release claims. Do not claim an APK was built or an app was published.", generationConfig: { maxOutputTokens: 1200, temperature: 0.35 } });
        const result = await model.generateContent(`Create a practical client LMS configuration for this brief: ${input.brief}\nReturn exactly JSON: {"appName":"","tagline":"","primaryColor":"#112233","accentColor":"#AABBCC","features":{"courses":true,"assessments":true,"liveClasses":true,"shorts":true,"downloads":true,"aiDoubt":true,"aiQuiz":true},"studentTabs":["home"],"about":"","contact":""}. Use six-character #RRGGBB colours and no more than five tabs.`);
        const raw = result.response.text().trim();
        const jsonText = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? raw;
        const parsed = z.object({ appName: z.string().trim().min(2).max(80), tagline: z.string().trim().max(160), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), features: z.object({ courses: z.boolean(), assessments: z.boolean(), liveClasses: z.boolean(), shorts: z.boolean(), downloads: z.boolean(), aiDoubt: z.boolean(), aiQuiz: z.boolean() }), studentTabs: z.array(z.enum(["home", "my_learning", "shorts", "downloads", "account", "explore"])).min(2).max(5), about: z.string().max(1200), contact: z.string().max(600) }).parse(JSON.parse(jsonText));
        await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_client_project.blueprint_generated", entityType: "client_project_blueprint", metadata: { briefLength: input.brief.length, provider: "gemini", published: false } });
        return parsed;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Client project blueprint generation failed", error instanceof Error ? error.message : "unknown provider error");
        throw new TRPCError({ code: "BAD_GATEWAY", message: "AI configuration could not be generated right now. Please try again." });
      }
    }),
    updateClientProject: requireRoles(["developer"]).input(z.object({
      clientProjectId: z.number().int().positive(),
      name: z.string().trim().min(2).max(160).optional(),
      status: z.enum(["draft", "ready_for_review", "release_prepared", "archived"]).optional(),
      branding: z.object({ appName: z.string().trim().min(2).max(80), tagline: z.string().trim().max(160), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), logoUrl: z.string().url().max(2048).nullable().optional() }).optional(),
      featureProfile: z.object({ courses: z.boolean(), assessments: z.boolean(), liveClasses: z.boolean(), shorts: z.boolean(), downloads: z.boolean(), aiDoubt: z.boolean(), aiQuiz: z.boolean() }).optional(),
      navigationProfile: z.object({ studentTabs: z.array(z.string().max(48)).max(8), staffAreas: z.array(z.string().max(48)).max(12), ownerAreas: z.array(z.string().max(48)).max(12) }).optional(),
      publicPages: z.object({ supportEmail: z.string().email().max(320).or(z.literal("")), about: z.string().max(5000), contact: z.string().max(2000), privacyUrl: z.string().url().max(2048).or(z.literal("")), termsUrl: z.string().url().max(2048).or(z.literal("")) }).optional(),
      previewUrl: z.string().url().max(2048).nullable().optional(),
      externalProjectReference: z.string().trim().max(160).nullable().optional(),
    }).refine((input) => Object.keys(input).length > 1, "Choose at least one client-project field to update.")).mutation(async ({ ctx, input }) => {
      const { clientProjectId, ...updates } = input;
      await db.updateClientProject({ clientProjectId, ...updates });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_client_project.updated", entityType: "client_project", entityId: clientProjectId, metadata: { fields: Object.keys(updates) } });
      return { success: true as const };
    }),
    prepareClientProjectRelease: requireRoles(["developer"]).input(z.object({ clientProjectId: z.number().int().positive(), confirmation: z.literal("PREPARE") })).mutation(async ({ ctx, input }) => {
      const prepared = await db.prepareClientProjectRelease({ clientProjectId: input.clientProjectId, preparedByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_client_project.release_prepared", entityType: "client_project", entityId: input.clientProjectId, metadata: { releaseId: prepared.releaseId, releaseVersion: prepared.releaseVersion, manualPlatformPublishRequired: true } });
      return prepared;
    }),
    clientProjectReleases: requireRoles(["developer"]).input(z.object({ clientProjectId: z.number().int().positive() })).query(({ input }) => db.listClientProjectReleases(input.clientProjectId)),
    users: requireRoles(["developer"]).input(z.object({ search: z.string().trim().max(120).optional() }).optional()).query(({ input }) => db.listManagedUsers(input?.search)),
    updateUser: requireRoles(["developer"]).input(z.object({ userId: z.number().int().positive(), role: z.enum(["student", "teacher", "admin", "super_admin"]).optional(), status: z.enum(["active", "suspended"]).optional() })).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Use your own account security flow for Developer access." });
      await db.developerUpdateUser(input.userId, { role: input.role, status: input.status });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_user.updated", entityType: "user", entityId: input.userId, metadata: { role: input.role, status: input.status } });
      return { success: true as const };
    }),
    resetUserPassword: requireRoles(["developer"]).input(z.object({ userId: z.number().int().positive(), password: z.string().min(12).max(128) })).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Use your own account security flow for Developer access." });
      await db.developerResetUserPassword(input.userId, input.password);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_user.password_reset", entityType: "user", entityId: input.userId, metadata: { sessionsRevoked: true } });
      return { success: true as const };
    }),
    createUser: requireRoles(["developer"]).input(credentialSchema.safeExtend({ role: z.enum(["student", "teacher", "admin", "super_admin"]) })).mutation(async ({ ctx, input }) => {
      const userId = await db.developerCreateCredentialUser({ ...input, email: input.email || undefined, mobile: input.mobile || undefined });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_user.created", entityType: "user", entityId: userId, metadata: { role: input.role } });
      return { userId };
    }),
    deleteUser: requireRoles(["developer"]).input(z.object({ userId: z.number().int().positive(), confirmation: z.literal("DELETE") })).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "A Developer cannot delete their own active root account." });
      await db.developerDeleteUser(input.userId);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_user.deleted", entityType: "user", entityId: input.userId, metadata: { confirmation: input.confirmation } });
      return { success: true as const };
    }),
    setUserControls: requireRoles(["developer"]).input(z.object({
      userId: z.number().int().positive(),
      canUploadShorts: z.boolean().optional(),
      permissions: z.array(z.enum(db.STAFF_PERMISSION_OPTIONS)).max(db.STAFF_PERMISSION_OPTIONS.length).optional(),
    }).refine((input) => input.canUploadShorts !== undefined || input.permissions !== undefined, "Choose a control to update.")).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Use your own account security flow for Developer access." });
      await db.developerSetUserControls({ ...input, grantedByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_user.controls_updated", entityType: "user", entityId: input.userId, metadata: { canUploadShorts: input.canUploadShorts, permissions: input.permissions } });
      return { success: true as const };
    }),
    setStudentFeatureControls: requireRoles(["developer"]).input(z.object({
      userId: z.number().int().positive(),
      features: z.array(z.object({ feature: z.enum(db.STUDENT_FEATURE_OPTIONS), enabled: z.boolean() })).min(1).max(db.STUDENT_FEATURE_OPTIONS.length),
    })).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Use the Developer access controls rather than previewing or changing the active root account." });
      await db.developerSetStudentFeatureControls({ ...input, grantedByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_student.feature_matrix_updated", entityType: "user", entityId: input.userId, metadata: { features: input.features } });
      return { success: true as const };
    }),
    resetStudentFeatureControls: requireRoles(["developer"]).input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "The active Developer account has no Student matrix to reset." });
      await db.developerResetStudentFeatureControls(input.userId);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_student.feature_matrix_reset", entityType: "user", entityId: input.userId, metadata: { restoredGlobalPolicyInheritance: true } });
      return { success: true as const };
    }),
    auditLogs: requireRoles(["developer"]).input(z.object({ search: z.string().trim().max(120).optional(), limit: z.number().int().min(1).max(500).default(200) }).optional()).query(({ input }) => db.listDeveloperAuditLogs({ search: input?.search, limit: input?.limit ?? 200 })),
    viewAsPreview: requireRoles(["developer"]).input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Developer View As only supports non-Developer accounts." });
      const target = await db.getDeveloperViewAsTarget(input.userId);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer.view_as_preview_opened", entityType: "user", entityId: input.userId, metadata: { role: target.role, safeReadOnlyPreview: true } });
      return target;
    }),
    contentInventory: requireRoles(["developer"]).query(() => db.listDeveloperContentInventory()),
    setContentStatus: requireRoles(["developer"]).input(z.object({ contentType: z.enum(["course", "test", "short"]), contentId: z.number().int().positive(), status: z.enum(["draft", "published", "archived"]) })).mutation(async ({ ctx, input }) => {
      await db.developerSetContentStatus(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_content.status_updated", entityType: input.contentType, entityId: input.contentId, metadata: { status: input.status } });
      return { success: true as const };
    }),
    archiveContent: requireRoles(["developer"]).input(z.object({ contentType: z.enum(["course", "test", "short"]), contentId: z.number().int().positive(), confirmation: z.literal("ARCHIVE") })).mutation(async ({ ctx, input }) => {
      if (input.contentType === "course") await db.updateCourseStatus(input.contentId, "archived");
      if (input.contentType === "test") await db.setManagedTestStatus(input.contentId, "archived");
      if (input.contentType === "short") await db.setEducationalShortStatus(input.contentId, "archived");
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_content.archived", entityType: input.contentType, entityId: input.contentId, metadata: { confirmation: input.confirmation } });
      return { success: true as const };
    }),
    integrationStatus: requireRoles(["developer"]).query(() => ({
      developerPortalPasskeyConfigured: isDeveloperPortalConfigured(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()),
      note: "Provider secrets are server-only and are never returned to this client.",
    })),
    saveSettings: requireRoles(["developer"]).input(z.object({
      appName: z.string().trim().min(2).max(80).optional(),
      tagline: z.string().trim().max(160).optional(),
      contactEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
      contactPhone: z.string().trim().max(40).optional(),
      whatsapp: z.string().trim().max(40).optional(),
      themePrimary: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      themeAccent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      maintenanceEnabled: z.boolean().optional(),
      studentAccessEnabled: z.boolean().optional(),
      staffAccessEnabled: z.boolean().optional(),
      ownerAccessEnabled: z.boolean().optional(),
      coursesEnabled: z.boolean().optional(),
      assessmentsEnabled: z.boolean().optional(),
      liveClassesEnabled: z.boolean().optional(),
      shortsEnabled: z.boolean().optional(),
      downloadsEnabled: z.boolean().optional(),
      aiDoubtEnabled: z.boolean().optional(),
      aiQuizEnabled: z.boolean().optional(),
      studyCoachEnabled: z.boolean().optional(),
      learningOperationsEnabled: z.boolean().optional(),
      guardianReportsEnabled: z.boolean().optional(),
      aminToolkitEnabled: z.boolean().optional(),
      telemetryApiLatencyEnabled: z.boolean().optional(),
      telemetryAuthLatencyEnabled: z.boolean().optional(),
      telemetryCrashReportingEnabled: z.boolean().optional(),
      interfaceLanguageDefault: z.enum(["english", "hindi", "bilingual"]).optional(),
      developerName: z.string().trim().max(160).optional(),
      developerRole: z.string().trim().max(160).optional(),
      developerProjectInfo: z.string().trim().max(600).optional(),
      developerContact: z.string().trim().max(320).optional(),
      developerCopyright: z.string().trim().max(240).optional(),
    })).mutation(async ({ ctx, input }) => {
      const values = {
        ...(input.appName !== undefined ? { "brand.app_name": input.appName } : {}),
        ...(input.tagline !== undefined ? { "brand.tagline": input.tagline } : {}),
        ...(input.contactEmail !== undefined ? { "brand.contact_email": input.contactEmail } : {}),
        ...(input.contactPhone !== undefined ? { "brand.contact_phone": input.contactPhone } : {}),
        ...(input.whatsapp !== undefined ? { "brand.whatsapp": input.whatsapp } : {}),
        ...(input.themePrimary !== undefined ? { "brand.theme_primary": input.themePrimary } : {}),
        ...(input.themeAccent !== undefined ? { "brand.theme_accent": input.themeAccent } : {}),
        ...(input.maintenanceEnabled !== undefined ? { "platform.maintenance_enabled": input.maintenanceEnabled } : {}),
        ...(input.studentAccessEnabled !== undefined ? { "platform.student_access_enabled": input.studentAccessEnabled } : {}),
        ...(input.staffAccessEnabled !== undefined ? { "platform.staff_access_enabled": input.staffAccessEnabled } : {}),
        ...(input.ownerAccessEnabled !== undefined ? { "platform.owner_access_enabled": input.ownerAccessEnabled } : {}),
        ...(input.coursesEnabled !== undefined ? { "feature.courses_enabled": input.coursesEnabled } : {}),
        ...(input.assessmentsEnabled !== undefined ? { "feature.assessments_enabled": input.assessmentsEnabled } : {}),
        ...(input.liveClassesEnabled !== undefined ? { "feature.live_classes_enabled": input.liveClassesEnabled } : {}),
        ...(input.shortsEnabled !== undefined ? { "feature.shorts_enabled": input.shortsEnabled } : {}),
        ...(input.downloadsEnabled !== undefined ? { "feature.downloads_enabled": input.downloadsEnabled } : {}),
        ...(input.aiDoubtEnabled !== undefined ? { "feature.ai_doubt_enabled": input.aiDoubtEnabled } : {}),
        ...(input.aiQuizEnabled !== undefined ? { "feature.ai_quiz_enabled": input.aiQuizEnabled } : {}),
        ...(input.studyCoachEnabled !== undefined ? { "feature.study_coach_enabled": input.studyCoachEnabled } : {}),
        ...(input.learningOperationsEnabled !== undefined ? { "feature.learning_operations_enabled": input.learningOperationsEnabled } : {}),
        ...(input.guardianReportsEnabled !== undefined ? { "feature.guardian_reports_enabled": input.guardianReportsEnabled } : {}),
        ...(input.aminToolkitEnabled !== undefined ? { "feature.amin_toolkit_enabled": input.aminToolkitEnabled } : {}),
        ...(input.telemetryApiLatencyEnabled !== undefined ? { "telemetry.api_latency_enabled": input.telemetryApiLatencyEnabled } : {}),
        ...(input.telemetryAuthLatencyEnabled !== undefined ? { "telemetry.auth_latency_enabled": input.telemetryAuthLatencyEnabled } : {}),
        ...(input.telemetryCrashReportingEnabled !== undefined ? { "telemetry.crash_reporting_enabled": input.telemetryCrashReportingEnabled } : {}),
        ...(input.interfaceLanguageDefault !== undefined ? { "platform.interface_language_default": input.interfaceLanguageDefault } : {}),
        ...(input.developerName !== undefined ? { "developer.name": input.developerName } : {}),
        ...(input.developerRole !== undefined ? { "developer.role": input.developerRole } : {}),
        ...(input.developerProjectInfo !== undefined ? { "developer.project_info": input.developerProjectInfo } : {}),
        ...(input.developerContact !== undefined ? { "developer.contact": input.developerContact } : {}),
        ...(input.developerCopyright !== undefined ? { "developer.copyright": input.developerCopyright } : {}),
      };
      await db.saveDeveloperManagedSettings(ctx.user.id, values);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "developer_settings.updated", entityType: "app_settings", metadata: { keys: Object.keys(values) } });
      return { success: true as const };
    }),
  }),
  operations: router({
    summary: requireRoles(["teacher", "admin", "super_admin"]).query(({ ctx }) => {
      requireStaffAccess(ctx.user.role);
      return db.getOperationsSummary();
    }),
    learningOperations: requireRoles(["teacher", "admin", "super_admin"]).query(async ({ ctx }) => {
      await requireGrowthSuiteFeature("feature.learning_operations_enabled");
      await requireAnyDelegatedPermission(ctx.user, ["learning_operations.manage", "assessments.manage", "courses.manage"]);
      return db.getLearningOperationsData();
    }),
    atRiskLearners: requireRoles(["teacher", "admin", "super_admin"]).query(async ({ ctx }) => {
      await requireGrowthSuiteFeature("feature.learning_operations_enabled");
      await requireAnyDelegatedPermission(ctx.user, ["learning_operations.manage", "assessments.manage", "courses.manage"]);
      return (await db.getLearningOperationsData()).atRiskLearners;
    }),
    sendLearningOperationsNotice: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ userId: z.number().int().positive(), title: z.string().trim().min(3).max(220), body: z.string().trim().min(3).max(1000), link: z.string().trim().max(1024).optional() })).mutation(async ({ ctx, input }) => {
      await requireGrowthSuiteFeature("feature.learning_operations_enabled");
      await requireAnyDelegatedPermission(ctx.user, ["learning_operations.manage", "assessments.manage", "courses.manage"]);
      const notificationId = await db.createLearningOperationsNotice(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "learning_operations.notice_sent", entityType: "notification", entityId: notificationId, metadata: { recipientUserId: input.userId, title: input.title, link: input.link ?? null } });
      return { notificationId };
    }),
    guardianReports: requireRoles(["teacher", "admin", "super_admin"]).query(async ({ ctx }) => {
      await requireGrowthSuiteFeature("feature.guardian_reports_enabled");
      await requireAnyDelegatedPermission(ctx.user, ["guardian_reports.manage"]);
      return db.listGuardianProgressReports();
    }),
    recordGuardianReportShare: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ studentUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireGrowthSuiteFeature("feature.guardian_reports_enabled");
      await requireAnyDelegatedPermission(ctx.user, ["guardian_reports.manage"]);
      const report = await db.getGuardianProgressReport(input.studentUserId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "No consented guardian report is available for this Student." });
      const notificationId = await db.recordGuardianReportShared(input.studentUserId);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "guardian_report.share_initiated", entityType: "guardian_report", entityId: input.studentUserId, metadata: { notificationId, contactMethod: report.guardianContact.includes("@") ? "email" : "mobile" } });
      return { notificationId };
    }),
    businessIntelligence: ownerProcedure.query(() => db.getOwnerBusinessIntelligence()),
    courses: requireRoles(["teacher", "admin", "super_admin"]).query(async ({ ctx }) => {
      await requireAnyDelegatedPermission(ctx.user, ["courses.manage", "course_content.manage"]);
      return db.listOperationsCourses();
    }),
    createCourse: requireRoles(["teacher", "admin", "super_admin"])
      .input(z.object({
        categoryId: z.number().int().positive(),
        instructorId: z.number().int().positive().nullable().optional(),
        title: z.string().trim().min(3).max(220),
        slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(240),
        shortDescription: z.string().trim().min(10).max(500),
        fullDescription: z.string().trim().max(20000).optional(),
        mrp: z.string().regex(/^\d+(\.\d{1,2})?$/),
        sellingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
        accessType: z.enum(["free", "lifetime", "time_limited"]),
        accessDurationDays: z.number().int().positive().max(3650).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireContentManagementPermission(ctx.user);
        if (Number(input.sellingPrice) > Number(input.mrp)) throw new Error("Selling price cannot exceed MRP");
        if (input.accessType === "time_limited" && !input.accessDurationDays) throw new Error("Time-limited courses need an access duration");
        const courseId = await db.createCourse(input);
        await db.writeAudit({ actorUserId: ctx.user.id, action: "course.created", entityType: "course", entityId: courseId, metadata: { title: input.title } });
        return { courseId };
      }),
    setCourseStatus: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ courseId: z.number().int().positive(), status: z.enum(["draft", "published", "archived"]) })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "courses.publish");
      await db.updateCourseStatus(input.courseId, input.status);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "course.status_changed", entityType: "course", entityId: input.courseId, metadata: { status: input.status } });
      return { success: true } as const;
    }),
    updateCourse: requireRoles(["teacher", "admin", "super_admin"])
      .input(z.object({
        courseId: z.number().int().positive(),
        categoryId: z.number().int().positive(),
        title: z.string().trim().min(3).max(220),
        slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(240),
        shortDescription: z.string().trim().min(10).max(500),
        fullDescription: z.string().trim().max(20000).optional(),
        mrp: moneySchema,
        sellingPrice: moneySchema,
        accessType: z.enum(["free", "lifetime", "time_limited"]),
        accessDurationDays: z.number().int().positive().max(3650).nullable().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireContentManagementPermission(ctx.user);
        if (input.status) await requireDelegatedPermission(ctx.user, "courses.publish");
        if (Number(input.sellingPrice) > Number(input.mrp)) throw new Error("Selling price cannot exceed MRP");
        if (input.accessType === "time_limited" && !input.accessDurationDays) throw new Error("Time-limited courses need an access duration");
        await db.updateCourse(input);
        await db.writeAudit({ actorUserId: ctx.user.id, action: "course.updated", entityType: "course", entityId: input.courseId, metadata: { title: input.title, status: input.status } });
        return { success: true } as const;
      }),
    courseStructure: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ courseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireContentManagementPermission(ctx.user);
      return db.getManagedCourseStructure(input.courseId);
    }),
    saveModule: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ moduleId: z.number().int().positive().optional(), courseId: z.number().int().positive(), title: z.string().trim().min(3).max(220), description: z.string().trim().max(10000).optional(), displayOrder: z.number().int().min(0).max(10000), isPublished: z.boolean() })).mutation(async ({ ctx, input }) => {
      await requireContentManagementPermission(ctx.user);
      const moduleId = await db.saveManagedModule(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.moduleId ? "module.updated" : "module.created", entityType: "module", entityId: moduleId, metadata: { courseId: input.courseId, title: input.title } });
      return { moduleId };
    }),
    saveLesson: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ lessonId: z.number().int().positive().optional(), moduleId: z.number().int().positive(), title: z.string().trim().min(3).max(220), description: z.string().trim().max(10000).optional(), contentType: z.enum(["video", "text", "image", "pdf", "mixed"]), contentUrl: z.string().trim().url().max(2048).optional().or(z.literal("")), provider: z.string().trim().max(64).optional(), durationSeconds: z.number().int().min(0).max(24 * 60 * 60), thumbnailUrl: z.string().trim().url().max(1024).optional().or(z.literal("")), isPreview: z.boolean(), isPublished: z.boolean(), displayOrder: z.number().int().min(0).max(10000) })).mutation(async ({ ctx, input }) => {
      await requireContentManagementPermission(ctx.user);
      const lessonId = await db.saveManagedLesson({ ...input, contentUrl: input.contentUrl || undefined, thumbnailUrl: input.thumbnailUrl || undefined });
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.lessonId ? "lesson.updated" : "lesson.created", entityType: "lesson", entityId: lessonId, metadata: { moduleId: input.moduleId, title: input.title, contentType: input.contentType } });
      return { lessonId };
    }),
    saveModuleResource: requireRoles(["teacher", "admin", "super_admin"]).input(moduleResourceSchema).mutation(async ({ ctx, input }) => {
      await requireContentManagementPermission(ctx.user);
      const resourceId = await db.saveModuleResource({ ...input, contentUrl: input.contentUrl || undefined, storageKey: input.storageKey || undefined, provider: input.provider || undefined, mimeType: input.mimeType || undefined, thumbnailUrl: input.thumbnailUrl || undefined, createdByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.resourceId ? "module_resource.updated" : "module_resource.created", entityType: "module_resource", entityId: resourceId, metadata: { moduleId: input.moduleId, resourceType: input.resourceType, downloadAllowed: input.downloadAllowed } });
      return { resourceId };
    }),
    freePlaylists: requireRoles(["teacher", "admin", "super_admin"]).query(async ({ ctx }) => {
      await requireAnyDelegatedPermission(ctx.user, ["media.manage"]);
      return db.listOperationsFreePlaylists();
    }),
    saveFreePlaylist: requireRoles(["teacher", "admin", "super_admin"]).input(freePlaylistSchema).mutation(async ({ ctx, input }) => {
      await requireAnyDelegatedPermission(ctx.user, ["media.manage"]);
      const playlistId = await db.saveFreePlaylist({ ...input, thumbnailUrl: input.thumbnailUrl || undefined, createdByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.playlistId ? "free_playlist.updated" : "free_playlist.created", entityType: "free_playlist", entityId: playlistId, metadata: { isPublished: input.isPublished } });
      return { playlistId };
    }),
    saveFreePlaylistItem: requireRoles(["teacher", "admin", "super_admin"]).input(freePlaylistItemSchema).mutation(async ({ ctx, input }) => {
      await requireAnyDelegatedPermission(ctx.user, ["media.manage"]);
      const itemId = await db.saveFreePlaylistItem({ ...input, contentUrl: input.contentUrl || undefined, storageKey: input.storageKey || undefined, provider: input.sourceType === "managed" ? input.provider || undefined : input.sourceType, mimeType: input.mimeType || undefined, thumbnailUrl: input.thumbnailUrl || undefined, createdByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.itemId ? "free_playlist_item.updated" : "free_playlist_item.created", entityType: "free_playlist_item", entityId: itemId, metadata: { playlistId: input.playlistId, contentType: input.contentType } });
      return { itemId };
    }),
    shorts: requireRoles(["teacher", "admin", "super_admin"]).query(async ({ ctx }) => {
      await requireAnyDelegatedPermission(ctx.user, ["media.manage"]);
      return db.listOperationsShorts();
    }),
    saveShort: requireRoles(["teacher", "admin", "super_admin"]).input(educationalShortSchema).mutation(async ({ ctx, input }) => {
      await requireAnyDelegatedPermission(ctx.user, ["media.manage"]);
      const shortId = await db.saveEducationalShort({ ...input, videoUrl: input.contentUrl || "", storageKey: input.storageKey || undefined, provider: input.sourceType === "managed" ? input.provider || undefined : input.sourceType, mimeType: input.mimeType || undefined, thumbnailUrl: input.thumbnailUrl || undefined, createdByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.shortId ? "short.updated" : "short.created", entityType: "educational_short", entityId: shortId, metadata: { status: input.status } });
      return { shortId };
    }),
    pendingShorts: requireRoles(["admin", "super_admin"]).query(() => db.listPendingShortsForModeration()),
    moderateShort: requireRoles(["admin", "super_admin"]).input(z.object({ shortId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), moderationNote: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const status = input.decision === "approved" ? "published" : "rejected";
      await db.moderateStudentShort({ shortId: input.shortId, moderatorUserId: ctx.user.id, status, moderationNote: input.moderationNote });
      await db.writeAudit({ actorUserId: ctx.user.id, action: `student_short.${input.decision}`, entityType: "educational_short", entityId: input.shortId, metadata: { status } });
      return { success: true as const, status };
    }),
    tests: requireRoles(["teacher", "admin", "super_admin"]).query(async ({ ctx }) => {
      await requireDelegatedPermission(ctx.user, "assessments.manage");
      return db.listOperationsTests();
    }),
    test: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ testId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "assessments.manage");
      const result = await db.getOperationsTest(input.testId);
      if (!result) throw new Error("Test was not found");
      return result;
    }),
    createTest: requireRoles(["teacher", "admin", "super_admin"]).input(testDetailsSchema).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "assessments.manage");
      const testId = await db.createManagedTest({ ...input, createdByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "test.created", entityType: "test", entityId: testId, metadata: { title: input.title } });
      return { testId };
    }),
    updateTest: requireRoles(["teacher", "admin", "super_admin"]).input(testDetailsSchema.extend({ testId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "assessments.manage");
      await db.updateManagedTest(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "test.updated", entityType: "test", entityId: input.testId, metadata: { title: input.title } });
      return { success: true } as const;
    }),
    setTestStatus: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ testId: z.number().int().positive(), status: z.enum(["draft", "published", "archived"]) })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "assessments.publish");
      if (input.status === "published") {
        const test = await db.getOperationsTest(input.testId);
        if (!test?.questions.length) throw new Error("Add at least one MCQ question before publishing a test");
      }
      await db.setManagedTestStatus(input.testId, input.status);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "test.status_changed", entityType: "test", entityId: input.testId, metadata: { status: input.status } });
      return { success: true } as const;
    }),
    saveQuestion: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ questionId: z.number().int().positive().optional(), testId: z.number().int().positive(), prompt: z.string().trim().min(5).max(10000), options: z.array(z.string().trim().min(1).max(1000)).length(4), correctOptionIndex: z.number().int().min(0).max(3), marks: z.number().int().min(1).max(1000), explanation: z.string().trim().max(5000).optional(), displayOrder: z.number().int().min(0).max(10000) })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "assessments.manage");
      const questionId = await db.saveManagedQuestion(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.questionId ? "question.updated" : "question.created", entityType: "question", entityId: questionId, metadata: { testId: input.testId } });
      return { questionId };
    }),
    aiQuizReviewQueue: requireRoles(["teacher", "admin", "super_admin"]).query(async ({ ctx }) => {
      await requireDelegatedPermission(ctx.user, "assessments.manage");
      return db.listAiQuizReviewSubmissions();
    }),
    exportAiQuizReview: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ submissionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "assessments.manage");
      const result = await db.exportAiQuizReviewSubmission({ submissionId: input.submissionId, reviewedByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "ai_quiz.exported_to_draft_test", entityType: "ai_quiz_review_submission", entityId: input.submissionId, metadata: result });
      return result;
    }),
    deleteQuestion: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ testId: z.number().int().positive(), questionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "assessments.manage");
      await db.deleteManagedQuestion(input.questionId, input.testId);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "question.deleted", entityType: "question", entityId: input.questionId, metadata: { testId: input.testId } });
      return { success: true } as const;
    }),
    liveClasses: requireRoles(["teacher", "admin", "super_admin"]).query(async ({ ctx }) => {
      await requireDelegatedPermission(ctx.user, "live_classes.manage");
      return db.listOperationsLiveClasses();
    }),
    createLiveClass: requireRoles(["teacher", "admin", "super_admin"]).input(liveClassDetailsSchema).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "live_classes.manage");
      const liveClassId = await db.createManagedLiveClass({ ...input, instructorId: ctx.user.id, meetingUrl: input.meetingUrl || undefined, recordingUrl: input.recordingUrl || undefined });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "live_class.created", entityType: "live_class", entityId: liveClassId, metadata: { title: input.title } });
      return { liveClassId };
    }),
    updateLiveClass: requireRoles(["teacher", "admin", "super_admin"]).input(liveClassDetailsSchema.safeExtend({ liveClassId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "live_classes.manage");
      await db.updateManagedLiveClass({ ...input, meetingUrl: input.meetingUrl || undefined, recordingUrl: input.recordingUrl || undefined });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "live_class.updated", entityType: "live_class", entityId: input.liveClassId, metadata: { title: input.title } });
      return { success: true } as const;
    }),
    setLiveClassStatus: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ liveClassId: z.number().int().positive(), status: z.enum(["upcoming", "live", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "live_classes.manage");
      await db.setManagedLiveClassStatus(input.liveClassId, input.status);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "live_class.status_changed", entityType: "live_class", entityId: input.liveClassId, metadata: { status: input.status } });
      return { success: true } as const;
    }),
    masterSettings: ownerProcedure.query(() => db.getOwnerManagedSettings()),
    saveMasterSettings: ownerProcedure.input(z.object({
      appName: z.string().trim().min(2).max(80).optional(), tagline: z.string().trim().max(160).optional(), contactEmail: z.string().trim().email().max(320).optional(), contactPhone: z.string().trim().max(40).optional(), whatsapp: z.string().trim().max(40).optional(), heroTitle: z.string().trim().max(220).optional(), heroSubtitle: z.string().trim().max(500).optional(), heroCta: z.string().trim().max(80).optional(), showLive: z.boolean().optional(), registrationEnabled: z.boolean().optional(), maintenanceEnabled: z.boolean().optional(), supportEmail: z.string().trim().email().max(320).optional().or(z.literal("")), supportPhone: z.string().trim().max(40).optional(), officeInfo: z.string().trim().max(500).optional(), helpIntro: z.string().trim().max(500).optional(), developerName: z.string().trim().max(160).optional(), developerRole: z.string().trim().max(160).optional(), developerProjectInfo: z.string().trim().max(600).optional(), developerContact: z.string().trim().max(320).optional(), developerCopyright: z.string().trim().max(240).optional(),
    })).mutation(async ({ ctx, input }) => {
      const values = {
        ...(input.appName !== undefined ? { "brand.app_name": input.appName } : {}), ...(input.tagline !== undefined ? { "brand.tagline": input.tagline } : {}), ...(input.contactEmail !== undefined ? { "brand.contact_email": input.contactEmail } : {}), ...(input.contactPhone !== undefined ? { "brand.contact_phone": input.contactPhone } : {}), ...(input.whatsapp !== undefined ? { "brand.whatsapp": input.whatsapp } : {}), ...(input.heroTitle !== undefined ? { "homepage.hero_title": input.heroTitle } : {}), ...(input.heroSubtitle !== undefined ? { "homepage.hero_subtitle": input.heroSubtitle } : {}), ...(input.heroCta !== undefined ? { "homepage.hero_cta": input.heroCta } : {}), ...(input.showLive !== undefined ? { "homepage.show_live": input.showLive } : {}), ...(input.registrationEnabled !== undefined ? { "platform.registration_enabled": input.registrationEnabled } : {}), ...(input.maintenanceEnabled !== undefined ? { "platform.maintenance_enabled": input.maintenanceEnabled } : {}), ...(input.supportEmail !== undefined ? { "support.support_email": input.supportEmail } : {}), ...(input.supportPhone !== undefined ? { "support.support_phone": input.supportPhone } : {}), ...(input.officeInfo !== undefined ? { "support.office_info": input.officeInfo } : {}), ...(input.helpIntro !== undefined ? { "support.help_intro": input.helpIntro } : {}), ...(input.developerName !== undefined ? { "developer.name": input.developerName } : {}), ...(input.developerRole !== undefined ? { "developer.role": input.developerRole } : {}), ...(input.developerProjectInfo !== undefined ? { "developer.project_info": input.developerProjectInfo } : {}), ...(input.developerContact !== undefined ? { "developer.contact": input.developerContact } : {}), ...(input.developerCopyright !== undefined ? { "developer.copyright": input.developerCopyright } : {}),
      };
      await db.saveOwnerManagedSettings(ctx.user.id, values);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "settings.updated", entityType: "app_settings", metadata: { keys: Object.keys(values) } });
      return { success: true } as const;
    }),
    people: requireRoles(["admin", "super_admin"]).input(z.object({ search: z.string().trim().max(160).optional() }).optional()).query(({ input }) => db.listManagedUsers(input?.search)),
    setStudentShortUploadPermission: requireRoles(["admin", "super_admin"]).input(z.object({ userId: z.number().int().positive(), canUploadShorts: z.boolean() })).mutation(async ({ ctx, input }) => {
      await db.setStudentShortUploadPermission(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.canUploadShorts ? "student_short_upload.granted" : "student_short_upload.revoked", entityType: "user", entityId: input.userId, metadata: { canUploadShorts: input.canUploadShorts } });
      return { success: true } as const;
    }),
    createStaffAccount: requireRoles(["super_admin"]).input(z.object({ fullName: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320).optional().or(z.literal("")), mobile: mobileSchema.optional().or(z.literal("")), password: z.string().min(12, "Use an initial password of at least 12 characters").max(128), role: z.enum(["teacher", "admin"]) }).superRefine((input, ctx) => {
      if (!input.email && !input.mobile) ctx.addIssue({ code: "custom", message: "Provide an email address or mobile number", path: ["email"] });
    })).mutation(async ({ ctx, input }) => {
      const user = await db.createStaffCredentialUser({ fullName: input.fullName, email: input.email || undefined, mobile: input.mobile || undefined, password: input.password, role: input.role });
      if (!user) throw new Error("Could not create the staff account");
      await db.writeAudit({ actorUserId: ctx.user.id, action: "staff_account.created", entityType: "user", entityId: user.id, metadata: { role: input.role, email: user.email, mobile: user.mobile } });
      return { user: safeUser(user) };
    }),
    updatePerson: requireRoles(["super_admin"]).input(z.object({ userId: z.number().int().positive(), role: z.enum(["student", "teacher", "admin"]).optional(), status: z.enum(["active", "suspended"]).optional() }).refine((value) => value.role !== undefined || value.status !== undefined, "Choose a role or status update")).mutation(async ({ ctx, input }) => {
      await db.updateManagedUser(input.userId, { role: input.role, status: input.status });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "person.updated", entityType: "user", entityId: input.userId, metadata: { role: input.role, status: input.status } });
      return { success: true } as const;
    }),
    setTeacherPermission: requireRoles(["super_admin"]).input(z.object({ userId: z.number().int().positive(), permission: z.enum(db.STAFF_PERMISSION_OPTIONS), granted: z.boolean() })).mutation(async ({ ctx, input }) => {
      await db.setManagedUserPermission({ ...input, grantedByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.granted ? "teacher_permission.granted" : "teacher_permission.revoked", entityType: "user_permission", entityId: input.userId, metadata: { permission: input.permission } });
      return { success: true } as const;
    }),
    enrollments: requireRoles(["admin", "super_admin"]).query(() => db.listManagedEnrollments()),
    setEnrollmentStatus: requireRoles(["super_admin"]).input(z.object({ enrollmentId: z.number().int().positive(), status: z.enum(["active", "expired", "revoked"]) })).mutation(async ({ ctx, input }) => {
      await db.setManagedEnrollmentStatus(input.enrollmentId, input.status);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "enrollment.status_changed", entityType: "enrollment", entityId: input.enrollmentId, metadata: { status: input.status } });
      return { success: true } as const;
    }),
    orders: requireRoles(["admin", "super_admin"]).query(() => db.listManagedOrders()),
    reviews: requireRoles(["admin", "super_admin"]).query(() => db.listManagedReviews()),
    setReviewStatus: requireRoles(["super_admin"]).input(z.object({ reviewId: z.number().int().positive(), status: z.enum(["pending", "approved", "hidden"]) })).mutation(async ({ ctx, input }) => {
      await db.setManagedReviewStatus(input.reviewId, input.status);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "review.status_changed", entityType: "review", entityId: input.reviewId, metadata: { status: input.status } });
      return { success: true } as const;
    }),
    announcements: requireRoles(["admin", "super_admin"]).query(() => db.listManagedAnnouncements()),
    resourceDownloadEvents: requireRoles(["admin", "super_admin"]).input(z.object({ cursor: z.number().int().positive().optional(), limit: z.number().int().min(10).max(100).default(50) }).optional()).query(({ input }) => db.listManagedResourceDownloadEvents({ cursor: input?.cursor, limit: input?.limit ?? 50 })),
    createAnnouncement: requireRoles(["admin", "super_admin"]).input(z.object({ title: z.string().trim().min(3).max(220), body: z.string().trim().min(3).max(10000), targetType: z.enum(["all_students", "course", "group", "student"]), targetId: z.number().int().positive().nullable().optional(), isPublished: z.boolean() })).mutation(async ({ ctx, input }) => {
      if (input.targetType !== "all_students" && !input.targetId) throw new Error("Choose a target for this announcement");
      const announcementId = await db.createManagedAnnouncement({ ...input, createdByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "announcement.created", entityType: "announcement", entityId: announcementId, metadata: { targetType: input.targetType, isPublished: input.isPublished } });
      return { announcementId };
    }),
    auditLogs: requireRoles(["super_admin"]).query(() => db.listManagedAuditLogs()),
    rotateStaffPasskey: requireRoles(["super_admin"]).input(z.object({ currentPasskey: z.string().min(1).max(256), nextPasskey: z.string().min(12, "Use at least 12 characters").max(256), confirmation: z.string().min(12).max(256) }).refine((input) => input.nextPasskey === input.confirmation, { message: "The new Staff Passkey confirmation does not match", path: ["confirmation"] })).mutation(async ({ ctx, input }) => {
      const result = await db.rotateStaffPasskey(ctx.user.id, input.currentPasskey, input.nextPasskey);
      if (!result.rotated) throw new TRPCError({ code: "BAD_REQUEST", message: "The current Staff Passkey is incorrect or no active passkey is available." });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "staff_passkey.rotated", entityType: "staff_passkey", metadata: { revokedExistingStaffSessions: true } });
      return { success: true as const };
    }),
    createCategory: requireRoles(["admin", "super_admin"]).input(z.object({ name: z.string().trim().min(3).max(120), slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(140), description: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const categoryId = await db.createCategory(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "category.created", entityType: "category", entityId: categoryId, metadata: { name: input.name } });
      return { categoryId };
    }),
    updateCategory: requireRoles(["admin", "super_admin"]).input(z.object({ categoryId: z.number().int().positive(), name: z.string().trim().min(3).max(120), slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(140), description: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      await db.updateCategory(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "category.updated", entityType: "category", entityId: input.categoryId, metadata: { name: input.name, slug: input.slug } });
      return { success: true as const };
    }),
  }),
});

export type AppRouter = typeof appRouter;
