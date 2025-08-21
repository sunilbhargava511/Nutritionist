-- Add audio caching fields to opening_messages table
ALTER TABLE opening_messages 
ADD COLUMN audio_url TEXT,
ADD COLUMN audio_blob TEXT, -- Base64 encoded audio data
ADD COLUMN audio_generated_at TEXT,
ADD COLUMN audio_hash TEXT, -- Hash of content + voice settings to detect changes
ADD COLUMN audio_duration REAL; -- Duration in seconds

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_opening_messages_audio_hash ON opening_messages(audio_hash);
CREATE INDEX IF NOT EXISTS idx_opening_messages_lesson_id ON opening_messages(lesson_id);

-- Create audio_cache table for additional audio storage if needed
CREATE TABLE IF NOT EXISTS audio_cache (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  audio_data TEXT NOT NULL, -- Base64 encoded audio
  file_path TEXT, -- Optional file system path
  mime_type TEXT DEFAULT 'audio/mpeg',
  size_bytes INTEGER,
  duration_seconds REAL,
  voice_id TEXT,
  voice_settings TEXT, -- JSON
  generated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  accessed_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  access_count INTEGER DEFAULT 0,
  FOREIGN KEY (message_id) REFERENCES opening_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_cache_message_id ON audio_cache(message_id);
CREATE INDEX IF NOT EXISTS idx_audio_cache_accessed ON audio_cache(accessed_at);