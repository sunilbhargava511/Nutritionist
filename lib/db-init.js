const Database = require('better-sqlite3');
const path = require('path');

function initializeDatabase() {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || path.join(process.cwd(), 'database.sqlite');
  console.log('[DB Init] Initializing database at:', dbPath);
  
  try {
    const db = new Database(dbPath);
    
    // Create admin_settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        messages TEXT,
        notes TEXT,
        summary TEXT,
        is_active INTEGER DEFAULT 1
      )
    `);
    
    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert default settings if not exists
    const settingsCount = db.prepare('SELECT COUNT(*) as count FROM admin_settings').get();
    if (settingsCount.count === 0) {
      console.log('[DB Init] Inserting default settings...');
      db.prepare(`
        INSERT INTO admin_settings (key, value) VALUES 
        ('autoNotesEnabled', 'true'),
        ('voiceEnabled', 'true'),
        ('elevenLabsEnabled', 'false')
      `).run();
    }
    
    db.close();
    console.log('[DB Init] Database initialized successfully');
  } catch (error) {
    console.error('[DB Init] Failed to initialize database:', error);
    // Don't throw - allow app to continue with in-memory fallback
  }
}

module.exports = { initializeDatabase };