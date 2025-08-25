#!/usr/bin/env node
/**
 * Database Backup and Restore Script for Multi-Tenant Architecture
 * Handles backing up and restoring webapp data with proper webapp_key isolation
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || './database.sqlite';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log('💾 Multi-Tenant Database Backup/Restore Tool');
console.log('=============================================\n');

// Tables that should be backed up per webapp
const WEBAPP_TABLES = [
  'webapp',
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
  'conversation_sessions',
  'conversation_messages',
  'debug_sessions',
  'debug_entries',
  'session_events',
  'conversation_style'
];

// Global tables (not webapp-specific)
const GLOBAL_TABLES = [
  'session_reports' // These might be global or we need to add webapp_key
];

/**
 * Create a complete database backup
 */
async function createFullBackup(outputFile) {
  let db;
  
  try {
    db = new Database(DATABASE_PATH);
    console.log(`📋 Creating full database backup...`);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = outputFile || path.join(BACKUP_DIR, `full-backup-${timestamp}.json`);
    
    const backup = {
      timestamp: new Date().toISOString(),
      type: 'full',
      version: '1.0.0',
      tables: {}
    };
    
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    
    console.log(`📊 Backing up ${tables.length} tables...`);
    
    for (const table of tables) {
      const tableName = table.name;
      
      try {
        // Get table schema
        const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
        
        // Get all data
        const data = db.prepare(`SELECT * FROM ${tableName}`).all();
        
        backup.tables[tableName] = {
          schema: schema,
          data: data,
          count: data.length
        };
        
        console.log(`   ✅ ${tableName}: ${data.length} rows`);
      } catch (error) {
        console.error(`   ❌ Failed to backup table ${tableName}:`, error.message);
      }
    }
    
    // Write backup file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    
    const fileSizeKB = Math.round(fs.statSync(backupFile).size / 1024);
    console.log(`\n🎉 Full backup created successfully!`);
    console.log(`📁 File: ${backupFile}`);
    console.log(`📊 Size: ${fileSizeKB} KB`);
    console.log(`🕒 Timestamp: ${backup.timestamp}`);
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ Error creating full backup:', error.message);
    throw error;
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * Create a webapp-specific backup
 */
async function createWebappBackup(webappKey, outputFile) {
  let db;
  
  try {
    db = new Database(DATABASE_PATH);
    console.log(`🏢 Creating backup for webapp: ${webappKey}`);
    
    // Verify webapp exists
    const webapp = db.prepare('SELECT * FROM webapp WHERE webapp_key = ?').get(webappKey);
    if (!webapp) {
      throw new Error(`Webapp '${webappKey}' not found`);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = outputFile || path.join(BACKUP_DIR, `webapp-${webappKey}-${timestamp}.json`);
    
    const backup = {
      timestamp: new Date().toISOString(),
      type: 'webapp',
      webappKey: webappKey,
      webappInfo: webapp,
      version: '1.0.0',
      tables: {}
    };
    
    console.log(`📊 Backing up data for: ${webapp.business_name}`);
    
    // Backup webapp-specific data
    for (const tableName of WEBAPP_TABLES) {
      try {
        // Check if table exists
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
        if (!tableExists) {
          console.log(`   ⚠️  Table ${tableName} does not exist, skipping`);
          continue;
        }
        
        // Get table schema
        const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const hasWebappKey = schema.find(col => col.name === 'webapp_key');
        
        let data = [];
        
        if (tableName === 'webapp') {
          // For webapp table, get only this specific webapp
          data = db.prepare(`SELECT * FROM webapp WHERE webapp_key = ?`).all(webappKey);
        } else if (hasWebappKey) {
          // For tables with webapp_key, filter by webapp
          data = db.prepare(`SELECT * FROM ${tableName} WHERE webapp_key = ?`).all(webappKey);
        } else {
          console.log(`   ⚠️  Table ${tableName} missing webapp_key column, skipping`);
          continue;
        }
        
        backup.tables[tableName] = {
          schema: schema,
          data: data,
          count: data.length
        };
        
        console.log(`   ✅ ${tableName}: ${data.length} rows`);
        
      } catch (error) {
        console.error(`   ❌ Failed to backup table ${tableName}:`, error.message);
      }
    }
    
    // Write backup file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    
    const fileSizeKB = Math.round(fs.statSync(backupFile).size / 1024);
    console.log(`\n🎉 Webapp backup created successfully!`);
    console.log(`📁 File: ${backupFile}`);
    console.log(`📊 Size: ${fileSizeKB} KB`);
    console.log(`🕒 Timestamp: ${backup.timestamp}`);
    
    return backupFile;
    
  } catch (error) {
    console.error(`❌ Error creating webapp backup for '${webappKey}':`, error.message);
    throw error;
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * Restore from a backup file
 */
async function restoreFromBackup(backupFile, options = {}) {
  let db;
  
  try {
    console.log(`📥 Restoring from backup: ${backupFile}`);
    
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }
    
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    console.log(`📋 Backup Info:`);
    console.log(`   Type: ${backup.type}`);
    console.log(`   Created: ${backup.timestamp}`);
    console.log(`   Version: ${backup.version}`);
    
    if (backup.type === 'webapp') {
      console.log(`   Webapp: ${backup.webappKey} (${backup.webappInfo.business_name})`);
    }
    
    db = new Database(DATABASE_PATH);
    
    // Confirm restoration (unless forced)
    if (!options.force && !options.confirm) {
      console.log(`\n⚠️  WARNING: This will ${options.overwrite ? 'OVERWRITE' : 'restore'} data in the database.`);
      console.log(`   Use --force flag to skip this confirmation.`);
      return;
    }
    
    console.log(`\n🔄 Restoring ${Object.keys(backup.tables).length} tables...`);
    
    // Begin transaction
    const transaction = db.transaction(() => {
      for (const [tableName, tableData] of Object.entries(backup.tables)) {
        try {
          console.log(`   📦 Restoring ${tableName}...`);
          
          // Check if table exists
          const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
          
          if (!tableExists) {
            console.log(`   ⚠️  Table ${tableName} does not exist in current database, skipping`);
            continue;
          }
          
          if (options.overwrite) {
            // Clear existing data for this webapp (if webapp-specific)
            if (backup.type === 'webapp' && tableName !== 'webapp') {
              const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
              const hasWebappKey = schema.find(col => col.name === 'webapp_key');
              
              if (hasWebappKey) {
                const deleteStmt = db.prepare(`DELETE FROM ${tableName} WHERE webapp_key = ?`);
                const deleted = deleteStmt.run(backup.webappKey);
                console.log(`     🗑️  Cleared ${deleted.changes} existing rows`);
              }
            }
          }
          
          // Insert data
          if (tableData.data && tableData.data.length > 0) {
            const firstRow = tableData.data[0];
            const columns = Object.keys(firstRow);
            const placeholders = columns.map(() => '?').join(', ');
            const columnList = columns.join(', ');
            
            const insertStmt = db.prepare(`INSERT OR REPLACE INTO ${tableName} (${columnList}) VALUES (${placeholders})`);
            
            let insertedCount = 0;
            for (const row of tableData.data) {
              const values = columns.map(col => row[col]);
              insertStmt.run(...values);
              insertedCount++;
            }
            
            console.log(`     ✅ Inserted ${insertedCount} rows`);
          } else {
            console.log(`     ℹ️  No data to restore`);
          }
          
        } catch (error) {
          console.error(`     ❌ Failed to restore table ${tableName}:`, error.message);
          throw error; // Abort transaction
        }
      }
    });
    
    transaction();
    
    console.log(`\n🎉 Backup restored successfully!`);
    
    if (backup.type === 'webapp') {
      console.log(`🏢 Webapp '${backup.webappKey}' has been restored`);
    } else {
      console.log(`📊 Full database has been restored`);
    }
    
  } catch (error) {
    console.error('❌ Error restoring from backup:', error.message);
    throw error;
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * List available backups
 */
function listBackups() {
  console.log(`📁 Available backups in: ${BACKUP_DIR}\n`);
  
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('   No backup directory found.');
    return;
  }
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.json'))
    .sort()
    .reverse(); // Most recent first
  
  if (files.length === 0) {
    console.log('   No backup files found.');
    return;
  }
  
  files.forEach((file, index) => {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.round(stats.size / 1024);
    
    try {
      const backup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const type = backup.type === 'webapp' ? `Webapp (${backup.webappKey})` : 'Full Database';
      const created = new Date(backup.timestamp).toLocaleString();
      
      console.log(`${index + 1}. ${file}`);
      console.log(`   Type: ${type}`);
      console.log(`   Created: ${created}`);
      console.log(`   Size: ${sizeKB} KB`);
      console.log('');
    } catch (error) {
      console.log(`${index + 1}. ${file} (corrupted backup)`);
      console.log('');
    }
  });
}

/**
 * Delete a webapp and all its data
 */
async function deleteWebapp(webappKey, options = {}) {
  let db;
  
  try {
    db = new Database(DATABASE_PATH);
    console.log(`🗑️  Deleting webapp: ${webappKey}`);
    
    // Verify webapp exists
    const webapp = db.prepare('SELECT * FROM webapp WHERE webapp_key = ?').get(webappKey);
    if (!webapp) {
      throw new Error(`Webapp '${webappKey}' not found`);
    }
    
    console.log(`🏢 Deleting: ${webapp.business_name}`);
    
    // Confirm deletion (unless forced)
    if (!options.force && !options.confirm) {
      console.log(`\n⚠️  WARNING: This will PERMANENTLY DELETE all data for webapp '${webappKey}'.`);
      console.log(`   Use --force flag to skip this confirmation.`);
      return;
    }
    
    // Create backup before deletion (unless skipped)
    if (!options.skipBackup) {
      console.log(`\n💾 Creating backup before deletion...`);
      await createWebappBackup(webappKey);
    }
    
    console.log(`\n🔄 Deleting data from all tables...`);
    
    // Begin transaction
    const transaction = db.transaction(() => {
      let totalDeleted = 0;
      
      for (const tableName of WEBAPP_TABLES) {
        try {
          // Check if table exists
          const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
          if (!tableExists) continue;
          
          if (tableName === 'webapp') {
            // Delete the webapp record itself
            const deleteStmt = db.prepare(`DELETE FROM webapp WHERE webapp_key = ?`);
            const result = deleteStmt.run(webappKey);
            console.log(`   ✅ ${tableName}: deleted ${result.changes} rows`);
            totalDeleted += result.changes;
          } else {
            // Check if table has webapp_key column
            const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
            const hasWebappKey = schema.find(col => col.name === 'webapp_key');
            
            if (hasWebappKey) {
              const deleteStmt = db.prepare(`DELETE FROM ${tableName} WHERE webapp_key = ?`);
              const result = deleteStmt.run(webappKey);
              console.log(`   ✅ ${tableName}: deleted ${result.changes} rows`);
              totalDeleted += result.changes;
            }
          }
          
        } catch (error) {
          console.error(`   ❌ Failed to delete from table ${tableName}:`, error.message);
          throw error; // Abort transaction
        }
      }
      
      console.log(`\n🎉 Successfully deleted webapp '${webappKey}'`);
      console.log(`📊 Total rows deleted: ${totalDeleted}`);
    });
    
    transaction();
    
  } catch (error) {
    console.error(`❌ Error deleting webapp '${webappKey}':`, error.message);
    throw error;
  } finally {
    if (db) {
      db.close();
    }
  }
}

// CLI Interface
function showUsage() {
  console.log(`
Usage: node backup-restore.js <command> [options]

Commands:
  backup-full [output-file]              Create full database backup
  backup-webapp <webapp-key> [output]    Create webapp-specific backup
  restore <backup-file> [options]        Restore from backup file
  list                                   List available backups
  delete-webapp <webapp-key> [options]   Delete webapp and all data

Options:
  --force                                Skip confirmations
  --overwrite                           Overwrite existing data during restore
  --skip-backup                         Skip backup before deletion

Examples:
  node backup-restore.js backup-full
  node backup-restore.js backup-webapp nutritionist-main
  node backup-restore.js restore ./backups/webapp-nutritionist-main-2023-12-01.json --force
  node backup-restore.js list
  node backup-restore.js delete-webapp test-webapp --force
`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showUsage();
    return;
  }
  
  const command = args[0];
  const options = {
    force: args.includes('--force'),
    overwrite: args.includes('--overwrite'),
    confirm: args.includes('--confirm'),
    skipBackup: args.includes('--skip-backup')
  };
  
  try {
    switch (command) {
      case 'backup-full':
        await createFullBackup(args[1]);
        break;
        
      case 'backup-webapp':
        if (!args[1]) {
          console.error('❌ Webapp key is required');
          process.exit(1);
        }
        await createWebappBackup(args[1], args[2]);
        break;
        
      case 'restore':
        if (!args[1]) {
          console.error('❌ Backup file is required');
          process.exit(1);
        }
        await restoreFromBackup(args[1], options);
        break;
        
      case 'list':
        listBackups();
        break;
        
      case 'delete-webapp':
        if (!args[1]) {
          console.error('❌ Webapp key is required');
          process.exit(1);
        }
        await deleteWebapp(args[1], options);
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createFullBackup,
  createWebappBackup,
  restoreFromBackup,
  deleteWebapp,
  listBackups
};