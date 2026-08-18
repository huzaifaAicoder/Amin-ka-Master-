import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, requireRoles, router } from "./_core/trpc";
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

function requireStaffAccess(role: "student" | "teacher" | "admin" | "super_admin") {
  if (role === "student") throw new Error("Staff access is required");
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

export const appRouter = router({
  system: systemRouter,
  auth: router({
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
    login: publicProcedure.input(z.object({ identity: z.string().trim().min(3).max(320), password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
      const user = await db.authenticateCredentialUser(input.identity, input.password);
      if (!user) throw new Error("Incorrect credentials or inactive account");
      const session = await db.createSession(user.id, ctx.req.headers["user-agent"]);
      return { user: safeUser(user), session };
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
    courses: publicProcedure.input(z.object({ search: z.string().max(100).optional(), categorySlug: z.string().max(140).optional() }).optional()).query(({ input }) => db.listPublishedCourses(input?.search, input?.categorySlug)),
    course: publicProcedure.input(z.object({ slug: z.string().min(1).max(240) })).query(async ({ input }) => {
      const result = await db.getPublishedCourseBySlug(input.slug);
      if (!result) throw new Error("Course was not found");
      return result;
    }),
  }),
  student: router({
    enrollFree: protectedProcedure.input(z.object({ courseId: z.number().int().positive() })).mutation(({ ctx, input }) => db.createFreeEnrollment(ctx.user.id, input.courseId)),
    learning: protectedProcedure.query(({ ctx }) => db.listMyLearning(ctx.user.id)),
    courseLearning: protectedProcedure.input(z.object({ courseId: z.number().int().positive() })).query(({ ctx, input }) => db.getCourseLearning(ctx.user.id, input.courseId)),
    lesson: protectedProcedure.input(z.object({ lessonId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const lesson = await db.getAuthorizedLesson(ctx.user.id, input.lessonId);
      if (!lesson) throw new Error("Lesson was not found");
      return lesson;
    }),
    updateProgress: protectedProcedure.input(z.object({ courseId: z.number().int().positive(), lessonId: z.number().int().positive(), watchedSeconds: z.number().int().min(0).max(24 * 60 * 60), completed: z.boolean() })).mutation(async ({ ctx, input }) => {
      const lesson = await db.getAuthorizedLesson(ctx.user.id, input.lessonId);
      if (!lesson?.authorized || lesson.course.id !== input.courseId) throw new Error("You do not have access to this lesson");
      await db.updateLessonProgress(ctx.user.id, input);
      return { success: true } as const;
    }),
    saveNote: protectedProcedure.input(z.object({ lessonId: z.number().int().positive(), body: z.string().trim().min(1).max(6000) })).mutation(async ({ ctx, input }) => {
      const lesson = await db.getAuthorizedLesson(ctx.user.id, input.lessonId);
      if (!lesson?.authorized) throw new Error("You do not have access to this lesson");
      await db.savePersonalNote(ctx.user.id, input.lessonId, input.body);
      return { success: true } as const;
    }),
    toggleBookmark: protectedProcedure.input(z.object({ lessonId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const lesson = await db.getAuthorizedLesson(ctx.user.id, input.lessonId);
      if (!lesson?.authorized) throw new Error("You do not have access to this lesson");
      return { bookmarked: await db.toggleBookmark(ctx.user.id, input.lessonId) };
    }),
    tests: protectedProcedure.query(({ ctx }) => db.listAvailableTests(ctx.user.id)),
    startTest: protectedProcedure.input(z.object({ testId: z.number().int().positive() })).mutation(({ ctx, input }) => db.startTestAttempt(ctx.user.id, input.testId)),
    submitTest: protectedProcedure.input(z.object({ attemptId: z.number().int().positive(), answers: z.array(z.object({ questionId: z.number().int().positive(), selectedOptionIndex: z.number().int().min(0).max(20).nullable() })).max(250) })).mutation(({ ctx, input }) => db.submitTestAttempt(ctx.user.id, input.attemptId, input.answers)),
    notifications: protectedProcedure.query(({ ctx }) => db.listMyNotifications(ctx.user.id)),
    markNotificationRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.markNotificationRead(ctx.user.id, input.notificationId);
      return { success: true } as const;
    }),
    liveClasses: protectedProcedure.query(({ ctx }) => db.listMyLiveClasses(ctx.user.id)),
  }),
  operations: router({
    summary: requireRoles(["teacher", "admin", "super_admin"]).query(({ ctx }) => {
      requireStaffAccess(ctx.user.role);
      return db.getOperationsSummary();
    }),
    courses: requireRoles(["teacher", "admin", "super_admin"]).query(({ ctx }) => db.listOperationsCourses()),
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
        await requireDelegatedPermission(ctx.user, "courses.manage");
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
    createCategory: requireRoles(["admin", "super_admin"]).input(z.object({ name: z.string().trim().min(3).max(120), slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(140), description: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const categoryId = await db.createCategory(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "category.created", entityType: "category", entityId: categoryId, metadata: { name: input.name } });
      return { categoryId };
    }),
  }),
});

export type AppRouter = typeof appRouter;
