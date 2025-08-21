import { SessionEvent, SessionEventType, SessionEventMetadata, Message } from '@/types';

export class SessionEventService {
  private static instance: SessionEventService;
  private events: SessionEvent[] = [];
  private currentSessionId: string | null = null;
  
  private constructor() {}

  static getInstance(): SessionEventService {
    if (!SessionEventService.instance) {
      SessionEventService.instance = new SessionEventService();
    }
    return SessionEventService.instance;
  }

  // Set the current session ID
  setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  // Create a session event
  createEvent(
    type: SessionEventType,
    metadata: Partial<SessionEventMetadata> = {}
  ): SessionEvent {
    const now = new Date();
    const sessionId = this.currentSessionId || `session_${now.getTime()}`;
    
    const event: SessionEvent = {
      id: `event_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: this.getEventTitle(type),
      summary: this.getEventSummary(type, metadata),
      timestamp: now,
      metadata: {
        sessionId,
        timestamp: now,
        ...metadata
      },
      firstMessage: this.getFirstMessage(type, metadata),
      status: 'active',
      icon: this.getEventIcon(type)
    };

    this.events.push(event);
    console.log(`[Session Event] Created ${type} event:`, event.id);
    
    return event;
  }

  // Create a system message for the event
  createSystemMessage(event: SessionEvent): Message {
    return {
      id: `msg_${event.id}`,
      type: 'system_event',
      content: this.formatSystemMessage(event),
      timestamp: event.timestamp,
      sessionEvent: event
    };
  }

  // Get event title based on type
  private getEventTitle(type: SessionEventType): string {
    switch (type) {
      case 'session_started':
        return 'Session Started';
      case 'elevenlabs_conversation_started':
        return 'Voice Conversation Started';
      case 'lesson_started':
        return 'Lesson Started';
      case 'lesson_qa_started':
        return 'Lesson Q&A Started';
      case 'open_conversation_started':
        return 'Open Conversation Started';
      default:
        return 'Session Event';
    }
  }

  // Get event summary based on type and metadata
  private getEventSummary(type: SessionEventType, metadata: Partial<SessionEventMetadata>): string {
    switch (type) {
      case 'session_started':
        return `New session started at ${metadata.timestamp?.toLocaleTimeString() || 'unknown time'}`;
      
      case 'elevenlabs_conversation_started':
        return `Voice mode activated with agent ${metadata.agentId || 'unknown'} using voice ${metadata.voiceSettings?.voiceId || 'default'}`;
      
      case 'lesson_started':
        return `Started lesson: ${metadata.lessonTitle || 'Unknown Lesson'} (Progress: ${metadata.lessonProgress || '0/0'})`;
      
      case 'lesson_qa_started':
        return `Q&A session for lesson ${metadata.parentLessonId || 'unknown'} with ${metadata.availableQuestions || 0} available questions`;
      
      case 'open_conversation_started':
        return `Free-form conversation started${metadata.detectedIntent ? ` - Intent: ${metadata.detectedIntent}` : ''}`;
      
      default:
        return 'Session event occurred';
    }
  }

  // Get first message for the event
  private getFirstMessage(type: SessionEventType, metadata: Partial<SessionEventMetadata>): string | undefined {
    switch (type) {
      case 'session_started':
        return "Welcome to your financial advisor session. I'm here to help you with your financial goals.";
      
      case 'elevenlabs_conversation_started':
        return "Voice conversation mode is now active. You can speak naturally and I'll respond with voice.";
      
      case 'lesson_started':
        return metadata.lessonTitle ? 
          `Let's begin the lesson on ${metadata.lessonTitle}. This will help you understand important financial concepts.` :
          "Let's begin this lesson on financial planning.";
      
      case 'lesson_qa_started':
        return `Now let's test your understanding with some questions about this lesson. I have ${metadata.availableQuestions || 'several'} questions prepared for you.`;
      
      case 'open_conversation_started':
        return "I'm ready to discuss any financial topics or questions you have. What would you like to talk about?";
      
      default:
        return undefined;
    }
  }

  // Get event icon
  private getEventIcon(type: SessionEventType): string {
    switch (type) {
      case 'session_started':
        return '🚀';
      case 'elevenlabs_conversation_started':
        return '🎤';
      case 'lesson_started':
        return '📚';
      case 'lesson_qa_started':
        return '❓';
      case 'open_conversation_started':
        return '💬';
      default:
        return '🔄';
    }
  }

  // Format system message for AI context
  private formatSystemMessage(event: SessionEvent): string {
    const metadata = event.metadata;
    let message = `[SYSTEM EVENT: ${event.type}]`;
    
    switch (event.type) {
      case 'session_started':
        message += ` - User session began at ${event.timestamp.toLocaleString()}`;
        if (metadata.previousSessionDate) {
          message += `, previous session: ${metadata.previousSessionDate.toLocaleDateString()}`;
        }
        if (metadata.timezone) {
          message += `, timezone: ${metadata.timezone}`;
        }
        break;

      case 'elevenlabs_conversation_started':
        message += ` - Voice conversation activated with agent ${metadata.agentId || 'unknown'}`;
        if (metadata.voiceSettings) {
          message += `, voice: ${metadata.voiceSettings.voiceId}`;
        }
        if (metadata.conversationId) {
          message += `, conversation ID: ${metadata.conversationId}`;
        }
        break;

      case 'lesson_started':
        message += ` - Lesson: ${metadata.lessonTitle || 'Unknown'}`;
        if (metadata.lessonProgress) {
          message += `, progress: ${metadata.lessonProgress}`;
        }
        if (metadata.estimatedDuration) {
          message += `, duration: ${metadata.estimatedDuration} minutes`;
        }
        break;

      case 'lesson_qa_started':
        message += ` - Q&A for lesson ${metadata.parentLessonId || 'unknown'}`;
        if (metadata.availableQuestions) {
          message += `, ${metadata.availableQuestions} questions available`;
        }
        break;

      case 'open_conversation_started':
        message += ` - Open conversation mode activated`;
        if (metadata.detectedIntent) {
          message += `, detected intent: ${metadata.detectedIntent}`;
        }
        break;
    }

    return message;
  }

  // Get all events for current session
  getSessionEvents(sessionId?: string): SessionEvent[] {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return [];
    
    return this.events.filter(event => event.metadata.sessionId === targetSessionId);
  }

  // Get all events
  getAllEvents(): SessionEvent[] {
    return [...this.events];
  }

  // Update event status
  updateEventStatus(eventId: string, status: 'active' | 'completed' | 'interrupted'): void {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.status = status;
      console.log(`[Session Event] Updated ${eventId} status to ${status}`);
    }
  }

  // Clear events for session
  clearSessionEvents(sessionId: string): void {
    this.events = this.events.filter(event => event.metadata.sessionId !== sessionId);
    console.log(`[Session Event] Cleared events for session ${sessionId}`);
  }

  // Clear all events
  clearAllEvents(): void {
    this.events = [];
    console.log('[Session Event] Cleared all events');
  }

  // Helper methods for creating specific event types
  createSessionStartedEvent(metadata: {
    userId?: string;
    userAgent?: string;
    timezone?: string;
    previousSessionDate?: Date;
  } = {}): SessionEvent {
    return this.createEvent('session_started', metadata);
  }

  createElevenLabsConversationEvent(metadata: {
    agentId: string;
    conversationId?: string;
    voiceSettings?: {
      voiceId: string;
      stability: number;
      similarityBoost: number;
      style: number;
    };
  }): SessionEvent {
    return this.createEvent('elevenlabs_conversation_started', metadata);
  }

  createLessonStartedEvent(metadata: {
    lessonId: string;
    lessonTitle: string;
    lessonProgress?: string;
    difficulty?: string;
    estimatedDuration?: number;
  }): SessionEvent {
    return this.createEvent('lesson_started', metadata);
  }

  createLessonQAEvent(metadata: {
    parentLessonId: string;
    availableQuestions?: number;
    questionTypes?: string[];
  }): SessionEvent {
    return this.createEvent('lesson_qa_started', metadata);
  }

  createOpenConversationEvent(metadata: {
    conversationContext?: string;
    detectedIntent?: string;
    userMood?: string;
  } = {}): SessionEvent {
    return this.createEvent('open_conversation_started', metadata);
  }
}

// Singleton instance for global use
export const sessionEventService = SessionEventService.getInstance();