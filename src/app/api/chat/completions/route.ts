import { NextRequest, NextResponse } from 'next/server';
import { getClaudeService } from '@/lib/claude-enhanced';
import { educationalSessionService } from '@/lib/educational-session';
import { sessionManager } from '@/lib/elevenlabs-session-manager';
import { debugSessionManager } from '@/lib/debug-session-manager';
import fs from 'fs';
import path from 'path';

/**
 * OpenAI-Compatible Chat Completions API for ElevenLabs Integration
 * This endpoint provides an OpenAI-compatible interface while using Anthropic Claude
 */

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
}

interface OpenAICompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

interface SessionData {
  sessionId: string;
  therapistId: string;
  frontendSessionId: string;
  registeredAt: string;
  lastActivity?: string;
}

// Session resolution following FTherapy pattern (guide lines 624-647)
async function resolveSessionId(maxRetries: number = 3): Promise<{ sessionId: string; therapistId: string } | null> {
  const SESSION_REGISTRY_DIR = path.join(process.cwd(), '.sessions');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const latestSessionPath = path.join(SESSION_REGISTRY_DIR, 'registry_latest.json');
      
      if (fs.existsSync(latestSessionPath)) {
        const data = await fs.promises.readFile(latestSessionPath, 'utf8');
        const latestSession: SessionData = JSON.parse(data);
        
        if (latestSession) {
          console.log(`[Session Resolution] Found session: ${latestSession.frontendSessionId} (attempt ${attempt})`);
          return {
            sessionId: latestSession.frontendSessionId,
            therapistId: latestSession.therapistId
          };
        }
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    } catch (error) {
      console.error(`Error resolving session ID (attempt ${attempt}):`, error);
      if (attempt === maxRetries) {
        return null;
      }
    }
  }
  
  return null;
}

// OpenAI-compatible STREAMING endpoint for ElevenLabs (FTherapy Pattern)
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Debug: Incoming request
  console.log('🎯 [CHAT-COMPLETIONS] Processing request');
  
  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        
        // Extract conversation_id from the request for educational session lookup
        const headers = Object.fromEntries(request.headers.entries());
        
        // Try multiple possible locations for conversation_id
        const conversationId = headers['conversation_id'] ||  // NEW: Check for the header you just added!
                              headers['x-conversation-id'] || 
                              headers['x-elevenlabs-conversation-id'] ||
                              body.conversation_id || 
                              body.variables?.conversation_id ||
                              body.metadata?.conversation_id;
        
        // Debug: Show all possible sources to find where conversation_id is located
        console.log('🔍 [SESSION-DEBUG] Searching for conversation_id:', {
          fromHeaders: {
            'conversation_id': headers['conversation_id'],  // NEW: Show the header value
            'x-conversation-id': headers['x-conversation-id'],
            'x-elevenlabs-conversation-id': headers['x-elevenlabs-conversation-id']
          },
          fromBody: {
            conversation_id: body.conversation_id,
            'variables.conversation_id': body.variables?.conversation_id,
            'metadata.conversation_id': body.metadata?.conversation_id
          },
          found: conversationId
        });

        // Try to resolve session using FTherapy pattern (optional for single conversation system)
        const sessionInfo = await resolveSessionId();
        if (sessionInfo) {
          console.log(`✅ Session resolved: ${sessionInfo.sessionId} (${sessionInfo.therapistId})`);
        } else {
          console.log('⚠️ [SESSION-DEBUG] Session resolution failed, will try direct conversation_id lookup');
        }
        
        // Check for educational session using conversation_id or session metadata
        let educationalSession = null;
        let useStructuredMode = false;
        let educationalSessionId = null;
        
        // FIRST: Try to use conversation_id directly if available (from ElevenLabs header)
        if (conversationId) {
          console.log('🎯 [SESSION-DEBUG] Conversation ID found! Attempting to use as educational session ID:', conversationId);
          
          // Try to load educational session using conversation_id as the key
          educationalSession = await educationalSessionService.getSession(conversationId);
          
          if (educationalSession) {
            console.log('✅ [SESSION-DEBUG] Educational session found using conversation_id!', {
              id: educationalSession.id,
              completed: educationalSession.completed
            });
            educationalSessionId = conversationId;
            useStructuredMode = true;
          } else {
            console.log('⚠️ [SESSION-DEBUG] No educational session found for conversation_id:', conversationId);
          }
        }
        
        // FALLBACK: If no conversation_id or no educational session found, try session metadata
        if (!educationalSession && sessionInfo && sessionInfo.sessionId) {
          console.log('🔍 [SESSION-DEBUG] Falling back to session metadata lookup...');
          
          try {
            const latestSession = await sessionManager.getLatestSession();
            if (latestSession && latestSession.metadata?.educational_session_id) {
              educationalSessionId = latestSession.metadata.educational_session_id;
              console.log('🔍 [SESSION-DEBUG] Found educational_session_id in metadata:', educationalSessionId);
              
              educationalSession = await educationalSessionService.getSession(educationalSessionId);
              if (educationalSession) {
                console.log('✅ [SESSION-DEBUG] Educational session found via metadata:', {
                  id: educationalSession.id,
                  completed: educationalSession.completed
                });
                useStructuredMode = true;
              } else {
                console.log('⚠️ [SESSION-DEBUG] Educational session not found in database');
              }
            } else {
              console.log('🔍 [SESSION-DEBUG] No educational_session_id in session metadata');
            }
          } catch (error) {
            console.log('🔍 [SESSION-DEBUG] Session lookup failed:', error instanceof Error ? error.message : 'Unknown error');
          }
        }
        
        if (!educationalSession) {
          console.log('❌ [SESSION-DEBUG] No educational session available - will use open-ended mode');
          
          // If we have conversation_id but no session, this might be a timing issue
          if (conversationId) {
            console.log('🔧 [SESSION-DEBUG] Have conversation_id but no session - might be during transition period');
          }
        }
        
        console.log('🔍 [SESSION-DEBUG] Structured mode enabled:', useStructuredMode);
        
        // Check if streaming is requested
        const isStreaming = body.stream !== false;
        
        // Get the last user message
        const messages = body.messages || [];
        const lastMessage = messages[messages.length - 1];
        
        // Create debug session for new conversations (when there's only user + assistant initial messages)
        if (messages.length <= 2 && conversationId) {
          const firstUserMessage = messages.find((m: any) => m.role === 'user');
          if (firstUserMessage) {
            const sessionTitle = firstUserMessage.content.substring(0, 50);
            debugSessionManager.createNewSession(sessionTitle);
            console.log('🐛 [DEBUG] Created new debug session for conversation:', conversationId);
          }
        }
        
        // Default response
        let responseContent = "Hello! I'm Sanjay, your AI financial advisor. I'm here to help you build a healthier relationship with money and work toward your financial goals. What would you like to talk about today?";
        
        if (lastMessage && lastMessage.role === 'user') {
          const userInput = lastMessage.content;
          
          try {
            if (useStructuredMode && educationalSession && educationalSessionId) {
              console.log('🎯 [STRUCTURED] Using educational session for response generation');
              
              // Use educational session service directly (no HTTP call needed since we're already in the API)
              const conversationHistory = messages.map((msg: any) => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content
              }));
              
              console.log('🔍 [STRUCTURED] Processing conversation directly with educational session service');
              
              // Get current session
              const currentSession = await educationalSessionService.getSession(educationalSessionId);
              
              // DEBUG: Show initial database state
              console.log('📊 [DATABASE-STATE] Initial educational session record:', {
                id: currentSession?.id,
                completed: currentSession?.completed,
                personalizationEnabled: currentSession?.personalizationEnabled,
                createdAt: currentSession?.createdAt,
                updatedAt: currentSession?.updatedAt
              });
              
              // Use standard QA flow for structured conversations
              const claudeService = getClaudeService();
              
              console.log('🎯 [STRUCTURED] Generating structured response with knowledge base');
              
              // Convert conversation history to Message format for sendMessageWithContext
              const claudeMessages = conversationHistory.map((msg: any, idx: number) => ({
                id: `msg_${idx}`,
                content: msg.content,
                sender: msg.role === 'user' ? 'user' as const : 'assistant' as const,
                timestamp: new Date()
              }));
              
              // Use RAG-enhanced response with knowledge base
              const ragResponse = await claudeService.sendMessageWithContext(
                claudeMessages,
                userInput
              );
              
              responseContent = ragResponse.response;
              
              // Log if knowledge base articles were found
              if (ragResponse.citedArticles && ragResponse.citedArticles.length > 0) {
                console.log('📚 [KNOWLEDGE-BASE] Found relevant articles:', 
                  ragResponse.citedArticles.map(a => a.title)
                );
              }
              
              console.log('✅ [STRUCTURED] Generated structured response with knowledge base', {
                responseLength: responseContent.length,
                articlesUsed: ragResponse.citedArticles?.length || 0
              });
              
            } else {
              console.log('🔹 [OPEN-ENDED] Using Claude for response generation with knowledge base');
              
              // Use Claude service for open-ended conversation
              const claudeService = getClaudeService();
              const claudeMessages = messages.map((msg: any, idx: number) => ({
                id: `msg_${idx}`,
                content: msg.content,
                sender: msg.role === 'user' ? 'user' as const : 'assistant' as const,
                timestamp: new Date()
              }));
              
              // Use RAG-enhanced response with knowledge base
              const ragResponse = await claudeService.sendMessageWithContext(
                claudeMessages,
                userInput
              );
              
              responseContent = ragResponse.response;
              
              // Log if knowledge base articles were found
              if (ragResponse.citedArticles && ragResponse.citedArticles.length > 0) {
                console.log('📚 [KNOWLEDGE-BASE] Found relevant articles:', 
                  ragResponse.citedArticles.map(a => a.title)
                );
              }
              
              console.log('✅ [OPEN-ENDED] Generated Claude response with knowledge base', {
                responseLength: responseContent.length,
                articlesUsed: ragResponse.citedArticles?.length || 0
              });
            }
            
          } catch (error) {
            console.error('❌ Failed to generate response:', error);
            responseContent = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
          }
        }
        
        // Voice settings for Sanjay (financial advisor tone)
        let voiceSettings = {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.4,
          use_speaker_boost: true,
          speed: 0.85
        };
        
        // Determine if this is a chunk delivery or Q&A response
        let isChunkDelivery = false;
        let isInterruptible = true; // Default: Q&A sessions are interruptible
        
        if (useStructuredMode && educationalSession && educationalSessionId) {
          // Check if this is delivering a new chunk (contains structured content patterns)
          const hasChunkPattern = responseContent.includes('---') || // Chunk separator
                                 !!responseContent.match(/\n\n[A-Z]/) || // New section pattern
                                 responseContent.length > 300; // Long educational content
          
          // Check if this is a first delivery or advancement to new chunk
          const sessionResponses = await educationalSessionService.getSessionResponses(educationalSessionId);
          const currentChunk = await educationalSessionService.getCurrentChunk(educationalSessionId);
          const currentChunkResponses = currentChunk ? sessionResponses.filter(r => r.chunkId === currentChunk.id) : [];
          
          // This is chunk delivery if it's the first interaction for this chunk or has chunk patterns
          isChunkDelivery = currentChunkResponses.length === 0 || hasChunkPattern;
          
          if (isChunkDelivery) {
            console.log('🔒 [INTERRUPTION-CONTROL] Chunk delivery detected - making uninterruptible');
            isInterruptible = false; // Chunks are uninterruptible
          } else {
            console.log('💬 [INTERRUPTION-CONTROL] Q&A response detected - keeping interruptible');
            isInterruptible = true; // Q&A sessions remain interruptible
          }
        }
        
        // Adjust voice based on response sentiment (FTherapy pattern)
        if (responseContent.includes('!') || responseContent.includes('excited') || responseContent.includes('great')) {
          voiceSettings.stability = 0.4;
          voiceSettings.similarity_boost = 0.85;
          voiceSettings.style = 0.6;
        } else if (responseContent.includes('concern') || responseContent.includes('worry') || responseContent.includes('difficult')) {
          voiceSettings.stability = 0.7;
          voiceSettings.similarity_boost = 0.75;
          voiceSettings.style = 0.3;
          voiceSettings.speed = 0.8; // Slower for serious topics
        }
        
        if (isStreaming) {
          // Use working 3-chunk pattern from test app (ElevenLabs compatible)
          const completionId = `chatcmpl-${Date.now()}`;
          const created = Math.floor(Date.now() / 1000);
          const fingerprint = `fp_${Date.now().toString(36)}`;
          const model = body.model || 'claude-3-5-sonnet-20241022';
          
          // OpenAI streaming format: role chunk, content chunk, final chunk
          const roleChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: created,
            model: model,
            system_fingerprint: fingerprint,
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: '' },
                logprobs: null,
                finish_reason: null
              }
            ]
          };
          
          const contentChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: created,
            model: model,
            system_fingerprint: fingerprint,
            choices: [
              {
                index: 0,
                delta: { content: responseContent },
                logprobs: null,
                finish_reason: null
              }
            ],
            // Add interruption control metadata for ElevenLabs
            metadata: {
              interruptible: isInterruptible,
              isChunkDelivery: isChunkDelivery,
              voiceSettings: voiceSettings
            }
          };
          
          const finalChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: created,
            model: model,
            system_fingerprint: fingerprint,
            choices: [
              {
                index: 0,
                delta: {},
                logprobs: null,
                finish_reason: 'stop'
              }
            ],
            // Add interruption control metadata for ElevenLabs
            metadata: {
              interruptible: isInterruptible,
              isChunkDelivery: isChunkDelivery,
              voiceSettings: voiceSettings
            }
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(roleChunk)}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          
        } else {
          // Non-streaming response (FTherapy pattern)
          const response: OpenAICompletionResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: body.model || 'claude-3-5-sonnet-20241022',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: responseContent
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: messages.reduce((sum: number, msg: any) => sum + msg.content.length / 4, 0),
              completion_tokens: responseContent.length / 4,
              total_tokens: (messages.reduce((sum: number, msg: any) => sum + msg.content.length, 0) + responseContent.length) / 4
            }
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
        }
        
      } catch (error) {
        console.error('❌ Chat completions error:', error);
        
        // Only try to send error response if controller is still open
        try {
          const errorResponse: OpenAIErrorResponse = {
            error: {
              message: error instanceof Error ? error.message : 'Internal server error',
              type: 'server_error',
              code: 'internal_error'
            }
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorResponse)}\n\n`));
        } catch (controllerError) {
          // Controller might already be closed, ignore this error
          console.log('Controller already closed, cannot send error response');
        }
      }
      
      // Only close controller if it's not already closed
      try {
        controller.close();
      } catch (closeError) {
        // Controller already closed, ignore
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'ElevenLabs Webhook Endpoint',
    description: 'Handles webhooks from ElevenLabs conversations configured for /api/chat/completions',
    purpose: 'OpenAI-compatible endpoint for ElevenLabs webhook integration',
    forwards_to: '/api/webhooks/post-call',
    status: 'active'
  });
}