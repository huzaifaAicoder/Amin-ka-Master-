CREATE TABLE `ai_quiz_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topic` varchar(160) NOT NULL,
	`aiQuizAttemptDifficulty` enum('beginner','intermediate','advanced') NOT NULL,
	`questionCount` int NOT NULL,
	`correctAnswers` int NOT NULL,
	`scorePercent` int NOT NULL,
	`durationSeconds` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_quiz_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_quiz_attempt_user_idx` ON `ai_quiz_attempts` (`userId`,`createdAt`);