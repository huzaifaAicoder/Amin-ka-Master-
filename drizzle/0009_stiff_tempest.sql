CREATE TABLE `short_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shortId` int NOT NULL,
	`userId` int NOT NULL,
	`body` varchar(1000) NOT NULL,
	`shortCommentStatus` enum('published','hidden','removed') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `short_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `educational_shorts` MODIFY COLUMN `shortStatus` enum('draft','pending','published','rejected','archived') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('developer','student','teacher','admin','super_admin') NOT NULL DEFAULT 'student';--> statement-breakpoint
ALTER TABLE `educational_shorts` ADD `shortSourceType` enum('managed','youtube','instagram') DEFAULT 'managed' NOT NULL;--> statement-breakpoint
ALTER TABLE `educational_shorts` ADD `moderatedByUserId` int;--> statement-breakpoint
ALTER TABLE `educational_shorts` ADD `moderatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `educational_shorts` ADD `moderationNote` varchar(1000);--> statement-breakpoint
CREATE INDEX `short_comments_short_time_idx` ON `short_comments` (`shortId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `short_comments_user_time_idx` ON `short_comments` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `educational_shorts_creator_status_idx` ON `educational_shorts` (`createdByUserId`,`shortStatus`);