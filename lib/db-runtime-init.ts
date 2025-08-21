import Database from 'better-sqlite3';
import path from 'path';

let initialized = false;

export function ensureDatabaseInitialized() {
  if (initialized) return;
  
  try {
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);
    
    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
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
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if settings exist, if not add defaults
    const settingsCount = db.prepare('SELECT COUNT(*) as count FROM admin_settings').get() as { count: number };
    if (settingsCount.count === 0) {
      db.prepare(`
        INSERT INTO admin_settings (key, value) VALUES 
        ('autoNotesEnabled', 'true'),
        ('voiceEnabled', 'true'),
        ('elevenLabsEnabled', 'false')
      `).run();
    }
    
    db.close();
    initialized = true;
    console.log('[DB Runtime] Database initialized successfully');
  } catch (error) {
    console.error('[DB Runtime] Failed to initialize database:', error);
    // App will continue with localStorage fallback
  }
}