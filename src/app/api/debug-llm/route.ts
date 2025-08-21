import { NextRequest, NextResponse } from 'next/server';
import { debugDatabaseService } from '@/lib/debug-database-service';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        // Refresh debug settings from database before getting stats
        await debugDatabaseService.isDebugEnabled();
        const stats = await debugDatabaseService.getDebugStats();
        return NextResponse.json({
          success: true,
          stats
        });

      case 'entries':
        const limit = parseInt(searchParams.get('limit') || '20');
        const since = searchParams.get('since') || undefined;
        const entries = await debugDatabaseService.getRecentEntries(limit, since);
        return NextResponse.json({
          success: true,
          entries
        });

      case 'current-session':
        const sinceCurrent = searchParams.get('since') || undefined;
        const currentEntries = await debugDatabaseService.getCurrentSessionEntries(sinceCurrent);
        return NextResponse.json({
          success: true,
          entries: currentEntries
        });

      case 'sessions':
        const sessions = await debugDatabaseService.getAllSessions();
        return NextResponse.json({
          success: true,
          sessions
        });

      case 'session-events':
        const sinceEvents = searchParams.get('since') || undefined;
        const events = await debugDatabaseService.getSessionEvents(sinceEvents);
        return NextResponse.json({
          success: true,
          events
        });

      case 'all-events':
        const limitEvents = parseInt(searchParams.get('limit') || '50');
        const sinceAllEvents = searchParams.get('since') || undefined;
        const allEvents = await debugDatabaseService.getAllSessionEvents(limitEvents, sinceAllEvents);
        return NextResponse.json({
          success: true,
          events: allEvents
        });

      default:
        // Default: return debug status and basic info
        const debugStats = await debugDatabaseService.getDebugStats();
        return NextResponse.json({
          success: true,
          isEnabled: debugStats.isEnabled,
          stats: debugStats
        });
    }
  } catch (error) {
    console.error('Debug LLM API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch debug data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { action, enabled } = await request.json();

    switch (action) {
      case 'clear':
        await debugDatabaseService.clearDebugData();
        return NextResponse.json({
          success: true,
          message: 'Debug data cleared'
        });

      case 'toggle':
        debugDatabaseService.setDebugEnabled(enabled);
        return NextResponse.json({
          success: true,
          enabled: debugDatabaseService.isDebugEnabledSync()
        });

      case 'cleanup':
        const keepLastN = parseInt(request.nextUrl.searchParams.get('keepLastN') || '1000');
        const deletedCount = await debugDatabaseService.cleanupOldEntries(keepLastN);
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${deletedCount} old entries`,
          deletedCount
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Debug LLM API POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process debug action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}