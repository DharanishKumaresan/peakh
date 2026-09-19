CREATE TABLE `friendships` (
	`user_a` text NOT NULL,
	`user_b` text NOT NULL,
	`id` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_a`, `user_b`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_id_unique` ON `friendships` (`id`);--> statement-breakpoint
CREATE INDEX `friendships_user_b_idx` ON `friendships` (`user_b`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_id_unique` ON `profiles` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_code_unique` ON `profiles` (`code`);