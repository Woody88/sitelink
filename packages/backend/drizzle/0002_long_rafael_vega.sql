ALTER TABLE `plan_markers` ADD `review_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `plan_markers` ADD `adjusted_bbox` text;--> statement-breakpoint
ALTER TABLE `plan_markers` ADD `original_bbox` text;--> statement-breakpoint
ALTER TABLE `plan_markers` ADD `adjusted_by` text;--> statement-breakpoint
ALTER TABLE `plan_markers` ADD `adjusted_at` integer;--> statement-breakpoint
ALTER TABLE `plan_markers` ADD `review_notes` text;--> statement-breakpoint
CREATE INDEX `idx_markers_review` ON `plan_markers` (`plan_id`,`review_status`,`confidence`);