CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(220) NOT NULL,
	`body` text NOT NULL,
	`targetType` enum('all_students','course','group','student') NOT NULL DEFAULT 'all_students',
	`targetId` int,
	`isPublished` boolean NOT NULL DEFAULT false,
	`publishedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(120) NOT NULL,
	`settingValue` json NOT NULL,
	`updatedByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(96) NOT NULL,
	`entityId` varchar(96),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`userAgent` varchar(512),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_hash_uq` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookmarks_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookmark_user_lesson_uq` UNIQUE(`userId`,`lessonId`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`description` text,
	`imageUrl` varchar(1024),
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`certificateCode` varchar(64) NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_certificateCode_unique` UNIQUE(`certificateCode`),
	CONSTRAINT `certificate_user_course_uq` UNIQUE(`userId`,`courseId`)
);
--> statement-breakpoint
CREATE TABLE `course_modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_modules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`body` text NOT NULL,
	`reviewStatus` enum('pending','approved','hidden') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_user_course_uq` UNIQUE(`userId`,`courseId`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`instructorId` int,
	`title` varchar(220) NOT NULL,
	`slug` varchar(240) NOT NULL,
	`shortDescription` varchar(500) NOT NULL,
	`fullDescription` text,
	`thumbnailUrl` varchar(1024),
	`benefits` json,
	`requirements` json,
	`durationLabel` varchar(80),
	`mrp` decimal(10,2) NOT NULL DEFAULT '0.00',
	`sellingPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`accessType` enum('free','lifetime','time_limited') NOT NULL DEFAULT 'free',
	`accessDurationDays` int,
	`courseStatus` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`averageRating` decimal(3,2) NOT NULL DEFAULT '0.00',
	`reviewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`),
	CONSTRAINT `courses_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`orderId` int,
	`enrollmentStatus` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrollment_user_course_uq` UNIQUE(`userId`,`courseId`)
);
--> statement-breakpoint
CREATE TABLE `lesson_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`lessonId` int NOT NULL,
	`watchedSeconds` int NOT NULL DEFAULT 0,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`lastViewedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lesson_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `progress_user_lesson_uq` UNIQUE(`userId`,`lessonId`)
);
--> statement-breakpoint
CREATE TABLE `lesson_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`resourceType` enum('pdf','image','document','link') NOT NULL,
	`storageKey` varchar(1024),
	`externalUrl` varchar(2048),
	`mimeType` varchar(160),
	`sizeBytes` int,
	`isPublished` boolean NOT NULL DEFAULT false,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lesson_resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moduleId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text,
	`contentType` enum('video','text','image','pdf','mixed') NOT NULL DEFAULT 'video',
	`contentUrl` varchar(2048),
	`provider` varchar(64),
	`durationSeconds` int NOT NULL DEFAULT 0,
	`thumbnailUrl` varchar(1024),
	`isPreview` boolean NOT NULL DEFAULT false,
	`isPublished` boolean NOT NULL DEFAULT false,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int,
	`instructorId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`meetingUrl` varchar(2048),
	`recordingUrl` varchar(2048),
	`liveClassStatus` enum('upcoming','live','completed','cancelled') NOT NULL DEFAULT 'upcoming',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`body` text NOT NULL,
	`type` varchar(64) NOT NULL DEFAULT 'announcement',
	`link` varchar(1024),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`providerOrderId` varchar(160),
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'INR',
	`orderStatus` enum('pending','paid','failed','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(64) NOT NULL,
	`providerEventId` varchar(160) NOT NULL,
	`orderId` int,
	`eventType` varchar(96) NOT NULL,
	`verifiedAt` timestamp NOT NULL,
	`payloadDigest` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_event_provider_event_uq` UNIQUE(`provider`,`providerEventId`)
);
--> statement-breakpoint
CREATE TABLE `personal_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `personal_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `note_user_lesson_uq` UNIQUE(`userId`,`lessonId`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testId` int NOT NULL,
	`prompt` text NOT NULL,
	`options` json NOT NULL,
	`correctOptionIndex` int NOT NULL,
	`marks` int NOT NULL DEFAULT 1,
	`explanation` text,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`questionId` int NOT NULL,
	`selectedOptionIndex` int,
	`isCorrect` boolean NOT NULL DEFAULT false,
	`marksAwarded` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_answer_attempt_question_uq` UNIQUE(`attemptId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `test_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testId` int NOT NULL,
	`userId` int NOT NULL,
	`attemptStatus` enum('in_progress','submitted','expired') NOT NULL DEFAULT 'in_progress',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`submittedAt` timestamp,
	`score` int NOT NULL DEFAULT 0,
	`totalMarks` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int,
	`title` varchar(220) NOT NULL,
	`description` text,
	`durationMinutes` int NOT NULL,
	`passingMarks` int NOT NULL DEFAULT 0,
	`testStatus` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`permission` varchar(96) NOT NULL,
	`grantedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_permission_uq` UNIQUE(`userId`,`permission`)
);
--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `name` TO `fullName`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `fullName` varchar(160);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `loginMethod` varchar(64) NOT NULL DEFAULT 'password';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('student','teacher','admin','super_admin') NOT NULL DEFAULT 'student';--> statement-breakpoint
ALTER TABLE `users` ADD `mobile` varchar(24);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','suspended') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_mobile_unique` UNIQUE(`mobile`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_time_idx` ON `audit_logs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `categories_active_order_idx` ON `categories` (`isActive`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `modules_course_order_idx` ON `course_modules` (`courseId`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `reviews_course_status_idx` ON `course_reviews` (`courseId`,`reviewStatus`);--> statement-breakpoint
CREATE INDEX `courses_discovery_idx` ON `courses` (`courseStatus`,`categoryId`);--> statement-breakpoint
CREATE INDEX `courses_instructor_idx` ON `courses` (`instructorId`);--> statement-breakpoint
CREATE INDEX `enrollment_course_idx` ON `enrollments` (`courseId`);--> statement-breakpoint
CREATE INDEX `progress_user_course_idx` ON `lesson_progress` (`userId`,`courseId`);--> statement-breakpoint
CREATE INDEX `resources_lesson_order_idx` ON `lesson_resources` (`lessonId`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `lessons_module_order_idx` ON `lessons` (`moduleId`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `live_classes_course_time_idx` ON `live_classes` (`courseId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`userId`,`isRead`,`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_user_course_idx` ON `orders` (`userId`,`courseId`,`orderStatus`);--> statement-breakpoint
CREATE INDEX `questions_test_order_idx` ON `questions` (`testId`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `attempt_user_test_idx` ON `test_attempts` (`userId`,`testId`);--> statement-breakpoint
CREATE INDEX `tests_course_status_idx` ON `tests` (`courseId`,`testStatus`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);