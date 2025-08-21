-- Rename educational_sessions table to conversations and add new fields
-- This migration reflects changes already applied manually

-- The table rename and new fields were already applied manually via migrate-to-conversations.js
-- This migration file exists to keep Drizzle's migration tracking in sync

-- If educational_sessions still exists, rename it to conversations
-- If conversations already exists, this is a no-op

-- Add conversation_type field if it doesn't exist
-- Add chunk_last_delivered field if it doesn't exist

-- Note: The actual changes were already applied by migrate-to-conversations.js
-- This file ensures Drizzle's migration state matches the database reality