CREATE TABLE `comment_likes` (
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `comment_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comment_likes_comment` ON `comment_likes` (`comment_id`);--> statement-breakpoint
ALTER TABLE `comments` ADD `parent_id` text;--> statement-breakpoint
CREATE INDEX `comments_parent` ON `comments` (`parent_id`);