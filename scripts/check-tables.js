#!/usr/bin/env node
/**
 * Database Table Validation Script
 * Checks database structure, validates webapp_key columns, and reports on multi-tenancy readiness
 */

const Database = require('better-sqlite3');
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || './database.sqlite';

console.log('📊 Database Table Validation Script');
console.log('=====================================\n');

try {
  const db = new Database(DATABASE_PATH);
  console.log(`✅ Connected to database: ${DATABASE_PATH}\n`);
  
  // Get all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  
  console.log(`📋 Found ${tables.length} tables:\n`);
  
  // Tables that should have webapp_key
  const WEBAPP_KEY_TABLES = [
    'lessons',
    'admin_settings',
    'opening_messages',
    'conversations',
    'session_progress',
    'knowledge_base_files',
    'system_prompts',
    'audio_cache',
    'user_sessions',
    'lesson_conversations',
    'conversation_messages',
    'conversation_sessions',
    'debug_sessions',
    'debug_entries',
    'session_events'
  ];
  
  // Tables that should NOT have webapp_key (legacy or being replaced)
  const LEGACY_TABLES = [
    'service_summary',
    'service_provider', 
    'website_config'
  ];
  
  let hasWebappTable = false;
  let webappKeyMissing = [];
  let unexpectedTables = [];
  
  for (const table of tables) {
    const tableName = table.name;
    console.log(`🔍 Analyzing table: ${tableName}`);
    
    // Get table schema
    const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const columns = schema.map(col => ({
      name: col.name,
      type: col.type,
      notNull: col.notnull,
      defaultValue: col.dflt_value,
      primaryKey: col.pk
    }));
    
    console.log(`   📊 Columns (${columns.length}):`);
    columns.forEach(col => {
      const nullText = col.notNull ? 'NOT NULL' : 'NULL';
      const defaultText = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
      const pkText = col.primaryKey ? ' PRIMARY KEY' : '';
      console.log(`      ${col.name}: ${col.type}${pkText} ${nullText}${defaultText}`);
    });
    
    // Check for webapp table
    if (tableName === 'webapp') {
      hasWebappTable = true;
      console.log('   ✅ Webapp table found');
      
      // Validate webapp table structure
      const requiredWebappColumns = [
        'id', 'webapp_key', 'business_name', 'service_description', 
        'key_benefits', 'lessons_name', 'conversation_name'
      ];
      const missingColumns = requiredWebappColumns.filter(
        col => !columns.find(c => c.name === col)
      );
      
      if (missingColumns.length > 0) {
        console.log(`   ❌ Missing required columns: ${missingColumns.join(', ')}`);
      } else {
        console.log('   ✅ All required webapp columns present');
      }
    }
    
    // Check for webapp_key in tables that should have it
    else if (WEBAPP_KEY_TABLES.includes(tableName)) {
      const hasWebappKey = columns.find(col => col.name === 'webapp_key');
      if (!hasWebappKey) {
        webappKeyMissing.push(tableName);
        console.log('   ❌ Missing webapp_key column');
      } else {
        console.log('   ✅ webapp_key column found');
      }
    }
    
    // Check for legacy tables
    else if (LEGACY_TABLES.includes(tableName)) {
      console.log('   ⚠️  Legacy table - should be removed in multi-tenant setup');
    }
    
    // Unknown table
    else {
      unexpectedTables.push(tableName);
      console.log('   ℹ️  Not in expected table list');
    }
    
    // Get row count
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      console.log(`   📈 Rows: ${count.count}`);
    } catch (err) {
      console.log(`   ❌ Could not count rows: ${err.message}`);
    }
    
    console.log('');
  }
  
  // Summary report
  console.log('🎯 Multi-Tenancy Readiness Report');
  console.log('==================================\n');
  
  if (hasWebappTable) {
    console.log('✅ Webapp table exists');
  } else {
    console.log('❌ Webapp table missing - need to create unified webapp table');
  }
  
  if (webappKeyMissing.length > 0) {
    console.log(`❌ Tables missing webapp_key (${webappKeyMissing.length}):`);
    webappKeyMissing.forEach(table => console.log(`   • ${table}`));
  } else {
    console.log('✅ All required tables have webapp_key column');
  }
  
  const legacyTablesFound = tables.filter(t => LEGACY_TABLES.includes(t.name));
  if (legacyTablesFound.length > 0) {
    console.log(`⚠️  Legacy tables found (${legacyTablesFound.length}):`);
    legacyTablesFound.forEach(table => console.log(`   • ${table.name} - should be removed`));
  } else {
    console.log('✅ No legacy tables found');
  }
  
  if (unexpectedTables.length > 0) {
    console.log(`ℹ️  Unexpected tables (${unexpectedTables.length}):`);
    unexpectedTables.forEach(table => console.log(`   • ${table}`));
  }
  
  // Migration recommendations
  console.log('\n📝 Recommendations:');
  
  if (!hasWebappTable) {
    console.log('1. Create webapp table with unified configuration');
  }
  
  if (webappKeyMissing.length > 0) {
    console.log('2. Add webapp_key column to tables missing it');
  }
  
  if (legacyTablesFound.length > 0) {
    console.log('3. Migrate data from legacy tables to webapp table');
    console.log('4. Drop legacy tables after migration');
  }
  
  // Check if ready for multi-tenancy
  const isMultiTenantReady = hasWebappTable && webappKeyMissing.length === 0 && legacyTablesFound.length === 0;
  
  console.log('\n🏆 Status:');
  if (isMultiTenantReady) {
    console.log('✅ Database is ready for multi-tenancy');
  } else {
    console.log('❌ Database needs migration for multi-tenancy');
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ Error analyzing database:', error.message);
  
  if (error.code === 'SQLITE_CANTOPEN') {
    console.log('\n💡 Database file not found. This is normal for a fresh installation.');
    console.log('   Run the application first to create the database.');
  }
  
  process.exit(1);
}

console.log('\n✨ Analysis complete!');