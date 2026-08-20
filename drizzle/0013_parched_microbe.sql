CREATE TABLE `ai_quiz_review_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submittedByUserId` int NOT NULL,
	`topic` varchar(160) NOT NULL,
	`aiQuizDifficulty` enum('beginner','intermediate','advanced') NOT NULL,
	`language` varchar(32) NOT NULL,
	`questions` json NOT NULL,
	`aiQuizReviewStatus` enum('pending','exported') NOT NULL DEFAULT 'pending',
	`reviewedByUserId` int,
	`exportedTestId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_quiz_review_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_quiz_review_status_idx` ON `ai_quiz_review_submissions` (`aiQuizReviewStatus`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_quiz_review_student_idx` ON `ai_quiz_review_submissions` (`submittedByUserId`);