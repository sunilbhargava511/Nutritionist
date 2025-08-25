import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Database path configuration with Railway fallback
const getDbPath = () => {
  // Check for DATABASE_URL first (Railway or other providers)
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    return process.env.DATABASE_URL.replace('file:', '');
  }
  
  // Check for DATABASE_PATH (Railway deployment)
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  
  // Production default (Railway pattern) - use app directory for writing
  if (process.env.NODE_ENV === 'production') {
    // Try /data first (if it exists), otherwise use /app (which nextjs user owns)
    const preferredPath = '/data/database.sqlite';
    const fallbackPath = path.join('/app', 'database.sqlite');
    
    try {
      const fs = require('fs');
      const preferredDir = path.dirname(preferredPath);
      
      // Check if /data directory exists and is writable
      if (fs.existsSync(preferredDir)) {
        try {
          fs.accessSync(preferredDir, fs.constants.W_OK);
          console.log(`[DB] Using preferred path: ${preferredPath}`);
          return preferredPath;
        } catch (permError) {
          console.warn(`[DB] /data directory exists but not writable:`, permError);
        }
      }
      
      // Fallback to /app directory (which nextjs user owns)
      console.log(`[DB] Using fallback path: ${fallbackPath}`);
      return fallbackPath;
      
    } catch (error) {
      console.warn(`[DB] Error checking directories:`, error);
      return fallbackPath;
    }
  }
  
  // Development default
  return path.join(process.cwd(), 'database.sqlite');
};

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

// Lazy initialization function
const initDB = () => {
  if (!sqlite) {
    const dbPath = getDbPath();
    console.log('[DB] Connecting to database at:', dbPath);
    
    sqlite = new Database(dbPath);
    
    // Enable WAL mode for better concurrent access
    sqlite.pragma('journal_mode = WAL');
    
    // Run initial table creation
    createTables(sqlite);
    
    // Run migrations for existing tables
    migrateTables(sqlite);
    
    db = drizzle(sqlite, { schema });
  }
  return { db, sqlite };
};

// Migrate existing tables to add missing columns
function migrateTables(sqlite: Database.Database) {
  try {
    // Check if lessons table has video_path column, if not add missing columns
    const columns = sqlite.prepare("PRAGMA table_info(lessons)").all() as any[];
    const columnNames = columns.map(col => col.name);
    
    if (!columnNames.includes('video_path')) {
      console.log('[DB] Migrating lessons table - adding missing columns');
      sqlite.exec(`
        ALTER TABLE lessons ADD COLUMN video_path text;
        ALTER TABLE lessons ADD COLUMN video_type text DEFAULT 'url';
        ALTER TABLE lessons ADD COLUMN video_mime_type text;
        ALTER TABLE lessons ADD COLUMN video_size integer;
        ALTER TABLE lessons ADD COLUMN video_transcript text;
        ALTER TABLE lessons ADD COLUMN transcript_extracted_at text;
        ALTER TABLE lessons ADD COLUMN transcript_language text DEFAULT 'en';
      `);
      
      // Make video_url nullable for existing records
      sqlite.exec(`
        CREATE TABLE lessons_new (
          id text PRIMARY KEY NOT NULL,
          title text NOT NULL,
          video_url text,
          video_path text,
          video_type text NOT NULL DEFAULT 'url',
          video_mime_type text,
          video_size integer,
          video_summary text NOT NULL,
          start_message text,
          video_transcript text,
          transcript_extracted_at text,
          transcript_language text DEFAULT 'en',
          order_index integer NOT NULL,
          prerequisites text,
          active integer DEFAULT true,
          created_at text DEFAULT (CURRENT_TIMESTAMP),
          updated_at text DEFAULT (CURRENT_TIMESTAMP)
        );
        
        INSERT INTO lessons_new SELECT 
          id, title, video_url, video_path, 
          COALESCE(video_type, 'url'),
          video_mime_type, video_size, video_summary, start_message,
          video_transcript, transcript_extracted_at,
          COALESCE(transcript_language, 'en'),
          order_index, prerequisites, active, created_at, updated_at
        FROM lessons;
        
        DROP TABLE lessons;
        ALTER TABLE lessons_new RENAME TO lessons;
      `);
      console.log('[DB] Lessons table migration completed');
    }
  } catch (error) {
    console.warn('[DB] Migration warning (non-fatal):', error);
  }
}

// Create tables if they don't exist
function createTables(sqlite: Database.Database) {
  try {
    // Create admin_settings table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id text PRIMARY KEY DEFAULT 'default' NOT NULL,
        voice_id text DEFAULT '4n2FYtLoSkOUG7xRbnu9' NOT NULL,
        voice_description text DEFAULT 'Professional, clear voice for nutrition education' NOT NULL,
        personalization_enabled integer DEFAULT false,
        conversation_aware integer DEFAULT true,
        use_structured_conversation integer DEFAULT true,
        debug_llm_enabled integer DEFAULT false,
        base_report_path text,
        base_report_template blob,
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create other essential tables
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS lessons (
        id text PRIMARY KEY NOT NULL,
        title text NOT NULL,
        video_url text,
        video_path text,
        video_type text NOT NULL DEFAULT 'url',
        video_mime_type text,
        video_size integer,
        video_summary text NOT NULL,
        start_message text,
        video_transcript text,
        transcript_extracted_at text,
        transcript_language text DEFAULT 'en',
        order_index integer NOT NULL,
        prerequisites text,
        active integer DEFAULT true,
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_prompts (
        id text PRIMARY KEY NOT NULL,
        type text NOT NULL,
        content text NOT NULL,
        lesson_id text,
        active integer DEFAULT true,
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id text PRIMARY KEY NOT NULL,
        conversation_id text UNIQUE,
        conversation_type text DEFAULT 'structured' NOT NULL,
        user_id text,
        completed integer DEFAULT false,
        personalization_enabled integer DEFAULT false,
        conversation_aware integer,
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create knowledge_base_files table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_base_files (
        id text PRIMARY KEY NOT NULL,
        filename text NOT NULL,
        content text NOT NULL,
        file_type text NOT NULL,
        indexed_content text,
        uploaded_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create session_reports table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS session_reports (
        id text PRIMARY KEY NOT NULL,
        session_id text NOT NULL,
        report_path text NOT NULL,
        report_data blob,
        generated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create user_sessions table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id text PRIMARY KEY NOT NULL,
        user_id text,
        completed_lessons text,
        current_lesson_id text,
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create lesson_conversations table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS lesson_conversations (
        id text PRIMARY KEY NOT NULL,
        session_id text NOT NULL,
        lesson_id text NOT NULL,
        conversation_id text,
        completed integer DEFAULT false,
        messages_count integer DEFAULT 0,
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create service_provider table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS service_provider (
        id text PRIMARY KEY DEFAULT 'default' NOT NULL,
        business_name text DEFAULT '' NOT NULL,
        address text DEFAULT '' NOT NULL,
        phone_number text DEFAULT '' NOT NULL,
        email text DEFAULT '',
        website text DEFAULT '',
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create website_config table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS website_config (
        id text PRIMARY KEY DEFAULT 'default' NOT NULL,
        lessons_name text DEFAULT 'Lessons' NOT NULL,
        lessons_description text DEFAULT 'Educational video content' NOT NULL,
        conversation_name text DEFAULT 'Chat' NOT NULL,
        conversation_description text DEFAULT 'Open conversation with AI' NOT NULL,
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create conversation_style table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS conversation_style (
        id text PRIMARY KEY DEFAULT 'default' NOT NULL,
        base_persona text DEFAULT 'default' NOT NULL,
        gender text DEFAULT 'female' NOT NULL,
        custom_person text DEFAULT '' NOT NULL,
        enhanced_prompt text NOT NULL,
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create service_summary table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS service_summary (
        id text PRIMARY KEY DEFAULT 'default' NOT NULL,
        service_description text DEFAULT '' NOT NULL,
        key_benefits text DEFAULT '' NOT NULL,
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Create opening_messages table (required for customization)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS opening_messages (
        id text PRIMARY KEY NOT NULL,
        type text NOT NULL,
        lesson_id text,
        message_content text NOT NULL,
        voice_settings text,
        active integer DEFAULT true,
        is_generated integer DEFAULT false,
        original_generated_content text,
        generated_at text,
        original_user_input text,
        is_styled integer DEFAULT false,
        styled_at text,
        audio_url text,
        audio_blob text,
        audio_generated_at text,
        audio_hash text,
        audio_duration real,
        cached_audio_url text,
        needs_audio_regeneration integer DEFAULT false,
        created_at text DEFAULT (CURRENT_TIMESTAMP),
        updated_at text DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    console.log('[DB] Tables created successfully');
  } catch (error) {
    console.error('[DB] Error creating tables:', error);
  }
}

// Export getter functions instead of direct instances
export const getDB = () => initDB().db;
export const getSQLite = () => initDB().sqlite;

// Utility function to initialize the database with default data
export async function initializeDatabase() {
  try {
    const { db } = initDB();
    
    // Check if we need to seed default admin settings
    const existingSettings = await getDB().select().from(schema.adminSettings).limit(1);
    
    if (existingSettings.length === 0) {
      await getDB().insert(schema.adminSettings).values({
        id: 'default',
        voiceId: '4n2FYtLoSkOUG7xRbnu9', // User requested voice ID
        voiceDescription: 'Professional, clear voice for nutrition education',
        personalizationEnabled: false,
        conversationAware: true, // Enable smooth lead-ins by default
        useStructuredConversation: true,
      });
      
      console.log('✅ Default admin settings created');
    }

    // Check if we need to seed default system prompts
    const existingPrompts = await getDB().select().from(schema.systemPrompts).limit(1);
    
    if (existingPrompts.length === 0) {
      await getDB().insert(schema.systemPrompts).values([
        {
          id: 'qa_prompt', 
          type: 'qa',
          content: `You are Sanjay Bhargava, an AI financial advisor answering questions about retirement planning.

CRITICAL GUIDELINES:
- Provide helpful, accurate responses to user questions
- Reference the educational content when relevant
- Keep responses conversational and supportive
- If personalization is enabled, use the full conversation context
- Focus on practical, actionable advice
- Write numbers as words for voice synthesis

Answer the user's question based on your expertise in retirement planning and the educational content being delivered.`,
          lessonId: null,
          active: true,
        },
        {
          id: 'report_prompt',
          type: 'report', 
          content: `You are generating a comprehensive session summary for a retirement planning education session.

CRITICAL GUIDELINES:
- Analyze the complete conversation history
- Extract key insights and learning points
- Identify action items and recommendations
- Create a personalized summary based on the user's responses
- Focus on behavioral insights and next steps
- Use clear, professional language suitable for a PDF report

Generate a detailed session summary that would be valuable for the user's financial planning journey.`,
          lessonId: null,
          active: true,
        },
      ]);
      
      console.log('✅ Default system prompts created');
    }

    // Check if we need to seed default service provider
    const existingServiceProvider = await getDB().select().from(schema.serviceProvider).limit(1);
    
    if (existingServiceProvider.length === 0) {
      await getDB().insert(schema.serviceProvider).values({
        id: 'default',
        businessName: 'Your Financial Advisory',
        address: '123 Main Street, City, State 12345',
        phoneNumber: '(555) 123-4567',
        email: 'contact@yourfirm.com',
        website: 'www.yourfirm.com',
      });
      
      console.log('✅ Default service provider created');
    }

    // Check if we need to seed default website config
    const existingWebsiteConfig = await getDB().select().from(schema.websiteConfig).limit(1);
    
    if (existingWebsiteConfig.length === 0) {
      await getDB().insert(schema.websiteConfig).values({
        id: 'default',
        lessonsName: 'Lessons',
        lessonsDescription: 'Educational video content',
        conversationName: 'Chat',
        conversationDescription: 'Open conversation with AI',
      });
      
      console.log('✅ Default website config created');
    }

    // Check if we need to seed default conversation style
    const existingConversationStyle = await getDB().select().from(schema.conversationStyle).limit(1);
    
    if (existingConversationStyle.length === 0) {
      await getDB().insert(schema.conversationStyle).values({
        id: 'default',
        basePersona: 'default',
        gender: 'female',
        customPerson: '',
        enhancedPrompt: 'You are a knowledgeable nutrition educator providing clear, evidence-based information. Write with a feminine voice and perspective.',
      });
      
      console.log('✅ Default conversation style created');
    }

    // Check if we need to seed default service summary
    const existingServiceSummary = await getDB().select().from(schema.serviceSummary).limit(1);
    
    if (existingServiceSummary.length === 0) {
      await getDB().insert(schema.serviceSummary).values({
        id: 'default',
        serviceDescription: `We provide comprehensive nutrition education and counseling services designed to help individuals achieve their health and wellness goals. Our AI-powered platform combines evidence-based nutrition science with personalized guidance to create effective, sustainable dietary changes.

Our services include:
- Personalized nutrition assessments and planning
- Interactive educational modules covering key nutrition topics
- One-on-one AI consultations for specific dietary questions
- Evidence-based meal planning and recipe recommendations
- Ongoing support and progress tracking

Whether you're looking to lose weight, manage a health condition, improve athletic performance, or simply eat healthier, our comprehensive approach ensures you receive the knowledge and tools needed for long-term success.

Our certified nutrition professionals have developed this platform to make quality nutrition guidance accessible, affordable, and convenient for everyone.`,
        keyBenefits: `Evidence-based nutrition guidance
Personalized meal planning and recommendations
Interactive learning modules with expert instruction
24/7 AI support for nutrition questions
Progress tracking and goal setting tools
Affordable alternative to traditional nutrition counseling`,
      });
      
      console.log('✅ Default service summary created');
    }
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  if (sqlite) {
    sqlite.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (sqlite) {
    sqlite.close();
  }
  process.exit(0);
});