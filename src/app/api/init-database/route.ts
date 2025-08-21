import { NextResponse } from 'next/server';
import { getSQLite } from '@/lib/database';

export async function POST() {
  try {
    console.log('🔄 Starting fresh database initialization...');
    
    const sqlite = getSQLite();

    // Create all required tables from scratch
    console.log('📋 Creating lessons table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        video_url TEXT NOT NULL,
        video_summary TEXT NOT NULL,
        start_message TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        prerequisites TEXT DEFAULT '[]',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    console.log('👤 Creating user_sessions table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        completed_lessons TEXT,
        current_lesson_id TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    console.log('💬 Creating lesson_conversations table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS lesson_conversations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        conversation_id TEXT,
        completed INTEGER DEFAULT 0,
        messages_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    console.log('⚙️ Creating admin_settings table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        voice_id TEXT NOT NULL DEFAULT 'pNInz6obpgDQGcFmaJgB',
        voice_description TEXT NOT NULL DEFAULT 'Professional, clear voice for financial education',
        personalization_enabled INTEGER DEFAULT 0,
        conversation_aware INTEGER DEFAULT 1,
        use_structured_conversation INTEGER DEFAULT 1,
        debug_llm_enabled INTEGER DEFAULT 0,
        base_report_path TEXT,
        base_report_template BLOB,
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    console.log('🧠 Creating system_prompts table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_prompts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        lesson_id TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    console.log('📚 Creating knowledge_base_files table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_base_files (
        id TEXT PRIMARY KEY,
        original_filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        embedding_status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    console.log('📄 Creating content_chunks table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS content_chunks (
        id TEXT PRIMARY KEY,
        file_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        question TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    console.log('🎙️ Creating opening_messages table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS opening_messages (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        lesson_id TEXT,
        message_content TEXT NOT NULL,
        voice_settings TEXT,
        active INTEGER DEFAULT 1,
        audio_url TEXT,
        audio_blob TEXT,
        audio_generated_at TEXT,
        audio_hash TEXT,
        audio_duration REAL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    console.log('🔊 Creating audio_cache table...');
    sqlite.exec(`
      DROP TABLE IF EXISTS audio_cache;
      CREATE TABLE audio_cache (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        audio_data TEXT NOT NULL,
        file_path TEXT,
        mime_type TEXT DEFAULT 'audio/mpeg',
        size_bytes INTEGER,
        duration_seconds REAL,
        voice_id TEXT,
        voice_settings TEXT,
        generated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        accessed_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        access_count INTEGER DEFAULT 0
      );
    `);

    console.log('💬 Creating conversation_sessions table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS conversation_sessions (
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

    console.log('📝 Creating conversation_messages table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
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

    console.log('📊 Creating session_reports table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS session_reports (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        report_path TEXT NOT NULL,
        report_data BLOB,
        generated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    console.log('📊 Creating debug tables...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS debug_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        start_time TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        end_time TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS debug_entries (
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

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS session_events (
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

    console.log('🌱 Inserting default admin settings...');
    sqlite.exec(`
      INSERT OR REPLACE INTO admin_settings (
        id, voice_id, voice_description, personalization_enabled, 
        conversation_aware, use_structured_conversation, debug_llm_enabled
      ) VALUES (
        'default', 
        'pNInz6obpgDQGcFmaJgB', 
        'Professional, clear voice for financial education', 
        0, 1, 1, 1
      );
    `);

    console.log('🧠 Inserting default system prompts...');
    sqlite.exec(`
      INSERT OR REPLACE INTO system_prompts (id, type, content, active) VALUES 
      (
        'qa_prompt', 
        'qa',
        'You are Sanjay Bhargava, an AI financial advisor answering questions about retirement planning.

CRITICAL GUIDELINES:
- Provide helpful, accurate responses to user questions
- Reference the educational content when relevant
- Keep responses conversational and supportive
- If personalization is enabled, use the full conversation context
- Focus on practical, actionable advice
- Write numbers as words for voice synthesis

Answer the user''s question based on your expertise in retirement planning and the educational content being delivered.',
        1
      ),
      (
        'report_prompt',
        'report', 
        'You are generating a comprehensive session summary for a retirement planning education session.

CRITICAL GUIDELINES:
- Analyze the complete conversation history
- Extract key insights and learning points
- Identify action items and recommendations
- Create a personalized summary based on the user''s responses
- Focus on behavioral insights and next steps
- Use clear, professional language suitable for a PDF report

Generate a detailed session summary that would be valuable for the user''s financial planning journey.',
        1
      );
    `);

    // Verify tables were created
    const tables = sqlite.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all();

    console.log(`✅ Database initialization completed!`);
    console.log(`📊 Created ${tables.length} tables:`, tables.map((t: any) => t.name).join(', '));

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully with all required tables',
      tablesCreated: tables.length,
      tables: tables.map((t: any) => t.name)
    });

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Database initialization failed'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const sqlite = getSQLite();
    
    // Return current database status
    const tables = sqlite.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all();

    const tableInfo: Record<string, any> = {};
    
    for (const table of tables) {
      try {
        const tableName = (table as any).name;
        const count = sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
        tableInfo[tableName] = count.count;
      } catch (error) {
        tableInfo[(table as any).name] = 'error';
      }
    }

    return NextResponse.json({
      success: true,
      status: 'Database operational',
      tables: tables.map((t: any) => t.name),
      tableCount: tables.length,
      recordCounts: tableInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Database status check failed' 
      },
      { status: 500 }
    );
  }
}