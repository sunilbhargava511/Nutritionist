import { NextRequest, NextResponse } from 'next/server';
import { lessonService } from '@/lib/lesson-service';
import { openingMessageService } from '@/lib/opening-message-service';

export async function POST(request: NextRequest) {
  try {
    const { lessonId, sessionId } = await request.json();

    if (!lessonId || !sessionId) {
      return NextResponse.json(
        { error: 'lessonId and sessionId are required' },
        { status: 400 }
      );
    }

    // Get the lesson
    const lesson = await lessonService.getLesson(lessonId);
    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      );
    }

    // Get or create user session
    let userSession = await lessonService.getUserSession(sessionId);
    if (!userSession) {
      userSession = await lessonService.createUserSession();
    }

    // Update current lesson
    await lessonService.updateUserSession(sessionId, {
      currentLessonId: lessonId
    });

    const response: any = {
      success: true,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        videoUrl: lesson.videoUrl,
        hasStartMessage: !!lesson.startMessage
      }
    };

    // If lesson has a start message, get cached audio URL from opening message service
    if (lesson.startMessage) {
      try {
        const openingMessage = await openingMessageService.getLessonIntroMessage(lessonId);
        
        response.startMessage = {
          text: lesson.startMessage,
          audioUrl: openingMessage?.cachedAudioUrl || null
        };
        
        console.log('[StartLesson] Lesson start message prepared:', {
          lessonId,
          hasAudio: !!openingMessage?.cachedAudioUrl,
          audioUrl: openingMessage?.cachedAudioUrl
        });
      } catch (error) {
        console.error('[StartLesson] Failed to get cached audio:', error);
        // Fallback to no audio if cache lookup fails
        response.startMessage = {
          text: lesson.startMessage,
          audioUrl: null
        };
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Start lesson error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start lesson'
      },
      { status: 500 }
    );
  }
}