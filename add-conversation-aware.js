#!/usr/bin/env node

/**
 * Migration script to add conversation_aware fields to admin_settings and conversations tables
 */

const Database = require('better-sqlite3');
const path = require('path');

// Use the same database path as the app
const dbPath = process.env.NODE_ENV === 'production' 
  ? (process.env.DATABASE_PATH || '/tmp/database.sqlite')
  : path.join(process.cwd(), 'database.sqlite');

console.log('🔧 Adding conversation_aware fields...');
console.log('📁 Database path:', dbPath);

const db = new Database(dbPath);

try {
  // Start transaction
  db.exec('BEGIN TRANSACTION');

  console.log('📊 Checking current database state...');
  
  // Check if conversation_aware column already exists in admin_settings
  const adminColumns = db.prepare(`
    PRAGMA table_info(admin_settings)
  `).all();
  
  const hasAdminConversationAware = adminColumns.some(col => col.name === 'conversation_aware');
  
  if (!hasAdminConversationAware) {
    console.log('➕ Adding conversation_aware to admin_settings table...');
    db.exec(`
      ALTER TABLE admin_settings 
      ADD COLUMN conversation_aware INTEGER DEFAULT 1
    `);
    console.log('✅ Added conversation_aware to admin_settings');
  } else {
    console.log('✅ conversation_aware already exists in admin_settings');
  }
  
  // Check if conversation_aware column already exists in conversations
  const conversationColumns = db.prepare(`
    PRAGMA table_info(conversations)
  `).all();
  
  const hasConversationConversationAware = conversationColumns.some(col => col.name === 'conversation_aware');
  
  if (!hasConversationConversationAware) {
    console.log('➕ Adding conversation_aware to conversations table...');
    db.exec(`
      ALTER TABLE conversations 
      ADD COLUMN conversation_aware INTEGER
    `);
    console.log('✅ Added conversation_aware to conversations');
  } else {
    console.log('✅ conversation_aware already exists in conversations');
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