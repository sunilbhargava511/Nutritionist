import { NextRequest, NextResponse } from 'next/server';
import { getClaudeService } from '@/lib/claude-enhanced';
import { educationalSessionService } from '@/lib/educational-session';
import { initializeDatabase } from '@/lib/database';
import { Message } from '@/types';

/**
 * @deprecated This API route uses the legacy educational session/chunk system.
 * New implementations should use the lesson-based system with qaStartService.
 * This route is maintained for backward compatibility only.
 */

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
    
    const { messages, query, generateIntro, sessionId, isEducationalMode = true } = await request.json();

    const claudeService = getClaudeService();

    // Handle educational session flow
    if (isEducationalMode && sessionId) {
      try {
        // Get current session and chunk
        const session = await educationalSessionService.getSession(sessionId);
        const currentChunk = await educationalSessionService.getCurrentChunk(sessionId);
        
        if (!session) {
          return NextResponse.json(
            { error: 'Educational session not found', success: false },
            { status: 404 }
          );
        }

        // If no current chunk, session is completed
        if (!currentChunk) {
          return NextResponse.json({
            response: "Thank you for completing the educational program! You should receive a comprehensive report shortly.",
            sessionCompleted: true,
            shouldGenerateReport: true,
            success: true
          });
        }

        // Determine if this is the first message for this chunk
        const sessionResponses = await educationalSessionService.getSessionResponses(sessionId);
        const currentChunkResponses = sessionResponses.filter(r => r.chunkId === currentChunk.id);
        
        if (currentChunkResponses.length === 0 || generateIntro) {
          // First interaction for this chunk - deliver the educational content
          const processedContent = await educationalSessionService.processChunkContent(
            sessionId,
            currentChunk.content,
            session.personalizationEnabled
          );
          
          // Get voice settings for consistent delivery
          const voiceSettings = await educationalSessionService.getVoiceSettings();
          
          // Legacy chunk system fallback for missing question field
          const chunkQuestion = currentChunk.question || "What are your thoughts on this topic?";
          
          return NextResponse.json({
            response: `${processedContent}\n\n${chunkQuestion}`,
            currentChunk,
            voiceSettings,
            isChunkDelivery: true,
            success: true
          });
        }
        
        // User is responding to chunk question - process their response
        if (!query || typeof query !== 'string') {
          return NextResponse.json(
            { error: 'User response is required', success: false },
            { status: 400 }
          );
        }

        let aiResponse: string;
        
        if (session.personalizationEnabled) {
          // Use full conversation history for personalized response
          const contentPrompt = await educationalSessionService.getSystemPrompt('content');
          const systemPrompt = contentPrompt?.content || 'You are a helpful financial advisor.';
          
          aiResponse = await claudeService.sendMessage(messages as Message[], systemPrompt);
        } else {
          // Simple acknowledgment and move to next chunk
          aiResponse = "Thank you for your response. Let's move on to the next topic.";
        }
        
        // Save the response
        await educationalSessionService.saveChunkResponse(
          sessionId,
          currentChunk.id,
          query,
          aiResponse
        );
        
        // Advance to next chunk
        const hasNextChunk = await educationalSessionService.advanceToNextChunk(sessionId);
        
        if (hasNextChunk) {
          const nextChunk = await educationalSessionService.getCurrentChunk(sessionId);
          if (nextChunk) {
            const nextContent = await educationalSessionService.processChunkContent(
              sessionId,
              nextChunk.content,
              session.personalizationEnabled
            );
            // Legacy chunk system fallback for missing question field
            const nextChunkQuestion = nextChunk.question || "What are your thoughts on this topic?";
            aiResponse += `\n\n---\n\nNow, let's move on to our next topic:\n\n${nextContent}\n\n${nextChunkQuestion}`;
          }
        } else {
          aiResponse += "\n\nCongratulations! You've completed the entire educational program. You should receive a comprehensive report shortly.";
        }

        return NextResponse.json({
          response: aiResponse,
          currentChunk,
          sessionCompleted: !hasNextChunk,
          shouldGenerateReport: !hasNextChunk,
          success: true
        });

      } catch (error) {
        console.error('Educational session error:', error);
        return NextResponse.json(
          { 
            error: 'Educational session processing failed',
            details: error instanceof Error ? error.message : 'Unknown error',
            success: false 
          },
          { status: 500 }
        );
      }
    }

    // Legacy free-form chat mode (when not in educational mode)
    if (generateIntro) {
      try {
        // Generate dynamic welcome message using Anthropic
        const introMessage = await claudeService.generateIntroduction();
        
        return NextResponse.json({
          response: introMessage,
          citedArticles: [],
          searchResults: [],
          success: true
        });
      } catch (error) {
        console.error('Failed to generate intro with Anthropic:', error);
        return NextResponse.json(
          { 
            error: 'Failed to generate introduction message',
            details: error instanceof Error ? error.message : 'Anthropic service unavailable',
            success: false 
          },
          { status: 500 }
        );
      }
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    // Use RAG-enhanced response for better knowledge integration
    const ragResponse = await claudeService.sendMessageWithContext(
      messages as Message[], 
      query
    );

    return NextResponse.json({
      response: ragResponse.response,
      citedArticles: ragResponse.citedArticles,
      searchResults: ragResponse.searchResults,
      success: true
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';

    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Chat API is running' },
    { status: 200 }
  );
}