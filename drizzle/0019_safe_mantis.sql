CREATE TABLE `telemetry_api_latency_buckets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bucketStartedAt` timestamp NOT NULL,
	`routeGroup` varchar(32) NOT NULL,
	`statusClass` varchar(8) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`totalDurationMs` int NOT NULL DEFAULT 0,
	`maxDurationMs` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telemetry_api_latency_buckets_id` PRIMARY KEY(`id`),
	CONSTRAINT `telemetry_latency_bucket_group_status_uq` UNIQUE(`bucketStartedAt`,`routeGroup`,`statusClass`)
);
--> statement-breakpoint
CREATE TABLE `telemetry_crash_buckets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bucketStartedAt` timestamp NOT NULL,
	`platform` varchar(12) NOT NULL,
	`routeGroup` varchar(32) NOT NULL,
	`errorClass` varchar(32) NOT NULL,
	`crashCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telemetry_crash_buckets_id` PRIMARY KEY(`id`),
	CONSTRAINT `telemetry_crash_bucket_platform_route_class_uq` UNIQUE(`bucketStartedAt`,`platform`,`routeGroup`,`errorClass`)
);
--> statement-breakpoint
CREATE INDEX `telemetry_latency_bucket_time_idx` ON `telemetry_api_latency_buckets` (`bucketStartedAt`);--> statement-breakpoint
CREATE INDEX `telemetry_crash_bucket_time_idx` ON `telemetry_crash_buckets` (`bucketStartedAt`);