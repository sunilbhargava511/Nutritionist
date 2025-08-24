import { NextRequest, NextResponse } from 'next/server';
import { getClaudeService } from '@/lib/claude';
import { getDB } from '@/lib/database';
import { conversationStyle, lessons } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

// Helper function to get current persona settings from database
async function getPersonaSettings() {
  try {
    const settings = await getDB()
      .select()
      .from(conversationStyle)
      .where(eq(conversationStyle.id, 'default'))
      .limit(1);

    if (settings.length === 0) {
      return {
        basePersona: 'default',
        gender: 'female',
        customPerson: '',
        enhancedPrompt: 'You are a knowledgeable nutrition educator providing clear, evidence-based information.'
      };
    }

    return {
      basePersona: settings[0].basePersona,
      gender: settings[0].gender,
      customPerson: settings[0].customPerson,
      enhancedPrompt: settings[0].enhancedPrompt
    };
  } catch (error) {
    console.error('Error loading conversation style:', error);
    return {
      basePersona: 'default',
      gender: 'female',
      customPerson: '',
      enhancedPrompt: 'You are a knowledgeable nutrition educator providing clear, evidence-based information.'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, lessonId } = body;

    if (!type || (type !== 'general' && type !== 'lesson')) {
      return NextResponse.json(
        { success: false, error: 'Type must be "general" or "lesson"' },
        { status: 400 }
      );
    }

    if (type === 'lesson' && !lessonId) {
      return NextResponse.json(
        { success: false, error: 'lessonId is required for lesson opening messages' },
        { status: 400 }
      );
    }

    // Get persona settings from database
    const personaSettings = await getPersonaSettings();
    
    console.log('[Opening Message Generation] Generating', type, 'opening message with persona:', {
      basePersona: personaSettings.basePersona,
      gender: personaSettings.gender,
      hasCustomPerson: !!personaSettings.customPerson
    });

    const claudeService = getClaudeService();
    
    let generatedMessage: string;

    if (type === 'general') {
      // Generate general opening message
      const persona = {
        name: `${personaSettings.basePersona} (${personaSettings.gender})${personaSettings.customPerson ? ` - ${personaSettings.customPerson}` : ''}`,
        prompt: personaSettings.enhancedPrompt
      };

      generatedMessage = await claudeService.generateGeneralOpeningMessage(persona);
      
    } else if (type === 'lesson') {
      // Get lesson details for context
      const lesson = await getDB()
        .select()
        .from(lessons)
        .where(eq(lessons.id, lessonId))
        .limit(1);

      if (lesson.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Lesson not found' },
          { status: 404 }
        );
      }

      const lessonData = lesson[0];
      
      const persona = {
        name: `${personaSettings.basePersona} (${personaSettings.gender})${personaSettings.customPerson ? ` - ${personaSettings.customPerson}` : ''}`,
        prompt: personaSettings.enhancedPrompt
      };

      generatedMessage = await claudeService.generateLessonOpeningMessage(
        lessonData.title,
        lessonData.videoSummary || 'A nutrition education lesson',
        persona
      );
    }

    console.log('[Opening Message Generation] Generated message length:', generatedMessage!.length);

    return NextResponse.json({
      success: true,
      message: generatedMessage,
      type: type,
      lessonId: lessonId || null,
      persona: {
        basePersona: personaSettings.basePersona,
        gender: personaSettings.gender,
        customPerson: personaSettings.customPerson || null
      }
    });

  } catch (error) {
    console.error('[Opening Message Generation] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate opening message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Opening Message Generation API',
    description: 'POST to generate AI-powered opening messages using conversation style',
    parameters: {
      type: 'string - "general" for general conversation or "lesson" for lesson-specific',
      lessonId: 'string (required if type is "lesson") - ID of the lesson'
    },
    flow: [
      '1. Retrieves conversation style settings from database',
      '2. For lesson messages: fetches lesson details for context',
      '3. Generates appropriate opening message using Claude with persona',
      '4. Returns generated message ready for TTS playback'
    ],
    examples: {
      general: { type: 'general' },
      lesson: { type: 'lesson', lessonId: 'lesson-123' }
    }
  });
}