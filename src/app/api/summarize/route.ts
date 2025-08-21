import { NextRequest, NextResponse } from 'next/server';
import { getClaudeService } from '@/lib/claude-enhanced';

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required', success: false },
        { status: 400 }
      );
    }

    const claudeService = getClaudeService();
    
    // Use a simple system prompt for summarization
    const summaryPrompt = `Please provide a concise 3-line summary of this educational content. Each line should capture a key point or concept. Keep it under 200 characters total and format as separate lines.`;
    
    const messages = [
      {
        id: 'summary_request',
        content: `${summaryPrompt}\n\nContent to summarize:\n\n${content}`,
        sender: 'user' as const,
        timestamp: new Date()
      }
    ];

    const summary = await claudeService.sendMessage(messages);
    
    return NextResponse.json({
      summary,
      success: true
    });

  } catch (error) {
    console.error('Summary API error:', error);
    
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