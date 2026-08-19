CREATE TABLE `resource_download_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`resourceId` int NOT NULL,
	`resourceDownloadType` enum('pdf') NOT NULL,
	`downloadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `resource_download_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `module_resources` ADD `downloadAllowed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `resource_download_events_user_time_idx` ON `resource_download_events` (`userId`,`downloadedAt`);--> statement-breakpoint
CREATE INDEX `resource_download_events_resource_time_idx` ON `resource_download_events` (`resourceId`,`downloadedAt`);