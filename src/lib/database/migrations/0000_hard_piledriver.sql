CREATE TABLE `admin_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`voice_id` text DEFAULT 'pNInz6obpgDQGcFmaJgB' NOT NULL,
	`voice_description` text DEFAULT 'Professional, clear voice for financial education' NOT NULL,
	`personalization_enabled` integer DEFAULT false,
	`base_report_path` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `content_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`order_index` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`question` text NOT NULL,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `educational_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`current_chunk_index` integer DEFAULT 0,
	`completed` integer DEFAULT false,
	`personalization_enabled` integer DEFAULT false,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `knowledge_base_files` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`content` text NOT NULL,
	`file_type` text NOT NULL,
	`indexed_content` text,
	`uploaded_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `session_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`chunk_id` text NOT NULL,
	`user_response` text NOT NULL,
	`ai_response` text NOT NULL,
	`timestamp` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `session_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`report_path` text NOT NULL,
	`report_data` blob,
	`generated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `system_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
