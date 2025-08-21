import { NextRequest, NextResponse } from 'next/server';
import { educationalSessionService } from '@/lib/educational-session';
import { getClaudeService } from '@/lib/claude-enhanced';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { action, ...data } = await request.json();

    switch (action) {
      case 'create':
        // Check if session already exists first
        const { personalizationEnabled, conversationAware, sessionId: createSessionId } = data;
        
        // Get admin settings to determine structured mode
        const createAdminSettings = await educationalSessionService.getAdminSettings();
        const useStructuredMode = createAdminSettings?.useStructuredConversation ?? true;
        
        let session;
        if (createSessionId) {
          // Try to get existing session first
          session = await educationalSessionService.getSession(createSessionId);
        }
        
        if (!session) {
          // Session doesn't exist, create a new one
          session = await educationalSessionService.createNewSession(
            personalizationEnabled, 
            createSessionId, 
            useStructuredMode ? 'structured' : 'open-ended',
            conversationAware
          );
        }
        
        // Get voice settings
        const voiceSettings = await educationalSessionService.getVoiceSettings();
        
        return NextResponse.json({
          success: true,
          session: session,
          voiceSettings,
          structuredMode: useStructuredMode,
          conversationMode: useStructuredMode ? 'structured' : 'open-ended'
        });

      case 'get_current_chunk':
        // Legacy chunk system - no longer supported
        return NextResponse.json(
          { success: false, error: 'Chunk system has been deprecated' },
          { status: 410 }
        );

      case 'process_conversation':
        // This handles the full conversational flow with ElevenLabs
        const { sessionId: convSessionId, userMessage, conversationHistory } = data;
        
        if (!convSessionId || !userMessage) {
          return NextResponse.json(
            { success: false, error: 'Session ID and user message are required' },
            { status: 400 }
          );
        }

        // Get current session
        const convSession = await educationalSessionService.getSession(convSessionId);
        
        if (!convSession) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        // Check if session is completed
        if (convSession.completed) {
          // Auto-generate report for completed session
          try {
            const reportResponse = await fetch(`${request.nextUrl.origin}/api/reports`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'generate',
                sessionId: convSessionId,
                options: {
                  includeResponses: true,
                  includeTimestamps: true,
                  includePersonalizationNotes: convSession.personalizationEnabled,
                  useBaseTemplate: true
                }
              })
            });

            const reportData = await reportResponse.json();
            
            return NextResponse.json({
              success: true,
              response: "Thank you for completing the educational program! Your comprehensive report has been generated and is available for download.",
              sessionCompleted: true,
              reportGenerated: reportData.success,
              reportId: reportData.reportId
            });
          } catch (reportError) {
            console.error('Auto-report generation failed:', reportError);
            return NextResponse.json({
              success: true,
              response: "Thank you for completing the educational program! You should receive a comprehensive report shortly.",
              sessionCompleted: true,
              shouldGenerateReport: true,
            });
          }
        }

        // Check if structured conversation is enabled in admin settings
        const adminSettings = await educationalSessionService.getAdminSettings();
        const useStructured = adminSettings?.useStructuredConversation ?? true;
        
        const claudeService = getClaudeService();
        
        // If structured conversation is disabled, bypass all chunk logic and use open-ended conversation
        if (!useStructured) {
          // Use QA prompt for open-ended conversation
          const qaPrompt = await educationalSessionService.getSystemPrompt('qa');
          const systemPrompt = qaPrompt?.content || 'You are a helpful financial advisor assistant.';
          
          const conversationMessages = conversationHistory || [{
            role: 'user' as const,
            content: userMessage
          }];
          
          const aiResponse = await claudeService.sendMessage(conversationMessages, systemPrompt);
          
          return NextResponse.json({
            success: true,
            response: aiResponse,
            currentChunk: null,
            sessionCompleted: false,
            openEndedMode: true
          });
        }
        
        // Structured conversation is enabled - use standard QA flow
        const qaPrompt = await educationalSessionService.getSystemPrompt('qa');
        const systemPrompt = qaPrompt?.content || 'You are a helpful financial advisor assistant.';

        // Process the conversation through Claude
        let aiResponse: string;
        
        try {
          const conversationMessages = conversationHistory || [{
            role: 'user' as const,
            content: userMessage
          }];
          
          aiResponse = await claudeService.sendMessage(conversationMessages, systemPrompt);
        } catch (error) {
          console.error('Error processing conversation:', error);
          aiResponse = "I apologize, but I encountered an error processing your message. Please try again.";
        }

        return NextResponse.json({
          success: true,
          response: aiResponse,
          sessionCompleted: convSession.completed,
        });

      case 'advance_chunk':
        // Legacy chunk system - no longer supported
        return NextResponse.json(
          { success: false, error: 'Chunk system has been deprecated' },
          { status: 410 }
        );

      case 'get_session_state':
        const { sessionId: stateSessionId } = data;
        if (!stateSessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        const sessionState = await educationalSessionService.getSessionState(stateSessionId);
        
        if (!sessionState) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          sessionState,
        });

      case 'update_conversation_id':
        // Update session to use ElevenLabs conversation_id and mark first chunk as sent
        const { tempSessionId, conversationId } = data;
        if (!tempSessionId || !conversationId) {
          return NextResponse.json(
            { success: false, error: 'tempSessionId and conversationId are required' },
            { status: 400 }
          );
        }

        // Get the temporary session
        const tempSession = await educationalSessionService.getSession(tempSessionId);
        if (!tempSession) {
          return NextResponse.json(
            { success: false, error: 'Temporary session not found' },
            { status: 404 }
          );
        }

        // Create new session with ElevenLabs conversation_id
        const updatedSession = await educationalSessionService.createNewSession(
          tempSession.personalizationEnabled,
          conversationId, // Use conversation_id as session ID
          tempSession.conversationType,
          tempSession.conversationAware,
          conversationId // Store conversation_id
        );

        // Session created and linked to ElevenLabs conversation ID

        // Delete temporary session (optional cleanup)
        // await educationalSessionService.deleteSession(tempSessionId);

        return NextResponse.json({
          success: true,
          session: updatedSession,
          message: 'Session updated with conversation_id and first chunk marked as sent'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Educational session API error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const sessionState = await educationalSessionService.getSessionState(sessionId);
    
    if (!sessionState) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionState,
    });
  } catch (error) {
    console.error('Error fetching session state:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session state' },
      { status: 500 }
    );
  }
}