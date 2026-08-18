CREATE TABLE `short_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shortId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `short_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `short_like_user_short_uq` UNIQUE(`userId`,`shortId`)
);
--> statement-breakpoint
CREATE TABLE `short_saves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shortId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `short_saves_id` PRIMARY KEY(`id`),
	CONSTRAINT `short_save_user_short_uq` UNIQUE(`userId`,`shortId`)
);
--> statement-breakpoint
CREATE INDEX `short_likes_short_idx` ON `short_likes` (`shortId`);--> statement-breakpoint
CREATE INDEX `short_saves_user_idx` ON `short_saves` (`userId`);