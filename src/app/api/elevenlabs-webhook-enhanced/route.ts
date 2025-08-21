import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getClaudeService } from '@/lib/claude-enhanced';
import { sessionTranscriptService } from '@/lib/session-transcript-service';
import { initializeDatabase } from '@/lib/database';
import { db } from '@/lib/database';
import * as schema from '@/lib/database/schema';
import { eq, and } from 'drizzle-orm';

// ElevenLabs webhook request format
interface ElevenLabsWebhookRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  variables?: {
    conversation_id?: string;
    session_id?: string;
    [key: string]: any;
  };
}

// ElevenLabs expected response format
interface ElevenLabsWebhookResponse {
  content: string;
  variables?: Record<string, any>;
}

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// Generate unique request ID for tracking
function generateRequestId(): string {
  return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Build contextual prompt with complete session transcript
async function buildContextualPrompt(sessionId: string): Promise<{ prompt: string; isLessonBased: boolean; lessonId?: string }> {
  try {
    const session = await sessionTranscriptService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const completeTranscript = await sessionTranscriptService.getCompleteTranscript(sessionId);
    const generalPrompt = await getGeneralPrompt();
    
    // Check if this is lesson-based Q&A
    if (session.sessionType === 'lesson_based' && session.currentLessonId && session.lessonPhase === 'qa_conversation') {
      const lessonPrompt = await getLessonSpecificPrompt(session.currentLessonId);
      
      const combinedPrompt = `${generalPrompt}

LESSON-SPECIFIC CONTEXT:
${lessonPrompt}

LESSON DETAILS:
- Lesson ID: ${session.currentLessonId}
- Phase: Q&A Conversation (post-video)

COMPLETE SESSION TRANSCRIPT:
${sessionTranscriptService.formatTranscriptForLLM(completeTranscript)}

Instructions: Use both general financial advisory skills AND lesson-specific context. Reference the video content and lesson concepts while maintaining your warm, conversational tone. Build upon the complete conversation history shown above.`;

      return {
        prompt: combinedPrompt,
        isLessonBased: true,
        lessonId: session.currentLessonId
      };
    } else {
      // Open-ended conversation
      const openEndedPrompt = `${generalPrompt}

COMPLETE SESSION TRANSCRIPT:
${sessionTranscriptService.formatTranscriptForLLM(completeTranscript)}

Instructions: Use your general financial advisory capabilities. Draw from the complete conversation history shown above to provide contextual, relevant responses.`;

      return {
        prompt: openEndedPrompt,
        isLessonBased: false
      };
    }
    
  } catch (error) {
    console.error('Error building contextual prompt:', error);
    // Fallback to basic general prompt
    const fallbackPrompt = await getGeneralPrompt();
    return {
      prompt: fallbackPrompt,
      isLessonBased: false
    };
  }
}

// Get general prompt from database
async function getGeneralPrompt(): Promise<string> {
  try {
    const generalPrompts = await db
      .select()
      .from(schema.systemPrompts)
      .where(
        and(
          eq(schema.systemPrompts.type, 'qa'),
          eq(schema.systemPrompts.active, true)
        )
      )
      .limit(1);
    
    if (generalPrompts.length > 0) {
      return generalPrompts[0].content;
    }
    
    // Fallback prompt if none found in database
    return `You are Sanjay, a warm, empathetic AI financial advisor who specializes in helping people develop healthy relationships with money. 

Your approach:
- Listen actively and ask thoughtful follow-up questions
- Provide practical, actionable advice
- Help clients identify emotional patterns around money
- Offer personalized strategies for financial wellness
- Maintain a supportive, non-judgmental tone
- Focus on behavioral change and sustainable habits

Keep responses conversational, warm, and focused on the human experience of financial decision-making.`;
    
  } catch (error) {
    console.error('Error fetching general prompt:', error);
    return `You are Sanjay, a friendly AI financial advisor. Help the user with their financial questions and provide practical, actionable advice.`;
  }
}

// Get lesson-specific prompt from database
async function getLessonSpecificPrompt(lessonId: string): Promise<string> {
  try {
    const lessonPrompts = await db
      .select()
      .from(schema.systemPrompts)
      .where(
        and(
          eq(schema.systemPrompts.type, 'lesson_qa'),
          eq(schema.systemPrompts.lessonId, lessonId),
          eq(schema.systemPrompts.active, true)
        )
      )
      .limit(1);
    
    if (lessonPrompts.length > 0) {
      return lessonPrompts[0].content;
    }
    
    // If no lesson-specific prompt, return generic lesson guidance
    return `You are conducting a Q&A session after the user has completed a financial education lesson. Focus on:
- Helping them understand and apply the lesson concepts
- Encouraging questions about the material
- Connecting theory to their personal financial situation
- Reinforcing key takeaways from the lesson
- Maintaining engagement and enthusiasm for learning`;
    
  } catch (error) {
    console.error('Error fetching lesson prompt:', error);
    return `Focus on the lesson content and help the user understand and apply what they learned.`;
  }
}

// Main webhook handler
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  try {
    await ensureDatabase();
    console.log(`[${requestId}] Enhanced webhook request started`);
    
    // Parse the webhook request body
    const body: ElevenLabsWebhookRequest = await request.json();
    const { messages, variables = {} } = body;
    
    // Extract the last user message
    const userMessage = messages[messages.length - 1];
    
    // Validate we have a user message to respond to
    if (!userMessage || userMessage.role !== 'user') {
      console.log(`[${requestId}] No user message found, returning default response`);
      return NextResponse.json({
        content: "I didn't catch that. Could you please repeat?",
        variables
      });
    }
    
    const userInput = userMessage.content;
    const conversationId = variables.conversation_id;
    
    console.log(`[${requestId}] User input: ${userInput.substring(0, 100)}...`);
    console.log(`[${requestId}] Conversation ID: ${conversationId}`);
    
    if (!conversationId) {
      console.error(`[${requestId}] No conversation_id provided`);
      return NextResponse.json({
        content: "I'm having trouble connecting. Please try starting a new conversation.",
        variables
      });
    }
    
    // Get session by ElevenLabs conversation ID
    const session = await sessionTranscriptService.getSessionByElevenLabsId(conversationId);
    if (!session) {
      console.error(`[${requestId}] No session found for conversation_id: ${conversationId}`);
      return NextResponse.json({
        content: "I can't find your session. Please start a new conversation.",
        variables
      });
    }
    
    console.log(`[${requestId}] Found session: ${session.id} (type: ${session.sessionType}, phase: ${session.lessonPhase})`);
    
    // Store incoming user message in transcript
    await sessionTranscriptService.addMessage(session.id, {
      messageType: 'user_voice',
      content: userInput,
      speaker: 'user',
      elevenlabsMessageId: conversationId, // Use conversation_id as message ID reference
      metadata: {
        elevenlabs_conversation_id: conversationId,
        webhook_request_id: requestId
      }
    });
    
    // Build contextual prompt with complete transcript
    const { prompt, isLessonBased, lessonId } = await buildContextualPrompt(session.id);
    
    console.log(`[${requestId}] Generated prompt for ${isLessonBased ? 'lesson-based' : 'open-ended'} conversation`);
    
    // Get complete transcript for LLM context
    const completeTranscript = await sessionTranscriptService.getCompleteTranscript(session.id);
    const messageFormat = sessionTranscriptService.convertToMessageFormat(completeTranscript);
    
    console.log(`[${requestId}] Using complete transcript with ${messageFormat.length} messages`);
    
    // Generate response using Claude with complete context
    const claudeService = getClaudeService();
    const response = await claudeService.sendMessage(messageFormat, prompt);
    
    // Store assistant response in transcript
    await sessionTranscriptService.addMessage(session.id, {
      messageType: 'assistant_voice',
      content: response,
      speaker: 'assistant',
      elevenlabsMessageId: conversationId,
      lessonContextId: lessonId,
      metadata: {
        prompt_type: isLessonBased ? 'lesson_qa' : 'general',
        lesson_id: lessonId,
        webhook_request_id: requestId,
        elevenlabs_conversation_id: conversationId
      }
    });
    
    // Build response variables
    const responseVariables = {
      ...variables,
      session_id: session.id,
      session_type: session.sessionType,
      lesson_phase: session.lessonPhase,
      is_lesson_based: isLessonBased,
      message_count: completeTranscript.length + 1,
      ...(lessonId && { lesson_id: lessonId })
    };
    
    // Log completion
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Enhanced webhook completed in ${duration}ms`);
    console.log(`[${requestId}] Response: ${response.substring(0, 100)}...`);
    
    // Return response in ElevenLabs expected format
    return NextResponse.json({
      content: response,
      variables: responseVariables
    });
      
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Enhanced webhook error after ${duration}ms:`, error);
    
    // Return error response in expected format
    return NextResponse.json({
      content: "I apologize, but I'm having a technical difficulty. Could you please try again?",
      variables: { error: true }
    }, { status: 200 }); // Return 200 even on error to prevent ElevenLabs retry loop
  }
}

// GET handler for webhook info
export async function GET() {
  return NextResponse.json(
    { 
      message: 'Enhanced ElevenLabs Webhook Handler',
      description: 'Processes conversation webhooks with unified session system',
      features: [
        'Complete session transcript management',
        'Contextual LLM prompting (general + lesson-specific)',
        'Real-time message storage',
        'Session-based conversation continuity',
        'Lesson Q&A support'
      ],
      version: '2.0.0'
    },
    { status: 200 }
  );
}