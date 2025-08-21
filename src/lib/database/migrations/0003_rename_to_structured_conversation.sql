-- Rename educational_content_enabled to use_structured_conversation
ALTER TABLE `admin_settings` RENAME COLUMN `educational_content_enabled` TO `use_structured_conversation`;