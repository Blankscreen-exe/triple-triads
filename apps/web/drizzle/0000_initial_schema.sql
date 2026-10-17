CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`art_key` text,
	`top` integer NOT NULL,
	`right` integer NOT NULL,
	`bottom` integer NOT NULL,
	`left` integer NOT NULL,
	`element` text,
	`kind` text NOT NULL,
	`creator_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cards_kind_valid" CHECK("cards"."kind" in ('generic', 'custom')),
	CONSTRAINT "cards_element_valid" CHECK("cards"."element" is null or "cards"."element" in ('fire', 'ice', 'thunder', 'earth', 'poison', 'wind', 'water', 'holy')),
	CONSTRAINT "cards_top_range" CHECK("cards"."top" between 1 and 10),
	CONSTRAINT "cards_right_range" CHECK("cards"."right" between 1 and 10),
	CONSTRAINT "cards_bottom_range" CHECK("cards"."bottom" between 1 and 10),
	CONSTRAINT "cards_left_range" CHECK("cards"."left" between 1 and 10),
	CONSTRAINT "cards_creator_matches_kind" CHECK(("cards"."kind" = 'generic' and "cards"."creator_id" is null) or ("cards"."kind" = 'custom' and "cards"."creator_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `cards_creator_id_idx` ON `cards` (`creator_id`);--> statement-breakpoint
CREATE TABLE `deck_cards` (
	`deck_id` text NOT NULL,
	`card_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`deck_id`, `card_id`),
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "deck_cards_quantity_positive" CHECK("deck_cards"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `decks_user_id_idx` ON `decks` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `starter_deck_cards` (
	`starter_deck_id` text NOT NULL,
	`card_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`starter_deck_id`, `card_id`),
	FOREIGN KEY (`starter_deck_id`) REFERENCES `starter_decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "starter_deck_cards_quantity_positive" CHECK("starter_deck_cards"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `starter_decks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `starter_decks_single_default_idx` ON `starter_decks` (`is_default`) WHERE "starter_decks"."is_default" = 1;--> statement-breakpoint
CREATE TABLE `trunk_cards` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trunk_cards_quantity_positive" CHECK("trunk_cards"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`username_key` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'player' NOT NULL,
	`active_deck_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`active_deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "users_role_valid" CHECK("users"."role" in ('player', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_key_unique` ON `users` (`username_key`);