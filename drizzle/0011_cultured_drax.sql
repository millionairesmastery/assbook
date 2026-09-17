CREATE TABLE `peek_shares` (
	`peek_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created` integer NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`peek_id`, `user_id`),
	FOREIGN KEY (`peek_id`) REFERENCES `peeks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `peek_shares_user` ON `peek_shares` (`user_id`,`created`);