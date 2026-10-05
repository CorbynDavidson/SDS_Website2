CREATE TABLE `enquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`postcode` text NOT NULL,
	`disrepair_type` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_enquiries_created_at` ON `enquiries` (`created_at`);