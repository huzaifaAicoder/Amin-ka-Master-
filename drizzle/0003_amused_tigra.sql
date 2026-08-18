CREATE TABLE `otp_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`purpose` enum('password_reset','identity_verification') NOT NULL,
	`destination` varchar(320) NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`attemptCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_challenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `otp_challenges_user_purpose_idx` ON `otp_challenges` (`userId`,`purpose`,`createdAt`);--> statement-breakpoint
CREATE INDEX `otp_challenges_destination_idx` ON `otp_challenges` (`destination`,`createdAt`);