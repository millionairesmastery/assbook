ALTER TABLE `uploads` ADD `target` text DEFAULT 'post' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploads` ADD `flagged` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploads` ADD `flag_reason` text;--> statement-breakpoint
CREATE INDEX `uploads_flagged` ON `uploads` (`flagged`,`created`);