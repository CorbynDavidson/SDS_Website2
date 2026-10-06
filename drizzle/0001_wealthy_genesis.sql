CREATE TABLE `content_drafts` (
	`page_path` text NOT NULL,
	`author_email` text NOT NULL,
	`base_sha256` text NOT NULL,
	`body_html` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`page_path`, `author_email`)
);
--> statement-breakpoint
CREATE TABLE `form_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`request_key` text NOT NULL,
	`form_key` text NOT NULL,
	`source_path` text NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_submissions_request_key_unique` ON `form_submissions` (`request_key`);--> statement-breakpoint
CREATE INDEX `idx_form_submissions_created_at` ON `form_submissions` (`created_at`);--> statement-breakpoint
CREATE TABLE `form_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` integer NOT NULL,
	`storage_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `form_submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_form_uploads_submission` ON `form_uploads` (`submission_id`);--> statement-breakpoint
CREATE TABLE `submission_rate_limits` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
