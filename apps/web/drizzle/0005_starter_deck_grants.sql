CREATE TABLE `starter_deck_grants` (
	`starter_deck_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`starter_deck_id`, `user_id`),
	FOREIGN KEY (`starter_deck_id`) REFERENCES `starter_decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `starter_deck_grants_user_id_idx` ON `starter_deck_grants` (`user_id`);--> statement-breakpoint
-- Hand-written: players already have the starter decks that existed when they signed up.
INSERT INTO `starter_deck_grants` (`starter_deck_id`, `user_id`, `created_at`)
SELECT `starter_decks`.`id`, `users`.`id`, `users`.`created_at`
FROM `users` JOIN `starter_decks` ON `starter_decks`.`created_at` <= `users`.`created_at`;
