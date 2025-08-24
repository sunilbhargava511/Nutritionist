import { NextRequest, NextResponse } from 'next/server';
import { lessonService } from '@/lib/lesson-service';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function POST() {
  try {
    await ensureDatabase();
    
    const result = await lessonService.syncAllTranscriptsToKnowledgeBase();
    
    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
      message: `Successfully synced ${result.synced} lesson transcripts to knowledge base${result.errors > 0 ? ` with ${result.errors} errors` : ''}`
    });
  } catch (error) {
    console.error('Error syncing transcripts to knowledge base:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync transcripts to knowledge base' },
      { status: 500 }
    );
  }
}