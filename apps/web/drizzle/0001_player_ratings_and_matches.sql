CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`red_user_id` text,
	`blue_user_id` text,
	`winner` text,
	`red_score` integer NOT NULL,
	`blue_score` integer NOT NULL,
	`forfeit` integer NOT NULL,
	`red_rating_before` integer NOT NULL,
	`red_rating_after` integer NOT NULL,
	`blue_rating_before` integer NOT NULL,
	`blue_rating_after` integer NOT NULL,
	`played_at` integer NOT NULL,
	FOREIGN KEY (`red_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`blue_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "matches_winner_valid" CHECK("matches"."winner" is null or "matches"."winner" in ('red', 'blue'))
);
--> statement-breakpoint
CREATE INDEX `matches_red_user_idx` ON `matches` (`red_user_id`,`played_at`);--> statement-breakpoint
CREATE INDEX `matches_blue_user_idx` ON `matches` (`blue_user_id`,`played_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `rating` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `wins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `losses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `draws` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `streak` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `users_rating_idx` ON `users` (`rating`);