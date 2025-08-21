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

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'general') {
      const generalMessage = await openingMessageService.getGeneralOpeningMessage();
      return NextResponse.json({ 
        success: true, 
        message: generalMessage 
      });
    } else if (type === 'lessons') {
      const lessonMessages = await openingMessageService.getAllLessonIntroMessages();
      const lessons = await lessonService.getAllLessons();
      
      return NextResponse.json({ 
        success: true, 
        lessonMessages,
        lessons
      });
    } else {
      // Get all opening messages
      const generalMessage = await openingMessageService.getGeneralOpeningMessage();
      const lessonMessages = await openingMessageService.getAllLessonIntroMessages();
      const lessons = await lessonService.getAllLessons();
      
      return NextResponse.json({ 
        success: true, 
        general: generalMessage,
        lessonMessages,
        lessons
      });
    }

  } catch (error) {
    console.error('Error fetching opening messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch opening messages' },
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
      case 'set_general': {
        const { messageContent, voiceSettings } = data;
        
        if (!messageContent) {
          return NextResponse.json(
            { success: false, error: 'Message content is required' },
            { status: 400 }
          );
        }

        const message = await openingMessageService.setGeneralOpeningMessage(
          messageContent,
          voiceSettings
        );

        return NextResponse.json({ 
          success: true, 
          message,
          description: 'General opening message updated successfully' 
        });
      }

      case 'set_lesson': {
        const { lessonId, messageContent, voiceSettings } = data;
        
        if (!lessonId || !messageContent) {
          return NextResponse.json(
            { success: false, error: 'Lesson ID and message content are required' },
            { status: 400 }
          );
        }

        const message = await openingMessageService.setLessonIntroMessage(
          lessonId,
          messageContent,
          voiceSettings
        );

        return NextResponse.json({ 
          success: true, 
          message,
          description: 'Lesson intro message updated successfully' 
        });
      }

      case 'initialize_defaults': {
        await openingMessageService.initializeDefaultMessages();
        
        return NextResponse.json({ 
          success: true, 
          description: 'Default messages initialized successfully' 
        });
      }

      case 'migrate_lesson_messages': {
        // Migrate startMessage from lessons table to opening_messages
        const lessons = await lessonService.getAllLessons();
        let migratedCount = 0;
        
        for (const lesson of lessons) {
          if (lesson.startMessage) {
            // Check if intro message already exists for this lesson
            const existing = await openingMessageService.getLessonIntroMessage(lesson.id);
            
            if (!existing) {
              await openingMessageService.setLessonIntroMessage(
                lesson.id,
                lesson.startMessage,
                openingMessageService.getDefaultVoiceSettings()
              );
              migratedCount++;
            }
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          description: `Migrated ${migratedCount} lesson intro messages`,
          totalLessons: lessons.length,
          migratedCount
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error managing opening messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to manage opening messages' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const body = await request.json();
    const { messageId, messageContent, voiceSettings } = body;

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Message ID is required' },
        { status: 400 }
      );
    }

    if (messageContent) {
      await openingMessageService.updateMessageContent(messageId, messageContent);
    }
    
    if (voiceSettings) {
      await openingMessageService.updateVoiceSettings(messageId, voiceSettings);
    }
    
    return NextResponse.json({ 
      success: true, 
      description: 'Opening message updated successfully' 
    });

  } catch (error) {
    console.error('Error updating opening message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update opening message' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Message ID is required' },
        { status: 400 }
      );
    }

    await openingMessageService.deleteOpeningMessage(messageId);
    
    return NextResponse.json({ 
      success: true, 
      description: 'Opening message deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting opening message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete opening message' },
      { status: 500 }
    );
  }
}