import { sqliteTable, text, integer, blob, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Lessons for educational delivery (replacing chunks)
export const lessons = sqliteTable('lessons', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  videoUrl: text('video_url').notNull(), // YouTube URL
  videoSummary: text('video_summary').notNull(), // Context for LLM during Q&A
  startMessage: text('start_message'), // TTS message played before video
  orderIndex: integer('order_index').notNull(),
  prerequisites: text('prerequisites'), // JSON array of lesson IDs
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// User sessions tracking progress across multiple lessons
export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id'), // Optional, for future user accounts
  completedLessons: text('completed_lessons'), // JSON array of completed lesson IDs
  currentLessonId: text('current_lesson_id'), // Currently active lesson
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Individual Q&A conversations for each lesson
export const lessonConversations = sqliteTable('lesson_conversations', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(), // References userSessions
  lessonId: text('lesson_id').notNull(), // References lessons
  conversationId: text('conversation_id'), // ElevenLabs conversation ID
  completed: integer('completed', { mode: 'boolean' }).default(false),
  messagesCount: integer('messages_count').default(0),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});


// Administrator settings
export const adminSettings = sqliteTable('admin_settings', {
  id: text('id').primaryKey().default('default'),
  voiceId: text('voice_id').notNull().default('pNInz6obpgDQGcFmaJgB'),
  voiceDescription: text('voice_description').notNull().default('Professional, clear voice for financial education'),
  personalizationEnabled: integer('personalization_enabled', { mode: 'boolean' }).default(false),
  conversationAware: integer('conversation_aware', { mode: 'boolean' }).default(true), // Enable smooth lead-ins by default
  useStructuredConversation: integer('use_structured_conversation', { mode: 'boolean' }).default(true),
  debugLlmEnabled: integer('debug_llm_enabled', { mode: 'boolean' }).default(false), // Enable LLM debug capture
  baseReportPath: text('base_report_path'),
  baseReportTemplate: blob('base_report_template'), // PDF template as binary data
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// System prompts for different purposes (simplified to two types)
export const systemPrompts = sqliteTable('system_prompts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'qa' (general) | 'lesson_qa' (lesson-specific) | 'report' (legacy)
  content: text('content').notNull(),
  lessonId: text('lesson_id'), // For lesson-specific prompts (lesson_qa type)
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Knowledge base files
export const knowledgeBaseFiles = sqliteTable('knowledge_base_files', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  content: text('content').notNull(),
  fileType: text('file_type').notNull(),
  indexedContent: text('indexed_content'), // Processed content for search
  uploadedAt: text('uploaded_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Conversations (renamed from educational_sessions for clarity)
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(), // Now uses ElevenLabs conversation_id directly
  conversationId: text('conversation_id').unique(), // Store ElevenLabs conversation_id for reference
  conversationType: text('conversation_type').notNull().default('structured'), // 'structured' | 'open-ended'
  userId: text('user_id'), // Optional user identification
  completed: integer('completed', { mode: 'boolean' }).default(false),
  personalizationEnabled: integer('personalization_enabled', { mode: 'boolean' }).default(false),
  conversationAware: integer('conversation_aware', { mode: 'boolean' }), // NULL = use admin default, true/false = override
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Keep old export for backward compatibility during migration
export const educationalSessions = conversations;

// Session progress tracking
export const sessionProgress = sqliteTable('session_progress', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  chunkId: text('chunk_id').notNull(),
  userResponse: text('user_response').notNull(),
  aiResponse: text('ai_response').notNull(),
  timestamp: text('timestamp').default(sql`(CURRENT_TIMESTAMP)`),
});

// Generated session reports
export const sessionReports = sqliteTable('session_reports', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  reportPath: text('report_path').notNull(),
  reportData: blob('report_data'), // PDF binary data
  generatedAt: text('generated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Debug LLM Sessions Table
export const debugSessions = sqliteTable('debug_sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  startTime: text('start_time').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  endTime: text('end_time'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Debug LLM Entries Table
export const debugEntries = sqliteTable('debug_entries', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  timestamp: text('timestamp').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  type: text('type').notNull(), // 'claude' | 'knowledge-search' | 'rag'
  status: text('status').notNull(), // 'pending' | 'success' | 'error'
  
  // Request data (stored as JSON)
  requestModel: text('request_model').notNull(),
  requestSystemPrompt: text('request_system_prompt'),
  requestMessages: text('request_messages'), // JSON string
  requestTemperature: real('request_temperature'),
  requestMaxTokens: integer('request_max_tokens'),
  requestKnowledgeContext: text('request_knowledge_context'),
  requestOtherParams: text('request_other_params'), // JSON string
  
  // Response data
  responseContent: text('response_content'),
  responseProcessingTime: integer('response_processing_time'), // milliseconds
  responseTokens: integer('response_tokens'),
  responseCitedArticles: text('response_cited_articles'), // JSON string
  
  // Error data
  errorMessage: text('error_message'),
  
  // Metadata
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Session Events Table for Debug Panel
export const sessionEvents = sqliteTable('session_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  debugSessionId: text('debug_session_id').notNull(), // Links to debugSessions
  eventType: text('event_type').notNull(), // 'session_started' | 'elevenlabs_conversation_started' | 'lesson_started' | 'lesson_qa_started' | 'open_conversation_started'
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  firstMessage: text('first_message'),
  status: text('status').notNull().default('active'), // 'active' | 'completed' | 'interrupted'
  icon: text('icon'),
  
  // Event metadata (stored as JSON)
  metadata: text('metadata').notNull(), // JSON object with event-specific data
  
  // Timestamps
  timestamp: text('timestamp').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Unified conversation sessions (new session system)
export const conversationSessions = sqliteTable('conversation_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id'), // Optional for future user accounts
  sessionType: text('session_type').notNull(), // 'open_ended' | 'lesson_based'
  lessonPhase: text('lesson_phase'), // 'lesson_intro' | 'video_watching' | 'qa_conversation'
  currentLessonId: text('current_lesson_id'), // NULL for open-ended, lesson ID for lesson-based
  elevenlabsConversationId: text('elevenlabs_conversation_id'), // When voice connected
  status: text('status').notNull().default('active'), // 'active' | 'paused' | 'completed'
  startedAt: text('started_at').default(sql`(CURRENT_TIMESTAMP)`),
  endedAt: text('ended_at'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Complete message transcript (EVERYTHING)
export const conversationMessages = sqliteTable('conversation_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(), // Foreign key to conversation_sessions
  messageType: text('message_type').notNull(), // 'tts_opening' | 'tts_lesson_intro' | 'user_voice' | 'assistant_voice' | 'llm_qa_start' | 'system'
  content: text('content').notNull(), // Actual message text
  speaker: text('speaker').notNull(), // 'user' | 'assistant' | 'system'
  elevenlabsMessageId: text('elevenlabs_message_id'), // If from ElevenLabs
  lessonContextId: text('lesson_context_id'), // If lesson-related
  timestamp: text('timestamp').default(sql`(CURRENT_TIMESTAMP)`),
  metadata: text('metadata'), // JSON for additional context
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Admin-configured opening messages
export const openingMessages = sqliteTable('opening_messages', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'general_opening' | 'lesson_intro'
  lessonId: text('lesson_id'), // NULL for general, specific lesson ID for lesson intros
  messageContent: text('message_content').notNull(), // The TTS message text
  voiceSettings: text('voice_settings'), // JSON: voice_id, speed, etc.
  active: integer('active', { mode: 'boolean' }).default(true),
  // Audio cache fields
  audioUrl: text('audio_url'), // URL to cached audio file
  audioBlob: text('audio_blob'), // Base64 encoded audio data
  audioGeneratedAt: text('audio_generated_at'), // When audio was generated
  audioHash: text('audio_hash'), // Hash of content + voice settings
  audioDuration: real('audio_duration'), // Duration in seconds
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Audio cache table for additional storage
export const audioCache = sqliteTable('audio_cache', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => openingMessages.id, { onDelete: 'cascade' }),
  audioData: text('audio_data').notNull(), // Base64 encoded audio
  filePath: text('file_path'), // Optional file system path
  mimeType: text('mime_type').default('audio/mpeg'),
  sizeBytes: integer('size_bytes'),
  durationSeconds: real('duration_seconds'),
  voiceId: text('voice_id'),
  voiceSettings: text('voice_settings'), // JSON
  generatedAt: text('generated_at').default(sql`(CURRENT_TIMESTAMP)`),
  accessedAt: text('accessed_at').default(sql`(CURRENT_TIMESTAMP)`),
  accessCount: integer('access_count').default(0),
});

// Export types for TypeScript
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

export type LessonConversation = typeof lessonConversations.$inferSelect;
export type NewLessonConversation = typeof lessonConversations.$inferInsert;


export type AdminSettings = typeof adminSettings.$inferSelect;
export type NewAdminSettings = typeof adminSettings.$inferInsert;

export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type NewSystemPrompt = typeof systemPrompts.$inferInsert;

export type KnowledgeBaseFile = typeof knowledgeBaseFiles.$inferSelect;
export type NewKnowledgeBaseFile = typeof knowledgeBaseFiles.$inferInsert;

export type EducationalSession = typeof educationalSessions.$inferSelect;
export type NewEducationalSession = typeof educationalSessions.$inferInsert;

export type SessionProgress = typeof sessionProgress.$inferSelect;
export type NewSessionProgress = typeof sessionProgress.$inferInsert;

export type SessionReport = typeof sessionReports.$inferSelect;
export type NewSessionReport = typeof sessionReports.$inferInsert;

export type ConversationSession = typeof conversationSessions.$inferSelect;
export type NewConversationSession = typeof conversationSessions.$inferInsert;

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;

export type DebugSession = typeof debugSessions.$inferSelect;
export type NewDebugSession = typeof debugSessions.$inferInsert;

export type DebugEntry = typeof debugEntries.$inferSelect;
export type NewDebugEntry = typeof debugEntries.$inferInsert;

export type OpeningMessage = typeof openingMessages.$inferSelect;
export type NewOpeningMessage = typeof openingMessages.$inferInsert;

export type AudioCache = typeof audioCache.$inferSelect;
export type NewAudioCache = typeof audioCache.$inferInsert;

export type SessionEvent = typeof sessionEvents.$inferSelect;
export type NewSessionEvent = typeof sessionEvents.$inferInsert;