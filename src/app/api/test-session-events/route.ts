import { NextRequest, NextResponse } from 'next/server';
import { debugDatabaseService } from '@/lib/debug-database-service';
import { sessionEventService } from '@/lib/session-event-service';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { action } = await request.json();

    switch (action) {
      case 'create-test-events':
        // Set a test session
        const sessionId = `test_session_${Date.now()}`;
        sessionEventService.setCurrentSession(sessionId);

        // Create session started event
        const sessionEvent = sessionEventService.createSessionStartedEvent({
          userId: 'test_user',
          userAgent: 'Test Browser',
          timezone: 'America/New_York'
        });

        // Create ElevenLabs conversation event
        const voiceEvent = sessionEventService.createElevenLabsConversationEvent({
          agentId: 'agent_test_123',
          conversationId: 'conv_test_456',
          voiceSettings: {
            voiceId: 'test_voice',
            stability: 0.75,
            similarityBoost: 0.85,
            style: 0.5
          }
        });

        // Create lesson started event
        const lessonEvent = sessionEventService.createLessonStartedEvent({
          lessonId: 'lesson_test_123',
          lessonTitle: 'Emergency Fund Basics',
          lessonProgress: '1/5 sections',
          difficulty: 'beginner',
          estimatedDuration: 15
        });

        // Create lesson Q&A event
        const qaEvent = sessionEventService.createLessonQAEvent({
          parentLessonId: 'lesson_test_123',
          availableQuestions: 5,
          questionTypes: ['multiple-choice', 'short-answer']
        });

        // Create open conversation event
        const chatEvent = sessionEventService.createOpenConversationEvent({
          conversationContext: 'User wants to discuss budgeting',
          detectedIntent: 'budget_planning',
          userMood: 'curious'
        });

        const allEvents = [sessionEvent, voiceEvent, lessonEvent, qaEvent, chatEvent];
        
        // Add events to debug database
        for (const event of allEvents) {
          await debugDatabaseService.addSessionEvent(event);
        }

        return NextResponse.json({
          success: true,
          message: `Created ${allEvents.length} test events`,
          events: allEvents.map(e => ({
            id: e.id,
            type: e.type,
            title: e.title,
            summary: e.summary,
            timestamp: e.timestamp
          }))
        });

      case 'clear-events':
        sessionEventService.clearAllEvents();
        return NextResponse.json({
          success: true,
          message: 'All events cleared'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Test session events API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}