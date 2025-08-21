import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import * as schema from '@/lib/database/schema';

export async function POST(request: NextRequest) {
  try {
    const { lessonId } = await request.json();

    if (!lessonId) {
      return NextResponse.json(
        { error: 'lessonId is required' },
        { status: 400 }
      );
    }

    // Create lesson-specific system prompt
    const systemPrompt = await db.insert(schema.systemPrompts).values({
      id: `prompt_${Date.now()}`,
      type: 'lesson_qa',
      lessonId: lessonId,
      content: `You are assisting with the "Test Enhanced Lesson with TTS" lesson. This lesson focuses on verifying enhanced TTS integration and contextual conversation features in the financial advisor system.

Key points for this lesson:
- This is a test lesson designed to validate enhanced features
- Users should experience seamless TTS playback  
- Conversations should be contextually aware of the lesson content
- The system should track lesson state throughout the experience

When responding:
- Acknowledge this is a test/demonstration lesson
- Focus on the enhanced user experience aspects
- Provide feedback about how the lesson system is working
- Ask relevant questions about the user's experience with the enhanced features
- Reference the video content and lesson materials when appropriate`,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({
      success: true,
      systemPrompt: systemPrompt[0],
      message: 'Lesson-specific system prompt created successfully'
    });

  } catch (error) {
    console.error('Test system prompt error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create system prompt'
      },
      { status: 500 }
    );
  }
}