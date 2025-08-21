-- Migration: Add educational content enabled toggle to admin settings
-- Created: 2025-08-12

ALTER TABLE admin_settings ADD COLUMN educational_content_enabled INTEGER DEFAULT 1;

-- Update the single admin settings record if it exists
UPDATE admin_settings SET educational_content_enabled = 1 WHERE id = 'default';