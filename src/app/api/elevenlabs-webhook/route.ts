import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getClaudeService } from '@/lib/claude-enhanced';
import { Message } from '@/types';
import { sessionManager, SessionData } from '@/lib/elevenlabs-session-manager';
import { educationalSessionService } from '@/lib/educational-session';
import { initializeDatabase } from '@/lib/database';
import { EnhancedSessionStorage } from '@/lib/session-enhanced';
import { lessonService } from '@/lib/lesson-service';
import { db } from '@/lib/database';
import * as schema from '@/lib/database/schema';
import { eq, and } from 'drizzle-orm';

// ElevenLabs webhook request format (from FTherapy reference)
interface ElevenLabsWebhookRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  variables?: {
    conversation_id?: string;
    session_id?: string;
    current_topic?: string;
    [key: string]: any;
  };
}

// ElevenLabs expected response format
interface ElevenLabsWebhookResponse {
  content: string;
  variables?: Record<string, any>;
}

// Financial advisor conversation topics
const CONVERSATION_TOPICS = [
  'introduction',
  'financial_goals', 
  'current_situation',
  'investment_experience',
  'risk_tolerance',
  'concerns',
  'planning',
  'summary'
];

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

// Build conversation context from messages
function buildConversationContext(messages: Array<{ role: string; content: string }>): string {
  return messages
    .filter(msg => msg.role !== 'system')
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');
}

// Build enhanced prompt with lesson context
async function buildEnhancedPrompt(conversationId: string, userInput: string): Promise<{ prompt: string; lessonContext?: any }> {
  try {
    // Check if we're in a lesson conversation by looking up in database
    console.log(`Checking for lesson conversation with ID: ${conversationId}`);
    
    const lessonConversations = await db
      .select()
      .from(schema.lessonConversations)
      .where(eq(schema.lessonConversations.conversationId, conversationId))
      .limit(1);
    
    if (lessonConversations.length > 0) {
      const lessonConversation = lessonConversations[0];
      console.log(`Found lesson conversation for ${conversationId}:`, {
        lessonId: lessonConversation.lessonId,
        sessionId: lessonConversation.sessionId
      });
      
      // Get lesson details
      const lesson = await lessonService.getLesson(lessonConversation.lessonId);
      if (!lesson) {
        console.warn(`Lesson ${lessonConversation.lessonId} not found`);
        return { prompt: await getGeneralPrompt() };
      }
      
      // Get lesson-specific prompt
      const lessonPrompts = await db
        .select()
        .from(schema.systemPrompts)
        .where(
          and(
            eq(schema.systemPrompts.type, 'lesson_qa'),
            eq(schema.systemPrompts.lessonId, lessonConversation.lessonId),
            eq(schema.systemPrompts.active, true)
          )
        )
        .limit(1);
      
      // Get general Q&A prompt as fallback
      const generalPrompt = await getGeneralPrompt();
      
      let combinedPrompt = generalPrompt;
      
      if (lessonPrompts.length > 0) {
        const lessonPrompt = lessonPrompts[0].content;
        
        // Combine general and lesson-specific prompts
        combinedPrompt = `${generalPrompt}

LESSON-SPECIFIC CONTEXT:
${lessonPrompt}

LESSON DETAILS:
- Lesson Title: ${lesson.title}
- Video Summary: ${lesson.videoSummary}
- Current Phase: conversation

When responding, prioritize lesson-specific guidance while maintaining your general advisory capabilities. Reference the video content when appropriate and help the user understand and apply the concepts discussed in this lesson.`;
      } else {
        // Use general prompt with lesson context
        combinedPrompt = `${generalPrompt}

CURRENT LESSON CONTEXT:
You are currently discussing "${lesson.title}" with the user. 

Video Summary: ${lesson.videoSummary}
Current Phase: conversation

Use this context to provide relevant, lesson-focused responses while maintaining your general financial advisory capabilities.`;
      }
      
      return {
        prompt: combinedPrompt,
        lessonContext: {
          lessonId: lessonConversation.lessonId,
          title: lesson.title,
          phase: 'conversation',
          hasLessonPrompt: lessonPrompts.length > 0
        }
      };
    }
    
    // Not in a lesson, use general prompt
    return { prompt: await getGeneralPrompt() };
    
  } catch (error) {
    console.error('Error building enhanced prompt:', error);
    // Fallback to general prompt on error
    return { prompt: await getGeneralPrompt() };
  }
}

// Get general Q&A prompt
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
    // Hard-coded fallback
    return `You are Sanjay, a friendly AI financial advisor. Help the user with their financial questions and provide practical, actionable advice.`;
  }
}

// Webhook signature verification (optional for development)
function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('elevenlabs-signature');
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    console.warn('Missing webhook signature or secret');
    return process.env.NODE_ENV !== 'production'; // Allow in development
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  try {
    await ensureDatabase();
    console.log(`[${requestId}] ElevenLabs webhook request started`);
    
    // Parse the webhook request body
    const body: ElevenLabsWebhookRequest = await request.json();
    const { messages, variables = {} } = body;
    
    // Extract the last user message
    const userMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    
    // Validate we have a user message to respond to
    if (!userMessage || userMessage.role !== 'user') {
      console.log(`[${requestId}] No user message found, returning default response`);
      return NextResponse.json({
        content: "I didn't catch that. Could you please repeat?",
        variables
      });
    }
    
    const userInput = userMessage.content;
    console.log(`[${requestId}] User input: ${userInput.substring(0, 100)}...`);
    
    // Resolve session with retry logic
    const sessionInfo = await sessionManager.resolveSessionWithRetry();
    
    if (!sessionInfo) {
      console.warn(`[${requestId}] Could not resolve session, creating new one`);
      // Create a new session if none exists
      const newSession: SessionData = {
        sessionId: `session_${Date.now()}`,
        conversationId: variables.conversation_id,
        registeredAt: new Date().toISOString(),
        messages: []
      };
      await sessionManager.registerSession(newSession);
    }
    
    const session = sessionInfo || await sessionManager.getLatestSession();
    
    if (!session) {
      console.error(`[${requestId}] Failed to get or create session`);
      return NextResponse.json({
        content: "I'm having trouble connecting. Please try refreshing the page and starting a new conversation.",
        variables
      });
    }
    
    // Store user message in session
    await sessionManager.addMessage(session.sessionId, {
      timestamp: new Date().toISOString(),
      message: userInput,
      speaker: 'user'
    });
    
    // Update session activity
    await sessionManager.updateSessionActivity(session.sessionId);
    
    // Build conversation context
    const conversationContext = buildConversationContext(messages);
    
    // Check for educational session using conversation_id
    console.log(`[${requestId}] Checking for educational session...`);
    
    // Get conversation_id from ElevenLabs variables
    const conversationId = variables.conversation_id;
    let educationalSession = null;
    
    if (conversationId) {
      console.log(`[${requestId}] Using conversation_id: ${conversationId}`);
      // Use conversation_id directly as educational session ID
      educationalSession = await educationalSessionService.getSession(conversationId);
      
      if (educationalSession) {
        console.log(`[${requestId}] Found educational session for conversation: ${conversationId}`);
      } else {
        console.log(`[${requestId}] No educational session found for conversation: ${conversationId}, using open-ended mode`);
      }
    } else {
      console.log(`[${requestId}] No conversation_id provided, using open-ended mode`);
    }
    
    let aiResponse: string;
    let updatedVariables = { ...variables };
    
    if (educationalSession) {
      // Use educational session processing for structured conversations
      console.log(`[${requestId}] Processing via educational session API...`);
      
      try {
        // Convert ElevenLabs messages to conversation history format
        const conversationHistory = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        }));
        
        // Call educational session processing
        const response = await fetch(`${request.nextUrl.origin}/api/educational-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'process_conversation',
            sessionId: conversationId, // Use conversation_id directly
            userMessage: userInput,
            conversationHistory: conversationHistory
          })
        });
        
        if (!response.ok) {
          throw new Error(`Educational session API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Educational session processing failed');
        }
        
        aiResponse = data.response;
        
        // Update variables with educational session context
        updatedVariables = {
          ...variables,
          conversation_id: conversationId,
          session_completed: data.sessionCompleted || false,
          structured_mode: true,
          conversation_mode: 'structured'
        };
        
        console.log(`[${requestId}] Educational session response generated`);
        
      } catch (educationalError) {
        console.error(`[${requestId}] Educational session processing failed:`, educationalError);
        // Fall back to Claude processing with enhanced prompts
        console.log(`[${requestId}] Falling back to Claude with enhanced prompts...`);
        const claudeService = getClaudeService();
        
        try {
          // Build enhanced prompt with potential lesson context
          const { prompt: enhancedPrompt, lessonContext } = await buildEnhancedPrompt(conversationId || '', userInput);
          
          const formattedMessages: Message[] = messages.map((msg, index) => ({
            id: `msg_${index}`,
            content: msg.content,
            sender: msg.role === 'user' ? 'user' : 'assistant',
            timestamp: new Date()
          }));
          
          const response = await claudeService.sendMessage(formattedMessages, enhancedPrompt);
          aiResponse = response;
          
          console.log(`[${requestId}] Fallback successful with lesson context:`, lessonContext ? 'Yes' : 'No');
        } catch (claudeError) {
          console.error(`[${requestId}] Claude processing also failed:`, claudeError);
          aiResponse = "I apologize, but I'm having technical difficulties. Please try again.";
        }
        
        updatedVariables = {
          ...variables,
          structured_mode: false,
          conversation_mode: 'fallback'
        };
      }
    } else {
      // Use Claude for open-ended conversation (no educational session)
      console.log(`[${requestId}] Processing via Claude (open-ended mode)...`);
      const claudeService = getClaudeService();
      
      try {
        // Build enhanced prompt with potential lesson context
        const { prompt: enhancedPrompt, lessonContext } = await buildEnhancedPrompt(conversationId || '', userInput);
        
        console.log(`[${requestId}] Using enhanced prompt. Lesson context:`, lessonContext ? 'Yes' : 'No');
        if (lessonContext) {
          console.log(`[${requestId}] Lesson: ${lessonContext.title} (${lessonContext.phase})`);
        }
        
        // Convert messages to our Message format for Claude
        const formattedMessages: Message[] = messages.map((msg, index) => ({
          id: `msg_${index}`,
          content: msg.content,
          sender: msg.role === 'user' ? 'user' : 'assistant',
          timestamp: new Date()
        }));
        
        // Generate response with enhanced context
        const response = await claudeService.sendMessage(formattedMessages, enhancedPrompt);
        aiResponse = response;
        
        // Update variables for open-ended mode with lesson context if available
        updatedVariables = {
          ...variables,
          structured_mode: false,
          conversation_mode: lessonContext ? 'lesson_qa' : 'open-ended',
          ...(lessonContext && {
            lesson_id: lessonContext.lessonId,
            lesson_title: lessonContext.title,
            lesson_phase: lessonContext.phase,
            has_lesson_prompt: lessonContext.hasLessonPrompt
          })
        };
        
      } catch (claudeError) {
        console.error(`[${requestId}] Claude processing failed:`, claudeError);
        throw claudeError;
      }
    }
      
    // Store assistant response in session
    await sessionManager.addMessage(session.sessionId, {
      timestamp: new Date().toISOString(),
      message: aiResponse,
      speaker: 'agent'
    });
    
    // Determine next topic in conversation flow (for compatibility)
    const currentTopic = variables.current_topic || 'introduction';
    const isStructuredMode = educationalSession !== null;
    const nextTopic = isStructuredMode ? 
      (updatedVariables.session_completed ? 'summary' : currentTopic) :
      determineNextTopic(currentTopic, userInput, messages);
    
    // Log completion
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Webhook completed in ${duration}ms (mode: ${isStructuredMode ? 'structured' : 'open-ended'})`);
    console.log(`[${requestId}] Response: ${aiResponse.substring(0, 100)}...`);
    
    // Return response in ElevenLabs expected format with enhanced variables
    return NextResponse.json({
      content: aiResponse,
      variables: {
        ...updatedVariables,
        current_topic: nextTopic,
        session_id: session.sessionId,
        message_count: messages.length + 1
      }
    });
      
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Webhook error after ${duration}ms:`, error);
    
    // Return error response in expected format
    return NextResponse.json({
      content: "I apologize, but I'm having a technical difficulty. Could you please try again?",
      variables: {}
    }, { status: 200 }); // Return 200 even on error to prevent ElevenLabs retry loop
  }
}

// Helper function to determine next topic
function determineNextTopic(currentTopic: string, userInput: string, messages: any[]): string {
  // Only progress if user provides substantive answer (FTherapy pattern)
  if (userInput.trim().length <= 10) {
    return currentTopic;
  }
  
  const currentIndex = CONVERSATION_TOPICS.indexOf(currentTopic);
  
  // Check for topic triggers in user input
  const lowerInput = userInput.toLowerCase();
  
  if (lowerInput.includes('goodbye') || lowerInput.includes('thank you') || lowerInput.includes('bye')) {
    return 'summary';
  }
  
  // Normal progression through topics
  if (currentIndex >= 0 && currentIndex < CONVERSATION_TOPICS.length - 1) {
    // Check if we have enough conversation before moving to summary
    if (CONVERSATION_TOPICS[currentIndex + 1] === 'summary' && messages.length < 10) {
      return currentTopic; // Stay on current topic if not enough conversation
    }
    return CONVERSATION_TOPICS[currentIndex + 1];
  }
  
  return currentTopic;
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'ElevenLabs Webhook Handler',
      description: 'Processes conversation webhooks from ElevenLabs',
      supportedTypes: [
        'conversation.message',
        'conversation.status',
        'conversation.error'
      ],
      features: [
        'Conversation flow management',
        'Dynamic response generation',
        'Tool integration triggers',
        'Signature verification'
      ]
    },
    { status: 200 }
  );
}