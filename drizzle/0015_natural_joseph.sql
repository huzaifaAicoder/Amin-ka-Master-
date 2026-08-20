CREATE TABLE `student_feature_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`feature` varchar(96) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`grantedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_feature_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_feature_permission_uq` UNIQUE(`userId`,`feature`)
);
