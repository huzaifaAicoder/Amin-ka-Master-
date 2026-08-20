CREATE TABLE `study_coach_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`noticesEnabled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `study_coach_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `study_coach_preference_user_uq` UNIQUE(`userId`)
);
