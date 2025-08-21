import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/elevenlabs-session-manager';

interface SessionRegistrationRequest {
  sessionId: string;
  conversationId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    console.log('[Session Registry] Raw request body:', rawBody);
    
    if (!rawBody) {
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }
    
    const body: SessionRegistrationRequest = JSON.parse(rawBody);
    const { sessionId, conversationId, timestamp, metadata } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    console.log(`[Session Registry] Registering session: ${sessionId}`, conversationId ? `with conversation: ${conversationId}` : '');

    // Register session with the session manager  
    const sessionData = {
      sessionId,
      conversationId,
      registeredAt: timestamp || new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messages: [],
      metadata: metadata || {}
    };

    await sessionManager.registerSession(sessionData);
    
    // If we have a conversation ID, map it to the session
    if (conversationId) {
      await sessionManager.mapConversationToSession(conversationId, sessionId);
    }
    
    console.log(`[Session Registry] Successfully registered session: ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId,
      conversationId,
      message: 'Session registered successfully'
    });

  } catch (error) {
    console.error('[Session Registry] Registration error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to register session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Get specific session
      const sessionData = await sessionManager.getSession(sessionId);
      
      if (!sessionData) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        session: sessionData
      });
    }

    // Debug endpoint to list all sessions
    const sessions = sessionManager.getAllSessions();
    
    return NextResponse.json({
      success: true,
      sessionCount: sessions.length,
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        conversationId: s.conversationId,
        registeredAt: s.registeredAt,
        lastActivity: s.lastActivity,
        messageCount: s.messages?.length || 0
      })),
      latestSession: await sessionManager.getLatestSession()
    });

  } catch (error) {
    console.error('[Session Registry] Get error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get session data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}