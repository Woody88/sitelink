CREATE TABLE `sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`sheet_name` text,
	`dzi_path` text NOT NULL,
	`tile_directory` text NOT NULL,
	`width` integer,
	`height` integer,
	`tile_count` integer,
	`processing_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sheets_plan_page_unique` ON `sheets` (`plan_id`,`page_number`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`directory_path` text,
	`processing_status` text DEFAULT 'pending' NOT NULL,
	`tile_metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_plans`("id", "project_id", "name", "description", "directory_path", "processing_status", "tile_metadata", "created_at") SELECT "id", "project_id", "name", "description", "directory_path", "processing_status", "tile_metadata", "created_at" FROM `plans`;--> statement-breakpoint
DROP TABLE `plans`;--> statement-breakpoint
ALTER TABLE `__new_plans` RENAME TO `plans`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `plans_processing_status_idx` ON `plans` (`processing_status`);