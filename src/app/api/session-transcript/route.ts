import { NextRequest, NextResponse } from 'next/server';
import { sessionTranscriptService } from '@/lib/session-transcript-service';
import { openingMessageService } from '@/lib/opening-message-service';
import { qaStartService } from '@/lib/qa-start-service';
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
      case 'session': {
        const session = await sessionTranscriptService.getSession(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, session });
      }

      case 'transcript': {
        const transcript = await sessionTranscriptService.getCompleteTranscript(sessionId);
        return NextResponse.json({ success: true, transcript });
      }

      case 'stats': {
        const stats = await sessionTranscriptService.getSessionStats(sessionId);
        return NextResponse.json({ success: true, stats });
      }

      default: {
        // Default: return both session and transcript
        const session = await sessionTranscriptService.getSession(sessionId);
        const transcript = await sessionTranscriptService.getCompleteTranscript(sessionId);
        
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({ 
          success: true, 
          session, 
          transcript 
        });
      }
    }

  } catch (error) {
    console.error('Error in session-transcript GET:', error);
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
      case 'create_session': {
        const { sessionType, currentLessonId, userId } = data;
        
        if (!sessionType || !['open_ended', 'lesson_based'].includes(sessionType)) {
          return NextResponse.json(
            { success: false, error: 'Valid session type is required' },
            { status: 400 }
          );
        }

        const session = await sessionTranscriptService.createSession({
          sessionType,
          currentLessonId,
          userId
        });

        return NextResponse.json({ 
          success: true, 
          session,
          message: 'Session created successfully' 
        });
      }

      case 'add_opening_message': {
        const { sessionId, messageType, lessonId } = data;
        
        if (!sessionId || !messageType) {
          return NextResponse.json(
            { success: false, error: 'Session ID and message type are required' },
            { status: 400 }
          );
        }

        let openingMessage;
        
        if (messageType === 'general_opening') {
          openingMessage = await openingMessageService.getGeneralOpeningMessage();
        } else if (messageType === 'lesson_intro' && lessonId) {
          openingMessage = await openingMessageService.getLessonIntroMessage(lessonId);
        } else {
          return NextResponse.json(
            { success: false, error: 'Invalid message type or missing lesson ID' },
            { status: 400 }
          );
        }

        if (!openingMessage) {
          return NextResponse.json(
            { success: false, error: 'Opening message not found' },
            { status: 404 }
          );
        }

        const message = await sessionTranscriptService.addMessage(sessionId, {
          messageType: messageType === 'general_opening' ? 'tts_opening' : 'tts_lesson_intro',
          content: openingMessage.messageContent,
          speaker: 'assistant',
          lessonContextId: lessonId,
          metadata: {
            messageSource: 'admin_configured',
            openingMessageId: openingMessage.id,
            lessonId
          }
        });

        return NextResponse.json({ 
          success: true, 
          message,
          openingMessage: openingMessage.messageContent
        });
      }

      case 'add_message': {
        const { sessionId, messageType, content, speaker, elevenlabsMessageId, lessonContextId, metadata } = data;
        
        if (!sessionId || !messageType || !content || !speaker) {
          return NextResponse.json(
            { success: false, error: 'Session ID, message type, content, and speaker are required' },
            { status: 400 }
          );
        }

        const message = await sessionTranscriptService.addMessage(sessionId, {
          messageType,
          content,
          speaker,
          elevenlabsMessageId,
          lessonContextId,
          metadata
        });

        return NextResponse.json({ 
          success: true, 
          message 
        });
      }

      case 'update_session': {
        const { sessionId, updates } = data;
        
        if (!sessionId || !updates) {
          return NextResponse.json(
            { success: false, error: 'Session ID and updates are required' },
            { status: 400 }
          );
        }

        await sessionTranscriptService.updateSession(sessionId, updates);
        const updatedSession = await sessionTranscriptService.getSession(sessionId);

        return NextResponse.json({ 
          success: true, 
          session: updatedSession 
        });
      }

      case 'link_elevenlabs': {
        const { sessionId, conversationId, lessonContext } = data;
        
        if (!sessionId || !conversationId) {
          return NextResponse.json(
            { success: false, error: 'Session ID and conversation ID are required' },
            { status: 400 }
          );
        }

        await sessionTranscriptService.linkElevenLabsConversation(sessionId, conversationId, lessonContext);

        return NextResponse.json({ 
          success: true, 
          message: 'ElevenLabs conversation linked successfully' 
        });
      }

      case 'start_lesson_qa': {
        const { sessionId, lessonId } = data;
        
        if (!sessionId || !lessonId) {
          return NextResponse.json(
            { success: false, error: 'Session ID and lesson ID are required' },
            { status: 400 }
          );
        }

        const qaStartMessage = await qaStartService.handleLessonVideoCompletion(sessionId, lessonId);

        return NextResponse.json({ 
          success: true, 
          qaStartMessage,
          message: 'Lesson Q&A started successfully'
        });
      }

      case 'end_session': {
        const { sessionId } = data;
        
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        await sessionTranscriptService.endSession(sessionId);

        return NextResponse.json({ 
          success: true, 
          message: 'Session ended successfully' 
        });
      }

      case 'pause_session': {
        const { sessionId } = data;
        
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        await sessionTranscriptService.pauseSession(sessionId);

        return NextResponse.json({ 
          success: true, 
          message: 'Session paused successfully' 
        });
      }

      case 'resume_session': {
        const { sessionId } = data;
        
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        const session = await sessionTranscriptService.resumeSession(sessionId);

        return NextResponse.json({ 
          success: true, 
          session,
          message: 'Session resumed successfully' 
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in session-transcript POST:', error);
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

    await sessionTranscriptService.updateSession(sessionId, updates);
    const updatedSession = await sessionTranscriptService.getSession(sessionId);
    
    return NextResponse.json({ 
      success: true, 
      session: updatedSession,
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