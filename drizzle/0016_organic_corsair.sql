CREATE TABLE `client_project_releases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientProjectId` int NOT NULL,
	`releaseVersion` varchar(64) NOT NULL,
	`clientProjectReleaseStatus` enum('prepared','submitted','provisioned','superseded') NOT NULL DEFAULT 'prepared',
	`manifest` json NOT NULL,
	`preparedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_project_releases_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_project_release_version_uq` UNIQUE(`clientProjectId`,`releaseVersion`)
);
--> statement-breakpoint
CREATE TABLE `client_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(64) NOT NULL,
	`templateId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`clientProjectStatus` enum('draft','ready_for_review','release_prepared','provisioned','archived') NOT NULL DEFAULT 'draft',
	`branding` json NOT NULL,
	`featureProfile` json NOT NULL,
	`navigationProfile` json NOT NULL,
	`publicPages` json NOT NULL,
	`externalProjectReference` varchar(160),
	`previewUrl` varchar(2048),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_projects_publicId_unique` UNIQUE(`publicId`),
	CONSTRAINT `client_projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `master_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateKey` varchar(96) NOT NULL,
	`name` varchar(160) NOT NULL,
	`version` varchar(64) NOT NULL,
	`masterTemplateStatus` enum('active','archived') NOT NULL DEFAULT 'active',
	`featureManifest` json NOT NULL,
	`sourceCheckpoint` varchar(96),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `master_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `master_templates_templateKey_unique` UNIQUE(`templateKey`)
);
--> statement-breakpoint
CREATE INDEX `client_project_releases_client_time_idx` ON `client_project_releases` (`clientProjectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `client_projects_template_status_idx` ON `client_projects` (`templateId`,`clientProjectStatus`);--> statement-breakpoint
CREATE INDEX `client_projects_creator_updated_idx` ON `client_projects` (`createdByUserId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `master_templates_status_updated_idx` ON `master_templates` (`masterTemplateStatus`,`updatedAt`);