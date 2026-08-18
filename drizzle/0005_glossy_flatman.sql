CREATE TABLE `staff_passkeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`passkeyHash` varchar(255) NOT NULL,
	`createdByUserId` int NOT NULL,
	`activatedAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_passkeys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `staff_passkeys_active_idx` ON `staff_passkeys` (`revokedAt`,`activatedAt`);