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

export async function GET() {
  try {
    await ensureDatabase();
    
    // Get recent session events for testing
    const events = await debugDatabaseService.getSessionEvents();
    const allEvents = await debugDatabaseService.getAllSessionEvents(20);
    
    return NextResponse.json({
      success: true,
      currentSessionEvents: events.length,
      allSessionEvents: allEvents.length,
      events: events.slice(0, 5), // Return first 5 for preview
      allEvents: allEvents.slice(0, 10), // Return first 10 for preview
      message: 'Session events test completed successfully'
    });
  } catch (error) {
    console.error('Session events test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to test session events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { action, eventData } = await request.json();
    
    switch (action) {
      case 'create-test-event':
        // Create a test session event
        const testEvent = {
          id: `test_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: eventData?.type || 'test',
          title: eventData?.title || 'Test Session Event',
          summary: eventData?.summary || 'This is a test session event for debugging',
          timestamp: new Date(),
          metadata: {
            sessionId: `test_session_${Date.now()}`,
            source: 'test-api',
            ...eventData?.metadata
          },
          firstMessage: eventData?.firstMessage || 'Test first message',
          status: eventData?.status || 'active',
          icon: eventData?.icon || 'test'
        };
        
        await debugDatabaseService.addSessionEvent(testEvent);
        
        return NextResponse.json({
          success: true,
          event: testEvent,
          message: 'Test session event created successfully'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Session events test POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process session events test',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
