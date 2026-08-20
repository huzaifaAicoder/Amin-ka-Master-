CREATE TABLE `guardian_report_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`guardianName` varchar(160),
	`guardianEmail` varchar(320),
	`guardianMobile` varchar(24),
	`consentGranted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guardian_report_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `guardian_report_preference_user_uq` UNIQUE(`userId`)
);
