#!/usr/bin/env node
/**
 * Migration Script: Single-tenant to Multi-tenant Architecture
 * Backs up existing data and recreates database with webapp_key support
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || './database.sqlite';
const BACKUP_DIR = './backups';
const TEMP_DATABASE = './database-new.sqlite';

console.log('🔄 Multi-Tenant Migration Script');
console.log('=================================\n');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// SQL for creating new multi-tenant tables
const WEBAPP_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS webapp (
  id TEXT PRIMARY KEY,
  webapp_key TEXT UNIQUE NOT NULL,
  service_description TEXT NOT NULL DEFAULT '',
  key_benefits TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone_number TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  logo_url TEXT,
  logo_path TEXT,
  logo_mime_type TEXT,
  logo_size INTEGER,
  lessons_name TEXT NOT NULL DEFAULT 'Lessons',
  lessons_description TEXT NOT NULL DEFAULT 'Educational video content',
  conversation_name TEXT NOT NULL DEFAULT 'Chat',
  conversation_description TEXT NOT NULL DEFAULT 'Open conversation with AI',
  subdomain TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  is_active INTEGER DEFAULT 1,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#ef4444',
  accent_color TEXT DEFAULT '#10b981',
  neutral_color TEXT DEFAULT '#6b7280',
  background_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#1f2937',
  header_bg_color TEXT DEFAULT '#ffffff',
  header_text_color TEXT DEFAULT '#1f2937',
  theme TEXT NOT NULL DEFAULT 'light',
  border_radius TEXT DEFAULT '0.375rem',
  font_family TEXT DEFAULT 'Inter',
  navigation_style TEXT DEFAULT 'horizontal',
  button_style TEXT DEFAULT 'rounded',
  button_size TEXT DEFAULT 'medium',
  custom_css TEXT,
  custom_fonts TEXT,
  tagline TEXT,
  welcome_message TEXT,
  show_logo INTEGER DEFAULT 1,
  show_tagline INTEGER DEFAULT 1,
  custom_favicon TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

// Updated table schemas with webapp_key
const TABLE_SCHEMAS = {
  lessons: `
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      webapp_key TEXT NOT NULL REFERENCES webapp(webapp_key) ON DELETE CASCADE,
      title TEXT NOT NULL,
      video_url TEXT,
      video_path TEXT,
      video_type TEXT NOT NULL DEFAULT 'url',
      video_mime_type TEXT,
      video_size INTEGER,
      video_summary TEXT NOT NULL,
      start_message TEXT,
      video_transcript TEXT,
      transcript_extracted_at TEXT,
      transcript_language TEXT DEFAULT 'en',
      order_index INTEGER NOT NULL,
      prerequisites TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `,
  admin_settings: `
    CREATE TABLE IF NOT EXISTS admin_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      webapp_key TEXT NOT NULL REFERENCES webapp(webapp_key) ON DELETE CASCADE,
      voice_id TEXT NOT NULL DEFAULT '4n2FYtLoSkOUG7xRbnu9',
      voice_description TEXT NOT NULL DEFAULT 'Professional, clear voice for nutrition education',
      personalization_enabled INTEGER DEFAULT 0,
      conversation_aware INTEGER DEFAULT 1,
      use_structured_conversation INTEGER DEFAULT 1,
      debug_llm_enabled INTEGER DEFAULT 0,
      base_report_path TEXT,
      base_report_template BLOB,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `,
  system_prompts: `
    CREATE TABLE IF NOT EXISTS system_prompts (
      id TEXT PRIMARY KEY,
      webapp_key TEXT NOT NULL REFERENCES webapp(webapp_key) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      lesson_id TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `,
  opening_messages: `
    CREATE TABLE IF NOT EXISTS opening_messages (
      id TEXT PRIMARY KEY,
      webapp_key TEXT NOT NULL REFERENCES webapp(webapp_key) ON DELETE CASCADE,
      type TEXT NOT NULL,
      lesson_id TEXT,
      message_content TEXT NOT NULL,
      voice_settings TEXT,
      active INTEGER DEFAULT 1,
      is_generated INTEGER DEFAULT 0,
      original_generated_content TEXT,
      generated_at TEXT,
      original_user_input TEXT,
      is_styled INTEGER DEFAULT 0,
      styled_at TEXT,
      audio_url TEXT,
      audio_blob TEXT,
      audio_generated_at TEXT,
      audio_hash TEXT,
      audio_duration REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `,
  conversations: `
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      webapp_key TEXT NOT NULL REFERENCES webapp(webapp_key) ON DELETE CASCADE,
      conversation_id TEXT UNIQUE,
      conversation_type TEXT NOT NULL DEFAULT 'structured',
      user_id TEXT,
      completed INTEGER DEFAULT 0,
      personalization_enabled INTEGER DEFAULT 0,
      conversation_aware INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `,
  knowledge_base_files: `
    CREATE TABLE IF NOT EXISTS knowledge_base_files (
      id TEXT PRIMARY KEY,
      webapp_key TEXT NOT NULL REFERENCES webapp(webapp_key) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      file_type TEXT NOT NULL,
      indexed_content TEXT,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `,
  user_sessions: `
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      webapp_key TEXT NOT NULL REFERENCES webapp(webapp_key) ON DELETE CASCADE,
      user_id TEXT,
      completed_lessons TEXT,
      current_lesson_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `,
  conversation_sessions: `
    CREATE TABLE IF NOT EXISTS conversation_sessions (
      id TEXT PRIMARY KEY,
      webapp_key TEXT NOT NULL REFERENCES webapp(webapp_key) ON DELETE CASCADE,
      user_id TEXT,
      session_type TEXT NOT NULL,
      lesson_phase TEXT,
      current_lesson_id TEXT,
      elevenlabs_conversation_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `,
  conversation_messages: `
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      webapp_key TEXT NOT NULL REFERENCES webapp(webapp_key) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      message_type TEXT NOT NULL,
      content TEXT NOT NULL,
      speaker TEXT NOT NULL,
      elevenlabs_message_id TEXT,
      lesson_context_id TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `
};

async function backupExistingData() {
  if (!fs.existsSync(DATABASE_PATH)) {
    console.log('ℹ️  No existing database found. Creating fresh multi-tenant database.');
    return null;
  }

  console.log('💾 Creating backup of existing database...');
  
  const db = new Database(DATABASE_PATH);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `pre-migration-backup-${timestamp}.json`);
  
  try {
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    
    const backup = {
      timestamp: new Date().toISOString(),
      type: 'pre-migration',
      version: '1.0.0',
      tables: {}
    };
    
    for (const table of tables) {
      const tableName = table.name;
      
      try {
        const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const data = db.prepare(`SELECT * FROM ${tableName}`).all();
        
        backup.tables[tableName] = {
          schema: schema,
          data: data,
          count: data.length
        };
        
        console.log(`   ✅ Backed up ${tableName}: ${data.length} rows`);
      } catch (error) {
        console.error(`   ❌ Failed to backup table ${tableName}:`, error.message);
      }
    }
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    const fileSizeKB = Math.round(fs.statSync(backupFile).size / 1024);
    console.log(`\n✅ Backup created: ${backupFile} (${fileSizeKB} KB)\n`);
    
    return backup;
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

async function createNewDatabase(backup) {
  console.log('🏗️  Creating new multi-tenant database...');
  
  // Remove temp database if it exists
  if (fs.existsSync(TEMP_DATABASE)) {
    fs.unlinkSync(TEMP_DATABASE);
  }
  
  const db = new Database(TEMP_DATABASE);
  
  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Create webapp table first
    console.log('   📊 Creating webapp table...');
    db.exec(WEBAPP_TABLE_SQL);
    
    // Create other tables with webapp_key
    for (const [tableName, sql] of Object.entries(TABLE_SCHEMAS)) {
      console.log(`   📊 Creating ${tableName} table...`);
      db.exec(sql);
    }
    
    // Create default webapp if migrating existing data
    if (backup) {
      console.log('\n🔄 Migrating existing data to multi-tenant structure...');
      
      // Create default webapp from legacy tables
      const defaultWebapp = createDefaultWebappFromBackup(backup, db);
      
      // Migrate data to new tables
      await migrateDataToNewTables(backup, db, defaultWebapp.webappKey);
    } else {
      console.log('\n🌱 No existing data to migrate. Database ready for seeding.');
    }
    
    console.log('\n✅ New multi-tenant database created successfully!');
    return db;
    
  } catch (error) {
    console.error('❌ Failed to create new database:', error.message);
    db.close();
    throw error;
  }
}

function createDefaultWebappFromBackup(backup, db) {
  console.log('   🏢 Creating default webapp from legacy data...');
  
  // Extract data from legacy tables
  const serviceProvider = backup.tables.service_provider?.data?.[0] || {};
  const websiteConfig = backup.tables.website_config?.data?.[0] || {};
  const serviceSummary = backup.tables.service_summary?.data?.[0] || {};
  const businessBranding = backup.tables.business_branding?.data?.[0] || {};
  
  const defaultWebapp = {
    id: 'default-webapp',
    webappKey: 'default',
    serviceDescription: serviceSummary.service_description || 'Professional nutrition counseling services',
    keyBenefits: serviceSummary.key_benefits || 'Personalized guidance, Expert advice, Health improvement',
    businessName: serviceProvider.business_name || 'Nutrition Practice',
    address: serviceProvider.address || '',
    phoneNumber: serviceProvider.phone_number || '',
    email: serviceProvider.email || '',
    website: serviceProvider.website || '',
    logoUrl: serviceProvider.logo_url || null,
    logoPath: serviceProvider.logo_path || null,
    logoMimeType: serviceProvider.logo_mime_type || null,
    logoSize: serviceProvider.logo_size || null,
    lessonsName: websiteConfig.lessons_name || 'Lessons',
    lessonsDescription: websiteConfig.lessons_description || 'Educational video content',
    conversationName: websiteConfig.conversation_name || 'Chat',
    conversationDescription: websiteConfig.conversation_description || 'Open conversation with AI',
    subdomain: null,
    customDomain: null,
    isActive: 1,
    primaryColor: businessBranding.primary_color || '#3b82f6',
    secondaryColor: businessBranding.secondary_color || '#ef4444',
    accentColor: businessBranding.accent_color || '#10b981',
    neutralColor: businessBranding.neutral_color || '#6b7280',
    backgroundColor: businessBranding.background_color || '#ffffff',
    textColor: businessBranding.text_color || '#1f2937',
    headerBgColor: businessBranding.header_bg_color || '#ffffff',
    headerTextColor: businessBranding.header_text_color || '#1f2937',
    theme: businessBranding.theme || 'light',
    borderRadius: businessBranding.border_radius || '0.375rem',
    fontFamily: businessBranding.font_family || 'Inter',
    navigationStyle: businessBranding.navigation_style || 'horizontal',
    buttonStyle: businessBranding.button_style || 'rounded',
    buttonSize: businessBranding.button_size || 'medium',
    customCss: businessBranding.custom_css || null,
    customFonts: businessBranding.custom_fonts || null,
    tagline: businessBranding.tagline || null,
    welcomeMessage: businessBranding.welcome_message || null,
    showLogo: businessBranding.show_logo || 1,
    showTagline: businessBranding.show_tagline || 1,
    customFavicon: businessBranding.custom_favicon || null
  };
  
  // Insert default webapp
  const insertStmt = db.prepare(`
    INSERT INTO webapp (
      id, webapp_key, service_description, key_benefits, business_name, address, phone_number, email, website,
      logo_url, logo_path, logo_mime_type, logo_size, lessons_name, lessons_description, conversation_name, conversation_description,
      subdomain, custom_domain, is_active, primary_color, secondary_color, accent_color, neutral_color,
      background_color, text_color, header_bg_color, header_text_color, theme, border_radius, font_family,
      navigation_style, button_style, button_size, custom_css, custom_fonts, tagline, welcome_message,
      show_logo, show_tagline, custom_favicon
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertStmt.run(
    defaultWebapp.id, defaultWebapp.webappKey, defaultWebapp.serviceDescription, defaultWebapp.keyBenefits,
    defaultWebapp.businessName, defaultWebapp.address, defaultWebapp.phoneNumber, defaultWebapp.email, defaultWebapp.website,
    defaultWebapp.logoUrl, defaultWebapp.logoPath, defaultWebapp.logoMimeType, defaultWebapp.logoSize,
    defaultWebapp.lessonsName, defaultWebapp.lessonsDescription, defaultWebapp.conversationName, defaultWebapp.conversationDescription,
    defaultWebapp.subdomain, defaultWebapp.customDomain, defaultWebapp.isActive,
    defaultWebapp.primaryColor, defaultWebapp.secondaryColor, defaultWebapp.accentColor, defaultWebapp.neutralColor,
    defaultWebapp.backgroundColor, defaultWebapp.textColor, defaultWebapp.headerBgColor, defaultWebapp.headerTextColor,
    defaultWebapp.theme, defaultWebapp.borderRadius, defaultWebapp.fontFamily, defaultWebapp.navigationStyle,
    defaultWebapp.buttonStyle, defaultWebapp.buttonSize, defaultWebapp.customCss, defaultWebapp.customFonts,
    defaultWebapp.tagline, defaultWebapp.welcomeMessage, defaultWebapp.showLogo, defaultWebapp.showTagline, defaultWebapp.customFavicon
  );
  
  console.log(`   ✅ Created default webapp: ${defaultWebapp.businessName}`);
  return defaultWebapp;
}

async function migrateDataToNewTables(backup, db, webappKey) {
  console.log(`   📦 Migrating data with webapp_key: ${webappKey}`);
  
  const tableMigrations = {
    lessons: (data) => {
      if (!data || data.length === 0) return 0;
      const stmt = db.prepare(`
        INSERT INTO lessons (id, webapp_key, title, video_url, video_path, video_type, video_mime_type, video_size, 
                           video_summary, start_message, video_transcript, transcript_extracted_at, transcript_language, 
                           order_index, prerequisites, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let count = 0;
      for (const row of data) {
        stmt.run(
          row.id, webappKey, row.title, row.video_url, row.video_path, row.video_type, row.video_mime_type, row.video_size,
          row.video_summary, row.start_message, row.video_transcript, row.transcript_extracted_at, row.transcript_language,
          row.order_index, row.prerequisites, row.active, row.created_at, row.updated_at
        );
        count++;
      }
      return count;
    },
    
    admin_settings: (data) => {
      if (!data || data.length === 0) return 0;
      const stmt = db.prepare(`
        INSERT INTO admin_settings (id, webapp_key, voice_id, voice_description, personalization_enabled, 
                                   conversation_aware, use_structured_conversation, debug_llm_enabled, 
                                   base_report_path, base_report_template, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let count = 0;
      for (const row of data) {
        stmt.run(
          `admin-${webappKey}`, webappKey, row.voice_id, row.voice_description, row.personalization_enabled,
          row.conversation_aware, row.use_structured_conversation, row.debug_llm_enabled,
          row.base_report_path, row.base_report_template, row.updated_at
        );
        count++;
      }
      return count;
    },
    
    system_prompts: (data) => {
      if (!data || data.length === 0) return 0;
      const stmt = db.prepare(`
        INSERT INTO system_prompts (id, webapp_key, type, content, lesson_id, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let count = 0;
      for (const row of data) {
        stmt.run(
          row.id, webappKey, row.type, row.content, row.lesson_id, row.active, row.created_at, row.updated_at
        );
        count++;
      }
      return count;
    },
    
    opening_messages: (data) => {
      if (!data || data.length === 0) return 0;
      const stmt = db.prepare(`
        INSERT INTO opening_messages (id, webapp_key, type, lesson_id, message_content, voice_settings, active,
                                    is_generated, original_generated_content, generated_at, original_user_input,
                                    is_styled, styled_at, audio_url, audio_blob, audio_generated_at, audio_hash,
                                    audio_duration, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let count = 0;
      for (const row of data) {
        stmt.run(
          row.id, webappKey, row.type, row.lesson_id, row.message_content, row.voice_settings, row.active,
          row.is_generated, row.original_generated_content, row.generated_at, row.original_user_input,
          row.is_styled, row.styled_at, row.audio_url, row.audio_blob, row.audio_generated_at, row.audio_hash,
          row.audio_duration, row.created_at, row.updated_at
        );
        count++;
      }
      return count;
    }
  };
  
  let totalMigrated = 0;
  
  for (const [tableName, migrationFn] of Object.entries(tableMigrations)) {
    if (backup.tables[tableName]?.data) {
      try {
        const count = migrationFn(backup.tables[tableName].data);
        console.log(`     ✅ Migrated ${tableName}: ${count} rows`);
        totalMigrated += count;
      } catch (error) {
        console.error(`     ❌ Failed to migrate ${tableName}:`, error.message);
      }
    }
  }
  
  console.log(`   📊 Total rows migrated: ${totalMigrated}`);
}

async function replaceDatabase() {
  console.log('\n🔄 Replacing old database with new multi-tenant version...');
  
  // Close any existing connections (handle gracefully)
  try {
    // Move old database to backup location
    if (fs.existsSync(DATABASE_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const oldDbBackup = path.join(BACKUP_DIR, `old-database-${timestamp}.sqlite`);
      fs.renameSync(DATABASE_PATH, oldDbBackup);
      console.log(`   📁 Old database backed up to: ${oldDbBackup}`);
    }
    
    // Move new database to production location
    fs.renameSync(TEMP_DATABASE, DATABASE_PATH);
    console.log(`   ✅ New database is now active at: ${DATABASE_PATH}`);
    
  } catch (error) {
    console.error('❌ Failed to replace database:', error.message);
    
    // Try to restore old database
    if (fs.existsSync(TEMP_DATABASE) && !fs.existsSync(DATABASE_PATH)) {
      try {
        fs.renameSync(TEMP_DATABASE, DATABASE_PATH);
        console.log('   🔄 Restored original database');
      } catch (restoreError) {
        console.error('❌ Failed to restore original database:', restoreError.message);
      }
    }
    
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting multi-tenant migration...\n');
    
    // Step 1: Backup existing data
    const backup = await backupExistingData();
    
    // Step 2: Create new database with multi-tenant schema
    const newDb = await createNewDatabase(backup);
    newDb.close();
    
    // Step 3: Replace old database
    await replaceDatabase();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Run validation script: node scripts/check-tables.js');
    console.log('2. Seed sample data: node scripts/seed-webapps.js');
    console.log('3. Test the application');
    console.log('\n💡 The old database has been backed up to the backups/ directory');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check that no other processes are using the database');
    console.log('2. Ensure you have write permissions');
    console.log('3. Check the backups/ directory for recovery options');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}