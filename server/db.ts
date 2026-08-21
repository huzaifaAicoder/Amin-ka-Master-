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
  aiQuizAttempts,
  aiQuizReviewSubmissions,
  appSettings,
  announcements,
  auditLogs,
  authSessions,
  bookmarks,
  categories,
  certificates,
  clientProjectReleases,
  clientProjects,
  courseModules,
  courseReviews,
  courses,
  enrollments,
  lessonProgress,
  lessonResources,
  lessons,
  liveClasses,
  masterTemplates,
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
  guardianReportPreferences,
  questions,
  staffPasskeys,
  studentFeaturePermissions,
  studyCoachPreferences,
  testAnswers,
  testAttempts,
  tests,
  telemetryApiLatencyBuckets,
  telemetryCrashBuckets,
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
  "learning_operations.manage",
  "guardian_reports.manage",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSION_OPTIONS)[number];
export const STUDENT_FEATURE_OPTIONS = ["courses", "assessments", "live_classes", "shorts", "downloads", "ai_doubt", "ai_quiz", "study_coach", "guardian_reports", "amin_toolkit"] as const;
export type StudentFeature = (typeof STUDENT_FEATURE_OPTIONS)[number];

export const MASTER_TEMPLATE_FEATURE_MANIFEST = {
  version: "amin-ka-master.master.v1",
  includedModules: ["authentication", "role_boundaries", "courses", "protected_learning", "assessments", "live_classes", "shorts", "offline_downloads", "ai_doubt_solver", "ai_quiz", "study_coach", "guardian_reports", "amin_toolkit", "developer_controls"],
  supportedBranding: ["appName", "tagline", "primaryColor", "accentColor", "logoUrl"],
  supportedFeatureProfile: ["courses", "assessments", "liveClasses", "shorts", "downloads", "aiDoubt", "aiQuiz", "studyCoach", "guardianReports", "aminToolkit"],
  excludedFromClone: ["users", "passwordHashes", "sessions", "passkeys", "setupCodes", "providerSecrets", "paymentSecrets", "webhookSecrets", "databaseCredentials", "productionMedia", "auditHistory"],
} as const;

export const DEFAULT_CLIENT_FEATURE_PROFILE = { courses: true, assessments: true, liveClasses: true, shorts: true, downloads: true, aiDoubt: true, aiQuiz: true, studyCoach: true, guardianReports: true, aminToolkit: true };
export const DEFAULT_CLIENT_NAVIGATION_PROFILE = { studentTabs: ["home", "my_learning", "shorts", "downloads", "account"], staffAreas: ["courses", "tests", "live_classes", "media", "moderation", "guardian_reports"], ownerAreas: ["operations", "reports", "people", "guardian_reports"] };

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
      inArray(moduleResources.resourceType, ["pdf", "video"]),
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
  await database.insert(resourceDownloadEvents).values({ userId, resourceId, resourceType: row.resource.resourceType });
  return {
    status: "authorized" as const,
    signedUrl,
    resource: { id: row.resource.id, title: row.resource.title, resourceType: row.resource.resourceType, mimeType: row.resource.mimeType ?? (row.resource.resourceType === "video" ? "video/mp4" : "application/pdf") },
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

export async function createAiQuizReviewSubmission(input: { submittedByUserId: number; topic: string; difficulty: "beginner" | "intermediate" | "advanced"; language: string; questions: Array<{ question: string; options: string[]; correctIndex: number; explanation: string }> }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(aiQuizReviewSubmissions).values(input);
  return Number(result[0].insertId);
}

export async function saveAiQuizAttempt(input: {
  userId: number;
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  questionCount: number;
  correctAnswers: number;
  scorePercent: number;
  durationSeconds: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(aiQuizAttempts).values(input);
  return Number(result[0].insertId);
}

export async function getStudentAiQuizStats(userId: number) {
  const database = await getDb();
  if (!database) return { averageScore: 0, totalAttempts: 0, lastDifficulty: null as "beginner" | "intermediate" | "advanced" | null, lastScore: null as number | null };
  const [summary] = await database
    .select({
      totalAttempts: sql<number>`count(*)`,
      averageScore: sql<number>`coalesce(round(avg(${aiQuizAttempts.scorePercent})), 0)`,
    })
    .from(aiQuizAttempts)
    .where(eq(aiQuizAttempts.userId, userId));
  const [lastAttempt] = await database
    .select({ difficulty: aiQuizAttempts.difficulty, scorePercent: aiQuizAttempts.scorePercent })
    .from(aiQuizAttempts)
    .where(eq(aiQuizAttempts.userId, userId))
    .orderBy(desc(aiQuizAttempts.createdAt), desc(aiQuizAttempts.id))
    .limit(1);
  return {
    averageScore: Number(summary?.averageScore ?? 0),
    totalAttempts: Number(summary?.totalAttempts ?? 0),
    lastDifficulty: lastAttempt?.difficulty ?? null,
    lastScore: lastAttempt ? Number(lastAttempt.scorePercent) : null,
  };
}

/** Aggregate-only Student quiz history. Questions, answers, AI explanations, and provider content are intentionally not retained here. */
export async function listStudentAiQuizAttempts(userId: number) {
  const database = await getDb();
  if (!database) return [];
  const rows = await database.select({
    id: aiQuizAttempts.id,
    topic: aiQuizAttempts.topic,
    difficulty: aiQuizAttempts.difficulty,
    questionCount: aiQuizAttempts.questionCount,
    correctAnswers: aiQuizAttempts.correctAnswers,
    scorePercent: aiQuizAttempts.scorePercent,
    durationSeconds: aiQuizAttempts.durationSeconds,
    createdAt: aiQuizAttempts.createdAt,
  }).from(aiQuizAttempts).where(eq(aiQuizAttempts.userId, userId)).orderBy(desc(aiQuizAttempts.createdAt), desc(aiQuizAttempts.id)).limit(12);
  return rows.map((row) => ({ ...row, scorePercent: Number(row.scorePercent) }));
}

const GROWTH_SUITE_DAY_MS = 24 * 60 * 60 * 1000;

function calendarDayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function calculateStudyStreak(activityDates: Date[], now = new Date()) {
  const activeDays = new Set(activityDates.map(calendarDayKey));
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!activeDays.has(calendarDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(calendarDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function latestDate(values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => value instanceof Date);
  return dates.length ? new Date(Math.max(...dates.map((value) => value.getTime()))) : null;
}

export async function getStudyCoachNoticePreference(userId: number) {
  const database = await getDb();
  if (!database) return { noticesEnabled: false };
  const [preference] = await database.select({ noticesEnabled: studyCoachPreferences.noticesEnabled }).from(studyCoachPreferences).where(eq(studyCoachPreferences.userId, userId)).limit(1);
  return { noticesEnabled: preference?.noticesEnabled ?? false };
}

export async function setStudyCoachNoticePreference(userId: number, noticesEnabled: boolean) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.insert(studyCoachPreferences).values({ userId, noticesEnabled }).onDuplicateKeyUpdate({ set: { noticesEnabled } });
}

export async function createStudyCoachNoticeConfirmation(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(notifications).values({ userId, title: "Study Coach notices are on", body: "You can review your private study plan whenever you are ready. You can turn this preference off from Study Coach at any time.", type: "study_coach", link: "/study-coach" });
  return Number(result[0].insertId);
}

export async function getGuardianReportPreference(userId: number) {
  const database = await getDb();
  const empty = { guardianName: "", guardianEmail: "", guardianMobile: "", consentGranted: false };
  if (!database) return empty;
  const [preference] = await database.select().from(guardianReportPreferences).where(eq(guardianReportPreferences.userId, userId)).limit(1);
  return preference ? { guardianName: preference.guardianName ?? "", guardianEmail: preference.guardianEmail ?? "", guardianMobile: preference.guardianMobile ?? "", consentGranted: preference.consentGranted } : empty;
}

export async function setGuardianReportPreference(input: { userId: number; guardianName: string; guardianEmail?: string; guardianMobile?: string; consentGranted: boolean }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.insert(guardianReportPreferences).values({ userId: input.userId, guardianName: input.guardianName, guardianEmail: input.guardianEmail || null, guardianMobile: input.guardianMobile || null, consentGranted: input.consentGranted }).onDuplicateKeyUpdate({ set: { guardianName: input.guardianName, guardianEmail: input.guardianEmail || null, guardianMobile: input.guardianMobile || null, consentGranted: input.consentGranted } });
}

type GuardianProgressReport = {
  studentUserId: number;
  studentName: string;
  guardianName: string;
  guardianContact: string;
  generatedAt: Date;
  summary: { activeCourseCount: number; overallProgressPercent: number; currentStreakDays: number; guidance: string };
};

async function buildGuardianProgressReport(userId: number): Promise<GuardianProgressReport | null> {
  const database = await getDb();
  if (!database) return null;
  const [row] = await database.select({ preference: guardianReportPreferences, studentName: users.fullName }).from(guardianReportPreferences).innerJoin(users, eq(guardianReportPreferences.userId, users.id)).where(eq(guardianReportPreferences.userId, userId)).limit(1);
  if (!row?.preference.consentGranted || !row.preference.guardianName || (!row.preference.guardianEmail && !row.preference.guardianMobile)) return null;
  const coach = await getStudentStudyCoachData(userId);
  const guidance = coach.activeCourseCount === 0 ? "Encourage the learner to choose a course and begin one small study step." : coach.overallProgressPercent < 40 ? "A short, regular study routine may help build confidence." : coach.currentStreakDays >= 3 ? "The learner is building steady study momentum; encouragement can help maintain the routine." : "Encourage the learner to continue the next planned study step.";
  return { studentUserId: userId, studentName: row.studentName?.trim() || "Student", guardianName: row.preference.guardianName, guardianContact: row.preference.guardianEmail || row.preference.guardianMobile || "", generatedAt: new Date(), summary: { activeCourseCount: coach.activeCourseCount, overallProgressPercent: coach.overallProgressPercent, currentStreakDays: coach.currentStreakDays, guidance } };
}

/** Returns only consented, aggregate progress. It deliberately excludes marks,
 * answers, AI topics, notes, downloads, assessment history, and private plans. */
export async function listGuardianProgressReports() {
  const database = await getDb();
  if (!database) return [] as GuardianProgressReport[];
  const preferences = await database.select({ userId: guardianReportPreferences.userId }).from(guardianReportPreferences).where(eq(guardianReportPreferences.consentGranted, true));
  const reports = await Promise.all(preferences.map((preference) => buildGuardianProgressReport(preference.userId)));
  return reports.filter((report): report is GuardianProgressReport => report !== null);
}

export async function getGuardianProgressReport(studentUserId: number) {
  return buildGuardianProgressReport(studentUserId);
}

export async function recordGuardianReportShared(studentUserId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(notifications).values({ userId: studentUserId, title: "Guardian progress report shared", body: "An authorized staff member shared your consented aggregate progress report with your selected parent or guardian.", type: "guardian_report", link: "/guardian-reports" });
  return Number(result[0].insertId);
}

/** Private guidance derived only from this Student's persisted learning data. */
export async function getStudentStudyCoachData(userId: number) {
  const database = await getDb();
  const empty = {
    generatedAt: new Date(), activeCourseCount: 0, overallProgressPercent: 0, currentStreakDays: 0,
    dailyPlan: [] as Array<{ type: "lesson" | "revision" | "practice"; title: string; detail: string; href: string }>,
    weakTopics: [] as Array<{ label: string; reason: string }>,
    revisionPriorities: [] as Array<{ title: string; detail: string; href: string }>, noticesEnabled: false,
  };
  if (!database) return empty;
  const [learning, aiAttempts, submittedAttempts, downloads, preference] = await Promise.all([
    listMyLearning(userId),
    database.select().from(aiQuizAttempts).where(eq(aiQuizAttempts.userId, userId)).orderBy(desc(aiQuizAttempts.createdAt)).limit(60),
    database.select({ attempt: testAttempts, test: tests }).from(testAttempts).innerJoin(tests, eq(testAttempts.testId, tests.id)).where(and(eq(testAttempts.userId, userId), eq(testAttempts.status, "submitted"))).orderBy(desc(testAttempts.submittedAt)).limit(40),
    database.select({ downloadedAt: resourceDownloadEvents.downloadedAt }).from(resourceDownloadEvents).where(eq(resourceDownloadEvents.userId, userId)).orderBy(desc(resourceDownloadEvents.downloadedAt)).limit(60),
    getStudyCoachNoticePreference(userId),
  ]);
  const activeLearning = learning.filter((item) => enrollmentIsActive(item.enrollment));
  const courseIds = activeLearning.map((item) => item.course.id);
  const lessonRows = courseIds.length
    ? await database.select({ courseId: courseModules.courseId, lesson: lessons, progress: lessonProgress }).from(lessons).innerJoin(courseModules, eq(lessons.moduleId, courseModules.id)).leftJoin(lessonProgress, and(eq(lessonProgress.lessonId, lessons.id), eq(lessonProgress.userId, userId))).where(and(inArray(courseModules.courseId, courseIds), eq(courseModules.isPublished, true), eq(lessons.isPublished, true))).orderBy(asc(courseModules.displayOrder), asc(lessons.displayOrder))
    : [];
  const totalLessons = activeLearning.reduce((total, item) => total + item.progress.lessonCount, 0);
  const completedLessons = activeLearning.reduce((total, item) => total + item.progress.completedLessons, 0);
  const courseTitleById = new Map(activeLearning.map((item) => [item.course.id, item.course.title]));
  const nextLesson = lessonRows.find((item) => !item.progress?.isCompleted);
  const topicStats = new Map<string, { total: number; sum: number }>();
  for (const attempt of aiAttempts) {
    const current = topicStats.get(attempt.topic) ?? { total: 0, sum: 0 };
    topicStats.set(attempt.topic, { total: current.total + 1, sum: current.sum + Number(attempt.scorePercent) });
  }
  const weakTopics = [...topicStats.entries()].filter(([, value]) => value.sum / value.total < 70).sort((a, b) => (a[1].sum / a[1].total) - (b[1].sum / b[1].total)).slice(0, 3).map(([label, value]) => ({ label, reason: `Recent practice average: ${Math.round(value.sum / value.total)}% across ${value.total} attempt${value.total === 1 ? "" : "s"}.` }));
  const lowAssessment = submittedAttempts.map((item) => ({ title: item.test.title, scorePercent: item.attempt.totalMarks > 0 ? Math.round((Number(item.attempt.score) / Number(item.attempt.totalMarks)) * 100) : null })).filter((item): item is { title: string; scorePercent: number } => item.scorePercent !== null && item.scorePercent < 60).slice(0, 2);
  const activityDates = [...lessonRows.map((item) => item.progress?.lastViewedAt), ...aiAttempts.map((item) => item.createdAt), ...submittedAttempts.map((item) => item.attempt.submittedAt ?? item.attempt.createdAt), ...downloads.map((item) => item.downloadedAt)].filter((value): value is Date => value instanceof Date);
  const dailyPlan: Array<{ type: "lesson" | "revision" | "practice"; title: string; detail: string; href: string }> = [];
  if (nextLesson) dailyPlan.push({ type: "lesson", title: `Continue ${courseTitleById.get(nextLesson.courseId) ?? "your course"}`, detail: nextLesson.lesson.title, href: `/lesson/${nextLesson.lesson.id}` });
  if (weakTopics[0]) dailyPlan.push({ type: "revision", title: `Revise ${weakTopics[0].label}`, detail: weakTopics[0].reason, href: "/ai-quiz" });
  if (lowAssessment[0]) dailyPlan.push({ type: "practice", title: `Revisit ${lowAssessment[0].title}`, detail: "Your latest completed attempt needs revision before the next practice session.", href: "/test-history" });
  if (!dailyPlan.length && activeLearning[0]) dailyPlan.push({ type: "lesson", title: `Maintain momentum in ${activeLearning[0].course.title}`, detail: "Open your learning path and choose the next published lesson.", href: `/course/${activeLearning[0].course.slug}` });
  return {
    generatedAt: new Date(), activeCourseCount: activeLearning.length, overallProgressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    currentStreakDays: calculateStudyStreak(activityDates), dailyPlan, weakTopics,
    revisionPriorities: [...weakTopics.map((item) => ({ title: item.label, detail: item.reason, href: "/ai-quiz" })), ...lowAssessment.map((item) => ({ title: item.title, detail: `Completed assessment score: ${item.scorePercent}%. Review the detailed explanations before retrying.`, href: "/test-history" }))].slice(0, 4),
    noticesEnabled: preference.noticesEnabled,
  };
}

export async function listAiQuizReviewSubmissions() {
  const database = await getDb();
  if (!database) return [];
  return database.select({ submission: aiQuizReviewSubmissions, studentName: users.fullName, studentEmail: users.email }).from(aiQuizReviewSubmissions).leftJoin(users, eq(aiQuizReviewSubmissions.submittedByUserId, users.id)).orderBy(desc(aiQuizReviewSubmissions.createdAt));
}

/**
 * Staff intervention data is deliberately privacy-minimised: it contains only
 * name, enrollment count, activity band, risk band, and general reason labels.
 * Exact answers, AI Quiz topics/scores, personal notes, email, and downloads
 * remain private to the Student.
 */
export async function getLearningOperationsData() {
  const database = await getDb();
  const empty = { summary: { monitoredStudents: 0, atRiskStudents: 0, pendingQuizReviews: 0, upcomingLiveClasses: 0 }, atRiskLearners: [] as Array<{ userId: number; displayName: string; activeEnrollmentCount: number; riskLevel: "low" | "medium" | "high"; activityState: string; signals: string[] }> };
  if (!database) return empty;
  const now = new Date();
  const [studentRows, progressRows, assessmentRows, quizRows, enrollmentRows, reviewRows, upcomingRows] = await Promise.all([
    database.select({ id: users.id, fullName: users.fullName, createdAt: users.createdAt }).from(users).where(and(eq(users.role, "student"), eq(users.status, "active"))),
    database.select({ userId: lessonProgress.userId, lastViewedAt: lessonProgress.lastViewedAt }).from(lessonProgress),
    database.select({ userId: testAttempts.userId, score: testAttempts.score, totalMarks: testAttempts.totalMarks, submittedAt: testAttempts.submittedAt }).from(testAttempts).where(eq(testAttempts.status, "submitted")),
    database.select({ userId: aiQuizAttempts.userId, scorePercent: aiQuizAttempts.scorePercent, createdAt: aiQuizAttempts.createdAt }).from(aiQuizAttempts),
    database.select({ userId: enrollments.userId }).from(enrollments).where(eq(enrollments.status, "active")),
    database.select({ id: aiQuizReviewSubmissions.id }).from(aiQuizReviewSubmissions).where(eq(aiQuizReviewSubmissions.status, "pending")),
    database.select({ id: liveClasses.id }).from(liveClasses).where(and(eq(liveClasses.status, "upcoming"), gt(liveClasses.startsAt, now))),
  ]);
  const latestProgress = new Map<number, Date>();
  for (const item of progressRows) if (!latestProgress.get(item.userId) || item.lastViewedAt > latestProgress.get(item.userId)!) latestProgress.set(item.userId, item.lastViewedAt);
  const assessmentsByUser = new Map<number, Array<{ score: number; totalMarks: number; submittedAt: Date | null }>>();
  for (const item of assessmentRows) assessmentsByUser.set(item.userId, [...(assessmentsByUser.get(item.userId) ?? []), { score: Number(item.score), totalMarks: Number(item.totalMarks), submittedAt: item.submittedAt }]);
  const quizzesByUser = new Map<number, Array<{ scorePercent: number; createdAt: Date }>>();
  for (const item of quizRows) quizzesByUser.set(item.userId, [...(quizzesByUser.get(item.userId) ?? []), { scorePercent: Number(item.scorePercent), createdAt: item.createdAt }]);
  const activeEnrollmentCounts = new Map<number, number>();
  for (const enrollment of enrollmentRows) activeEnrollmentCounts.set(enrollment.userId, (activeEnrollmentCounts.get(enrollment.userId) ?? 0) + 1);
  const atRiskLearners = studentRows.flatMap((student) => {
    const activeEnrollmentCount = activeEnrollmentCounts.get(student.id) ?? 0;
    if (!activeEnrollmentCount) return [];
    const assessments = (assessmentsByUser.get(student.id) ?? []).slice(-2);
    const quizzes = (quizzesByUser.get(student.id) ?? []).slice(-3);
    const lastActivityAt = latestDate([latestProgress.get(student.id), ...assessments.map((item) => item.submittedAt), ...quizzes.map((item) => item.createdAt)]);
    const awayDays = lastActivityAt ? Math.floor((now.getTime() - lastActivityAt.getTime()) / GROWTH_SUITE_DAY_MS) : Math.floor((now.getTime() - student.createdAt.getTime()) / GROWTH_SUITE_DAY_MS);
    const lowAssessment = assessments.some((item) => item.totalMarks > 0 && (item.score / item.totalMarks) * 100 < 50);
    const lowPractice = quizzes.length > 0 && quizzes.reduce((total, item) => total + item.scorePercent, 0) / quizzes.length < 55;
    const signals: string[] = [];
    let riskScore = 0;
    if (awayDays >= 7) { signals.push(awayDays >= 14 ? "No recorded learning activity for 14+ days" : "No recorded learning activity for 7+ days"); riskScore += 2; }
    if (lowAssessment) { signals.push("Recent completed assessment needs follow-up"); riskScore += 1; }
    if (lowPractice) { signals.push("Recent practice performance needs follow-up"); riskScore += 1; }
    if (!riskScore) return [];
    return [{ userId: student.id, displayName: student.fullName?.trim() || "Student", activeEnrollmentCount, riskLevel: riskScore >= 3 ? "high" as const : riskScore === 2 ? "medium" as const : "low" as const, activityState: awayDays >= 14 ? "Away 14+ days" : awayDays >= 7 ? "Away 7+ days" : "Recently active", signals }];
  }).sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.riskLevel] - { high: 3, medium: 2, low: 1 }[a.riskLevel]));
  return { summary: { monitoredStudents: studentRows.length, atRiskStudents: atRiskLearners.length, pendingQuizReviews: reviewRows.length, upcomingLiveClasses: upcomingRows.length }, atRiskLearners };
}

export async function createLearningOperationsNotice(input: { userId: number; title: string; body: string; link?: string }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(notifications).values({ userId: input.userId, title: input.title, body: input.body, type: "learning_operations", link: input.link });
  return Number(result[0].insertId);
}

export async function getOwnerBusinessIntelligence() {
  const database = await getDb();
  const empty = { enrollment: { active: 0, total: 0, studentsWithEnrollment: 0 }, engagement: { activeLearnersLast30Days: 0, recentLessonViews: 0, recentAssessmentAttempts: 0, recentAiQuizAttempts: 0 }, content: { publishedCourses: 0, draftCourses: 0, coursePerformance: [] as Array<{ courseId: number; title: string; enrollmentCount: number }> }, staffActivity: [] as Array<{ role: string; actionsLast30Days: number }>, payments: { providerOrderSignals: { pending: 0, paid: 0, failed: 0, refunded: 0 }, revenueReporting: "unavailable" as const, courseViewFunnelTracked: false } };
  if (!database) return empty;
  const since = new Date(Date.now() - 30 * GROWTH_SUITE_DAY_MS);
  const [enrollmentRows, recentProgress, recentTests, recentAi, courseRows, courseEnrollmentRows, staffAudits, orderRows] = await Promise.all([
    database.select({ userId: enrollments.userId, status: enrollments.status }).from(enrollments),
    database.select({ userId: lessonProgress.userId }).from(lessonProgress).where(gte(lessonProgress.lastViewedAt, since)),
    database.select({ id: testAttempts.id }).from(testAttempts).where(and(eq(testAttempts.status, "submitted"), gte(testAttempts.submittedAt, since))),
    database.select({ id: aiQuizAttempts.id }).from(aiQuizAttempts).where(gte(aiQuizAttempts.createdAt, since)),
    database.select({ id: courses.id, title: courses.title, status: courses.status }).from(courses),
    database.select({ courseId: enrollments.courseId }).from(enrollments).where(eq(enrollments.status, "active")),
    database.select({ role: users.role }).from(auditLogs).innerJoin(users, eq(auditLogs.actorUserId, users.id)).where(and(gte(auditLogs.createdAt, since), inArray(users.role, ["teacher", "admin", "super_admin"]))),
    database.select({ status: orders.status }).from(orders),
  ]);
  const enrollmentCounts = new Map<number, number>();
  for (const row of courseEnrollmentRows) enrollmentCounts.set(row.courseId, (enrollmentCounts.get(row.courseId) ?? 0) + 1);
  const staffActions = new Map<string, number>();
  for (const row of staffAudits) staffActions.set(row.role, (staffActions.get(row.role) ?? 0) + 1);
  const providerOrderSignals = { pending: 0, paid: 0, failed: 0, refunded: 0 };
  for (const order of orderRows) if (order.status === "pending" || order.status === "paid" || order.status === "failed" || order.status === "refunded") providerOrderSignals[order.status] += 1;
  return {
    enrollment: { active: enrollmentRows.filter((row) => row.status === "active").length, total: enrollmentRows.length, studentsWithEnrollment: new Set(enrollmentRows.map((row) => row.userId)).size },
    engagement: { activeLearnersLast30Days: new Set(recentProgress.map((row) => row.userId)).size, recentLessonViews: recentProgress.length, recentAssessmentAttempts: recentTests.length, recentAiQuizAttempts: recentAi.length },
    content: { publishedCourses: courseRows.filter((row) => row.status === "published").length, draftCourses: courseRows.filter((row) => row.status === "draft").length, coursePerformance: courseRows.map((course) => ({ courseId: course.id, title: course.title, enrollmentCount: enrollmentCounts.get(course.id) ?? 0 })).sort((a, b) => b.enrollmentCount - a.enrollmentCount).slice(0, 8) },
    staffActivity: [...staffActions.entries()].map(([role, actionsLast30Days]) => ({ role, actionsLast30Days })).sort((a, b) => b.actionsLast30Days - a.actionsLast30Days),
    payments: { providerOrderSignals, revenueReporting: "unavailable" as const, courseViewFunnelTracked: false },
  };
}

export async function exportAiQuizReviewSubmission(input: { submissionId: number; reviewedByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  return database.transaction(async (tx) => {
    const [submission] = await tx.select().from(aiQuizReviewSubmissions).where(eq(aiQuizReviewSubmissions.id, input.submissionId)).limit(1);
    if (!submission) throw new Error("AI Quiz submission was not found");
    if (submission.status !== "pending") throw new Error("This AI Quiz submission has already been exported");
    const items = submission.questions as Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>;
    if (!Array.isArray(items) || items.length < 2 || items.length > 10) throw new Error("AI Quiz submission is invalid");
    const testResult = await tx.insert(tests).values({ title: `AI review — ${submission.topic}`, description: `Teacher-reviewed AI practice export · ${submission.difficulty} · ${submission.language}`, durationMinutes: Math.max(5, items.length * 2), passingMarks: 0, status: "draft", createdByUserId: input.reviewedByUserId });
    const testId = Number(testResult[0].insertId);
    await tx.insert(questions).values(items.map((item, displayOrder) => ({ testId, prompt: item.question, options: item.options, correctOptionIndex: item.correctIndex, marks: 1, explanation: item.explanation, displayOrder })));
    await tx.update(aiQuizReviewSubmissions).set({ status: "exported", reviewedByUserId: input.reviewedByUserId, exportedTestId: testId }).where(eq(aiQuizReviewSubmissions.id, input.submissionId));
    return { testId, questionCount: items.length };
  });
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
 "platform.student_access_enabled", "platform.staff_access_enabled", "platform.owner_access_enabled",
 "feature.courses_enabled", "feature.assessments_enabled", "feature.live_classes_enabled", "feature.shorts_enabled", "feature.downloads_enabled", "feature.ai_doubt_enabled", "feature.ai_quiz_enabled", "feature.study_coach_enabled", "feature.learning_operations_enabled", "feature.guardian_reports_enabled", "feature.amin_toolkit_enabled",
 "telemetry.api_latency_enabled", "telemetry.auth_latency_enabled", "telemetry.crash_reporting_enabled",
 "support.support_email", "support.support_phone", "support.office_info", "support.help_intro",
  "developer.name", "developer.role", "developer.project_info", "developer.contact", "developer.copyright",
] as const;
const DEVELOPER_SETTING_KEYS = [
 "brand.app_name", "brand.tagline", "brand.contact_email", "brand.contact_phone", "brand.whatsapp", "brand.theme_primary", "brand.theme_accent",
 "platform.maintenance_enabled",
 "platform.student_access_enabled", "platform.staff_access_enabled", "platform.owner_access_enabled",
 "feature.courses_enabled", "feature.assessments_enabled", "feature.live_classes_enabled", "feature.shorts_enabled", "feature.downloads_enabled", "feature.ai_doubt_enabled", "feature.ai_quiz_enabled", "feature.study_coach_enabled", "feature.learning_operations_enabled", "feature.guardian_reports_enabled", "feature.amin_toolkit_enabled",
 "telemetry.api_latency_enabled", "telemetry.auth_latency_enabled", "telemetry.crash_reporting_enabled",
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
  if ("telemetry.api_latency_enabled" in scoped || "telemetry.auth_latency_enabled" in scoped || "telemetry.crash_reporting_enabled" in scoped) telemetryConfigurationCache = null;
}

const TELEMETRY_SETTING_KEYS = ["telemetry.api_latency_enabled", "telemetry.auth_latency_enabled", "telemetry.crash_reporting_enabled"] as const satisfies readonly ManagedSettingKey[];
const TELEMETRY_RETENTION_DAYS = 30;
const TELEMETRY_CONFIGURATION_CACHE_MS = 60_000;
let telemetryConfigurationCache: { expiresAt: number; value: { apiLatencyEnabled: boolean; authLatencyEnabled: boolean; crashReportingEnabled: boolean } } | null = null;
let lastTelemetryPruneAt = 0;

function telemetryHour(date = new Date()) {
  const value = new Date(date);
  value.setUTCMinutes(0, 0, 0);
  return value;
}

function telemetryDuration(durationMs: number) {
  return Math.max(0, Math.min(Math.round(durationMs), 60_000));
}

export async function getTelemetryConfiguration() {
  if (telemetryConfigurationCache && telemetryConfigurationCache.expiresAt > Date.now()) return telemetryConfigurationCache.value;
  const settings = await getSettingsByKeys(TELEMETRY_SETTING_KEYS);
  const value = { apiLatencyEnabled: settings["telemetry.api_latency_enabled"] === true, authLatencyEnabled: settings["telemetry.auth_latency_enabled"] === true, crashReportingEnabled: settings["telemetry.crash_reporting_enabled"] === true };
  telemetryConfigurationCache = { expiresAt: Date.now() + TELEMETRY_CONFIGURATION_CACHE_MS, value };
  return value;
}

async function pruneTelemetryBuckets(database: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (Date.now() - lastTelemetryPruneAt < 6 * 60 * 60 * 1000) return;
  lastTelemetryPruneAt = Date.now();
  const cutoff = new Date(Date.now() - TELEMETRY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await Promise.all([
    database.delete(telemetryApiLatencyBuckets).where(lt(telemetryApiLatencyBuckets.bucketStartedAt, cutoff)),
    database.delete(telemetryCrashBuckets).where(lt(telemetryCrashBuckets.bucketStartedAt, cutoff)),
  ]);
}

/** Stores one hourly aggregate only; callers may provide fixed route groups, never request paths or payload data. Authentication measurements use a dedicated Developer switch and never carry a login identity or credential outcome detail. */
export async function recordApiLatencyMeasurement(input: { routeGroup: "auth" | "trpc" | "media_upload" | "health" | "storage" | "other"; statusCode: number; durationMs: number }) {
  const configuration = await getTelemetryConfiguration();
  if (input.routeGroup === "auth" ? !configuration.authLatencyEnabled : !configuration.apiLatencyEnabled) return;
  const database = await getDb();
  if (!database) return;
  const durationMs = telemetryDuration(input.durationMs);
  const statusClass = `${Math.max(1, Math.min(5, Math.floor(input.statusCode / 100) || 5))}xx`;
  const bucketStartedAt = telemetryHour();
  await database.insert(telemetryApiLatencyBuckets).values({ bucketStartedAt, routeGroup: input.routeGroup, statusClass, requestCount: 1, totalDurationMs: durationMs, maxDurationMs: durationMs }).onDuplicateKeyUpdate({ set: { requestCount: sql`${telemetryApiLatencyBuckets.requestCount} + 1`, totalDurationMs: sql`${telemetryApiLatencyBuckets.totalDurationMs} + ${durationMs}`, maxDurationMs: sql`GREATEST(${telemetryApiLatencyBuckets.maxDurationMs}, ${durationMs})` } });
  void pruneTelemetryBuckets(database).catch(() => undefined);
}

/** Stores only fixed categories in an hourly bucket. It deliberately has no user ID, error message, stack trace, route path, device ID, or request content. */
export async function recordCrashMeasurement(input: { platform: "android" | "ios" | "web" | "unknown"; routeGroup: "auth" | "student" | "staff" | "developer" | "other"; errorClass: "unhandled_error" | "unhandled_rejection" | "react_render" }) {
  const configuration = await getTelemetryConfiguration();
  if (!configuration.crashReportingEnabled) return;
  const database = await getDb();
  if (!database) return;
  const bucketStartedAt = telemetryHour();
  await database.insert(telemetryCrashBuckets).values({ bucketStartedAt, platform: input.platform, routeGroup: input.routeGroup, errorClass: input.errorClass, crashCount: 1 }).onDuplicateKeyUpdate({ set: { crashCount: sql`${telemetryCrashBuckets.crashCount} + 1` } });
  void pruneTelemetryBuckets(database).catch(() => undefined);
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
  const featureGrants = await database.select({ userId: studentFeaturePermissions.userId, feature: studentFeaturePermissions.feature, enabled: studentFeaturePermissions.enabled }).from(studentFeaturePermissions).where(inArray(studentFeaturePermissions.userId, people.map((person) => person.id)));
  const permissionsByUser = new Map<number, string[]>();
  for (const grant of grants) permissionsByUser.set(grant.userId, [...(permissionsByUser.get(grant.userId) ?? []), grant.permission]);
  const featureOverridesByUser = new Map<number, Record<string, boolean>>();
  for (const grant of featureGrants) featureOverridesByUser.set(grant.userId, { ...(featureOverridesByUser.get(grant.userId) ?? {}), [grant.feature]: grant.enabled });
  return people.map((person) => ({ ...person, permissions: permissionsByUser.get(person.id) ?? [], studentFeatureOverrides: featureOverridesByUser.get(person.id) ?? {} }));
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

export async function developerCreateCredentialUser(input: {
  fullName: string;
  email?: string;
  mobile?: string;
  password: string;
  role: "student" | "teacher" | "admin" | "super_admin";
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const email = input.email ? normalizeIdentity(input.email) : null;
  const mobile = input.mobile ? normalizeMobile(input.mobile) : null;
  if (!email && !mobile) throw new Error("Provide an email address or mobile number");
  const identityMatch = await database.select({ id: users.id }).from(users).where(or(email ? eq(users.email, email) : sql`false`, mobile ? eq(users.mobile, mobile) : sql`false`)).limit(1);
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
  return Number(result[0].insertId);
}

export async function developerDeleteUser(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [target] = await database.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new Error("User not found");
  if (target.role === "developer") throw new Error("Developer accounts cannot be deleted through this control.");
  await database.transaction(async (tx) => {
    await tx.delete(authSessions).where(eq(authSessions.userId, userId));
    await tx.delete(userPermissions).where(eq(userPermissions.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}

export async function developerSetUserControls(input: { userId: number; canUploadShorts?: boolean; permissions?: StaffPermission[]; grantedByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [target] = await database.select({ role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target || target.role === "developer") throw new Error("This account cannot be changed through this control.");
  if (input.canUploadShorts !== undefined) {
    if (target.role !== "student") throw new Error("Short upload permission can only be changed for Student accounts.");
    await database.update(users).set({ canUploadShorts: input.canUploadShorts }).where(eq(users.id, input.userId));
  }
  if (input.permissions !== undefined) {
    if (target.role !== "teacher") throw new Error("Staff permissions can only be changed for Teacher accounts.");
    await database.delete(userPermissions).where(eq(userPermissions.userId, input.userId));
    for (const permission of input.permissions) await database.insert(userPermissions).values({ userId: input.userId, permission, grantedByUserId: input.grantedByUserId });
  }
  await revokeAllSessions(input.userId);
}

export async function developerSetStudentFeatureControls(input: { userId: number; features: Array<{ feature: StudentFeature; enabled: boolean }>; grantedByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [target] = await database.select({ role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target || target.role !== "student") throw new Error("Individual feature controls can only be changed for Student accounts.");
  await database.transaction(async (tx) => {
    for (const item of input.features) {
      await tx.insert(studentFeaturePermissions).values({ userId: input.userId, feature: item.feature, enabled: item.enabled, grantedByUserId: input.grantedByUserId }).onDuplicateKeyUpdate({ set: { enabled: item.enabled, grantedByUserId: input.grantedByUserId } });
    }
  });
  await revokeAllSessions(input.userId);
}

export async function developerResetStudentFeatureControls(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [target] = await database.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.role !== "student") throw new Error("Individual feature controls can only be reset for Student accounts.");
  await database.delete(studentFeaturePermissions).where(eq(studentFeaturePermissions.userId, userId));
  await revokeAllSessions(userId);
}

export async function getStudentFeatureOverrides(userId: number) {
  const database = await getDb();
  if (!database) return {} as Record<string, boolean>;
  const rows = await database.select({ feature: studentFeaturePermissions.feature, enabled: studentFeaturePermissions.enabled }).from(studentFeaturePermissions).where(eq(studentFeaturePermissions.userId, userId));
  return rows.reduce<Record<string, boolean>>((result, row) => ({ ...result, [row.feature]: row.enabled }), {});
}

export async function listDeveloperAuditLogs(input: { search?: string; limit: number }) {
  const database = await getDb();
  if (!database) return [];
  const needle = input.search?.trim();
  const condition = needle ? or(like(auditLogs.action, `%${needle}%`), like(auditLogs.entityType, `%${needle}%`), like(auditLogs.entityId, `%${needle}%`), like(users.fullName, `%${needle}%`), like(users.email, `%${needle}%`)) : undefined;
  return database.select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actorName: users.fullName, actorEmail: users.email }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).where(condition).orderBy(desc(auditLogs.createdAt)).limit(input.limit);
}

export async function getDeveloperViewAsTarget(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [target] = await database.select({ id: users.id, fullName: users.fullName, role: users.role, status: users.status, canUploadShorts: users.canUploadShorts }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.role === "developer") throw new Error("This account cannot be previewed through View As.");
  const [permissions, studentFeatureOverrides] = await Promise.all([
    database.select({ permission: userPermissions.permission }).from(userPermissions).where(eq(userPermissions.userId, userId)),
    getStudentFeatureOverrides(userId),
  ]);
  return { ...target, permissions: permissions.map((item) => item.permission), studentFeatureOverrides };
}

export async function ensureMasterTemplate(actorUserId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [existing] = await database.select().from(masterTemplates).where(eq(masterTemplates.templateKey, "amin-ka-master-master")).limit(1);
  if (existing) return existing;
  const result = await database.insert(masterTemplates).values({
    templateKey: "amin-ka-master-master",
    name: "Amin Ka Master — Complete LMS Master",
    version: "1.0",
    status: "active",
    featureManifest: MASTER_TEMPLATE_FEATURE_MANIFEST,
    sourceCheckpoint: "master-reference",
    createdByUserId: actorUserId,
  });
  const [created] = await database.select().from(masterTemplates).where(eq(masterTemplates.id, Number(result[0].insertId))).limit(1);
  if (!created) throw new Error("Master template could not be created");
  return created;
}

export async function listMasterTemplates(actorUserId: number) {
  await ensureMasterTemplate(actorUserId);
  const database = await getDb();
  if (!database) return [];
  return database.select().from(masterTemplates).orderBy(desc(masterTemplates.updatedAt));
}

export async function listClientProjects() {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(clientProjects).orderBy(desc(clientProjects.updatedAt));
}

export async function getDeveloperClientHealth() {
  const database = await getDb();
  const empty = {
    aggregateUsage: { activeUsersLast30Days: 0, totalUsers: 0, publishedCourses: 0, publishedShorts: 0 },
    clientProjects: [] as Array<{ clientProjectId: number; name: string; status: string; updatedAt: Date; enabledFeatureCount: number; latestReleaseStatus: string | null; releaseReady: boolean }>,
    observability: { apiLatency: { collectionEnabled: false, windowHours: 24, requestCount: 0, averageDurationMs: null as number | null, maxDurationMs: null as number | null }, authLatency: { collectionEnabled: false, windowHours: 24, requestCount: 0, averageDurationMs: null as number | null, maxDurationMs: null as number | null }, crashReporting: { collectionEnabled: false, windowHours: 24, crashCount: 0 }, storageMetering: "not_instrumented" as const },
  };
  if (!database) return empty;
  const since = new Date(Date.now() - 30 * GROWTH_SUITE_DAY_MS);
  const telemetrySince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [projects, releases, activeUsers, allUsers, publishedCourses, publishedShorts, configuration, latencyBuckets, crashBuckets] = await Promise.all([
    database.select().from(clientProjects).orderBy(desc(clientProjects.updatedAt)),
    database.select().from(clientProjectReleases).orderBy(desc(clientProjectReleases.createdAt)),
    database.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.lastSignedIn, since)),
    database.select({ count: sql<number>`count(*)` }).from(users),
    database.select({ count: sql<number>`count(*)` }).from(courses).where(eq(courses.status, "published")),
    database.select({ count: sql<number>`count(*)` }).from(educationalShorts).where(eq(educationalShorts.status, "published")),
    getTelemetryConfiguration(),
    database.select().from(telemetryApiLatencyBuckets).where(gte(telemetryApiLatencyBuckets.bucketStartedAt, telemetrySince)),
    database.select().from(telemetryCrashBuckets).where(gte(telemetryCrashBuckets.bucketStartedAt, telemetrySince)),
  ]);
  const apiLatencyBuckets = latencyBuckets.filter((bucket) => bucket.routeGroup !== "auth");
  const authLatencyBuckets = latencyBuckets.filter((bucket) => bucket.routeGroup === "auth");
  const requestCount = apiLatencyBuckets.reduce((total, bucket) => total + bucket.requestCount, 0);
  const totalDurationMs = apiLatencyBuckets.reduce((total, bucket) => total + bucket.totalDurationMs, 0);
  const maxDurationMs = apiLatencyBuckets.reduce((maximum, bucket) => Math.max(maximum, bucket.maxDurationMs), 0);
  const authRequestCount = authLatencyBuckets.reduce((total, bucket) => total + bucket.requestCount, 0);
  const authTotalDurationMs = authLatencyBuckets.reduce((total, bucket) => total + bucket.totalDurationMs, 0);
  const authMaxDurationMs = authLatencyBuckets.reduce((maximum, bucket) => Math.max(maximum, bucket.maxDurationMs), 0);
  const crashCount = crashBuckets.reduce((total, bucket) => total + bucket.crashCount, 0);
  const latestReleaseByProject = new Map<number, typeof releases[number]>();
  for (const release of releases) if (!latestReleaseByProject.has(release.clientProjectId)) latestReleaseByProject.set(release.clientProjectId, release);
  return {
    aggregateUsage: { activeUsersLast30Days: Number(activeUsers[0]?.count ?? 0), totalUsers: Number(allUsers[0]?.count ?? 0), publishedCourses: Number(publishedCourses[0]?.count ?? 0), publishedShorts: Number(publishedShorts[0]?.count ?? 0) },
    clientProjects: projects.map((project) => {
      const featureProfile = project.featureProfile as Record<string, unknown>;
      const latestRelease = latestReleaseByProject.get(project.id);
      const enabledFeatureCount = Object.values(featureProfile).filter((value) => value === true).length;
      return { clientProjectId: project.id, name: project.name, status: project.status, updatedAt: project.updatedAt, enabledFeatureCount, latestReleaseStatus: latestRelease?.status ?? null, releaseReady: project.status === "release_prepared" || latestRelease?.status === "prepared" || latestRelease?.status === "submitted" || latestRelease?.status === "provisioned" };
    }),
    observability: { apiLatency: { collectionEnabled: configuration.apiLatencyEnabled, windowHours: 24, requestCount, averageDurationMs: requestCount ? Math.round(totalDurationMs / requestCount) : null, maxDurationMs: requestCount ? maxDurationMs : null }, authLatency: { collectionEnabled: configuration.authLatencyEnabled, windowHours: 24, requestCount: authRequestCount, averageDurationMs: authRequestCount ? Math.round(authTotalDurationMs / authRequestCount) : null, maxDurationMs: authRequestCount ? authMaxDurationMs : null }, crashReporting: { collectionEnabled: configuration.crashReportingEnabled, windowHours: 24, crashCount }, storageMetering: "not_instrumented" as const },
  };
}

export async function getClientProject(clientProjectId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [record] = await database.select({ project: clientProjects, templateName: masterTemplates.name, templateVersion: masterTemplates.version, templateManifest: masterTemplates.featureManifest }).from(clientProjects).innerJoin(masterTemplates, eq(clientProjects.templateId, masterTemplates.id)).where(eq(clientProjects.id, clientProjectId)).limit(1);
  if (!record) throw new Error("Client project was not found");
  return record;
}

export async function createClientProject(input: { name: string; slug: string; templateId: number; appName: string; tagline?: string; primaryColor: string; accentColor: string; supportEmail?: string; createdByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [template] = await database.select({ id: masterTemplates.id, status: masterTemplates.status }).from(masterTemplates).where(eq(masterTemplates.id, input.templateId)).limit(1);
  if (!template || template.status !== "active") throw new Error("Choose an active master template.");
  const result = await database.insert(clientProjects).values({
    publicId: `client_${randomUUID()}`,
    templateId: input.templateId,
    name: input.name,
    slug: input.slug,
    status: "draft",
    branding: { appName: input.appName, tagline: input.tagline ?? "", primaryColor: input.primaryColor, accentColor: input.accentColor, logoUrl: null },
    featureProfile: DEFAULT_CLIENT_FEATURE_PROFILE,
    navigationProfile: DEFAULT_CLIENT_NAVIGATION_PROFILE,
    publicPages: { supportEmail: input.supportEmail ?? "", about: "", contact: "", privacyUrl: "", termsUrl: "" },
    createdByUserId: input.createdByUserId,
  });
  return Number(result[0].insertId);
}

export async function updateClientProject(input: { clientProjectId: number; name?: string; status?: "draft" | "ready_for_review" | "release_prepared" | "archived"; branding?: Record<string, unknown>; featureProfile?: Record<string, boolean>; navigationProfile?: Record<string, unknown>; publicPages?: Record<string, unknown>; previewUrl?: string | null; externalProjectReference?: string | null }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [existing] = await database.select({ id: clientProjects.id }).from(clientProjects).where(eq(clientProjects.id, input.clientProjectId)).limit(1);
  if (!existing) throw new Error("Client project was not found");
  const values = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.branding !== undefined ? { branding: input.branding } : {}),
    ...(input.featureProfile !== undefined ? { featureProfile: input.featureProfile } : {}),
    ...(input.navigationProfile !== undefined ? { navigationProfile: input.navigationProfile } : {}),
    ...(input.publicPages !== undefined ? { publicPages: input.publicPages } : {}),
    ...(input.previewUrl !== undefined ? { previewUrl: input.previewUrl } : {}),
    ...(input.externalProjectReference !== undefined ? { externalProjectReference: input.externalProjectReference } : {}),
  };
  await database.update(clientProjects).set(values).where(eq(clientProjects.id, input.clientProjectId));
}

export async function prepareClientProjectRelease(input: { clientProjectId: number; preparedByUserId: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const record = await getClientProject(input.clientProjectId);
  if (record.project.status === "archived") throw new Error("Archived client projects cannot be released.");
  const releaseCount = await database.select({ id: clientProjectReleases.id }).from(clientProjectReleases).where(eq(clientProjectReleases.clientProjectId, input.clientProjectId));
  const releaseVersion = `v${releaseCount.length + 1}`;
  const manifest = {
    manifestVersion: "white-label-release.v1",
    clientProject: { publicId: record.project.publicId, name: record.project.name, slug: record.project.slug },
    masterTemplate: { name: record.templateName, version: record.templateVersion },
    branding: record.project.branding,
    featureProfile: record.project.featureProfile,
    navigationProfile: record.project.navigationProfile,
    publicPages: record.project.publicPages,
    securityBoundary: { copiedUsers: false, copiedCredentials: false, copiedProviderSecrets: false, copiedPaymentSecrets: false, copiedWebhooks: false, copiedAuditHistory: false, copiedProductionMedia: false },
    provisioning: { status: "manual_platform_project_creation_required", finalPublish: "Developer must use the separate project Publish control after review and checkpointing." },
  };
  const result = await database.insert(clientProjectReleases).values({ clientProjectId: input.clientProjectId, releaseVersion, status: "prepared", manifest, preparedByUserId: input.preparedByUserId });
  await database.update(clientProjects).set({ status: "release_prepared" }).where(eq(clientProjects.id, input.clientProjectId));
  return { releaseId: Number(result[0].insertId), releaseVersion, manifest };
}

export async function listClientProjectReleases(clientProjectId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(clientProjectReleases).where(eq(clientProjectReleases.clientProjectId, clientProjectId)).orderBy(desc(clientProjectReleases.createdAt));
}

export async function listDeveloperContentInventory() {
  const database = await getDb();
  if (!database) return { courses: [], tests: [], shorts: [] };
  const [courseItems, testItems, shortItems] = await Promise.all([
    database.select({ id: courses.id, title: courses.title, status: courses.status, updatedAt: courses.updatedAt }).from(courses).orderBy(desc(courses.updatedAt)).limit(100),
    database.select({ id: tests.id, title: tests.title, status: tests.status, updatedAt: tests.updatedAt }).from(tests).orderBy(desc(tests.updatedAt)).limit(100),
    database.select({ id: educationalShorts.id, title: educationalShorts.title, status: educationalShorts.status, updatedAt: educationalShorts.updatedAt }).from(educationalShorts).orderBy(desc(educationalShorts.updatedAt)).limit(100),
  ]);
  return { courses: courseItems, tests: testItems, shorts: shortItems };
}

export async function developerSetContentStatus(input: { contentType: "course" | "test" | "short"; contentId: number; status: "draft" | "published" | "archived" }) {
  if (input.contentType === "course") return updateCourseStatus(input.contentId, input.status);
  if (input.contentType === "test") return setManagedTestStatus(input.contentId, input.status);
  return setEducationalShortStatus(input.contentId, input.status);
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


export async function getAuthorizedShortDownload(userId: number, shortId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const [short] = await database.select().from(educationalShorts).where(and(eq(educationalShorts.id, shortId), eq(educationalShorts.status, "published"))).limit(1);
  if (!short) return { status: "not_found" as const };
  if (short.sourceType !== "managed") return { status: "external" as const };
  const key = managedStorageKey(short.videoUrl, short.storageKey);
  if (!key) return { status: "unavailable" as const };
  const signedUrl = await storageGetSignedUrl(key);
  if (!signedUrl) return { status: "unavailable" as const };
  return { status: "authorized" as const, shortId, title: short.title, signedUrl, resource: { resourceType: "video" as const, mimeType: short.mimeType, sizeBytes: short.sizeBytes } };
}


export async function listLikedShorts(userId: number) {
  const database = await getDb();
  if (!database) return [];
  const rows = await database.select({ short: educationalShorts }).from(shortLikes).innerJoin(educationalShorts, eq(shortLikes.shortId, educationalShorts.id)).where(and(eq(shortLikes.userId, userId), eq(educationalShorts.status, "published"))).orderBy(desc(shortLikes.createdAt));
  const shorts = rows.map((row) => row.short);
  if (!shorts.length) return [];
  const shortIds = shorts.map((short) => short.id);
  const [likeRows, saveRows] = await Promise.all([
    database.select({ shortId: shortLikes.shortId }).from(shortLikes).where(inArray(shortLikes.shortId, shortIds)),
    database.select({ shortId: shortSaves.shortId }).from(shortSaves).where(and(eq(shortSaves.userId, userId), inArray(shortSaves.shortId, shortIds))),
  ]);
  const likeCounts = new Map<number, number>();
  for (const row of likeRows) likeCounts.set(row.shortId, (likeCounts.get(row.shortId) ?? 0) + 1);
  const savedIds = new Set(saveRows.map((row) => row.shortId));
  return Promise.all(shorts.map(async (short) => ({ ...short, videoUrl: (await resolveManagedMediaUrl(short.videoUrl, short.storageKey)) ?? short.videoUrl, likeCount: likeCounts.get(short.id) ?? 0, isLiked: true, isSaved: savedIds.has(short.id) })));
}
