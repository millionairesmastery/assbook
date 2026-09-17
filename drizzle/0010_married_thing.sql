CREATE TABLE `peek_likes` (
	`peek_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`peek_id`, `user_id`),
	FOREIGN KEY (`peek_id`) REFERENCES `peeks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `peek_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`peek_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`peek_id`) REFERENCES `peeks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `peek_replies_peek` ON `peek_replies` (`peek_id`,`created`);--> statement-breakpoint
CREATE TABLE `peek_views` (
	`peek_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`peek_id`, `user_id`),
	FOREIGN KEY (`peek_id`) REFERENCES `peeks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `peek_views_user` ON `peek_views` (`user_id`);--> statement-breakpoint
CREATE TABLE `peeks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`frame` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`file_gone` integer DEFAULT 0 NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `peeks_user` ON `peeks` (`user_id`,`created`);--> statement-breakpoint
CREATE INDEX `peeks_live` ON `peeks` (`deleted`,`expires`);