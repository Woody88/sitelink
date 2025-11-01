ALTER TABLE `files` ADD `upload_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `files` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `files_upload_id_unique` ON `files` (`upload_id`);