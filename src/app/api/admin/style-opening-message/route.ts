import { NextRequest, NextResponse } from 'next/server';
import { openingMessageService } from '@/lib/opening-message-service';
import { getClaudeService } from '@/lib/claude';
import { lessonService } from '@/lib/lesson-service';
import { initializeDatabase } from '@/lib/database';
import { getDB } from '@/lib/database';
import * as schema from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// Get persona settings from conversation style
async function getPersonaSettings() {
  try {
    const personas = await getDB().select().from(schema.conversationStyle).limit(1);
    if (personas.length === 0) {
      return null;
    }
    
    const persona = personas[0];
    let prompt = '';
    
    if (persona.basePersona === 'custom' && persona.customPerson) {
      prompt = persona.customPerson;
    } else if (persona.basePersona === 'nutritionist') {
      const genderText = persona.gender === 'male' ? 'He is' : 'She is';
      prompt = `You are a knowledgeable nutrition educator. ${genderText} professional, evidence-based, and passionate about helping people improve their relationship with food and health.`;
    } else {
      prompt = 'You are a knowledgeable nutrition educator providing clear, evidence-based information.';
    }
    
    return {
      basePersona: persona.basePersona,
      gender: persona.gender,
      prompt,
      customPerson: persona.customPerson
    };
  } catch (error) {
    console.error('Error getting persona settings:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const body = await request.json();
    const { action, messageId, userInput, messageType, lessonId } = body;

    if (!action || !messageId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: action, messageId' },
        { status: 400 }
      );
    }

    // Validate required fields for specific actions
    if ((action === 'direct_update' || action === 'style_message') && !userInput) {
      return NextResponse.json(
        { success: false, error: 'userInput is required for direct_update and style_message actions' },
        { status: 400 }
      );
    }

    // Get persona settings for styling
    const personaSettings = await getPersonaSettings();
    const persona = personaSettings ? {
      name: 'Nutritionist',
      prompt: personaSettings.prompt
    } : undefined;

    const claudeService = getClaudeService();

    switch (action) {
      case 'direct_update': {
        // Update message directly without styling
        const updatedMessage = await openingMessageService.updateMessageDirectly(
          messageId,
          userInput,
          openingMessageService.getDefaultVoiceSettings(),
          true // generateAudio
        );

        return NextResponse.json({
          success: true,
          message: updatedMessage,
          description: 'Message updated directly'
        });
      }

      case 'style_message': {
        // Get lesson context if this is a lesson message
        let lessonContext;
        if (messageType === 'lesson' && lessonId) {
          try {
            const lesson = await lessonService.getLessonById(lessonId);
            if (lesson) {
              lessonContext = {
                lessonTitle: lesson.title,
                lessonSummary: lesson.videoSummary
              };
            }
          } catch (error) {
            console.error('Error fetching lesson for context:', error);
          }
        }

        // Style the user input using Claude
        const styledContent = await claudeService.styleOpeningMessage(
          userInput,
          messageType || 'general',
          lessonContext,
          persona
        );

        // Update message with styled content
        const styledMessage = await openingMessageService.styleMessageContent(
          messageId,
          userInput, // Original user input
          styledContent, // Styled version
          openingMessageService.getDefaultVoiceSettings(),
          true // generateAudio
        );

        return NextResponse.json({
          success: true,
          message: styledMessage,
          originalInput: userInput,
          styledContent: styledContent,
          persona: personaSettings,
          description: 'Message styled successfully'
        });
      }

      case 'revert_to_user_input': {
        // Revert to original user input (before styling)
        const revertedMessage = await openingMessageService.revertToUserInput(messageId);

        if (!revertedMessage) {
          return NextResponse.json(
            { success: false, error: 'No original user input to revert to' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: revertedMessage,
          description: 'Message reverted to original user input'
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action. Use: direct_update, style_message, or revert_to_user_input' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in style opening message API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process message styling request' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if message can be reverted
export async function GET(request: NextRequest) {
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

    const canRevertToGenerated = await openingMessageService.canRevert(messageId);
    const canRevertToUserInput = await openingMessageService.canRevertToUserInput(messageId);

    return NextResponse.json({
      success: true,
      canRevertToGenerated,
      canRevertToUserInput
    });

  } catch (error) {
    console.error('Error checking revert capabilities:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check revert capabilities' },
      { status: 500 }
    );
  }
}