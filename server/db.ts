import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  like,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash, createHmac, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import {
  appSettings,
  announcements,
  auditLogs,
  authSessions,
  bookmarks,
  categories,
  certificates,
  courseModules,
  courseReviews,
  courses,
  enrollments,
  lessonProgress,
  lessonResources,
  lessons,
  liveClasses,
  moduleResources,
  notifications,
  otpChallenges,
  orders,
  personalNotes,
  educationalShorts,
  resourceDownloadEvents,
  shortComments,
  shortLikes,
  shortSaves,
  freePlaylistItems,
  freePlaylists,
  questions,
  staffPasskeys,
  testAnswers,
  testAttempts,
  tests,
  userPermissions,
  users,
  type InsertUser,
  type User,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { storageGetSignedUrl } from "./storage";

export const SESSION_DURATION_DAYS = 30;
export const OTP_CODE_TTL_MS = 10 * 60 * 1000;
export const OTP_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_REQUESTS_PER_HOUR = 3;
export const STAFF_PERMISSION_OPTIONS = [
  "courses.manage",
  "courses.publish",
  "course_content.manage",
  "media.manage",
  "assessments.manage",
  "assessments.publish",
  "live_classes.manage",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSION_OPTIONS)[number];

export function getOtpVerificationState(input: {
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  codeMatches: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.consumedAt || input.expiresAt <= now) return "expired_or_invalid" as const;
  if (input.attemptCount >= OTP_MAX_ATTEMPTS) return "attempt_limit" as const;
  if (input.codeMatches) return "verified" as const;
  return input.attemptCount + 1 >= OTP_MAX_ATTEMPTS ? "attempt_limit" as const : "invalid" as const;
}

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

function otpCodeDigest(userId: number, purpose: "password_reset" | "identity_verification", code: string) {
  if (!ENV.cookieSecret) throw new Error("Password recovery is not securely configured");
  return createHmac("sha256", ENV.cookieSecret).update(`${userId}:${purpose}:${code}`).digest("hex");
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

export async function createStaffCredentialUser(input: {
  fullName: string;
  email?: string;
  mobile?: string;
  password: string;
  role: "teacher" | "admin";
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
    role: input.role,
    status: "active",
    lastSignedIn: new Date(),
  });
  const created = await database.select().from(users).where(eq(users.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function isInitialDeveloperSetupAvailable() {
  const database = await getDb();
  if (!database) return false;
  const existing = await database.select({ id: users.id }).from(users).where(eq(users.role, "developer")).limit(1);
  return !existing[0];
}

export async function createInitialDeveloperCredentialUser(input: { fullName: string; email: string; password: string }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const email = normalizeIdentity(input.email);
  return database.transaction(async (tx) => {
    const existingDeveloper = await tx.select({ id: users.id }).from(users).where(eq(users.role, "developer")).limit(1);
    if (existingDeveloper[0]) return { status: "already_claimed" as const };
    const identityMatch = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (identityMatch[0]) return { status: "identity_exists" as const };
    const result = await tx.insert(users).values({
      openId: `local_${randomUUID()}`,
      fullName: input.fullName.trim(),
      email,
      passwordHash: hashPassword(input.password),
      loginMethod: "password",
      role: "developer",
      status: "active",
      lastSignedIn: new Date(),
    });
    const [user] = await tx.select().from(users).where(eq(users.id, Number(result[0].insertId))).limit(1);
    return { status: "claimed" as const, user };
  });
}

const OWNER_SETUP_CLAIM_KEY = "security.owner_setup_claimed";

export async function isInitialOwnerSetupAvailable() {
  const database = await getDb();
  if (!database) return false;
  const existingClaim = await database.select({ id: appSettings.id }).from(appSettings).where(eq(appSettings.settingKey, OWNER_SETUP_CLAIM_KEY)).limit(1);
  return !existingClaim[0];
}

export async function claimInitialOwnerAccount(input: {
  fullName: string;
  email?: string;
  mobile?: string;
  password: string;
  staffPasskey: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const email = input.email ? normalizeIdentity(input.email) : null;
  const mobile = input.mobile ? normalizeMobile(input.mobile) : null;
  return database.transaction(async (tx) => {
    const existingClaim = await tx.select({ id: appSettings.id }).from(appSettings).where(eq(appSettings.settingKey, OWNER_SETUP_CLAIM_KEY)).limit(1);
    if (existingClaim[0]) return { status: "already_claimed" as const };
    const activeStaffPasskey = await tx.select({ id: staffPasskeys.id }).from(staffPasskeys).where(sql`${staffPasskeys.revokedAt} IS NULL`).limit(1);
    if (activeStaffPasskey[0]) return { status: "staff_passkey_already_configured" as const };
    const identityMatch = await tx.select({ id: users.id }).from(users).where(or(email ? eq(users.email, email) : sql`false`, mobile ? eq(users.mobile, mobile) : sql`false`)).limit(1);
    if (identityMatch[0]) return { status: "identity_exists" as const };
    const result = await tx.insert(users).values({
      openId: `local_${randomUUID()}`,
      fullName: input.fullName.trim(),
      email,
      mobile,
      passwordHash: hashPassword(input.password),
      loginMethod: "password",
      role: "super_admin",
      status: "active",
      lastSignedIn: new Date(),
    });
    const userId = Number(result[0].insertId);
    await tx.insert(staffPasskeys).values({ passkeyHash: hashPassword(input.staffPasskey), createdByUserId: userId });
    await tx.insert(appSettings).values({ settingKey: OWNER_SETUP_CLAIM_KEY, settingValue: { claimedAt: new Date().toISOString() }, updatedByUserId: userId });
    const created = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    return { status: "claimed" as const, user: created[0] };
  });
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

export async function revokeAllStaffSessions() {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const staffUsers = await database
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ["teacher", "admin", "super_admin"]));
  const staffUserIds = staffUsers.map((user) => user.id);
  if (!staffUserIds.length) return;
  await database
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(inArray(authSessions.userId, staffUserIds), sql`${authSessions.revokedAt} IS NULL`));
}

export async function getActiveStaffPasskey() {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const rows = await database
    .select()
    .from(staffPasskeys)
    .where(sql`${staffPasskeys.revokedAt} IS NULL`)
    .orderBy(desc(staffPasskeys.activatedAt))
    .limit(1);
  return rows[0];
}

export async function verifyActiveStaffPasskey(candidate: string) {
  const activePasskey = await getActiveStaffPasskey();
  return Boolean(activePasskey && verifyPassword(candidate, activePasskey.passkeyHash));
}

export async function bootstrapStaffPasskey(actorUserId: number, passkey: string) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const activePasskey = await getActiveStaffPasskey();
  if (activePasskey) return { created: false as const };
  await database.insert(staffPasskeys).values({ passkeyHash: hashPassword(passkey), createdByUserId: actorUserId });
  return { created: true as const };
}

export async function rotateStaffPasskey(actorUserId: number, currentPasskey: string, nextPasskey: string) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const activePasskey = await getActiveStaffPasskey();
  if (!activePasskey || !verifyPassword(currentPasskey, activePasskey.passkeyHash)) return { rotated: false as const };
  const now = new Date();
  await database.transaction(async (tx) => {
    const revoked = await tx
      .update(staffPasskeys)
      .set({ revokedAt: now })
      .where(and(eq(staffPasskeys.id, activePasskey.id), sql`${staffPasskeys.revokedAt} IS NULL`));
    if (revoked[0].affectedRows !== 1) throw new Error("The Staff Passkey has changed. Try again with the current value.");
    await tx.insert(staffPasskeys).values({ passkeyHash: hashPassword(nextPasskey), createdByUserId: actorUserId, activatedAt: now });
  });
  await revokeAllStaffSessions();
  return { rotated: true as const };
}

export async function getRecentOtpCount(destination: string, windowMinutes = 60) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  const result = await database
    .select({ count: sql<number>`count(*)` })
    .from(otpChallenges)
    .where(and(eq(otpChallenges.destination, destination), gte(otpChallenges.createdAt, windowStart)));
  return Number(result[0]?.count ?? 0);
}

export async function createOtpChallenge(input: {
  userId: number;
  purpose: "password_reset" | "identity_verification";
  destination: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const recentCount = await getRecentOtpCount(input.destination, 60);
  if (recentCount >= OTP_MAX_REQUESTS_PER_HOUR) return { status: "rate_limited" as const };

  const now = new Date();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now.getTime() + OTP_CODE_TTL_MS);
  await database
    .update(otpChallenges)
    .set({ consumedAt: now })
    .where(and(eq(otpChallenges.userId, input.userId), eq(otpChallenges.purpose, input.purpose), sql`${otpChallenges.consumedAt} IS NULL`));
  const result = await database.insert(otpChallenges).values({
    userId: input.userId,
    purpose: input.purpose,
    destination: input.destination,
    codeHash: otpCodeDigest(input.userId, input.purpose, code),
    expiresAt,
  });
  return { status: "created" as const, challengeId: Number(result[0].insertId), code, expiresAt };
}

export async function consumeOtpChallenge(challengeId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.id, challengeId), sql`${otpChallenges.consumedAt} IS NULL`));
}

export async function verifyOtpChallenge(input: {
  userId: number;
  purpose: "password_reset" | "identity_verification";
  code: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const challenge = await database
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.userId, input.userId), eq(otpChallenges.purpose, input.purpose), sql`${otpChallenges.consumedAt} IS NULL`))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  const current = challenge[0];
  const now = new Date();
  if (!current || getOtpVerificationState({ expiresAt: current.expiresAt, consumedAt: current.consumedAt, attemptCount: current.attemptCount, codeMatches: false, now }) === "expired_or_invalid") {
    if (current) await database.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, current.id));
    return { status: "expired_or_invalid" as const };
  }
  if (getOtpVerificationState({ expiresAt: current.expiresAt, consumedAt: current.consumedAt, attemptCount: current.attemptCount, codeMatches: false, now }) === "attempt_limit") {
    await database.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, current.id));
    return { status: "attempt_limit" as const };
  }

  const expected = Buffer.from(current.codeHash, "hex");
  const actual = Buffer.from(otpCodeDigest(input.userId, input.purpose, input.code), "hex");
  const codeMatches = expected.length === actual.length && timingSafeEqual(expected, actual);
  const state = getOtpVerificationState({ expiresAt: current.expiresAt, consumedAt: current.consumedAt, attemptCount: current.attemptCount, codeMatches, now });
  if (state !== "verified") {
    const nextAttemptCount = current.attemptCount + 1;
    await database
      .update(otpChallenges)
      .set({ attemptCount: nextAttemptCount, ...(nextAttemptCount >= OTP_MAX_ATTEMPTS ? { consumedAt: now } : {}) })
      .where(eq(otpChallenges.id, current.id));
    return { status: state };
  }

  await database.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, current.id));
  return { status: "verified" as const, challengeId: current.id };
}

export async function createPasswordResetToken(challengeId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + OTP_RESET_TOKEN_TTL_MS);
  await database
    .update(otpChallenges)
    .set({ resetTokenHash: tokenDigest(token), resetTokenExpiresAt: expiresAt, resetTokenUsedAt: null })
    .where(and(eq(otpChallenges.id, challengeId), sql`${otpChallenges.consumedAt} IS NOT NULL`));
  return { token, expiresAt };
}

export async function resetPasswordWithToken(resetToken: string, newPassword: string) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const now = new Date();
  const challenges = await database
    .select()
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.resetTokenHash, tokenDigest(resetToken)),
        sql`${otpChallenges.resetTokenUsedAt} IS NULL`,
        gt(otpChallenges.resetTokenExpiresAt, now),
      ),
    )
    .limit(1);
  const challenge = challenges[0];
  if (!challenge) return { status: "invalid_or_expired" as const };

  await database.transaction(async (tx) => {
    const markedUsed = await tx
      .update(otpChallenges)
      .set({ resetTokenUsedAt: now })
      .where(and(eq(otpChallenges.id, challenge.id), sql`${otpChallenges.resetTokenUsedAt} IS NULL`));
    if (markedUsed[0].affectedRows !== 1) throw new Error("Recovery token has already been used");
    await tx.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, challenge.userId));
    await tx
      .update(authSessions)
      .set({ revokedAt: now })
      .where(and(eq(authSessions.userId, challenge.userId), sql`${authSessions.revokedAt} IS NULL`));
  });
  return { status: "reset" as const, userId: challenge.userId };
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

export async function hasAnyPermission(user: User, permissions: readonly string[]) {
  if (user.role === "super_admin") return true;
  const database = await getDb();
  if (!database) return false;
  const grants = await database
    .select({ id: userPermissions.id })
    .from(userPermissions)
    .where(and(eq(userPermissions.userId, user.id), inArray(userPermissions.permission, [...permissions])))
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
  const resourceRows = moduleIds.length
    ? await database
        .select()
        .from(moduleResources)
        .where(and(inArray(moduleResources.moduleId, moduleIds), eq(moduleResources.isPublished, true)))
        .orderBy(asc(moduleResources.displayOrder))
    : [];
  const securedResources = await Promise.all(resourceRows.map(async (resource) => ({
    ...resource,
    contentUrl: await resolveManagedMediaUrl(resource.contentUrl, resource.storageKey),
  })));
  return {
    course: course[0],
    enrolled: true as const,
    modules: modules.map((module) => ({
      ...module,
      lessons: lessonRows.filter((row) => row.lesson.moduleId === module.id),
      resources: securedResources.filter((resource) => resource.moduleId === module.id),
    })),
  };
}

export async function getAuthorizedResourceDownload(userId: number, resourceId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const rows = await database
    .select({ resource: moduleResources, module: courseModules, course: courses })
    .from(moduleResources)
    .innerJoin(courseModules, eq(moduleResources.moduleId, courseModules.id))
    .innerJoin(courses, eq(courseModules.courseId, courses.id))
    .where(and(
      eq(moduleResources.id, resourceId),
      eq(moduleResources.resourceType, "pdf"),
      eq(moduleResources.isPublished, true),
      eq(moduleResources.downloadAllowed, true),
      eq(courseModules.isPublished, true),
    ))
    .limit(1);
  const row = rows[0];
  if (!row) return { status: "unavailable" as const };

  const enrollment = await getEnrollment(userId, row.course.id);
  if (!enrollmentIsActive(enrollment)) return { status: "not_enrolled" as const };

  const storageKey = managedStorageKey(row.resource.contentUrl, row.resource.storageKey);
  if (!storageKey) return { status: "unavailable" as const };

  const signedUrl = await storageGetSignedUrl(storageKey);
  await database.insert(resourceDownloadEvents).values({ userId, resourceId, resourceType: "pdf" });
  return {
    status: "authorized" as const,
    signedUrl,
    resource: { id: row.resource.id, title: row.resource.title, mimeType: row.resource.mimeType ?? "application/pdf" },
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
  const securedResources = await Promise.all(resources.map(async (resource) => ({
    ...resource,
    externalUrl: await resolveManagedMediaUrl(resource.externalUrl, resource.storageKey),
  })));
  return {
    authorized: true as const,
    ...row,
    lesson: { ...row.lesson, contentUrl: await resolveManagedMediaUrl(row.lesson.contentUrl) },
    resources: securedResources,
    progress: progress[0] ?? null,
    note: note[0] ?? null,
    bookmarked: Boolean(bookmark[0]),
  };
}

async function issueCourseCertificateIfComplete(database: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, courseId: number) {
  const publishedLessons = await database.select({ id: lessons.id }).from(lessons).innerJoin(courseModules, eq(lessons.moduleId, courseModules.id)).where(and(eq(courseModules.courseId, courseId), eq(courseModules.isPublished, true), eq(lessons.isPublished, true)));
  if (!publishedLessons.length) return undefined;
  const completedRows = await database.select({ id: lessonProgress.id }).from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.courseId, courseId), eq(lessonProgress.isCompleted, true)));
  if (completedRows.length < publishedLessons.length) return undefined;
  const existing = await database.select().from(certificates).where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId))).limit(1);
  if (existing[0]) return existing[0];
  const [course, user] = await Promise.all([
    database.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId)).limit(1),
    database.select({ fullName: users.fullName }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  if (!course[0] || !user[0]) return undefined;
  await database.insert(certificates).values({ userId, courseId, certificateCode: `AKM-${new Date().getFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}` });
  const issued = await database.select().from(certificates).where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId))).limit(1);
  return issued[0];
}

export async function listMyCertificates(userId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select({ certificate: certificates, courseTitle: courses.title }).from(certificates).innerJoin(courses, eq(certificates.courseId, courses.id)).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));
}

export async function getMyCertificate(userId: number, certificateId: number) {
  const database = await getDb();
  if (!database) return undefined;
  const rows = await database.select({ certificate: certificates, courseTitle: courses.title, recipientName: users.fullName }).from(certificates).innerJoin(courses, eq(certificates.courseId, courses.id)).innerJoin(users, eq(certificates.userId, users.id)).where(and(eq(certificates.id, certificateId), eq(certificates.userId, userId))).limit(1);
  return rows[0];
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
  return issueCourseCertificateIfComplete(database, userId, input.courseId);
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
  const testQuestions = await database.select({ id: questions.id, prompt: questions.prompt, options: questions.options, marks: questions.marks, displayOrder: questions.displayOrder }).from(questions).where(eq(questions.testId, testId)).orderBy(asc(questions.displayOrder));
  let activeAttempt: typeof testAttempts.$inferSelect | undefined = existing[0];
  if (activeAttempt && Date.now() >= activeAttempt.startedAt.getTime() + test[0].durationMinutes * 60 * 1000) {
    const scoredQuestions = await database.select().from(questions).where(eq(questions.testId, testId)).orderBy(asc(questions.displayOrder));
    await saveScoredAttempt(database, activeAttempt, test[0], scoredQuestions, [], "expired");
    activeAttempt = undefined;
  }
  if (!activeAttempt) {
    const result = await database.insert(testAttempts).values({ userId, testId, status: "in_progress" });
    const attemptId = Number(result[0].insertId);
    activeAttempt = { id: attemptId, userId, testId, status: "in_progress", startedAt: new Date(), submittedAt: null, score: 0, totalMarks: 0, createdAt: new Date() };
  }
  const remainingSeconds = Math.max(0, test[0].durationMinutes * 60 - getAttemptElapsedSeconds(activeAttempt.startedAt, new Date(), test[0].durationMinutes));
  return { attemptId: activeAttempt.id, test: test[0], questions: testQuestions, startedAt: activeAttempt.startedAt, remainingSeconds };
}

type ScoredAttemptAnswer = {
  attemptId: number;
  questionId: number;
  selectedOptionIndex: number | null;
  isCorrect: boolean;
  marksAwarded: number;
};

function getAttemptElapsedSeconds(startedAt: Date, completedAt: Date | null, durationMinutes: number) {
  const rawElapsed = Math.max(0, Math.floor(((completedAt ?? new Date()).getTime() - startedAt.getTime()) / 1000));
  return Math.min(rawElapsed, durationMinutes * 60);
}

function buildAttemptReview(
  attempt: typeof testAttempts.$inferSelect,
  test: typeof tests.$inferSelect,
  testQuestions: Array<typeof questions.$inferSelect>,
  answerRows: ScoredAttemptAnswer[],
) {
  const answersByQuestion = new Map(answerRows.map((answer) => [answer.questionId, answer]));
  const calculatedTotalMarks = testQuestions.reduce((sum, question) => sum + question.marks, 0);
  const totalMarks = attempt.totalMarks || calculatedTotalMarks;
  const score = attempt.score;
  return {
    attemptId: attempt.id,
    testId: test.id,
    testTitle: test.title,
    status: attempt.status,
    score,
    totalMarks,
    passingMarks: test.passingMarks,
    durationMinutes: test.durationMinutes,
    elapsedSeconds: getAttemptElapsedSeconds(attempt.startedAt, attempt.submittedAt, test.durationMinutes),
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    review: testQuestions.map((question) => {
      const answer = answersByQuestion.get(question.id);
      return {
        questionId: question.id,
        prompt: question.prompt,
        options: question.options,
        selectedOptionIndex: answer?.selectedOptionIndex ?? null,
        correctOptionIndex: question.correctOptionIndex,
        isCorrect: answer?.isCorrect ?? false,
        marksAwarded: answer?.marksAwarded ?? 0,
        explanation: question.explanation,
      };
    }),
  };
}

async function saveScoredAttempt(
  database: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  attempt: typeof testAttempts.$inferSelect,
  test: typeof tests.$inferSelect,
  testQuestions: Array<typeof questions.$inferSelect>,
  answers: Array<{ questionId: number; selectedOptionIndex: number | null }>,
  status: "submitted" | "expired",
) {
  const answersByQuestion = new Map(answers.map((answer) => [answer.questionId, answer.selectedOptionIndex]));
  const resultRows: ScoredAttemptAnswer[] = testQuestions.map((question) => {
    // Answers are deliberately discarded after the server-authoritative deadline.
    const selectedOptionIndex = status === "expired" ? null : answersByQuestion.get(question.id) ?? null;
    const isCorrect = selectedOptionIndex === question.correctOptionIndex;
    return { attemptId: attempt.id, questionId: question.id, selectedOptionIndex, isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
  });
  const score = resultRows.reduce((sum, answer) => sum + answer.marksAwarded, 0);
  const totalMarks = testQuestions.reduce((sum, question) => sum + question.marks, 0);
  const submittedAt = new Date();
  for (const row of resultRows) {
    await database.insert(testAnswers).values(row).onDuplicateKeyUpdate({ set: { selectedOptionIndex: row.selectedOptionIndex, isCorrect: row.isCorrect, marksAwarded: row.marksAwarded } });
  }
  await database.update(testAttempts).set({ status, submittedAt, score, totalMarks }).where(eq(testAttempts.id, attempt.id));
  return buildAttemptReview({ ...attempt, status, submittedAt, score, totalMarks }, test, testQuestions, resultRows);
}

export async function submitTestAttempt(userId: number, attemptId: number, answers: Array<{ questionId: number; selectedOptionIndex: number | null }>) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const attempt = await database.select().from(testAttempts).where(and(eq(testAttempts.id, attemptId), eq(testAttempts.userId, userId))).limit(1);
  if (!attempt[0]) throw new Error("Test attempt was not found");
  if (attempt[0].status !== "in_progress") throw new Error("This attempt has already been submitted");
  const test = await database.select().from(tests).where(eq(tests.id, attempt[0].testId)).limit(1);
  if (!test[0]) throw new Error("Test configuration was not found");
  const testQuestions = await database.select().from(questions).where(eq(questions.testId, attempt[0].testId)).orderBy(asc(questions.displayOrder));
  const validQuestionIds = new Set(testQuestions.map((question) => question.id));
  if (answers.some((answer) => !validQuestionIds.has(answer.questionId))) throw new Error("Invalid question submission");
  const endsAt = attempt[0].startedAt.getTime() + test[0].durationMinutes * 60 * 1000;
  if (Date.now() > endsAt) {
    return saveScoredAttempt(database, attempt[0], test[0], testQuestions, [], "expired");
  }
  return saveScoredAttempt(database, attempt[0], test[0], testQuestions, answers, "submitted");
}

export async function listMyTestAttempts(userId: number) {
  const database = await getDb();
  if (!database) return [];
  const rows = await database
    .select({ attempt: testAttempts, test: tests, courseTitle: courses.title })
    .from(testAttempts)
    .innerJoin(tests, eq(testAttempts.testId, tests.id))
    .leftJoin(courses, eq(tests.courseId, courses.id))
    .where(eq(testAttempts.userId, userId))
    .orderBy(desc(testAttempts.startedAt))
    .limit(60);
  return rows.map(({ attempt, test, courseTitle }) => ({
    attemptId: attempt.id,
    testId: test.id,
    testTitle: test.title,
    courseTitle,
    status: attempt.status,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    passingMarks: test.passingMarks,
    durationMinutes: test.durationMinutes,
    elapsedSeconds: getAttemptElapsedSeconds(attempt.startedAt, attempt.submittedAt, test.durationMinutes),
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
  }));
}

export async function getMyTestAttemptReview(userId: number, attemptId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const rows = await database
    .select({ attempt: testAttempts, test: tests })
    .from(testAttempts)
    .innerJoin(tests, eq(testAttempts.testId, tests.id))
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.attempt.status === "in_progress") return { status: "in_progress" as const, attemptId: row.attempt.id, testId: row.test.id };
  const [testQuestions, answerRows] = await Promise.all([
    database.select().from(questions).where(eq(questions.testId, row.test.id)).orderBy(asc(questions.displayOrder)),
    database.select().from(testAnswers).where(eq(testAnswers.attemptId, row.attempt.id)),
  ]);
  return buildAttemptReview(row.attempt, row.test, testQuestions, answerRows);
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
  try {
    const [studentCount, courseCount, enrollmentCount, liveCount] = await Promise.all([
      database.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "student")),
      database.select({ count: sql<number>`count(*)` }).from(courses),
      database.select({ count: sql<number>`count(*)` }).from(enrollments),
      database.select({ count: sql<number>`count(*)` }).from(liveClasses).where(and(eq(liveClasses.status, "upcoming"), gt(liveClasses.startsAt, new Date()))),
    ]);
    return { students: Number(studentCount[0]?.count ?? 0), courses: Number(courseCount[0]?.count ?? 0), enrollments: Number(enrollmentCount[0]?.count ?? 0), upcomingLiveClasses: Number(liveCount[0]?.count ?? 0) };
  } catch (error) {
    console.error("[Operations] Summary aggregation failed; returning safe zero totals", error);
    return { students: 0, courses: 0, enrollments: 0, upcomingLiveClasses: 0 };
  }
}

export async function listOperationsCourses() {
  const database = await getDb();
  if (!database) return [];
  try {
    return await database.select({ course: courses, categoryName: categories.name, instructorName: users.fullName }).from(courses).innerJoin(categories, eq(courses.categoryId, categories.id)).leftJoin(users, eq(courses.instructorId, users.id)).orderBy(desc(courses.updatedAt));
  } catch (error) {
    console.error("[Operations] Course list query failed; returning an empty operational list", error);
    return [];
  }
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
    const existing = await database.select({ id: questions.id }).from(questions).where(and(eq(questions.id, input.questionId), eq(questions.testId, input.testId))).limit(1);
    if (!existing[0]) throw new Error("Question was not found in this test");
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
  status?: "draft" | "published" | "archived";
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database
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
      ...(input.status ? { status: input.status } : {}),
    })
    .where(eq(courses.id, input.courseId));
  if (result[0].affectedRows !== 1) throw new Error("Course was not found or could not be updated");
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
  const resources = moduleIds.length ? await database.select().from(moduleResources).where(inArray(moduleResources.moduleId, moduleIds)).orderBy(asc(moduleResources.displayOrder)) : [];
  return { modules, lessons: lessonsForModules, resources };
}

export async function saveModuleResource(input: {
  resourceId?: number;
  moduleId: number;
  title: string;
  description?: string;
  resourceType: "video" | "pdf";
  contentUrl?: string;
  storageKey?: string;
  provider?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds: number;
  thumbnailUrl?: string;
  isPublished: boolean;
  downloadAllowed: boolean;
  displayOrder: number;
  createdByUserId: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const values = { moduleId: input.moduleId, title: input.title, description: input.description, resourceType: input.resourceType, contentUrl: input.contentUrl, storageKey: input.storageKey, provider: input.provider, mimeType: input.mimeType, sizeBytes: input.sizeBytes, durationSeconds: input.durationSeconds, thumbnailUrl: input.thumbnailUrl, isPublished: input.isPublished, downloadAllowed: input.downloadAllowed, displayOrder: input.displayOrder };
  if (input.resourceId) {
    await database.update(moduleResources).set(values).where(and(eq(moduleResources.id, input.resourceId), eq(moduleResources.moduleId, input.moduleId)));
    return input.resourceId;
  }
  const result = await database.insert(moduleResources).values({ ...values, createdByUserId: input.createdByUserId });
  return Number(result[0].insertId);
}

export async function listOperationsFreePlaylists() {
  const database = await getDb();
  if (!database) return { playlists: [], items: [] };
  const playlists = await database.select().from(freePlaylists).orderBy(asc(freePlaylists.displayOrder), desc(freePlaylists.updatedAt));
  const playlistIds = playlists.map((playlist) => playlist.id);
  const items = playlistIds.length ? await database.select().from(freePlaylistItems).where(inArray(freePlaylistItems.playlistId, playlistIds)).orderBy(asc(freePlaylistItems.displayOrder)) : [];
  return { playlists, items };
}

export async function saveFreePlaylist(input: { playlistId?: number; title: string; description?: string; thumbnailUrl?: string; isPublished: boolean; displayOrder: number; createdByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const values = { title: input.title, description: input.description, thumbnailUrl: input.thumbnailUrl, isPublished: input.isPublished, displayOrder: input.displayOrder };
  if (input.playlistId) {
    await database.update(freePlaylists).set(values).where(eq(freePlaylists.id, input.playlistId));
    return input.playlistId;
  }
  const result = await database.insert(freePlaylists).values({ ...values, createdByUserId: input.createdByUserId });
  return Number(result[0].insertId);
}

export async function saveFreePlaylistItem(input: {
  itemId?: number;
  playlistId: number;
  title: string;
  description?: string;
  contentType: "video" | "pdf";
  contentUrl?: string;
  storageKey?: string;
  provider?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds: number;
  thumbnailUrl?: string;
  isPublished: boolean;
  displayOrder: number;
  createdByUserId: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const values = { playlistId: input.playlistId, title: input.title, description: input.description, contentType: input.contentType, contentUrl: input.contentUrl, storageKey: input.storageKey, provider: input.provider, mimeType: input.mimeType, sizeBytes: input.sizeBytes, durationSeconds: input.durationSeconds, thumbnailUrl: input.thumbnailUrl, isPublished: input.isPublished, displayOrder: input.displayOrder };
  if (input.itemId) {
    await database.update(freePlaylistItems).set(values).where(and(eq(freePlaylistItems.id, input.itemId), eq(freePlaylistItems.playlistId, input.playlistId)));
    return input.itemId;
  }
  const result = await database.insert(freePlaylistItems).values({ ...values, createdByUserId: input.createdByUserId });
  return Number(result[0].insertId);
}

export async function listPublishedFreePlaylists() {
  const database = await getDb();
  if (!database) return { playlists: [], items: [] };
  const playlists = await database.select().from(freePlaylists).where(eq(freePlaylists.isPublished, true)).orderBy(asc(freePlaylists.displayOrder));
  const playlistIds = playlists.map((playlist) => playlist.id);
  const items = playlistIds.length ? await database.select().from(freePlaylistItems).where(and(inArray(freePlaylistItems.playlistId, playlistIds), eq(freePlaylistItems.isPublished, true))).orderBy(asc(freePlaylistItems.displayOrder)) : [];
  return {
    playlists,
    items: await Promise.all(items.map(async (item) => ({
      ...item,
      contentUrl: await resolveManagedMediaUrl(item.contentUrl, item.storageKey),
    }))),
  };
}

export async function listOperationsShorts() {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(educationalShorts).orderBy(desc(educationalShorts.updatedAt));
}

export async function saveEducationalShort(input: { shortId?: number; title: string; description?: string; videoUrl: string; storageKey?: string; provider?: string; mimeType?: string; sizeBytes?: number; durationSeconds: number; thumbnailUrl?: string; sourceType?: "managed" | "youtube" | "instagram"; status: "draft" | "pending" | "published" | "rejected" | "archived"; displayOrder: number; createdByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const values = { title: input.title, description: input.description, videoUrl: input.videoUrl, storageKey: input.storageKey, provider: input.provider, mimeType: input.mimeType, sizeBytes: input.sizeBytes, durationSeconds: input.durationSeconds, thumbnailUrl: input.thumbnailUrl, sourceType: input.sourceType ?? "managed", status: input.status, displayOrder: input.displayOrder };
  if (input.shortId) {
    await database.update(educationalShorts).set(values).where(eq(educationalShorts.id, input.shortId));
    return input.shortId;
  }
  const result = await database.insert(educationalShorts).values({ ...values, createdByUserId: input.createdByUserId });
  return Number(result[0].insertId);
}

export async function setEducationalShortStatus(shortId: number, status: "draft" | "pending" | "published" | "rejected" | "archived") {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(educationalShorts).set({ status }).where(eq(educationalShorts.id, shortId));
}

function managedStorageKey(contentUrl?: string | null, storageKey?: string | null) {
  if (storageKey?.trim()) return storageKey;
  if (!contentUrl?.startsWith("/manus-storage/")) return undefined;
  return contentUrl.slice("/manus-storage/".length);
}

async function resolveManagedMediaUrl(contentUrl?: string | null, storageKey?: string | null) {
  const key = managedStorageKey(contentUrl, storageKey);
  if (!key) return contentUrl ?? null;
  return storageGetSignedUrl(key);
}

export async function listPublishedShorts(userId: number) {
  const database = await getDb();
  if (!database) return [];
  const shorts = await database.select().from(educationalShorts).where(eq(educationalShorts.status, "published")).orderBy(asc(educationalShorts.displayOrder), desc(educationalShorts.createdAt));
  if (!shorts.length) return [];

  const shortIds = shorts.map((short) => short.id);
  const [likeRows, studentLikeRows, studentSaveRows, commentRows] = await Promise.all([
    database.select({ shortId: shortLikes.shortId }).from(shortLikes).where(inArray(shortLikes.shortId, shortIds)),
    database.select({ shortId: shortLikes.shortId }).from(shortLikes).where(and(eq(shortLikes.userId, userId), inArray(shortLikes.shortId, shortIds))),
    database.select({ shortId: shortSaves.shortId }).from(shortSaves).where(and(eq(shortSaves.userId, userId), inArray(shortSaves.shortId, shortIds))),
    database.select({ shortId: shortComments.shortId }).from(shortComments).where(and(inArray(shortComments.shortId, shortIds), eq(shortComments.status, "published"))),
  ]);
  const likeCounts = new Map<number, number>();
  for (const row of likeRows) likeCounts.set(row.shortId, (likeCounts.get(row.shortId) ?? 0) + 1);
  const likedShortIds = new Set(studentLikeRows.map((row) => row.shortId));
  const savedShortIds = new Set(studentSaveRows.map((row) => row.shortId));
  const commentCounts = new Map<number, number>();
  for (const row of commentRows) commentCounts.set(row.shortId, (commentCounts.get(row.shortId) ?? 0) + 1);

  return Promise.all(shorts.map(async (short) => ({
    ...short,
    videoUrl: (await resolveManagedMediaUrl(short.videoUrl, short.storageKey)) ?? short.videoUrl,
    likeCount: likeCounts.get(short.id) ?? 0,
    isLiked: likedShortIds.has(short.id),
    isSaved: savedShortIds.has(short.id),
    commentCount: commentCounts.get(short.id) ?? 0,
  })));
}

export async function listSavedShorts(userId: number) {
  const database = await getDb();
  if (!database) return [];
  const savedRows = await database
    .select({ short: educationalShorts })
    .from(shortSaves)
    .innerJoin(educationalShorts, eq(shortSaves.shortId, educationalShorts.id))
    .where(and(eq(shortSaves.userId, userId), eq(educationalShorts.status, "published")))
    .orderBy(desc(shortSaves.createdAt));
  const shorts = savedRows.map((row) => row.short);
  if (!shorts.length) return [];
  const shortIds = shorts.map((short) => short.id);
  const [likeRows, studentLikeRows] = await Promise.all([
    database.select({ shortId: shortLikes.shortId }).from(shortLikes).where(inArray(shortLikes.shortId, shortIds)),
    database.select({ shortId: shortLikes.shortId }).from(shortLikes).where(and(eq(shortLikes.userId, userId), inArray(shortLikes.shortId, shortIds))),
  ]);
  const likeCounts = new Map<number, number>();
  for (const row of likeRows) likeCounts.set(row.shortId, (likeCounts.get(row.shortId) ?? 0) + 1);
  const likedShortIds = new Set(studentLikeRows.map((row) => row.shortId));
  return Promise.all(shorts.map(async (short) => ({
    ...short,
    videoUrl: (await resolveManagedMediaUrl(short.videoUrl, short.storageKey)) ?? short.videoUrl,
    likeCount: likeCounts.get(short.id) ?? 0,
    isLiked: likedShortIds.has(short.id),
    isSaved: true,
  })));
}

async function isPublishedShort(shortId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [short] = await database.select({ id: educationalShorts.id }).from(educationalShorts).where(and(eq(educationalShorts.id, shortId), eq(educationalShorts.status, "published"))).limit(1);
  return Boolean(short);
}

export async function toggleShortLike(userId: number, shortId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  if (!(await isPublishedShort(shortId))) return null;
  const [existing] = await database.select({ id: shortLikes.id }).from(shortLikes).where(and(eq(shortLikes.userId, userId), eq(shortLikes.shortId, shortId))).limit(1);
  const liked = !existing;
  if (existing) {
    await database.delete(shortLikes).where(eq(shortLikes.id, existing.id));
  } else {
    await database.insert(shortLikes).values({ userId, shortId });
  }
  const [count] = await database.select({ count: sql<number>`count(*)` }).from(shortLikes).where(eq(shortLikes.shortId, shortId));
  return { liked, likeCount: Number(count?.count ?? 0) };
}

export async function toggleShortSave(userId: number, shortId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  if (!(await isPublishedShort(shortId))) return null;
  const [existing] = await database.select({ id: shortSaves.id }).from(shortSaves).where(and(eq(shortSaves.userId, userId), eq(shortSaves.shortId, shortId))).limit(1);
  const saved = !existing;
  if (existing) {
    await database.delete(shortSaves).where(eq(shortSaves.id, existing.id));
  } else {
    await database.insert(shortSaves).values({ userId, shortId });
  }
  return { saved };
}

export async function listShortComments(shortId: number) {
  const database = await getDb();
  if (!database) return [];
  if (!(await isPublishedShort(shortId))) return null;
  return database
    .select({
      id: shortComments.id,
      body: shortComments.body,
      createdAt: shortComments.createdAt,
      userId: users.id,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(shortComments)
    .innerJoin(users, eq(shortComments.userId, users.id))
    .where(and(eq(shortComments.shortId, shortId), eq(shortComments.status, "published")))
    .orderBy(desc(shortComments.createdAt))
    .limit(100);
}

export async function addShortComment(userId: number, shortId: number, body: string) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  if (!(await isPublishedShort(shortId))) return null;
  const result = await database.insert(shortComments).values({ userId, shortId, body });
  const commentId = Number(result[0].insertId);
  const [comment] = await database
    .select({ id: shortComments.id, body: shortComments.body, createdAt: shortComments.createdAt, userId: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
    .from(shortComments)
    .innerJoin(users, eq(shortComments.userId, users.id))
    .where(eq(shortComments.id, commentId))
    .limit(1);
  return comment ?? null;
}

export async function submitStudentShort(input: { userId: number; title: string; description?: string; subjectCategory: string; videoUrl: string; storageKey: string; provider?: string; mimeType?: string; sizeBytes?: number; durationSeconds: number; thumbnailUrl?: string }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [student] = await database.select({ role: users.role, canUploadShorts: users.canUploadShorts }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!student || student.role !== "student" || !student.canUploadShorts) throw new Error("Short uploads are not enabled for this student account.");
  const result = await database.insert(educationalShorts).values({
    title: input.title,
    description: input.description,
    subjectCategory: input.subjectCategory,
    videoUrl: input.videoUrl,
    storageKey: input.storageKey,
    provider: input.provider,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    durationSeconds: input.durationSeconds,
    thumbnailUrl: input.thumbnailUrl,
    sourceType: "managed",
    status: "pending",
    displayOrder: 0,
    createdByUserId: input.userId,
  });
  return Number(result[0].insertId);
}

export async function listMyShortSubmissions(userId: number) {
  const database = await getDb();
  if (!database) return [];
  const rows = await database.select().from(educationalShorts).where(eq(educationalShorts.createdByUserId, userId)).orderBy(desc(educationalShorts.updatedAt));
  return Promise.all(rows.map(async (short) => ({ ...short, videoUrl: (await resolveManagedMediaUrl(short.videoUrl, short.storageKey)) ?? short.videoUrl })));
}

export async function listPendingShortsForModeration() {
  const database = await getDb();
  if (!database) return [];
  const rows = await database
    .select({ short: educationalShorts, authorName: users.fullName, authorEmail: users.email, authorMobile: users.mobile })
    .from(educationalShorts)
    .innerJoin(users, eq(educationalShorts.createdByUserId, users.id))
    .where(eq(educationalShorts.status, "pending"))
    .orderBy(asc(educationalShorts.createdAt));
  return Promise.all(rows.map(async ({ short, ...author }) => ({ ...short, ...author, videoUrl: (await resolveManagedMediaUrl(short.videoUrl, short.storageKey)) ?? short.videoUrl })));
}

export async function moderateStudentShort(input: { shortId: number; moderatorUserId: number; status: "published" | "rejected"; moderationNote?: string }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.update(educationalShorts).set({ status: input.status, moderatedByUserId: input.moderatorUserId, moderatedAt: new Date(), moderationNote: input.moderationNote }).where(and(eq(educationalShorts.id, input.shortId), eq(educationalShorts.status, "pending")));
  if (!result[0].affectedRows) throw new Error("This submission is no longer pending moderation");
}

export async function updateCategory(input: { categoryId: number; name: string; slug: string; description?: string }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.update(categories).set({ name: input.name, slug: input.slug, description: input.description }).where(eq(categories.id, input.categoryId));
  if (!result[0].affectedRows) throw new Error("The category was not found");
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
  "brand.app_name", "brand.tagline", "brand.contact_email", "brand.contact_phone", "brand.whatsapp", "brand.theme_primary", "brand.theme_accent",
  "homepage.hero_title", "homepage.hero_subtitle", "homepage.hero_cta", "homepage.show_live",
  "platform.registration_enabled", "platform.maintenance_enabled",
  "support.support_email", "support.support_phone", "support.office_info", "support.help_intro",
  "developer.name", "developer.role", "developer.project_info", "developer.contact", "developer.copyright",
] as const;
const DEVELOPER_SETTING_KEYS = [
  "brand.app_name", "brand.tagline", "brand.contact_email", "brand.contact_phone", "brand.whatsapp", "brand.theme_primary", "brand.theme_accent",
  "developer.name", "developer.role", "developer.project_info", "developer.contact", "developer.copyright",
] as const;
const OWNER_SETTING_KEYS = [
  "homepage.hero_title", "homepage.hero_subtitle", "homepage.hero_cta", "homepage.show_live",
  "platform.registration_enabled", "platform.maintenance_enabled",
  "support.support_email", "support.support_phone", "support.office_info", "support.help_intro",
] as const;

export type ManagedSettingKey = typeof MANAGED_SETTINGS[number];

export async function getManagedSettings() {
  const database = await getDb();
  if (!database) return {} as Record<ManagedSettingKey, unknown>;
  const rows = await database.select().from(appSettings).where(inArray(appSettings.settingKey, [...MANAGED_SETTINGS]));
  return Object.fromEntries(rows.map((row) => [row.settingKey, row.settingValue])) as Partial<Record<ManagedSettingKey, unknown>>;
}

async function getSettingsByKeys<T extends readonly ManagedSettingKey[]>(keys: T) {
  const database = await getDb();
  if (!database) return {} as Partial<Record<T[number], unknown>>;
  const rows = await database.select().from(appSettings).where(inArray(appSettings.settingKey, [...keys]));
  return Object.fromEntries(rows.map((row) => [row.settingKey, row.settingValue])) as Partial<Record<T[number], unknown>>;
}

export function getOwnerManagedSettings() {
  return getSettingsByKeys(OWNER_SETTING_KEYS);
}

export function getDeveloperManagedSettings() {
  return getSettingsByKeys(DEVELOPER_SETTING_KEYS);
}

export async function saveManagedSettings(actorUserId: number, values: Partial<Record<ManagedSettingKey, unknown>>) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  for (const [settingKey, settingValue] of Object.entries(values)) {
    if (!MANAGED_SETTINGS.includes(settingKey as ManagedSettingKey)) continue;
    await database.insert(appSettings).values({ settingKey, settingValue, updatedByUserId: actorUserId }).onDuplicateKeyUpdate({ set: { settingValue, updatedByUserId: actorUserId } });
  }
}

export async function saveDeveloperManagedSettings(actorUserId: number, values: Partial<Record<(typeof DEVELOPER_SETTING_KEYS)[number], unknown>>) {
  const scoped = Object.fromEntries(Object.entries(values).filter(([key]) => DEVELOPER_SETTING_KEYS.includes(key as (typeof DEVELOPER_SETTING_KEYS)[number])));
  await saveManagedSettings(actorUserId, scoped as Partial<Record<ManagedSettingKey, unknown>>);
}

export async function saveOwnerManagedSettings(actorUserId: number, values: Partial<Record<(typeof OWNER_SETTING_KEYS)[number], unknown>>) {
  const scoped = Object.fromEntries(Object.entries(values).filter(([key]) => OWNER_SETTING_KEYS.includes(key as (typeof OWNER_SETTING_KEYS)[number])));
  await saveManagedSettings(actorUserId, scoped as Partial<Record<ManagedSettingKey, unknown>>);
}

export async function listManagedUsers(search?: string) {
  const database = await getDb();
  if (!database) return [];
  const needle = search?.trim();
  const condition = needle ? or(like(users.fullName, `%${needle}%`), like(users.email, `%${needle}%`), like(users.mobile, `%${needle}%`)) : undefined;
  const people = await database.select({ id: users.id, fullName: users.fullName, email: users.email, mobile: users.mobile, role: users.role, status: users.status, canUploadShorts: users.canUploadShorts, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(condition).orderBy(desc(users.createdAt)).limit(200);
  if (!people.length) return [];
  const grants = await database.select({ userId: userPermissions.userId, permission: userPermissions.permission }).from(userPermissions).where(inArray(userPermissions.userId, people.map((person) => person.id)));
  const permissionsByUser = new Map<number, string[]>();
  for (const grant of grants) permissionsByUser.set(grant.userId, [...(permissionsByUser.get(grant.userId) ?? []), grant.permission]);
  return people.map((person) => ({ ...person, permissions: permissionsByUser.get(person.id) ?? [] }));
}

export async function setManagedUserPermission(input: { userId: number; permission: StaffPermission; granted: boolean; grantedByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [target] = await database.select({ role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target || target.role !== "teacher") throw new Error("Permissions can only be changed for Teacher accounts.");
  if (input.granted) {
    await database.insert(userPermissions).values({ userId: input.userId, permission: input.permission, grantedByUserId: input.grantedByUserId }).onDuplicateKeyUpdate({ set: { grantedByUserId: input.grantedByUserId } });
  } else {
    await database.delete(userPermissions).where(and(eq(userPermissions.userId, input.userId), eq(userPermissions.permission, input.permission)));
  }
}

export async function updateManagedUser(userId: number, input: { role?: "student" | "teacher" | "admin"; status?: "active" | "suspended" }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(users).set(input).where(eq(users.id, userId));
}

export async function developerUpdateUser(userId: number, input: { role?: "student" | "teacher" | "admin" | "super_admin"; status?: "active" | "suspended" }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [target] = await database.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new Error("User not found");
  if (target.role === "developer") throw new Error("Developer accounts cannot be modified through this control.");
  await database.update(users).set(input).where(eq(users.id, userId));
  await revokeAllSessions(userId);
}

export async function developerResetUserPassword(userId: number, password: string) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [target] = await database.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.role === "developer") throw new Error("This password cannot be reset through this control.");
  await database.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, userId));
  await revokeAllSessions(userId);
}

export async function getStudentShortUploadAccess(userId: number) {
  const database = await getDb();
  if (!database) return { canUploadShorts: false };
  const [student] = await database.select({ role: users.role, status: users.status, canUploadShorts: users.canUploadShorts }).from(users).where(eq(users.id, userId)).limit(1);
  return { canUploadShorts: Boolean(student?.role === "student" && student.status === "active" && student.canUploadShorts) };
}

export async function setStudentShortUploadPermission(input: { userId: number; canUploadShorts: boolean }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [student] = await database.select({ role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!student || student.role !== "student") throw new Error("Short upload permission can only be changed for Student accounts.");
  await database.update(users).set({ canUploadShorts: input.canUploadShorts }).where(eq(users.id, input.userId));
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

export async function listManagedResourceDownloadEvents(input: { cursor?: number; limit: number }) {
  const database = await getDb();
  if (!database) return { events: [], nextCursor: null };
  const query = database
    .select({
      event: resourceDownloadEvents,
      studentName: users.fullName,
      studentEmail: users.email,
      resourceTitle: moduleResources.title,
      moduleTitle: courseModules.title,
      courseTitle: courses.title,
    })
    .from(resourceDownloadEvents)
    .innerJoin(users, eq(resourceDownloadEvents.userId, users.id))
    .innerJoin(moduleResources, eq(resourceDownloadEvents.resourceId, moduleResources.id))
    .innerJoin(courseModules, eq(moduleResources.moduleId, courseModules.id))
    .innerJoin(courses, eq(courseModules.courseId, courses.id));
  const rows = input.cursor
    ? await query.where(lt(resourceDownloadEvents.id, input.cursor)).orderBy(desc(resourceDownloadEvents.id)).limit(input.limit + 1)
    : await query.orderBy(desc(resourceDownloadEvents.id)).limit(input.limit + 1);
  const hasMore = rows.length > input.limit;
  const events = hasMore ? rows.slice(0, input.limit) : rows;
  return { events, nextCursor: hasMore ? events.at(-1)?.event.id ?? null : null };
}
