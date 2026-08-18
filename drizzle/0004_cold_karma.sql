ALTER TABLE `otp_challenges` ADD `resetTokenHash` varchar(128);--> statement-breakpoint
ALTER TABLE `otp_challenges` ADD `resetTokenExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `otp_challenges` ADD `resetTokenUsedAt` timestamp;