import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  like,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import {
  appSettings,
  announcements,
  auditLogs,
  authSessions,
  bookmarks,
  categories,
  courseModules,
  courseReviews,
  courses,
  enrollments,
  lessonProgress,
  lessonResources,
  lessons,
  liveClasses,
  notifications,
  orders,
  personalNotes,
  questions,
  testAnswers,
  testAttempts,
  tests,
  userPermissions,
  users,
  type InsertUser,
  type User,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

export const SESSION_DURATION_DAYS = 30;

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expected] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function normalizeIdentity(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeMobile(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const database = await getDb();
  if (!database) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  if (user.fullName !== undefined) {
    values.fullName = user.fullName;
    updateSet.fullName = user.fullName;
  }
  if (user.email !== undefined) {
    values.email = user.email;
    updateSet.email = user.email;
  }
  if (user.loginMethod !== undefined) {
    values.loginMethod = user.loginMethod;
    updateSet.loginMethod = user.loginMethod;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "super_admin";
    updateSet.role = "super_admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await database.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByIdentity(identity: string) {
  const database = await getDb();
  if (!database) return undefined;
  const email = normalizeIdentity(identity);
  const mobile = normalizeMobile(identity);
  const result = await database
    .select()
    .from(users)
    .where(or(eq(users.email, email), eq(users.mobile, mobile)))
    .limit(1);
  return result[0];
}

export async function registerCredentialUser(input: {
  fullName: string;
  email?: string;
  mobile?: string;
  password: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const email = input.email ? normalizeIdentity(input.email) : null;
  const mobile = input.mobile ? normalizeMobile(input.mobile) : null;
  const identityMatch = await database
    .select({ id: users.id })
    .from(users)
    .where(or(email ? eq(users.email, email) : sql`false`, mobile ? eq(users.mobile, mobile) : sql`false`))
    .limit(1);
  if (identityMatch[0]) throw new Error("An account already exists for that email or mobile number");

  const result = await database.insert(users).values({
    openId: `local_${randomUUID()}`,
    fullName: input.fullName.trim(),
    email,
    mobile,
    passwordHash: hashPassword(input.password),
    loginMethod: "password",
    role: "student",
    status: "active",
    lastSignedIn: new Date(),
  });
  const created = await database.select().from(users).where(eq(users.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function authenticateCredentialUser(identity: string, password: string) {
  const user = await getUserByIdentity(identity);
  if (!user || user.status !== "active" || !user.passwordHash) return undefined;
  if (!verifyPassword(password, user.passwordHash)) return undefined;
  const database = await getDb();
  if (database) await database.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return user;
}

export async function createSession(userId: number, userAgent?: string | null) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await database.insert(authSessions).values({
    userId,
    tokenHash: tokenDigest(token),
    userAgent: userAgent?.slice(0, 512) ?? undefined,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function getSessionUser(token: string) {
  const database = await getDb();
  if (!database || !token) return undefined;
  const result = await database
    .select({ user: users, sessionId: authSessions.id })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, tokenDigest(token)),
        sql`${authSessions.revokedAt} IS NULL`,
        gt(authSessions.expiresAt, new Date()),
        eq(users.status, "active"),
      ),
    )
    .limit(1);
  return result[0] ? { user: result[0].user, sessionId: result[0].sessionId } : undefined;
}

export async function revokeSession(sessionId?: number) {
  if (!sessionId) return;
  const database = await getDb();
  if (database) await database.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, sessionId));
}

export async function revokeAllSessions(userId: number) {
  const database = await getDb();
  if (database) {
    await database
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), sql`${authSessions.revokedAt} IS NULL`));
  }
}

export async function listActiveSessions(userId: number) {
  const database = await getDb();
  if (!database) return [];
  return database
    .select({ id: authSessions.id, userAgent: authSessions.userAgent, createdAt: authSessions.createdAt, expiresAt: authSessions.expiresAt })
    .from(authSessions)
    .where(and(eq(authSessions.userId, userId), sql`${authSessions.revokedAt} IS NULL`, gt(authSessions.expiresAt, new Date())))
    .orderBy(desc(authSessions.createdAt));
}

export async function hasPermission(user: User, permission: string) {
  if (user.role === "super_admin") return true;
  const database = await getDb();
  if (!database) return false;
  const grants = await database
    .select({ id: userPermissions.id })
    .from(userPermissions)
    .where(and(eq(userPermissions.userId, user.id), eq(userPermissions.permission, permission)))
    .limit(1);
  return Boolean(grants[0]);
}

export async function listPublicCategories() {
  const database = await getDb();
  if (!database) return [];
  return database
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.displayOrder), asc(categories.name));
}

export async function listPublishedCourses(search?: string, categorySlug?: string) {
  const database = await getDb();
  if (!database) return [];
  const conditions = [eq(courses.status, "published")];
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(like(courses.title, term), like(courses.shortDescription, term))!);
  }
  if (categorySlug) conditions.push(eq(categories.slug, categorySlug));
  return database
    .select({ course: courses, categoryName: categories.name, categorySlug: categories.slug, instructorName: users.fullName })
    .from(courses)
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .leftJoin(users, eq(courses.instructorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(courses.updatedAt));
}

export async function getPublishedCourseBySlug(slug: string) {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database
    .select({ course: courses, categoryName: categories.name, categorySlug: categories.slug, instructorName: users.fullName })
    .from(courses)
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .leftJoin(users, eq(courses.instructorId, users.id))
    .where(and(eq(courses.slug, slug), eq(courses.status, "published")))
    .limit(1);
  return result[0];
}

export async function getEnrollment(userId: number, courseId: number) {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return result[0];
}

export function enrollmentIsActive(enrollment?: { status: string; expiresAt: Date | null }) {
  return Boolean(enrollment && enrollment.status === "active" && (!enrollment.expiresAt || enrollment.expiresAt > new Date()));
}

export async function createFreeEnrollment(userId: number, courseId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const course = await database.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  const selected = course[0];
  if (!selected || selected.status !== "published") throw new Error("This course is not available for enrollment");
  if (selected.accessType !== "free" || Number(selected.sellingPrice) !== 0) throw new Error("This course requires verified payment");
  const existing = await getEnrollment(userId, courseId);
  if (existing && enrollmentIsActive(existing)) return { enrollment: existing, created: false };
  await database.insert(enrollments).values({ userId, courseId, status: "active", expiresAt: null });
  const enrollment = await getEnrollment(userId, courseId);
  return { enrollment, created: true };
}

export async function listMyLearning(userId: number) {
  const database = await getDb();
  if (!database) return [];
  const rows = await database
    .select({ enrollment: enrollments, course: courses, categoryName: categories.name, instructorName: users.fullName })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .leftJoin(users, eq(courses.instructorId, users.id))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.updatedAt));
  const courseIds = rows.map((row) => row.course.id);
  if (!courseIds.length) return [];
  const progressRows = await database
    .select({ courseId: lessonProgress.courseId, completed: sql<number>`sum(case when ${lessonProgress.isCompleted} then 1 else 0 end)` })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.courseId, courseIds)))
    .groupBy(lessonProgress.courseId);
  const completeByCourse = new Map(progressRows.map((row) => [row.courseId, Number(row.completed)]));
  const lessonRows = await database
    .select({ courseId: courseModules.courseId, count: sql<number>`count(${lessons.id})` })
    .from(courseModules)
    .innerJoin(lessons, and(eq(lessons.moduleId, courseModules.id), eq(lessons.isPublished, true)))
    .where(inArray(courseModules.courseId, courseIds))
    .groupBy(courseModules.courseId);
  const lessonCountByCourse = new Map(lessonRows.map((row) => [row.courseId, Number(row.count)]));
  return rows.map((row) => ({
    ...row,
    progress: {
      completedLessons: completeByCourse.get(row.course.id) ?? 0,
      lessonCount: lessonCountByCourse.get(row.course.id) ?? 0,
    },
  }));
}

export async function getCourseLearning(userId: number, courseId: number) {
  const database = await getDb();
  if (!database) return undefined;
  const course = await database.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course[0]) return undefined;
  const enrollment = await getEnrollment(userId, courseId);
  if (!enrollmentIsActive(enrollment)) return { course: course[0], enrolled: false as const, modules: [] };
  const modules = await database
    .select()
    .from(courseModules)
    .where(and(eq(courseModules.courseId, courseId), eq(courseModules.isPublished, true)))
    .orderBy(asc(courseModules.displayOrder));
  const moduleIds = modules.map((item) => item.id);
  const lessonRows = moduleIds.length
    ? await database
        .select({ lesson: lessons, progress: lessonProgress })
        .from(lessons)
        .leftJoin(lessonProgress, and(eq(lessonProgress.lessonId, lessons.id), eq(lessonProgress.userId, userId)))
        .where(and(inArray(lessons.moduleId, moduleIds), eq(lessons.isPublished, true)))
        .orderBy(asc(lessons.displayOrder))
    : [];
  return {
    course: course[0],
    enrolled: true as const,
    modules: modules.map((module) => ({
      ...module,
      lessons: lessonRows.filter((row) => row.lesson.moduleId === module.id),
    })),
  };
}

export async function getAuthorizedLesson(userId: number, lessonId: number) {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database
    .select({ lesson: lessons, module: courseModules, course: courses })
    .from(lessons)
    .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
    .innerJoin(courses, eq(courseModules.courseId, courses.id))
    .where(and(eq(lessons.id, lessonId), eq(lessons.isPublished, true), eq(courseModules.isPublished, true)))
    .limit(1);
  const row = result[0];
  if (!row) return undefined;
  const enrollment = await getEnrollment(userId, row.course.id);
  if (!row.lesson.isPreview && !enrollmentIsActive(enrollment)) return { authorized: false as const, ...row };
  const [resources, progress, note, bookmark] = await Promise.all([
    database.select().from(lessonResources).where(and(eq(lessonResources.lessonId, lessonId), eq(lessonResources.isPublished, true))).orderBy(asc(lessonResources.displayOrder)),
    database.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId))).limit(1),
    database.select().from(personalNotes).where(and(eq(personalNotes.userId, userId), eq(personalNotes.lessonId, lessonId))).limit(1),
    database.select().from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId))).limit(1),
  ]);
  return { authorized: true as const, ...row, resources, progress: progress[0] ?? null, note: note[0] ?? null, bookmarked: Boolean(bookmark[0]) };
}

export async function updateLessonProgress(userId: number, input: { courseId: number; lessonId: number; watchedSeconds: number; completed: boolean }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const existing = await database
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, input.lessonId)))
    .limit(1);
  const now = new Date();
  if (existing[0]) {
    await database
      .update(lessonProgress)
      .set({ watchedSeconds: Math.max(existing[0].watchedSeconds, input.watchedSeconds), isCompleted: input.completed || existing[0].isCompleted, completedAt: input.completed ? now : existing[0].completedAt, lastViewedAt: now })
      .where(eq(lessonProgress.id, existing[0].id));
  } else {
    await database.insert(lessonProgress).values({ userId, courseId: input.courseId, lessonId: input.lessonId, watchedSeconds: input.watchedSeconds, isCompleted: input.completed, completedAt: input.completed ? now : null, lastViewedAt: now });
  }
}

export async function savePersonalNote(userId: number, lessonId: number, body: string) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.insert(personalNotes).values({ userId, lessonId, body }).onDuplicateKeyUpdate({ set: { body, updatedAt: new Date() } });
}

export async function toggleBookmark(userId: number, lessonId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const current = await database.select().from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId))).limit(1);
  if (current[0]) {
    await database.delete(bookmarks).where(eq(bookmarks.id, current[0].id));
    return false;
  }
  await database.insert(bookmarks).values({ userId, lessonId });
  return true;
}

export async function listAvailableTests(userId: number) {
  const database = await getDb();
  if (!database) return [];
  const rows = await database
    .select({ test: tests, courseTitle: courses.title })
    .from(tests)
    .leftJoin(courses, eq(tests.courseId, courses.id))
    .where(eq(tests.status, "published"))
    .orderBy(desc(tests.updatedAt));
  const owned = await database.select({ courseId: enrollments.courseId }).from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.status, "active")));
  const ownedCourseIds = new Set(owned.map((row) => row.courseId));
  return rows.filter((row) => !row.test.courseId || ownedCourseIds.has(row.test.courseId));
}

export async function startTestAttempt(userId: number, testId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const test = await database.select().from(tests).where(and(eq(tests.id, testId), eq(tests.status, "published"))).limit(1);
  if (!test[0]) throw new Error("Test is unavailable");
  if (test[0].courseId) {
    const enrollment = await getEnrollment(userId, test[0].courseId);
    if (!enrollmentIsActive(enrollment)) throw new Error("Course enrollment is required for this test");
  }
  const existing = await database.select().from(testAttempts).where(and(eq(testAttempts.userId, userId), eq(testAttempts.testId, testId), eq(testAttempts.status, "in_progress"))).limit(1);
  const attemptId = existing[0]?.id ?? Number((await database.insert(testAttempts).values({ userId, testId, status: "in_progress" }))[0].insertId);
  const testQuestions = await database.select({ id: questions.id, prompt: questions.prompt, options: questions.options, marks: questions.marks, displayOrder: questions.displayOrder }).from(questions).where(eq(questions.testId, testId)).orderBy(asc(questions.displayOrder));
  return { attemptId, test: test[0], questions: testQuestions };
}

export async function submitTestAttempt(userId: number, attemptId: number, answers: Array<{ questionId: number; selectedOptionIndex: number | null }>) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const attempt = await database.select().from(testAttempts).where(and(eq(testAttempts.id, attemptId), eq(testAttempts.userId, userId))).limit(1);
  if (!attempt[0]) throw new Error("Test attempt was not found");
  if (attempt[0].status !== "in_progress") throw new Error("This attempt has already been submitted");
  const test = await database.select({ durationMinutes: tests.durationMinutes }).from(tests).where(eq(tests.id, attempt[0].testId)).limit(1);
  if (!test[0]) throw new Error("Test configuration was not found");
  const endsAt = attempt[0].startedAt.getTime() + test[0].durationMinutes * 60 * 1000;
  if (Date.now() > endsAt) {
    await database.update(testAttempts).set({ status: "expired", submittedAt: new Date() }).where(eq(testAttempts.id, attemptId));
    throw new Error("The permitted test time has elapsed");
  }
  const testQuestions = await database.select().from(questions).where(eq(questions.testId, attempt[0].testId));
  const answersByQuestion = new Map(answers.map((answer) => [answer.questionId, answer.selectedOptionIndex]));
  const validQuestionIds = new Set(testQuestions.map((question) => question.id));
  if (answers.some((answer) => !validQuestionIds.has(answer.questionId))) throw new Error("Invalid question submission");
  let score = 0;
  const resultRows = testQuestions.map((question) => {
    const selectedOptionIndex = answersByQuestion.get(question.id) ?? null;
    const isCorrect = selectedOptionIndex === question.correctOptionIndex;
    const marksAwarded = isCorrect ? question.marks : 0;
    score += marksAwarded;
    return { attemptId, questionId: question.id, selectedOptionIndex, isCorrect, marksAwarded };
  });
  for (const row of resultRows) {
    await database.insert(testAnswers).values(row).onDuplicateKeyUpdate({ set: { selectedOptionIndex: row.selectedOptionIndex, isCorrect: row.isCorrect, marksAwarded: row.marksAwarded } });
  }
  const totalMarks = testQuestions.reduce((sum, question) => sum + question.marks, 0);
  await database.update(testAttempts).set({ status: "submitted", submittedAt: new Date(), score, totalMarks }).where(eq(testAttempts.id, attemptId));
  return { score, totalMarks, resultRows };
}

export async function listMyNotifications(userId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function listMyLiveClasses(userId: number) {
  const database = await getDb();
  if (!database) return [];
  const owned = await database.select({ courseId: enrollments.courseId }).from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.status, "active")));
  const courseIds = owned.map((row) => row.courseId);
  return database
    .select({ liveClass: liveClasses, courseTitle: courses.title, instructorName: users.fullName })
    .from(liveClasses)
    .leftJoin(courses, eq(liveClasses.courseId, courses.id))
    .leftJoin(users, eq(liveClasses.instructorId, users.id))
    .where(courseIds.length ? or(sql`${liveClasses.courseId} IS NULL`, inArray(liveClasses.courseId, courseIds)) : sql`${liveClasses.courseId} IS NULL`)
    .orderBy(asc(liveClasses.startsAt));
}

export async function getOperationsSummary() {
  const database = await getDb();
  if (!database) return { students: 0, courses: 0, enrollments: 0, upcomingLiveClasses: 0 };
  const [studentCount, courseCount, enrollmentCount, liveCount] = await Promise.all([
    database.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "student")),
    database.select({ count: sql<number>`count(*)` }).from(courses),
    database.select({ count: sql<number>`count(*)` }).from(enrollments),
    database.select({ count: sql<number>`count(*)` }).from(liveClasses).where(and(eq(liveClasses.status, "upcoming"), gt(liveClasses.startsAt, new Date()))),
  ]);
  return { students: Number(studentCount[0]?.count ?? 0), courses: Number(courseCount[0]?.count ?? 0), enrollments: Number(enrollmentCount[0]?.count ?? 0), upcomingLiveClasses: Number(liveCount[0]?.count ?? 0) };
}

export async function listOperationsCourses() {
  const database = await getDb();
  if (!database) return [];
  return database.select({ course: courses, categoryName: categories.name, instructorName: users.fullName }).from(courses).innerJoin(categories, eq(courses.categoryId, categories.id)).leftJoin(users, eq(courses.instructorId, users.id)).orderBy(desc(courses.updatedAt));
}

export async function listOperationsTests() {
  const database = await getDb();
  if (!database) return [];
  return database
    .select({ test: tests, courseTitle: courses.title, questionCount: sql<number>`count(${questions.id})` })
    .from(tests)
    .leftJoin(courses, eq(tests.courseId, courses.id))
    .leftJoin(questions, eq(questions.testId, tests.id))
    .groupBy(tests.id, courses.title)
    .orderBy(desc(tests.updatedAt));
}

export async function getOperationsTest(testId: number) {
  const database = await getDb();
  if (!database) return undefined;
  const test = await database.select().from(tests).where(eq(tests.id, testId)).limit(1);
  if (!test[0]) return undefined;
  const testQuestions = await database.select().from(questions).where(eq(questions.testId, testId)).orderBy(asc(questions.displayOrder));
  return { test: test[0], questions: testQuestions };
}

export async function createManagedTest(input: { courseId?: number | null; title: string; description?: string; durationMinutes: number; passingMarks: number; createdByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(tests).values({ ...input, status: "draft" });
  return Number(result[0].insertId);
}

export async function updateManagedTest(input: { testId: number; courseId?: number | null; title: string; description?: string; durationMinutes: number; passingMarks: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(tests).set({ courseId: input.courseId, title: input.title, description: input.description, durationMinutes: input.durationMinutes, passingMarks: input.passingMarks }).where(eq(tests.id, input.testId));
}

export async function setManagedTestStatus(testId: number, status: "draft" | "published" | "archived") {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(tests).set({ status }).where(eq(tests.id, testId));
}

export async function saveManagedQuestion(input: { questionId?: number; testId: number; prompt: string; options: string[]; correctOptionIndex: number; marks: number; explanation?: string; displayOrder: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  if (input.questionId) {
    await database.update(questions).set({ prompt: input.prompt, options: input.options, correctOptionIndex: input.correctOptionIndex, marks: input.marks, explanation: input.explanation, displayOrder: input.displayOrder }).where(and(eq(questions.id, input.questionId), eq(questions.testId, input.testId)));
    return input.questionId;
  }
  const result = await database.insert(questions).values({ testId: input.testId, prompt: input.prompt, options: input.options, correctOptionIndex: input.correctOptionIndex, marks: input.marks, explanation: input.explanation, displayOrder: input.displayOrder });
  return Number(result[0].insertId);
}

export async function deleteManagedQuestion(questionId: number, testId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.delete(questions).where(and(eq(questions.id, questionId), eq(questions.testId, testId)));
}

export async function listOperationsLiveClasses() {
  const database = await getDb();
  if (!database) return [];
  return database.select({ liveClass: liveClasses, courseTitle: courses.title, instructorName: users.fullName }).from(liveClasses).leftJoin(courses, eq(liveClasses.courseId, courses.id)).leftJoin(users, eq(liveClasses.instructorId, users.id)).orderBy(desc(liveClasses.startsAt));
}

export async function createManagedLiveClass(input: { courseId?: number | null; instructorId: number; title: string; description?: string; startsAt: Date; endsAt?: Date | null; meetingUrl?: string; recordingUrl?: string }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(liveClasses).values({ ...input, status: "upcoming" });
  return Number(result[0].insertId);
}

export async function updateManagedLiveClass(input: { liveClassId: number; courseId?: number | null; title: string; description?: string; startsAt: Date; endsAt?: Date | null; meetingUrl?: string; recordingUrl?: string }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(liveClasses).set({ courseId: input.courseId, title: input.title, description: input.description, startsAt: input.startsAt, endsAt: input.endsAt, meetingUrl: input.meetingUrl, recordingUrl: input.recordingUrl }).where(eq(liveClasses.id, input.liveClassId));
}

export async function setManagedLiveClassStatus(liveClassId: number, status: "upcoming" | "live" | "completed" | "cancelled") {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(liveClasses).set({ status }).where(eq(liveClasses.id, liveClassId));
}

export async function createCourse(input: {
  categoryId: number;
  instructorId?: number | null;
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription?: string;
  mrp: string;
  sellingPrice: string;
  accessType: "free" | "lifetime" | "time_limited";
  accessDurationDays?: number | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(courses).values({ ...input, status: "draft" });
  return Number(result[0].insertId);
}

export async function updateCourse(input: {
  courseId: number;
  categoryId: number;
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription?: string;
  mrp: string;
  sellingPrice: string;
  accessType: "free" | "lifetime" | "time_limited";
  accessDurationDays?: number | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database
    .update(courses)
    .set({
      categoryId: input.categoryId,
      title: input.title,
      slug: input.slug,
      shortDescription: input.shortDescription,
      fullDescription: input.fullDescription,
      mrp: input.mrp,
      sellingPrice: input.sellingPrice,
      accessType: input.accessType,
      accessDurationDays: input.accessDurationDays,
    })
    .where(eq(courses.id, input.courseId));
}

export async function createCategory(input: { name: string; slug: string; description?: string }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(categories).values({
    name: input.name,
    slug: input.slug,
    description: input.description,
    displayOrder: 0,
    isActive: true,
  });
  return Number(result[0].insertId);
}

export async function writeAudit(input: { actorUserId?: number | null; action: string; entityType: string; entityId?: string | number; metadata?: unknown }) {
  const database = await getDb();
  if (!database) return;
  await database.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId?.toString() ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function updateCourseStatus(courseId: number, status: "draft" | "published" | "archived") {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(courses).set({ status }).where(eq(courses.id, courseId));
}

export async function getManagedCourseStructure(courseId: number) {
  const database = await getDb();
  if (!database) return { modules: [], lessons: [] };
  const modules = await database.select().from(courseModules).where(eq(courseModules.courseId, courseId)).orderBy(asc(courseModules.displayOrder));
  const moduleIds = modules.map((module) => module.id);
  const lessonsForModules = moduleIds.length ? await database.select().from(lessons).where(inArray(lessons.moduleId, moduleIds)).orderBy(asc(lessons.displayOrder)) : [];
  return { modules, lessons: lessonsForModules };
}

export async function saveManagedModule(input: { moduleId?: number; courseId: number; title: string; description?: string; displayOrder: number; isPublished: boolean }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  if (input.moduleId) {
    await database.update(courseModules).set({ title: input.title, description: input.description, displayOrder: input.displayOrder, isPublished: input.isPublished }).where(and(eq(courseModules.id, input.moduleId), eq(courseModules.courseId, input.courseId)));
    return input.moduleId;
  }
  const result = await database.insert(courseModules).values({ courseId: input.courseId, title: input.title, description: input.description, displayOrder: input.displayOrder, isPublished: input.isPublished });
  return Number(result[0].insertId);
}

export async function saveManagedLesson(input: { lessonId?: number; moduleId: number; title: string; description?: string; contentType: "video" | "text" | "image" | "pdf" | "mixed"; contentUrl?: string; provider?: string; durationSeconds: number; thumbnailUrl?: string; isPreview: boolean; isPublished: boolean; displayOrder: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const values = { moduleId: input.moduleId, title: input.title, description: input.description, contentType: input.contentType, contentUrl: input.contentUrl, provider: input.provider, durationSeconds: input.durationSeconds, thumbnailUrl: input.thumbnailUrl, isPreview: input.isPreview, isPublished: input.isPublished, displayOrder: input.displayOrder };
  if (input.lessonId) {
    await database.update(lessons).set(values).where(and(eq(lessons.id, input.lessonId), eq(lessons.moduleId, input.moduleId)));
    return input.lessonId;
  }
  const result = await database.insert(lessons).values(values);
  return Number(result[0].insertId);
}

export async function listPublishedAnnouncements() {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(announcements).where(eq(announcements.isPublished, true)).orderBy(desc(announcements.publishedAt));
}

const MANAGED_SETTINGS = [
  "brand.app_name", "brand.tagline", "brand.contact_email", "brand.contact_phone", "brand.whatsapp",
  "homepage.hero_title", "homepage.hero_subtitle", "homepage.hero_cta", "homepage.show_live",
  "platform.registration_enabled", "platform.maintenance_enabled",
] as const;

export type ManagedSettingKey = typeof MANAGED_SETTINGS[number];

export async function getManagedSettings() {
  const database = await getDb();
  if (!database) return {} as Record<ManagedSettingKey, unknown>;
  const rows = await database.select().from(appSettings).where(inArray(appSettings.settingKey, [...MANAGED_SETTINGS]));
  return Object.fromEntries(rows.map((row) => [row.settingKey, row.settingValue])) as Partial<Record<ManagedSettingKey, unknown>>;
}

export async function saveManagedSettings(actorUserId: number, values: Partial<Record<ManagedSettingKey, unknown>>) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  for (const [settingKey, settingValue] of Object.entries(values)) {
    if (!MANAGED_SETTINGS.includes(settingKey as ManagedSettingKey)) continue;
    await database.insert(appSettings).values({ settingKey, settingValue, updatedByUserId: actorUserId }).onDuplicateKeyUpdate({ set: { settingValue, updatedByUserId: actorUserId } });
  }
}

export async function listManagedUsers(search?: string) {
  const database = await getDb();
  if (!database) return [];
  const needle = search?.trim();
  const condition = needle ? or(like(users.fullName, `%${needle}%`), like(users.email, `%${needle}%`), like(users.mobile, `%${needle}%`)) : undefined;
  return database.select({ id: users.id, fullName: users.fullName, email: users.email, mobile: users.mobile, role: users.role, status: users.status, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(condition).orderBy(desc(users.createdAt)).limit(200);
}

export async function updateManagedUser(userId: number, input: { role?: "student" | "teacher" | "admin"; status?: "active" | "suspended" }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(users).set(input).where(eq(users.id, userId));
}

export async function listManagedEnrollments() {
  const database = await getDb();
  if (!database) return [];
  return database.select({ enrollment: enrollments, studentName: users.fullName, studentEmail: users.email, courseTitle: courses.title }).from(enrollments).innerJoin(users, eq(enrollments.userId, users.id)).innerJoin(courses, eq(enrollments.courseId, courses.id)).orderBy(desc(enrollments.updatedAt)).limit(300);
}

export async function setManagedEnrollmentStatus(enrollmentId: number, status: "active" | "expired" | "revoked") {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(enrollments).set({ status }).where(eq(enrollments.id, enrollmentId));
}

export async function listManagedOrders() {
  const database = await getDb();
  if (!database) return [];
  return database.select({ order: orders, studentName: users.fullName, studentEmail: users.email, courseTitle: courses.title }).from(orders).innerJoin(users, eq(orders.userId, users.id)).innerJoin(courses, eq(orders.courseId, courses.id)).orderBy(desc(orders.createdAt)).limit(300);
}

export async function listManagedReviews() {
  const database = await getDb();
  if (!database) return [];
  return database.select({ review: courseReviews, studentName: users.fullName, courseTitle: courses.title }).from(courseReviews).innerJoin(users, eq(courseReviews.userId, users.id)).innerJoin(courses, eq(courseReviews.courseId, courses.id)).orderBy(desc(courseReviews.createdAt)).limit(300);
}

export async function setManagedReviewStatus(reviewId: number, status: "pending" | "approved" | "hidden") {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(courseReviews).set({ status }).where(eq(courseReviews.id, reviewId));
}

export async function listManagedAnnouncements() {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(200);
}

export async function createManagedAnnouncement(input: { title: string; body: string; targetType: "all_students" | "course" | "group" | "student"; targetId?: number | null; isPublished: boolean; createdByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(announcements).values({ ...input, publishedAt: input.isPublished ? new Date() : null });
  return Number(result[0].insertId);
}

export async function listManagedAuditLogs() {
  const database = await getDb();
  if (!database) return [];
  return database.select({ audit: auditLogs, actorName: users.fullName, actorEmail: users.email }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(300);
}
