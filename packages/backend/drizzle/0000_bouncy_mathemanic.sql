CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`filePath` text,
	`fileType` text,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `medias` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`filePath` text NOT NULL,
	`mediaType` text,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`clerkOrganizationId` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_clerkOrganizationId_unique` ON `organizations` (`clerkOrganizationId`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`directoryPath` text,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`plan` text,
	`startDate` text,
	`endDate` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL
);
