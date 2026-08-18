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

const optionalUrl = z.string().trim().url().max(2048).optional().or(z.literal(""));
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
    login: publicProcedure.input(z.object({ identity: z.string().trim().min(3).max(320), password: z.string().min(1).max(128), portal: z.enum(["student", "staff"]) })).mutation(async ({ input, ctx }) => {
      const user = await db.authenticateCredentialUser(input.identity, input.password);
      if (!user) throw new Error("Incorrect credentials or inactive account");
      if (input.portal === "student" && user.role !== "student") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This account belongs to the Staff / Admin portal. Please use Staff / Admin Login." });
      }
      if (input.portal === "staff" && user.role === "student") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This account is not authorized for the Staff / Admin portal." });
      }
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
    uiSettings: publicProcedure.query(() => db.getManagedSettings()),
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
    updateCourse: requireRoles(["teacher", "admin", "super_admin"])
      .input(z.object({
        courseId: z.number().int().positive(),
        categoryId: z.number().int().positive(),
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
        await db.updateCourse(input);
        await db.writeAudit({ actorUserId: ctx.user.id, action: "course.updated", entityType: "course", entityId: input.courseId, metadata: { title: input.title } });
        return { success: true } as const;
      }),
    courseStructure: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ courseId: z.number().int().positive() })).query(({ input }) => db.getManagedCourseStructure(input.courseId)),
    saveModule: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ moduleId: z.number().int().positive().optional(), courseId: z.number().int().positive(), title: z.string().trim().min(3).max(220), description: z.string().trim().max(10000).optional(), displayOrder: z.number().int().min(0).max(10000), isPublished: z.boolean() })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "courses.manage");
      const moduleId = await db.saveManagedModule(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.moduleId ? "module.updated" : "module.created", entityType: "module", entityId: moduleId, metadata: { courseId: input.courseId, title: input.title } });
      return { moduleId };
    }),
    saveLesson: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ lessonId: z.number().int().positive().optional(), moduleId: z.number().int().positive(), title: z.string().trim().min(3).max(220), description: z.string().trim().max(10000).optional(), contentType: z.enum(["video", "text", "image", "pdf", "mixed"]), contentUrl: z.string().trim().url().max(2048).optional().or(z.literal("")), provider: z.string().trim().max(64).optional(), durationSeconds: z.number().int().min(0).max(24 * 60 * 60), thumbnailUrl: z.string().trim().url().max(1024).optional().or(z.literal("")), isPreview: z.boolean(), isPublished: z.boolean(), displayOrder: z.number().int().min(0).max(10000) })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "courses.manage");
      const lessonId = await db.saveManagedLesson({ ...input, contentUrl: input.contentUrl || undefined, thumbnailUrl: input.thumbnailUrl || undefined });
      await db.writeAudit({ actorUserId: ctx.user.id, action: input.lessonId ? "lesson.updated" : "lesson.created", entityType: "lesson", entityId: lessonId, metadata: { moduleId: input.moduleId, title: input.title, contentType: input.contentType } });
      return { lessonId };
    }),
    tests: requireRoles(["teacher", "admin", "super_admin"]).query(() => db.listOperationsTests()),
    test: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ testId: z.number().int().positive() })).query(async ({ input }) => {
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
    deleteQuestion: requireRoles(["teacher", "admin", "super_admin"]).input(z.object({ testId: z.number().int().positive(), questionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireDelegatedPermission(ctx.user, "assessments.manage");
      await db.deleteManagedQuestion(input.questionId, input.testId);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "question.deleted", entityType: "question", entityId: input.questionId, metadata: { testId: input.testId } });
      return { success: true } as const;
    }),
    liveClasses: requireRoles(["teacher", "admin", "super_admin"]).query(() => db.listOperationsLiveClasses()),
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
    masterSettings: requireRoles(["super_admin"]).query(() => db.getManagedSettings()),
    saveMasterSettings: requireRoles(["super_admin"]).input(z.object({
      appName: z.string().trim().min(2).max(80).optional(), tagline: z.string().trim().max(160).optional(), contactEmail: z.string().trim().email().max(320).optional(), contactPhone: z.string().trim().max(40).optional(), whatsapp: z.string().trim().max(40).optional(), heroTitle: z.string().trim().max(220).optional(), heroSubtitle: z.string().trim().max(500).optional(), heroCta: z.string().trim().max(80).optional(), showLive: z.boolean().optional(), registrationEnabled: z.boolean().optional(), maintenanceEnabled: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const values = {
        ...(input.appName !== undefined ? { "brand.app_name": input.appName } : {}), ...(input.tagline !== undefined ? { "brand.tagline": input.tagline } : {}), ...(input.contactEmail !== undefined ? { "brand.contact_email": input.contactEmail } : {}), ...(input.contactPhone !== undefined ? { "brand.contact_phone": input.contactPhone } : {}), ...(input.whatsapp !== undefined ? { "brand.whatsapp": input.whatsapp } : {}), ...(input.heroTitle !== undefined ? { "homepage.hero_title": input.heroTitle } : {}), ...(input.heroSubtitle !== undefined ? { "homepage.hero_subtitle": input.heroSubtitle } : {}), ...(input.heroCta !== undefined ? { "homepage.hero_cta": input.heroCta } : {}), ...(input.showLive !== undefined ? { "homepage.show_live": input.showLive } : {}), ...(input.registrationEnabled !== undefined ? { "platform.registration_enabled": input.registrationEnabled } : {}), ...(input.maintenanceEnabled !== undefined ? { "platform.maintenance_enabled": input.maintenanceEnabled } : {}),
      };
      await db.saveManagedSettings(ctx.user.id, values);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "settings.updated", entityType: "app_settings", metadata: { keys: Object.keys(values) } });
      return { success: true } as const;
    }),
    people: requireRoles(["admin", "super_admin"]).input(z.object({ search: z.string().trim().max(160).optional() }).optional()).query(({ input }) => db.listManagedUsers(input?.search)),
    updatePerson: requireRoles(["super_admin"]).input(z.object({ userId: z.number().int().positive(), role: z.enum(["student", "teacher", "admin"]).optional(), status: z.enum(["active", "suspended"]).optional() }).refine((value) => value.role !== undefined || value.status !== undefined, "Choose a role or status update")).mutation(async ({ ctx, input }) => {
      await db.updateManagedUser(input.userId, { role: input.role, status: input.status });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "person.updated", entityType: "user", entityId: input.userId, metadata: { role: input.role, status: input.status } });
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
    createAnnouncement: requireRoles(["admin", "super_admin"]).input(z.object({ title: z.string().trim().min(3).max(220), body: z.string().trim().min(3).max(10000), targetType: z.enum(["all_students", "course", "group", "student"]), targetId: z.number().int().positive().nullable().optional(), isPublished: z.boolean() })).mutation(async ({ ctx, input }) => {
      if (input.targetType !== "all_students" && !input.targetId) throw new Error("Choose a target for this announcement");
      const announcementId = await db.createManagedAnnouncement({ ...input, createdByUserId: ctx.user.id });
      await db.writeAudit({ actorUserId: ctx.user.id, action: "announcement.created", entityType: "announcement", entityId: announcementId, metadata: { targetType: input.targetType, isPublished: input.isPublished } });
      return { announcementId };
    }),
    auditLogs: requireRoles(["super_admin"]).query(() => db.listManagedAuditLogs()),
    createCategory: requireRoles(["admin", "super_admin"]).input(z.object({ name: z.string().trim().min(3).max(120), slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(140), description: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const categoryId = await db.createCategory(input);
      await db.writeAudit({ actorUserId: ctx.user.id, action: "category.created", entityType: "category", entityId: categoryId, metadata: { name: input.name } });
      return { categoryId };
    }),
  }),
});

export type AppRouter = typeof appRouter;
