CREATE TABLE `plan_markers` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`sheet_number` integer NOT NULL,
	`marker_text` text NOT NULL,
	`detail` text NOT NULL,
	`sheet` text NOT NULL,
	`marker_type` text NOT NULL,
	`confidence` real NOT NULL,
	`is_valid` integer NOT NULL,
	`fuzzy_matched` integer DEFAULT false NOT NULL,
	`source_tile` text,
	`bbox` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`upload_id`) REFERENCES `plan_uploads`(`upload_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_markers_upload` ON `plan_markers` (`upload_id`);--> statement-breakpoint
CREATE INDEX `idx_markers_plan` ON `plan_markers` (`plan_id`);--> statement-breakpoint
CREATE INDEX `idx_markers_sheet` ON `plan_markers` (`plan_id`,`sheet_number`);--> statement-breakpoint
ALTER TABLE `plan_sheets` ADD `sheet_name` text;--> statement-breakpoint
ALTER TABLE `plan_sheets` ADD `metadata_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `plan_sheets` ADD `metadata` text;--> statement-breakpoint
ALTER TABLE `plan_sheets` ADD `metadata_extracted_at` integer;