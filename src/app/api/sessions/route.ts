import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/lib/session-service';
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

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const action = searchParams.get('action');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'progress': {
        const progress = await sessionService.getSessionProgress(sessionId);
        if (!progress) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, progress });
      }

      case 'analytics': {
        const analytics = await sessionService.getSessionAnalytics(sessionId);
        return NextResponse.json({ success: true, analytics });
      }

      case 'recommendation': {
        const { conversationContext } = Object.fromEntries(searchParams.entries());
        const recommendation = await sessionService.getSessionRecommendation(
          sessionId,
          conversationContext
        );
        return NextResponse.json({ success: true, recommendation });
      }

      default: {
        const session = await sessionService.getSession(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, session });
      }
    }

  } catch (error) {
    console.error('Error in sessions GET:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'start': {
        const { userId } = data;
        
        try {
          const session = await sessionService.startSession(userId);
          
          return NextResponse.json({ 
            success: true, 
            session,
            message: 'Session started successfully' 
          });
        } catch (error) {
          console.error('Failed to start session:', error);
          throw error; // Re-throw to be caught by outer try-catch
        }
      }

      case 'start_lesson_conversation': {
        const { sessionId, lessonId, elevenLabsConversationId } = data;
        
        if (!sessionId || !lessonId) {
          return NextResponse.json(
            { success: false, error: 'Session ID and Lesson ID are required' },
            { status: 400 }
          );
        }

        const conversation = await sessionService.startLessonConversation(
          sessionId,
          lessonId,
          elevenLabsConversationId
        );

        // Get the lesson intro message
        const introMessage = await sessionService.getLessonIntroMessage(sessionId, lessonId);

        return NextResponse.json({ 
          success: true, 
          conversation,
          introMessage,
          message: 'Lesson conversation started' 
        });
      }

      case 'complete_lesson_conversation': {
        const { conversationId } = data;
        
        if (!conversationId) {
          return NextResponse.json(
            { success: false, error: 'Conversation ID is required' },
            { status: 400 }
          );
        }

        await sessionService.completeLessonConversation(conversationId);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Lesson conversation completed' 
        });
      }

      case 'end': {
        const { sessionId } = data;
        
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        await sessionService.endSession(sessionId);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Session ended successfully' 
        });
      }

      case 'get_lesson_prompt': {
        const { lessonId, generalPrompt } = data;
        
        if (!lessonId || !generalPrompt) {
          return NextResponse.json(
            { success: false, error: 'Lesson ID and general prompt are required' },
            { status: 400 }
          );
        }

        const lessonAwarePrompt = await sessionService.generateLessonAwarePrompt(
          lessonId,
          generalPrompt
        );

        return NextResponse.json({ 
          success: true, 
          prompt: lessonAwarePrompt 
        });
      }

      case 'should_recommend_lesson': {
        const { sessionId, conversationHistory } = data;
        
        if (!sessionId || !Array.isArray(conversationHistory)) {
          return NextResponse.json(
            { success: false, error: 'Session ID and conversation history are required' },
            { status: 400 }
          );
        }

        const shouldRecommend = await sessionService.shouldRecommendLesson(
          sessionId,
          conversationHistory
        );

        return NextResponse.json({ 
          success: true, 
          shouldRecommend 
        });
      }

      case 'get_conversation_end_message': {
        const { lessonId } = data;
        
        if (!lessonId) {
          return NextResponse.json(
            { success: false, error: 'Lesson ID is required' },
            { status: 400 }
          );
        }

        const endMessage = await sessionService.getConversationEndMessage(lessonId);

        return NextResponse.json({ 
          success: true, 
          message: endMessage 
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in sessions POST:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const body = await request.json();
    const { sessionId, ...updates } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    await lessonService.updateUserSession(sessionId, updates);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Session updated successfully' 
    });

  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update session' },
      { status: 500 }
    );
  }
}