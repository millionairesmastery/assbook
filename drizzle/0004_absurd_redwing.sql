ALTER TABLE `posts` ADD `pinned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `posts_pinned` ON `posts` (`pinned`,`created`);