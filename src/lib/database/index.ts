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
    
    db = drizzle(sqlite, { schema });
  }
  return { db, sqlite };
};

// Create tables if they don't exist
function createTables(sqlite: Database.Database) {
  try {
    // Create admin_settings table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id text PRIMARY KEY DEFAULT 'default' NOT NULL,
        voice_id text DEFAULT 'pNInz6obpgDQGcFmaJgB' NOT NULL,
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
        video_url text NOT NULL,
        video_summary text NOT NULL,
        start_message text,
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
        voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice from ElevenLabs
        voiceDescription: 'Professional, clear voice for financial education',
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