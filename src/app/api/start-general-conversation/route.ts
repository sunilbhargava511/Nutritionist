import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { getClaudeService } from '@/lib/claude-enhanced';
import { getDB } from '@/lib/database';
import { conversationStyle } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import { lessonService } from '@/lib/lesson-service';
import { voiceConfigService } from '@/lib/voice-config-service';

// Helper function to get current persona settings from database
async function getPersonaSettings() {
  try {
    const settings = await getDB()
      .select()
      .from(conversationStyle)
      .where(eq(conversationStyle.id, 'default'))
      .limit(1);

    if (settings.length === 0) {
      // Return default settings if none exist
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
    console.error('Error loading conversation style from database:', error);
    // Return default on error
    return {
      basePersona: 'default',
      gender: 'female',
      customPerson: '',
      enhancedPrompt: 'You are a knowledgeable nutrition educator providing clear, evidence-based information.'
    };
  }
}

// Helper function to convert numbers to ordinals (1st, 2nd, 3rd, etc.)
function getOrdinalNumber(num: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body to get optional lesson context
    const body = await request.json();
    const { lessonId, lessonTitle, orderIndex } = body || {};
    
    // Get persona settings from database
    const personaSettings = await getPersonaSettings();
    
    console.log('Starting general conversation with ElevenLabs...', {
      hasLessonContext: !!lessonId,
      lessonId,
      lessonTitle,
      orderIndex,
      personaSettings: personaSettings
    });
    
    // 1. Get the general Q&A prompt from database
    const prompts = await adminService.getAllSystemPrompts();
    let qaPrompt = null;
    let lessonTranscript = null;
    
    // If this is a lesson Q&A, try to get the lesson-specific prompt and transcript
    if (lessonId) {
      // Get lesson-specific Q&A prompt if it exists
      qaPrompt = prompts.find(p => p.type === 'lesson_qa' && p.lessonId === lessonId);
      
      // Get the lesson to retrieve its transcript
      const lesson = await lessonService.getLesson(lessonId);
      if (lesson?.videoTranscript) {
        lessonTranscript = lesson.videoTranscript;
        console.log('Found lesson transcript, length:', lessonTranscript.length);
      }
    }
    
    // Fall back to general Q&A prompt if no lesson-specific prompt
    if (!qaPrompt) {
      qaPrompt = prompts.find(p => p.type === 'qa' && !p.lessonId);
    }
    
    if (!qaPrompt) {
      return NextResponse.json(
        { 
          error: 'Q&A prompt not found',
          details: 'Please configure a Q&A prompt in the admin panel' 
        },
        { status: 500 }
      );
    }

    // 2. Get voice settings from centralized config
    const voiceId = await voiceConfigService.getVoiceId();
    
    // 3. Pass the prompt to Claude to generate the first message
    const claudeService = getClaudeService();
    
    // Build context-aware intro prompt
    let conversationContext = '';
    let transcriptContext = '';
    
    if (lessonId && lessonTitle && orderIndex !== undefined) {
      conversationContext = `This is a Q&A session after completing "${lessonTitle}" which is the ${getOrdinalNumber(orderIndex + 1)} lesson.`;
      
      // Include transcript in context if available
      if (lessonTranscript) {
        transcriptContext = `

LESSON TRANSCRIPT FOR REFERENCE:
The following is the full transcript of the lesson the user just completed. Use this information to answer questions about the lesson content accurately:

${lessonTranscript}

END OF TRANSCRIPT`;
      }
    } else {
      conversationContext = 'This is the start of a general nutrition education conversation.';
    }
    
    // Use the stored enhanced prompt which already includes gender and custom person
    const introPrompt = `${personaSettings.enhancedPrompt}

${conversationContext}${transcriptContext}

Generate a warm, welcoming introduction message that:
- Introduces you as a nutrition educator/advisor  
- Creates a comfortable, safe space for discussion
${lessonId 
  ? `- Acknowledges they just completed the lesson and invites questions about it
- Also welcomes any other nutrition topics they'd like to discuss` 
  : '- Invites the user to share what\'s on their mind about nutrition and health'
}
- Keep it under 100 words
- Write for voice synthesis (avoid symbols, spell out numbers)
- Use the personality and style specified in your persona

Generate just the introduction message, nothing else.`;

    const firstMessage = await claudeService.sendMessage([{
      id: 'intro_request',
      sender: 'user',
      content: introPrompt,
      timestamp: new Date()
    }], introPrompt);

    console.log('Generated first message from Claude:', firstMessage.substring(0, 100) + '...');

    // 4. Create ElevenLabs conversation with the Claude-generated first message
    const elevenlabsResponse = await fetch(`${process.env.NODE_ENV === 'production' ? 'https://thegoldenpath.fly.dev' : 'http://localhost:3002'}/api/elevenlabs-conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstMessage: firstMessage.trim(),
        voiceId: voiceId,
        voiceSettings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.4,
          use_speaker_boost: true,
          speed: 0.85
        }
      })
    });

    if (!elevenlabsResponse.ok) {
      const errorData = await elevenlabsResponse.json();
      console.error('Failed to create ElevenLabs conversation:', errorData);
      return NextResponse.json(
        { 
          error: 'Failed to create voice conversation',
          details: errorData.error || 'ElevenLabs API error'
        },
        { status: 500 }
      );
    }

    const conversationData = await elevenlabsResponse.json();
    
    console.log('Successfully created general conversation:', {
      conversationId: conversationData.conversationId,
      firstMessageLength: firstMessage.length
    });

    // 5. Store the prompt ID and lesson context for use in webhook callbacks
    return NextResponse.json({
      success: true,
      conversation: {
        signedUrl: conversationData.signedUrl,
        conversationId: conversationData.conversationId,
        expiresAt: conversationData.expiresAt,
        promptId: qaPrompt.id, // Store for webhook use
        type: lessonId ? 'lesson_qa' : 'general_qa',
        // Include lesson context for webhook
        lessonContext: lessonId ? {
          lessonId,
          lessonTitle,
          orderIndex,
          conversationState: `Q&A after completing "${lessonTitle}" (${getOrdinalNumber(orderIndex + 1)} lesson)`,
          hasTranscript: !!lessonTranscript,
          transcriptLength: lessonTranscript?.length || 0
        } : null
      },
      firstMessage: firstMessage.trim(),
      voiceSettings: {
        voiceId,
        settings: conversationData.overrides?.voiceSettings
      }
    });

  } catch (error) {
    console.error('Error starting general conversation:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to start conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Unified Conversation Starter Endpoint',
    description: 'POST to start a general financial counseling conversation with ElevenLabs, with optional lesson context',
    parameters: {
      lessonId: 'string (optional) - ID of completed lesson for Q&A context',
      lessonTitle: 'string (optional) - Title of completed lesson',
      orderIndex: 'number (optional) - Zero-based lesson order for "nth lesson" context'
    },
    flow: [
      '1. Retrieves general Q&A prompt from database',
      '2. Builds context-aware intro prompt based on lesson parameters',
      '3. Passes prompt to Claude to generate appropriate introduction message',
      '4. Creates ElevenLabs conversation with Claude-generated intro',
      '5. Returns conversation details with lesson context for webhook integration'
    ],
    conversationStates: {
      general: 'No lesson parameters - general financial conversation',
      lessonQA: 'With lesson parameters - post-lesson Q&A session'
    },
    webhookIntegration: 'Use promptId and lessonContext in webhook to maintain appropriate context',
    requirements: [
      'General Q&A prompt configured in admin panel',
      'ElevenLabs API credentials',
      'Claude API credentials'
    ]
  });
}