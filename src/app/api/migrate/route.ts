import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting database migration...');
    
    // Check if lesson_id column exists in system_prompts table
    const tableInfo = sqlite.prepare(`PRAGMA table_info(system_prompts)`).all();
    const hasLessonIdColumn = tableInfo.some((col: any) => col.name === 'lesson_id');
    
    if (!hasLessonIdColumn) {
      console.log('Adding lesson_id column to system_prompts table...');
      sqlite.exec(`ALTER TABLE system_prompts ADD COLUMN lesson_id TEXT;`);
      console.log('✅ Added lesson_id column');
    } else {
      console.log('✅ lesson_id column already exists');
    }
    
    // Check if lessons table exists
    const tablesResult = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='lessons'
    `).all();
    
    if (tablesResult.length === 0) {
      console.log('Creating lessons table...');
      sqlite.exec(`
        CREATE TABLE lessons (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          video_url TEXT NOT NULL,
          video_summary TEXT NOT NULL,
          start_message TEXT,
          question TEXT NOT NULL,
          prerequisites TEXT DEFAULT '[]',
          order_index INTEGER DEFAULT 0,
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created lessons table');
    } else {
      console.log('✅ lessons table already exists');
      
      // Check if start_message column exists in lessons table
      const lessonsTableInfo = sqlite.prepare(`PRAGMA table_info(lessons)`).all();
      const hasStartMessageColumn = lessonsTableInfo.some((col: any) => col.name === 'start_message');
      
      if (!hasStartMessageColumn) {
        console.log('Adding start_message column to lessons table...');
        sqlite.exec(`ALTER TABLE lessons ADD COLUMN start_message TEXT;`);
        console.log('✅ Added start_message column');
      } else {
        console.log('✅ start_message column already exists');
      }
    }
    
    // Create new unified session tables
    console.log('Creating unified session system tables...');
    
    // Check if conversation_sessions table exists
    const sessionsTableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='conversation_sessions'
    `).all();
    
    if (sessionsTableExists.length === 0) {
      console.log('Creating conversation_sessions table...');
      sqlite.exec(`
        CREATE TABLE conversation_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          session_type TEXT NOT NULL,
          lesson_phase TEXT,
          current_lesson_id TEXT,
          elevenlabs_conversation_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          started_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          ended_at TEXT,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created conversation_sessions table');
    } else {
      console.log('✅ conversation_sessions table already exists');
    }
    
    // Check if conversation_messages table exists
    const messagesTableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='conversation_messages'
    `).all();
    
    if (messagesTableExists.length === 0) {
      console.log('Creating conversation_messages table...');
      sqlite.exec(`
        CREATE TABLE conversation_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          message_type TEXT NOT NULL,
          content TEXT NOT NULL,
          speaker TEXT NOT NULL,
          elevenlabs_message_id TEXT,
          lesson_context_id TEXT,
          timestamp TEXT DEFAULT (CURRENT_TIMESTAMP),
          metadata TEXT,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created conversation_messages table');
    } else {
      console.log('✅ conversation_messages table already exists');
    }
    
    // Check if opening_messages table exists
    const openingTableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='opening_messages'
    `).all();
    
    if (openingTableExists.length === 0) {
      console.log('Creating opening_messages table...');
      sqlite.exec(`
        CREATE TABLE opening_messages (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          lesson_id TEXT,
          message_content TEXT NOT NULL,
          voice_settings TEXT,
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created opening_messages table');
    } else {
      console.log('✅ opening_messages table already exists');
    }
    
    // Check if debug_sessions table exists
    const debugSessionsExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='debug_sessions'
    `).all();
    
    if (debugSessionsExists.length === 0) {
      console.log('Creating debug_sessions table...');
      sqlite.exec(`
        CREATE TABLE debug_sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          start_time TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          end_time TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created debug_sessions table');
    } else {
      console.log('✅ debug_sessions table already exists');
    }
    
    // Check if debug_entries table exists
    const debugEntriesExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='debug_entries'
    `).all();
    
    if (debugEntriesExists.length === 0) {
      console.log('Creating debug_entries table...');
      sqlite.exec(`
        CREATE TABLE debug_entries (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          timestamp TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          request_model TEXT NOT NULL,
          request_system_prompt TEXT,
          request_messages TEXT,
          request_temperature REAL,
          request_max_tokens INTEGER,
          request_knowledge_context TEXT,
          request_other_params TEXT,
          response_content TEXT,
          response_processing_time INTEGER,
          response_tokens INTEGER,
          response_cited_articles TEXT,
          error_message TEXT,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created debug_entries table');
    } else {
      console.log('✅ debug_entries table already exists');
    }
    
    // Check if session_events table exists
    const sessionEventsExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='session_events'
    `).all();
    
    if (sessionEventsExists.length === 0) {
      console.log('Creating session_events table...');
      sqlite.exec(`
        CREATE TABLE session_events (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          debug_session_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          first_message TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          icon TEXT,
          metadata TEXT NOT NULL,
          timestamp TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        );
      `);
      console.log('✅ Created session_events table');
    } else {
      console.log('✅ session_events table already exists');
    }

    // Check if debugLlmEnabled column exists in admin_settings
    const adminTableInfo = sqlite.prepare(`PRAGMA table_info(admin_settings)`).all();
    const hasDebugLlmColumn = adminTableInfo.some((col: any) => col.name === 'debug_llm_enabled');
    
    if (!hasDebugLlmColumn) {
      console.log('Adding debug_llm_enabled column to admin_settings table...');
      sqlite.exec(`ALTER TABLE admin_settings ADD COLUMN debug_llm_enabled INTEGER DEFAULT 0;`);
      console.log('✅ Added debug_llm_enabled column');
    } else {
      console.log('✅ debug_llm_enabled column already exists');
    }
    
    console.log('Database migration completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully'
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown migration error' 
      },
      { status: 500 }
    );
  }
}