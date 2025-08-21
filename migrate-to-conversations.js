#!/usr/bin/env node

/**
 * Migration script to rename educational_sessions table to conversations
 * and add new fields: conversation_type and chunk_last_delivered
 */

const Database = require('better-sqlite3');
const path = require('path');

// Use the same database path as the app
const dbPath = process.env.NODE_ENV === 'production' 
  ? (process.env.DATABASE_PATH || '/tmp/database.sqlite')
  : path.join(process.cwd(), 'database.sqlite');

console.log('🔧 Starting migration to conversations table...');
console.log('📁 Database path:', dbPath);

const db = new Database(dbPath);

try {
  // Start transaction
  db.exec('BEGIN TRANSACTION');

  console.log('📊 Checking current database state...');
  
  // Check if educational_sessions table exists
  const tablesResult = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN ('educational_sessions', 'conversations')
  `).all();
  
  const hasEducationalSessions = tablesResult.some(t => t.name === 'educational_sessions');
  const hasConversations = tablesResult.some(t => t.name === 'conversations');
  
  console.log('🔍 Found tables:', tablesResult.map(t => t.name));
  
  if (hasConversations) {
    console.log('✅ Conversations table already exists - migration may have run already');
    db.exec('ROLLBACK');
    process.exit(0);
  }
  
  if (!hasEducationalSessions) {
    console.log('🆕 No educational_sessions table found - creating new conversations table...');
    
    // Create new conversations table from scratch
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        conversation_type TEXT NOT NULL DEFAULT 'structured',
        user_id TEXT,
        current_chunk_index INTEGER DEFAULT 0,
        chunk_last_delivered INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        personalization_enabled INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    console.log('✅ Created new conversations table');
  } else {
    console.log('🔄 Migrating data from educational_sessions to conversations...');
    
    // Create new conversations table
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        conversation_type TEXT NOT NULL DEFAULT 'structured',
        user_id TEXT,
        current_chunk_index INTEGER DEFAULT 0,
        chunk_last_delivered INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        personalization_enabled INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    // Copy data from educational_sessions to conversations
    db.exec(`
      INSERT INTO conversations (
        id, 
        user_id, 
        current_chunk_index, 
        chunk_last_delivered,
        completed, 
        personalization_enabled, 
        created_at, 
        updated_at
      )
      SELECT 
        id,
        user_id,
        current_chunk_index,
        current_chunk_index, -- Set chunk_last_delivered to current_chunk_index for existing sessions
        completed,
        personalization_enabled,
        created_at,
        updated_at
      FROM educational_sessions
    `);
    
    const migratedCount = db.prepare('SELECT COUNT(*) as count FROM conversations').get();
    console.log(`✅ Migrated ${migratedCount.count} sessions to conversations table`);
    
    // Rename old table as backup
    db.exec('ALTER TABLE educational_sessions RENAME TO educational_sessions_backup');
    console.log('✅ Renamed old table to educational_sessions_backup');
  }
  
  // Commit transaction
  db.exec('COMMIT');
  console.log('🎉 Migration completed successfully!');
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}