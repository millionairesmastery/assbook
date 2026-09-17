CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor_id` text,
	`kind` text NOT NULL,
	`post_id` text DEFAULT '' NOT NULL,
	`peek_id` text DEFAULT '' NOT NULL,
	`ref` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user` ON `notifications` (`user_id`,`created`);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_once` ON `notifications` (`user_id`,`actor_id`,`kind`,`post_id`,`peek_id`,`ref`);