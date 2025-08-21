import { db } from './database';
import * as schema from './database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Message } from '@/types';

export interface SessionTranscriptMessage {
  id: string;
  sessionId: string;
  messageType: 'tts_opening' | 'tts_lesson_intro' | 'user_voice' | 'assistant_voice' | 'llm_qa_start' | 'system';
  content: string;
  speaker: 'user' | 'assistant' | 'system';
  elevenlabsMessageId?: string;
  lessonContextId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CreateSessionData {
  userId?: string;
  sessionType: 'open_ended' | 'lesson_based';
  currentLessonId?: string;
}

export interface AddMessageData {
  messageType: SessionTranscriptMessage['messageType'];
  content: string;
  speaker: SessionTranscriptMessage['speaker'];
  elevenlabsMessageId?: string;
  lessonContextId?: string;
  metadata?: Record<string, any>;
}

export class SessionTranscriptService {
  // Create new session
  async createSession(data: CreateSessionData): Promise<schema.ConversationSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newSession: schema.NewConversationSession = {
      id: sessionId,
      userId: data.userId,
      sessionType: data.sessionType,
      lessonPhase: data.sessionType === 'lesson_based' ? 'lesson_intro' : null,
      currentLessonId: data.currentLessonId,
      status: 'active'
    };

    await db.insert(schema.conversationSessions).values(newSession);
    
    const created = await db.select()
      .from(schema.conversationSessions)
      .where(eq(schema.conversationSessions.id, sessionId))
      .limit(1);
    
    if (created.length === 0) {
      throw new Error('Failed to create session');
    }
    
    return created[0];
  }

  // Get session by ID
  async getSession(sessionId: string): Promise<schema.ConversationSession | null> {
    const sessions = await db.select()
      .from(schema.conversationSessions)
      .where(eq(schema.conversationSessions.id, sessionId))
      .limit(1);
    
    return sessions.length > 0 ? sessions[0] : null;
  }

  // Get session by ElevenLabs conversation ID
  async getSessionByElevenLabsId(conversationId: string): Promise<schema.ConversationSession | null> {
    const sessions = await db.select()
      .from(schema.conversationSessions)
      .where(eq(schema.conversationSessions.elevenlabsConversationId, conversationId))
      .limit(1);
    
    return sessions.length > 0 ? sessions[0] : null;
  }

  // Update session
  async updateSession(sessionId: string, updates: Partial<schema.ConversationSession>): Promise<void> {
    await db.update(schema.conversationSessions)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.conversationSessions.id, sessionId));
  }

  // Update session type and lesson
  async updateSessionType(sessionId: string, sessionType: 'open_ended' | 'lesson_based', lessonId?: string): Promise<schema.ConversationSession> {
    await this.updateSession(sessionId, {
      sessionType,
      currentLessonId: lessonId,
      lessonPhase: sessionType === 'lesson_based' ? 'lesson_intro' : null
    });
    
    const updated = await this.getSession(sessionId);
    if (!updated) {
      throw new Error('Failed to update session');
    }
    
    return updated;
  }

  // Update lesson phase
  async updateLessonPhase(sessionId: string, phase: 'lesson_intro' | 'video_watching' | 'qa_conversation'): Promise<void> {
    await this.updateSession(sessionId, { lessonPhase: phase });
  }

  // Link ElevenLabs conversation with optional lesson context
  async linkElevenLabsConversation(sessionId: string, conversationId: string, lessonContext?: any): Promise<void> {
    const updates: any = { elevenlabsConversationId: conversationId };
    
    // If lesson context is provided, store it in session metadata
    if (lessonContext) {
      updates.metadata = JSON.stringify({ lessonContext });
    }
    
    await this.updateSession(sessionId, updates);
  }

  // Add message to session transcript
  async addMessage(sessionId: string, messageData: AddMessageData): Promise<SessionTranscriptMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newMessage: schema.NewConversationMessage = {
      id: messageId,
      sessionId,
      messageType: messageData.messageType,
      content: messageData.content,
      speaker: messageData.speaker,
      elevenlabsMessageId: messageData.elevenlabsMessageId,
      lessonContextId: messageData.lessonContextId,
      metadata: messageData.metadata ? JSON.stringify(messageData.metadata) : null
    };

    await db.insert(schema.conversationMessages).values(newMessage);
    
    const created = await db.select()
      .from(schema.conversationMessages)
      .where(eq(schema.conversationMessages.id, messageId))
      .limit(1);
    
    if (created.length === 0) {
      throw new Error('Failed to add message');
    }
    
    const message = created[0];
    return {
      id: message.id,
      sessionId: message.sessionId,
      messageType: message.messageType as SessionTranscriptMessage['messageType'],
      content: message.content,
      speaker: message.speaker as SessionTranscriptMessage['speaker'],
      elevenlabsMessageId: message.elevenlabsMessageId || undefined,
      lessonContextId: message.lessonContextId || undefined,
      timestamp: new Date(message.timestamp || new Date()),
      metadata: message.metadata ? JSON.parse(message.metadata) : undefined
    };
  }

  // Get complete session transcript
  async getCompleteTranscript(sessionId: string): Promise<SessionTranscriptMessage[]> {
    const messages = await db.select()
      .from(schema.conversationMessages)
      .where(eq(schema.conversationMessages.sessionId, sessionId))
      .orderBy(schema.conversationMessages.timestamp);
    
    return messages.map(message => ({
      id: message.id,
      sessionId: message.sessionId,
      messageType: message.messageType as SessionTranscriptMessage['messageType'],
      content: message.content,
      speaker: message.speaker as SessionTranscriptMessage['speaker'],
      elevenlabsMessageId: message.elevenlabsMessageId || undefined,
      lessonContextId: message.lessonContextId || undefined,
      timestamp: new Date(message.timestamp || new Date()),
      metadata: message.metadata ? JSON.parse(message.metadata) : undefined
    }));
  }

  // Format transcript for LLM
  formatTranscriptForLLM(transcript: SessionTranscriptMessage[]): string {
    return transcript.map(message => {
      const timestamp = message.timestamp.toLocaleTimeString();
      const speaker = message.speaker === 'user' ? 'User' : 
                     message.speaker === 'assistant' ? 'Assistant' : 
                     'System';
      
      // Add context for different message types
      let typeContext = '';
      switch (message.messageType) {
        case 'tts_opening':
          typeContext = ' (Opening TTS)';
          break;
        case 'tts_lesson_intro':
          typeContext = ' (Lesson Intro TTS)';
          break;
        case 'llm_qa_start':
          typeContext = ' (Q&A Start)';
          break;
        case 'system':
          typeContext = ' (System)';
          break;
      }
      
      return `[${timestamp}] ${speaker}${typeContext}: ${message.content}`;
    }).join('\n');
  }

  // Convert to Message format for LLM calls
  convertToMessageFormat(transcript: SessionTranscriptMessage[]): Message[] {
    return transcript
      .filter(msg => msg.speaker !== 'system') // Exclude system messages from LLM context
      .map((message, index) => ({
        id: message.id,
        content: message.content,
        sender: message.speaker as 'user' | 'assistant',
        timestamp: message.timestamp,
        type: message.speaker as 'user' | 'assistant'
      }));
  }

  // End session
  async endSession(sessionId: string): Promise<void> {
    await this.updateSession(sessionId, {
      status: 'completed',
      endedAt: new Date().toISOString()
    });
  }

  // Pause session
  async pauseSession(sessionId: string): Promise<void> {
    await this.updateSession(sessionId, { status: 'paused' });
  }

  // Resume session
  async resumeSession(sessionId: string): Promise<schema.ConversationSession> {
    await this.updateSession(sessionId, { status: 'active' });
    
    const resumed = await this.getSession(sessionId);
    if (!resumed) {
      throw new Error('Failed to resume session');
    }
    
    return resumed;
  }

  // Get session statistics
  async getSessionStats(sessionId: string): Promise<{
    messageCount: number;
    duration: number; // in milliseconds
    lastActivity: Date;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const messages = await this.getCompleteTranscript(sessionId);
    
    const startTime = new Date(session.startedAt || new Date()).getTime();
    const endTime = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    const lastActivity = messages.length > 0 ? 
      messages[messages.length - 1].timestamp : 
      new Date(session.startedAt || new Date());

    return {
      messageCount: messages.length,
      duration: endTime - startTime,
      lastActivity
    };
  }

  // Get recent sessions
  async getRecentSessions(limit: number = 10): Promise<schema.ConversationSession[]> {
    return await db.select()
      .from(schema.conversationSessions)
      .orderBy(desc(schema.conversationSessions.updatedAt))
      .limit(limit);
  }

  // Get active sessions
  async getActiveSessions(): Promise<schema.ConversationSession[]> {
    return await db.select()
      .from(schema.conversationSessions)
      .where(eq(schema.conversationSessions.status, 'active'))
      .orderBy(desc(schema.conversationSessions.updatedAt));
  }
}

// Singleton instance
export const sessionTranscriptService = new SessionTranscriptService();

// Export service instance as default
export default sessionTranscriptService;