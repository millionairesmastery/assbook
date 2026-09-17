ALTER TABLE `reports` ADD `resolved` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `reports_unique` ON `reports` (`user_id`,`post_id`);--> statement-breakpoint
CREATE INDEX `reports_post` ON `reports` (`post_id`);--> statement-breakpoint
CREATE INDEX `reports_open` ON `reports` (`resolved`,`created`);--> statement-breakpoint
CREATE INDEX `blocks_target` ON `blocks` (`target_id`);--> statement-breakpoint
CREATE INDEX `posts_image` ON `posts` (`image`);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`,`auth_version`);--> statement-breakpoint
CREATE INDEX `users_avatar` ON `users` (`avatar`);