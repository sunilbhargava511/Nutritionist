import { NextRequest, NextResponse } from 'next/server';
import { lessonService } from '@/lib/lesson-service';
import { adminService } from '@/lib/admin-service';

interface LessonContextRequest {
  lessonId: string;
  query?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { lessonId, query }: LessonContextRequest = await request.json();
    
    if (!lessonId) {
      return NextResponse.json(
        { error: 'lessonId is required' },
        { status: 400 }
      );
    }
    
    // Get the lesson with its transcript
    const lesson = await lessonService.getLesson(lessonId);
    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      );
    }
    
    // Get lesson-specific Q&A prompt if it exists
    const prompts = await adminService.getAllSystemPrompts();
    const lessonPrompt = prompts.find(p => p.type === 'lesson_qa' && p.lessonId === lessonId);
    const generalPrompt = prompts.find(p => p.type === 'qa' && !p.lessonId);
    
    const qaPrompt = lessonPrompt || generalPrompt;
    
    // Build comprehensive context for the AI
    const context = {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        summary: lesson.videoSummary,
        transcript: lesson.videoTranscript,
        orderIndex: lesson.orderIndex + 1, // Make it 1-based for user display
      },
      systemPrompt: qaPrompt?.content || 'You are a helpful nutrition educator.',
      query: query || null,
      instructions: `You are answering questions about the lesson "${lesson.title}". ${
        lesson.videoTranscript 
          ? 'Use the provided transcript to give accurate, specific answers about the lesson content.' 
          : 'Use the lesson summary to provide helpful information.'
      }`
    };
    
    return NextResponse.json({
      success: true,
      context,
      message: `Context provided for lesson: ${lesson.title}`,
      hasTranscript: !!lesson.videoTranscript,
      transcriptLength: lesson.videoTranscript?.length || 0
    });
    
  } catch (error) {
    console.error('Error getting lesson context:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get lesson context',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Lesson Context API',
    description: 'Provides lesson transcript and context for AI Q&A sessions',
    usage: 'POST with { "lessonId": "lesson_id", "query": "optional_question" }',
    response: {
      lesson: 'lesson details including transcript',
      systemPrompt: 'appropriate Q&A prompt',
      instructions: 'context-aware guidance for the AI'
    },
    integration: 'Designed to be called by ElevenLabs agents during lesson Q&A'
  });
}