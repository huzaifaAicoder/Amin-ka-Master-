import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    fullName: varchar("fullName", { length: 160 }),
    email: varchar("email", { length: 320 }).unique(),
    mobile: varchar("mobile", { length: 24 }).unique(),
    passwordHash: varchar("passwordHash", { length: 255 }),
    loginMethod: varchar("loginMethod", { length: 64 }).default("password").notNull(),
    role: mysqlEnum("role", ["developer", "student", "teacher", "admin", "super_admin"])
      .default("student")
      .notNull(),
    status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
    canUploadShorts: boolean("canUploadShorts").default(false).notNull(),
    avatarUrl: varchar("avatarUrl", { length: 1024 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => [index("users_role_idx").on(table.role)],
);

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
    userAgent: varchar("userAgent", { length: 512 }),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("auth_sessions_token_hash_uq").on(table.tokenHash), index("auth_sessions_user_idx").on(table.userId)],
);

export const staffPasskeys = mysqlTable(
  "staff_passkeys",
  {
    id: int("id").autoincrement().primaryKey(),
    passkeyHash: varchar("passkeyHash", { length: 255 }).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    activatedAt: timestamp("activatedAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("staff_passkeys_active_idx").on(table.revokedAt, table.activatedAt)],
);

export const otpChallenges = mysqlTable(
  "otp_challenges",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    purpose: mysqlEnum("purpose", ["password_reset", "identity_verification"]).notNull(),
    destination: varchar("destination", { length: 320 }).notNull(),
    codeHash: varchar("codeHash", { length: 128 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    consumedAt: timestamp("consumedAt"),
    attemptCount: int("attemptCount").default(0).notNull(),
    resetTokenHash: varchar("resetTokenHash", { length: 128 }),
    resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),
    resetTokenUsedAt: timestamp("resetTokenUsedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("otp_challenges_user_purpose_idx").on(table.userId, table.purpose, table.createdAt),
    index("otp_challenges_destination_idx").on(table.destination, table.createdAt),
  ],
);

export const userPermissions = mysqlTable(
  "user_permissions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    permission: varchar("permission", { length: 96 }).notNull(),
    grantedByUserId: int("grantedByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("user_permission_uq").on(table.userId, table.permission)],
);

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull().unique(),
    description: text("description"),
    imageUrl: varchar("imageUrl", { length: 1024 }),
    displayOrder: int("displayOrder").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("categories_active_order_idx").on(table.isActive, table.displayOrder)],
);

export const courses = mysqlTable(
  "courses",
  {
    id: int("id").autoincrement().primaryKey(),
    categoryId: int("categoryId").notNull(),
    instructorId: int("instructorId"),
    title: varchar("title", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 240 }).notNull().unique(),
    shortDescription: varchar("shortDescription", { length: 500 }).notNull(),
    fullDescription: text("fullDescription"),
    thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
    benefits: json("benefits"),
    requirements: json("requirements"),
    durationLabel: varchar("durationLabel", { length: 80 }),
    mrp: decimal("mrp", { precision: 10, scale: 2 }).default("0.00").notNull(),
    sellingPrice: decimal("sellingPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
    accessType: mysqlEnum("accessType", ["free", "lifetime", "time_limited"]).default("free").notNull(),
    accessDurationDays: int("accessDurationDays"),
    status: mysqlEnum("courseStatus", ["draft", "published", "archived"]).default("draft").notNull(),
    averageRating: decimal("averageRating", { precision: 3, scale: 2 }).default("0.00").notNull(),
    reviewCount: int("reviewCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("courses_discovery_idx").on(table.status, table.categoryId),
    index("courses_instructor_idx").on(table.instructorId),
  ],
);

export const courseModules = mysqlTable(
  "course_modules",
  {
    id: int("id").autoincrement().primaryKey(),
    courseId: int("courseId").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    displayOrder: int("displayOrder").default(0).notNull(),
    isPublished: boolean("isPublished").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("modules_course_order_idx").on(table.courseId, table.displayOrder)],
);

export const lessons = mysqlTable(
  "lessons",
  {
    id: int("id").autoincrement().primaryKey(),
    moduleId: int("moduleId").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    contentType: mysqlEnum("contentType", ["video", "text", "image", "pdf", "mixed"])
      .default("video")
      .notNull(),
    contentUrl: varchar("contentUrl", { length: 2048 }),
    provider: varchar("provider", { length: 64 }),
    durationSeconds: int("durationSeconds").default(0).notNull(),
    thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
    isPreview: boolean("isPreview").default(false).notNull(),
    isPublished: boolean("isPublished").default(false).notNull(),
    displayOrder: int("displayOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("lessons_module_order_idx").on(table.moduleId, table.displayOrder)],
);

export const lessonResources = mysqlTable(
  "lesson_resources",
  {
    id: int("id").autoincrement().primaryKey(),
    lessonId: int("lessonId").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    resourceType: mysqlEnum("resourceType", ["pdf", "image", "document", "link"]).notNull(),
    storageKey: varchar("storageKey", { length: 1024 }),
    externalUrl: varchar("externalUrl", { length: 2048 }),
    mimeType: varchar("mimeType", { length: 160 }),
    sizeBytes: int("sizeBytes"),
    isPublished: boolean("isPublished").default(false).notNull(),
    displayOrder: int("displayOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("resources_lesson_order_idx").on(table.lessonId, table.displayOrder)],
);

export const moduleResources = mysqlTable(
  "module_resources",
  {
    id: int("id").autoincrement().primaryKey(),
    moduleId: int("moduleId").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    resourceType: mysqlEnum("moduleResourceType", ["video", "pdf"]).notNull(),
    storageKey: varchar("storageKey", { length: 1024 }),
    contentUrl: varchar("contentUrl", { length: 2048 }),
    provider: varchar("provider", { length: 64 }),
    mimeType: varchar("mimeType", { length: 160 }),
    sizeBytes: int("sizeBytes"),
    durationSeconds: int("durationSeconds").default(0).notNull(),
    thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
    isPublished: boolean("isPublished").default(false).notNull(),
    downloadAllowed: boolean("downloadAllowed").default(false).notNull(),
    displayOrder: int("displayOrder").default(0).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("module_resources_module_order_idx").on(table.moduleId, table.displayOrder)],
);

export const resourceDownloadEvents = mysqlTable(
  "resource_download_events",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    resourceId: int("resourceId").notNull(),
    resourceType: mysqlEnum("resourceDownloadType", ["pdf", "video"]).notNull(),
    downloadedAt: timestamp("downloadedAt").defaultNow().notNull(),
  },
  (table) => [
    index("resource_download_events_user_time_idx").on(table.userId, table.downloadedAt),
    index("resource_download_events_resource_time_idx").on(table.resourceId, table.downloadedAt),
  ],
);

export const freePlaylists = mysqlTable(
  "free_playlists",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
    isPublished: boolean("isPublished").default(false).notNull(),
    displayOrder: int("displayOrder").default(0).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("free_playlists_visibility_order_idx").on(table.isPublished, table.displayOrder)],
);

export const freePlaylistItems = mysqlTable(
  "free_playlist_items",
  {
    id: int("id").autoincrement().primaryKey(),
    playlistId: int("playlistId").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    contentType: mysqlEnum("freePlaylistContentType", ["video", "pdf"]).notNull(),
    storageKey: varchar("storageKey", { length: 1024 }),
    contentUrl: varchar("contentUrl", { length: 2048 }),
    provider: varchar("provider", { length: 64 }),
    mimeType: varchar("mimeType", { length: 160 }),
    sizeBytes: int("sizeBytes"),
    durationSeconds: int("durationSeconds").default(0).notNull(),
    thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
    isPublished: boolean("isPublished").default(false).notNull(),
    displayOrder: int("displayOrder").default(0).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("free_playlist_items_playlist_order_idx").on(table.playlistId, table.displayOrder)],
);

export const educationalShorts = mysqlTable(
  "educational_shorts",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 220 }).notNull(),
    description: varchar("description", { length: 1000 }),
    subjectCategory: varchar("subjectCategory", { length: 80 }).default("General").notNull(),
    videoUrl: varchar("videoUrl", { length: 2048 }).notNull(),
    storageKey: varchar("storageKey", { length: 1024 }),
    provider: varchar("provider", { length: 64 }),
    mimeType: varchar("mimeType", { length: 160 }),
    sizeBytes: int("sizeBytes"),
    durationSeconds: int("durationSeconds").default(0).notNull(),
    thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
    sourceType: mysqlEnum("shortSourceType", ["managed", "youtube", "instagram"]).default("managed").notNull(),
    status: mysqlEnum("shortStatus", ["draft", "pending", "published", "rejected", "archived"]).default("draft").notNull(),
    displayOrder: int("displayOrder").default(0).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    moderatedByUserId: int("moderatedByUserId"),
    moderatedAt: timestamp("moderatedAt"),
    moderationNote: varchar("moderationNote", { length: 1000 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("educational_shorts_status_order_idx").on(table.status, table.displayOrder),
    index("educational_shorts_creator_status_idx").on(table.createdByUserId, table.status),
  ],
);

export const shortLikes = mysqlTable(
  "short_likes",
  {
    id: int("id").autoincrement().primaryKey(),
    shortId: int("shortId").notNull(),
    userId: int("userId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("short_like_user_short_uq").on(table.userId, table.shortId),
    index("short_likes_short_idx").on(table.shortId),
  ],
);

export const shortSaves = mysqlTable(
  "short_saves",
  {
    id: int("id").autoincrement().primaryKey(),
    shortId: int("shortId").notNull(),
    userId: int("userId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("short_save_user_short_uq").on(table.userId, table.shortId),
    index("short_saves_user_idx").on(table.userId),
  ],
);

export const shortComments = mysqlTable(
  "short_comments",
  {
    id: int("id").autoincrement().primaryKey(),
    shortId: int("shortId").notNull(),
    userId: int("userId").notNull(),
    body: varchar("body", { length: 1000 }).notNull(),
    status: mysqlEnum("shortCommentStatus", ["published", "hidden", "removed"]).default("published").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("short_comments_short_time_idx").on(table.shortId, table.createdAt),
    index("short_comments_user_time_idx").on(table.userId, table.createdAt),
  ],
);

export const enrollments = mysqlTable(
  "enrollments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    courseId: int("courseId").notNull(),
    orderId: int("orderId"),
    status: mysqlEnum("enrollmentStatus", ["active", "expired", "revoked"]).default("active").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("enrollment_user_course_uq").on(table.userId, table.courseId), index("enrollment_course_idx").on(table.courseId)],
);

export const lessonProgress = mysqlTable(
  "lesson_progress",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    courseId: int("courseId").notNull(),
    lessonId: int("lessonId").notNull(),
    watchedSeconds: int("watchedSeconds").default(0).notNull(),
    isCompleted: boolean("isCompleted").default(false).notNull(),
    completedAt: timestamp("completedAt"),
    lastViewedAt: timestamp("lastViewedAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("progress_user_lesson_uq").on(table.userId, table.lessonId),
    index("progress_user_course_idx").on(table.userId, table.courseId),
  ],
);

export const bookmarks = mysqlTable(
  "bookmarks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    lessonId: int("lessonId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("bookmark_user_lesson_uq").on(table.userId, table.lessonId)],
);

export const personalNotes = mysqlTable(
  "personal_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    lessonId: int("lessonId").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("note_user_lesson_uq").on(table.userId, table.lessonId)],
);

export const tests = mysqlTable(
  "tests",
  {
    id: int("id").autoincrement().primaryKey(),
    courseId: int("courseId"),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    durationMinutes: int("durationMinutes").notNull(),
    passingMarks: int("passingMarks").default(0).notNull(),
    status: mysqlEnum("testStatus", ["draft", "published", "archived"]).default("draft").notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("tests_course_status_idx").on(table.courseId, table.status)],
);

export const questions = mysqlTable(
  "questions",
  {
    id: int("id").autoincrement().primaryKey(),
    testId: int("testId").notNull(),
    prompt: text("prompt").notNull(),
    options: json("options").notNull(),
    correctOptionIndex: int("correctOptionIndex").notNull(),
    marks: int("marks").default(1).notNull(),
    explanation: text("explanation"),
    displayOrder: int("displayOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("questions_test_order_idx").on(table.testId, table.displayOrder)],
);

export const testAttempts = mysqlTable(
  "test_attempts",
  {
    id: int("id").autoincrement().primaryKey(),
    testId: int("testId").notNull(),
    userId: int("userId").notNull(),
    status: mysqlEnum("attemptStatus", ["in_progress", "submitted", "expired"]).default("in_progress").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    submittedAt: timestamp("submittedAt"),
    score: int("score").default(0).notNull(),
    totalMarks: int("totalMarks").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("attempt_user_test_idx").on(table.userId, table.testId)],
);

export const testAnswers = mysqlTable(
  "test_answers",
  {
    id: int("id").autoincrement().primaryKey(),
    attemptId: int("attemptId").notNull(),
    questionId: int("questionId").notNull(),
    selectedOptionIndex: int("selectedOptionIndex"),
    isCorrect: boolean("isCorrect").default(false).notNull(),
    marksAwarded: int("marksAwarded").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("test_answer_attempt_question_uq").on(table.attemptId, table.questionId)],
);

export const liveClasses = mysqlTable(
  "live_classes",
  {
    id: int("id").autoincrement().primaryKey(),
    courseId: int("courseId"),
    instructorId: int("instructorId").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt"),
    meetingUrl: varchar("meetingUrl", { length: 2048 }),
    recordingUrl: varchar("recordingUrl", { length: 2048 }),
    status: mysqlEnum("liveClassStatus", ["upcoming", "live", "completed", "cancelled"])
      .default("upcoming")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("live_classes_course_time_idx").on(table.courseId, table.startsAt)],
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    body: text("body").notNull(),
    type: varchar("type", { length: 64 }).default("announcement").notNull(),
    link: varchar("link", { length: 1024 }),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("notifications_user_read_idx").on(table.userId, table.isRead, table.createdAt)],
);

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 220 }).notNull(),
  body: text("body").notNull(),
  targetType: mysqlEnum("targetType", ["all_students", "course", "group", "student"]).default("all_students").notNull(),
  targetId: int("targetId"),
  isPublished: boolean("isPublished").default(false).notNull(),
  publishedAt: timestamp("publishedAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const courseReviews = mysqlTable(
  "course_reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    courseId: int("courseId").notNull(),
    userId: int("userId").notNull(),
    rating: int("rating").notNull(),
    body: text("body").notNull(),
    status: mysqlEnum("reviewStatus", ["pending", "approved", "hidden"]).default("pending").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("review_user_course_uq").on(table.userId, table.courseId), index("reviews_course_status_idx").on(table.courseId, table.status)],
);

export const certificates = mysqlTable(
  "certificates",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    courseId: int("courseId").notNull(),
    certificateCode: varchar("certificateCode", { length: 64 }).notNull().unique(),
    issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("certificate_user_course_uq").on(table.userId, table.courseId)],
);

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    publicId: varchar("publicId", { length: 64 }).notNull().unique(),
    userId: int("userId").notNull(),
    courseId: int("courseId").notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerOrderId: varchar("providerOrderId", { length: 160 }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).default("INR").notNull(),
    status: mysqlEnum("orderStatus", ["pending", "paid", "failed", "cancelled", "refunded"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("orders_user_course_idx").on(table.userId, table.courseId, table.status)],
);

export const paymentEvents = mysqlTable(
  "payment_events",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerEventId: varchar("providerEventId", { length: 160 }).notNull(),
    orderId: int("orderId"),
    eventType: varchar("eventType", { length: 96 }).notNull(),
    verifiedAt: timestamp("verifiedAt").notNull(),
    payloadDigest: varchar("payloadDigest", { length: 128 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("payment_event_provider_event_uq").on(table.provider, table.providerEventId)],
);

export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 120 }).notNull().unique(),
  settingValue: json("settingValue").notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId"),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entityType", { length: 96 }).notNull(),
    entityId: varchar("entityId", { length: 96 }),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("audit_logs_actor_time_idx").on(table.actorUserId, table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
