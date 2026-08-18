CREATE TABLE `educational_shorts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` varchar(1000),
	`videoUrl` varchar(2048) NOT NULL,
	`storageKey` varchar(1024),
	`provider` varchar(64),
	`mimeType` varchar(160),
	`sizeBytes` int,
	`durationSeconds` int NOT NULL DEFAULT 0,
	`thumbnailUrl` varchar(1024),
	`shortStatus` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `educational_shorts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `free_playlist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playlistId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text,
	`freePlaylistContentType` enum('video','pdf') NOT NULL,
	`storageKey` varchar(1024),
	`contentUrl` varchar(2048),
	`provider` varchar(64),
	`mimeType` varchar(160),
	`sizeBytes` int,
	`durationSeconds` int NOT NULL DEFAULT 0,
	`thumbnailUrl` varchar(1024),
	`isPublished` boolean NOT NULL DEFAULT false,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `free_playlist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `free_playlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text,
	`thumbnailUrl` varchar(1024),
	`isPublished` boolean NOT NULL DEFAULT false,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `free_playlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `module_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moduleId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text,
	`moduleResourceType` enum('video','pdf') NOT NULL,
	`storageKey` varchar(1024),
	`contentUrl` varchar(2048),
	`provider` varchar(64),
	`mimeType` varchar(160),
	`sizeBytes` int,
	`durationSeconds` int NOT NULL DEFAULT 0,
	`thumbnailUrl` varchar(1024),
	`isPublished` boolean NOT NULL DEFAULT false,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `module_resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `educational_shorts_status_order_idx` ON `educational_shorts` (`shortStatus`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `free_playlist_items_playlist_order_idx` ON `free_playlist_items` (`playlistId`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `free_playlists_visibility_order_idx` ON `free_playlists` (`isPublished`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `module_resources_module_order_idx` ON `module_resources` (`moduleId`,`displayOrder`);