import { NextRequest, NextResponse } from 'next/server';
import { lessonService } from '@/lib/lesson-service';

export async function POST(request: NextRequest) {
  try {
    const { lessonId, sessionId } = await request.json();

    if (!lessonId || !sessionId) {
      return NextResponse.json(
        { error: 'lessonId and sessionId are required' },
        { status: 400 }
      );
    }

    // Get the lesson to extract context
    const lesson = await lessonService.getLesson(lessonId);
    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      );
    }

    // Get user session or create one if it doesn't exist
    let userSession = await lessonService.getUserSession(sessionId);
    if (!userSession) {
      console.log(`Creating new user session for ID: ${sessionId}`);
      userSession = await lessonService.createUserSession();
    }

    console.log('Starting lesson conversation via unified general conversation API', {
      lessonId,
      lessonTitle: lesson.title,
      orderIndex: lesson.orderIndex
    });

    // Call the unified general conversation API with lesson context
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://thegoldenpath.fly.dev' 
      : 'http://localhost:3000';
      
    const generalConversationResponse = await fetch(`${baseUrl}/api/start-general-conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        orderIndex: lesson.orderIndex
      })
    });

    if (!generalConversationResponse.ok) {
      const errorData = await generalConversationResponse.json();
      console.error('Failed to start general conversation with lesson context:', errorData);
      return NextResponse.json(
        { 
          error: 'Failed to start lesson conversation',
          details: errorData.error || 'General conversation API error'
        },
        { status: 500 }
      );
    }

    const conversationData = await generalConversationResponse.json();

    // Create lesson conversation record for tracking
    const lessonConversation = await lessonService.createLessonConversation(
      userSession.id,
      lessonId,
      conversationData.conversation.conversationId
    );

    // Return data in the same format as before for compatibility
    return NextResponse.json({
      success: true,
      conversationId: conversationData.conversation.conversationId,
      conversationUrl: conversationData.conversation.signedUrl,
      lessonConversation: lessonConversation,
      lesson: {
        id: lesson.id,
        title: lesson.title
      },
      // Include the full conversation data for debugging
      conversationDetails: conversationData.conversation
    });

  } catch (error) {
    console.error('Start lesson conversation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start lesson conversation'
      },
      { status: 500 }
    );
  }
}