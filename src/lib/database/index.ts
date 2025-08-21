import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Database path configuration
const getDbPath = () => {
  return process.env.DATABASE_URL?.startsWith('file:') 
    ? process.env.DATABASE_URL.replace('file:', '')
    : process.env.NODE_ENV === 'production' 
      ? (process.env.DATABASE_PATH || '/tmp/database.sqlite')
      : path.join(process.cwd(), 'database.sqlite');
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
    
    db = drizzle(sqlite, { schema });
  }
  return { db, sqlite };
};

// Export getter functions instead of direct instances
export const getDB = () => initDB().db;
export const getSQLite = () => initDB().sqlite;

// Utility function to initialize the database with default data
export async function initializeDatabase() {
  try {
    const { db } = initDB();
    
    // Check if we need to seed default admin settings
    const existingSettings = await db.select().from(schema.adminSettings).limit(1);
    
    if (existingSettings.length === 0) {
      await db.insert(schema.adminSettings).values({
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
    const existingPrompts = await db.select().from(schema.systemPrompts).limit(1);
    
    if (existingPrompts.length === 0) {
      await db.insert(schema.systemPrompts).values([
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