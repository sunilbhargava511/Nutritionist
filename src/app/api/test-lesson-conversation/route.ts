import { NextRequest, NextResponse } from 'next/server';
import { lessonService } from '@/lib/lesson-service';
import { db } from '@/lib/database';
import * as schema from '@/lib/database/schema';

export async function POST(request: NextRequest) {
  try {
    const { lessonId, conversationId } = await request.json();

    if (!lessonId || !conversationId) {
      return NextResponse.json(
        { error: 'lessonId and conversationId are required' },
        { status: 400 }
      );
    }

    // Create a test user session first
    const testSession = await lessonService.createUserSession('test_user');

    // Create lesson conversation record directly
    const lessonConversation = await db.insert(schema.lessonConversations).values({
      id: `test_conv_${Date.now()}`,
      sessionId: testSession.id,
      lessonId: lessonId,
      conversationId: conversationId,
      completed: false,
      messagesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({
      success: true,
      lessonConversation: lessonConversation[0],
      userSession: testSession,
      message: 'Test lesson conversation created successfully'
    });

  } catch (error) {
    console.error('Test lesson conversation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test lesson conversation'
      },
      { status: 500 }
    );
  }
}