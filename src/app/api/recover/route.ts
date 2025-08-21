import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting database recovery...');
    
    const body = await request.json();
    const { action, statements, metadata } = body;
    
    if (action !== 'recover-database' || !statements || !Array.isArray(statements)) {
      return NextResponse.json(
        { success: false, error: 'Invalid recovery request format' },
        { status: 400 }
      );
    }
    
    console.log(`📊 Processing ${statements.length} SQL statements...`);
    
    let executedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    // Begin transaction for better performance and atomicity
    sqlite.exec('BEGIN TRANSACTION;');
    
    try {
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        
        // Skip empty statements and comments
        if (!statement || statement.startsWith('--') || statement.startsWith('/*')) {
          continue;
        }
        
        // Skip PRAGMA statements that might not be needed
        if (statement.toUpperCase().startsWith('PRAGMA')) {
          continue;
        }
        
        // Skip BEGIN/COMMIT statements since we're managing transaction
        if (statement.toUpperCase().includes('BEGIN TRANSACTION') || 
            statement.toUpperCase().includes('COMMIT')) {
          continue;
        }
        
        try {
          sqlite.exec(statement + ';');
          executedCount++;
          
          // Log progress for large operations
          if (executedCount % 100 === 0) {
            console.log(`📈 Executed ${executedCount}/${statements.length} statements...`);
          }
          
        } catch (error) {
          errorCount++;
          const errorMsg = `Statement ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          
          // Continue with other statements, don't fail entirely
          console.warn(`⚠️ ${errorMsg}`);
          
          // But if we have too many errors, something is seriously wrong
          if (errorCount > 50) {
            throw new Error(`Too many errors (${errorCount}), aborting recovery`);
          }
        }
      }
      
      // Commit the transaction
      sqlite.exec('COMMIT;');
      
      console.log(`✅ Recovery completed: ${executedCount} statements executed, ${errorCount} errors`);
      
      // Verify key tables exist
      const tables = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
      `).all();
      
      console.log(`📋 Database now contains ${tables.length} tables:`, 
        tables.map((t: any) => t.name).join(', '));
      
      return NextResponse.json({
        success: true,
        message: 'Database recovery completed successfully',
        statementsExecuted: executedCount,
        errors: errorCount,
        errorDetails: errorCount > 0 ? errors.slice(0, 10) : [], // Return first 10 errors
        tablesCreated: tables.length,
        metadata: {
          ...metadata,
          completedAt: new Date().toISOString()
        }
      });
      
    } catch (transactionError) {
      // Rollback on serious errors
      sqlite.exec('ROLLBACK;');
      throw transactionError;
    }
    
  } catch (error) {
    console.error('❌ Database recovery failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown recovery error',
        details: 'Check server logs for more information'
      },
      { status: 500 }
    );
  }
}

// Also handle GET requests for recovery status/info
export async function GET(request: NextRequest) {
  try {
    // Get list of tables to verify database state
    const tables = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all();
    
    // Get some basic counts from key tables
    const counts: Record<string, number> = {};
    
    const keyTables = ['content_chunks', 'knowledge_base_files', 'system_prompts', 'lessons'];
    for (const tableName of keyTables) {
      try {
        const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
        counts[tableName] = result.count;
      } catch {
        counts[tableName] = 0; // Table doesn't exist
      }
    }
    
    return NextResponse.json({
      success: true,
      status: 'Database operational',
      tables: tables.map((t: any) => t.name),
      tableCount: tables.length,
      recordCounts: counts,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Database check failed' 
      },
      { status: 500 }
    );
  }
}