CREATE TABLE IF NOT EXISTS `editor_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`author_email` text NOT NULL,
	`page_path` text NOT NULL,
	`patch_json` text NOT NULL,
	`status` text DEFAULT 'creating' NOT NULL,
	`base_sha` text,
	`head_sha` text,
	`pr_number` integer,
	`merge_sha` text,
	`error` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS editor_publication_active ON editor_publications ((1)) WHERE status IN ('creating','checking','deploying');
