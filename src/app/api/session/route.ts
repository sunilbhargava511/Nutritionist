import { NextRequest, NextResponse } from 'next/server';
import { getClaudeService } from '@/lib/claude-enhanced';
import { Message } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();
    const claudeService = getClaudeService();

    switch (action) {
      case 'generateSummary':
        const { messages } = data;
        if (!messages || !Array.isArray(messages)) {
          return NextResponse.json(
            { error: 'Messages array is required' },
            { status: 400 }
          );
        }
        
        const summary = await claudeService.generateSessionSummary(messages as Message[]);
        return NextResponse.json({ summary, success: true });

      case 'extractNotes':
        const { userMessage, assistantMessage } = data;
        if (!userMessage || !assistantMessage) {
          return NextResponse.json(
            { error: 'Both userMessage and assistantMessage are required' },
            { status: 400 }
          );
        }
        
        const notes = await claudeService.extractSessionNotes(userMessage, assistantMessage);
        return NextResponse.json({ notes, success: true });

      case 'generateAutoNotes':
        const { userMessage: userMsg, assistantMessage: assistantMsg } = data;
        if (!userMsg || !assistantMsg) {
          return NextResponse.json(
            { error: 'Both userMessage and assistantMessage are required' },
            { status: 400 }
          );
        }
        
        const autoNotes = await claudeService.generateAutoTherapistNotes(userMsg, assistantMsg);
        return NextResponse.json({ notes: autoNotes, success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Session API error:', error);
    
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
    { message: 'Session API is running' },
    { status: 200 }
  );
}