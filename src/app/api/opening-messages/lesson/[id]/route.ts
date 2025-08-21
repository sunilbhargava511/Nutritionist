import { NextRequest, NextResponse } from 'next/server';
import { openingMessageService } from '@/lib/opening-message-service';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabase();
    
    const { id: lessonId } = await params;
    
    if (!lessonId) {
      return NextResponse.json(
        { success: false, error: 'Lesson ID is required' },
        { status: 400 }
      );
    }

    // First try to get the opening message from the opening_messages table
    const openingMessage = await openingMessageService.getLessonIntroMessage(lessonId);
    
    if (openingMessage) {
      return NextResponse.json({
        success: true,
        openingMessage: openingMessage.messageContent, // Legacy field for backward compatibility
        openingMessageData: openingMessage, // Full object with cached audio
        voiceSettings: openingMessage.voiceSettings
      });
    }

    // Fallback: get the lesson's startMessage if no opening message exists
    const lesson = await lessonService.getLesson(lessonId);
    
    if (lesson && lesson.startMessage) {
      return NextResponse.json({
        success: true,
        openingMessage: lesson.startMessage,
        openingMessageData: {
          messageContent: lesson.startMessage,
          cachedAudioUrl: null,
          needsAudioRegeneration: true
        },
        voiceSettings: null // No specific voice settings for fallback
      });
    }

    // No message found - return default
    const defaultMessage = "Welcome to this lesson! Let's begin our journey towards better financial understanding.";
    return NextResponse.json({
      success: true,
      openingMessage: defaultMessage,
      openingMessageData: {
        messageContent: defaultMessage,
        cachedAudioUrl: null,
        needsAudioRegeneration: true
      },
      voiceSettings: null
    });

  } catch (error) {
    console.error('Error fetching lesson opening message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lesson opening message' },
      { status: 500 }
    );
  }
}