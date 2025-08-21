import { Message, Article } from '@/types';

export interface LLMDebugEntry {
  id: string;
  timestamp: Date;
  sessionId: string;
  type: 'claude' | 'knowledge-search' | 'rag';
  request: {
    systemPrompt: string;
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    model: string;
    knowledgeContext?: string;
    otherParameters?: Record<string, any>;
  };
  response: {
    content: string;
    usage?: { tokens: number };
    citedArticles?: Article[];
    processingTime: number;
  };
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export interface DebugSession {
  id: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  entries: LLMDebugEntry[];
  totalRequests: number;
}

export class DebugSessionManager {
  private static instance: DebugSessionManager;
  private sessions: DebugSession[] = [];
  private currentSessionId: string | null = null;
  private readonly maxSessions = 10;
  private readonly storageKey = 'debug_llm_sessions';

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): DebugSessionManager {
    if (!DebugSessionManager.instance) {
      DebugSessionManager.instance = new DebugSessionManager();
    }
    return DebugSessionManager.instance;
  }

  // Create a new debug session
  createNewSession(title?: string): DebugSession {
    const sessionId = `debug_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const defaultTitle = title || `Session ${new Date().toLocaleTimeString()}`;
    
    const newSession: DebugSession = {
      id: sessionId,
      title: defaultTitle,
      startTime: new Date(),
      entries: [],
      totalRequests: 0
    };

    // End current session if exists
    if (this.currentSessionId) {
      const currentSession = this.sessions.find(s => s.id === this.currentSessionId);
      if (currentSession && !currentSession.endTime) {
        currentSession.endTime = new Date();
      }
    }

    // Add new session at the beginning
    this.sessions.unshift(newSession);
    this.currentSessionId = sessionId;

    // Cleanup old sessions
    this.cleanupOldSessions();
    this.saveToStorage();

    console.log(`[Debug] Created new session: ${defaultTitle}`);
    return newSession;
  }

  // Get current active session
  getCurrentSession(): DebugSession | null {
    if (!this.currentSessionId) {
      // Auto-create a session if none exists
      return this.createNewSession();
    }
    
    return this.sessions.find(s => s.id === this.currentSessionId) || null;
  }

  // Get all sessions (most recent first)
  getAllSessions(): DebugSession[] {
    return [...this.sessions];
  }

  // Switch to a specific session
  switchToSession(sessionId: string): DebugSession | null {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      // End current session
      if (this.currentSessionId && this.currentSessionId !== sessionId) {
        const currentSession = this.sessions.find(s => s.id === this.currentSessionId);
        if (currentSession && !currentSession.endTime) {
          currentSession.endTime = new Date();
        }
      }
      
      this.currentSessionId = sessionId;
      this.saveToStorage();
      console.log(`[Debug] Switched to session: ${session.title}`);
      return session;
    }
    return null;
  }

  // Add debug entry to current session
  addEntryToCurrentSession(entry: LLMDebugEntry): void {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      console.warn('[Debug] No current session to add entry to');
      return;
    }

    // Set session ID
    entry.sessionId = currentSession.id;
    
    // Add entry to session
    currentSession.entries.push(entry);
    currentSession.totalRequests++;
    
    // Update session title if it's the first meaningful interaction
    if (currentSession.entries.length === 1 && entry.request.messages.length > 0) {
      const firstUserMessage = entry.request.messages.find(m => m.sender === 'user');
      if (firstUserMessage) {
        const preview = firstUserMessage.content.substring(0, 50);
        currentSession.title = preview.length < firstUserMessage.content.length 
          ? `${preview}...` 
          : preview;
      }
    }

    this.saveToStorage();
    console.log(`[Debug] Added entry to session ${currentSession.title}: ${entry.type}`);
  }

  // Get entries for a specific session
  getSessionEntries(sessionId: string): LLMDebugEntry[] {
    const session = this.sessions.find(s => s.id === sessionId);
    return session ? [...session.entries] : [];
  }

  // Clear all sessions
  clearAllSessions(): void {
    this.sessions = [];
    this.currentSessionId = null;
    this.saveToStorage();
    console.log('[Debug] Cleared all sessions');
  }

  // Clear specific session
  clearSession(sessionId: string): void {
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = this.sessions.length > 0 ? this.sessions[0].id : null;
    }
    this.saveToStorage();
    console.log(`[Debug] Cleared session: ${sessionId}`);
  }

  // Export session data
  exportSession(sessionId: string): string {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const exportData = {
      session: {
        id: session.id,
        title: session.title,
        startTime: session.startTime,
        endTime: session.endTime,
        totalRequests: session.totalRequests
      },
      entries: session.entries,
      exportedAt: new Date()
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Get session statistics
  getSessionStats(sessionId: string): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgProcessingTime: number;
    totalTokens: number;
  } {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgProcessingTime: 0,
        totalTokens: 0
      };
    }

    const successfulEntries = session.entries.filter(e => e.status === 'success');
    const failedEntries = session.entries.filter(e => e.status === 'error');
    
    const avgProcessingTime = successfulEntries.length > 0
      ? successfulEntries.reduce((sum, entry) => sum + entry.response.processingTime, 0) / successfulEntries.length
      : 0;

    const totalTokens = successfulEntries.reduce((sum, entry) => 
      sum + (entry.response.usage?.tokens || 0), 0
    );

    return {
      totalRequests: session.entries.length,
      successfulRequests: successfulEntries.length,
      failedRequests: failedEntries.length,
      avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      totalTokens
    };
  }

  // Private methods
  private cleanupOldSessions(): void {
    if (this.sessions.length > this.maxSessions) {
      const sessionsToRemove = this.sessions.splice(this.maxSessions);
      console.log(`[Debug] Removed ${sessionsToRemove.length} old sessions`);
    }
  }

  private saveToStorage(): void {
    // Only access localStorage in browser environment
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      const data = {
        sessions: this.sessions,
        currentSessionId: this.currentSessionId
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data, this.dateReplacer));
    } catch (error) {
      console.error('[Debug] Failed to save sessions to storage:', error);
    }
  }

  private loadFromStorage(): void {
    // Only access localStorage in browser environment
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data, this.dateReviver);
        
        // Ensure all sessions have proper Date objects
        this.sessions = (parsed.sessions || []).map((session: any) => ({
          ...session,
          startTime: typeof session.startTime === 'string' ? new Date(session.startTime) : session.startTime,
          endTime: session.endTime ? (typeof session.endTime === 'string' ? new Date(session.endTime) : session.endTime) : undefined,
          entries: (session.entries || []).map((entry: any) => ({
            ...entry,
            timestamp: typeof entry.timestamp === 'string' ? new Date(entry.timestamp) : entry.timestamp
          }))
        }));
        
        this.currentSessionId = parsed.currentSessionId || null;
        console.log(`[Debug] Loaded ${this.sessions.length} sessions from storage`);
      }
    } catch (error) {
      console.error('[Debug] Failed to load sessions from storage:', error);
      this.sessions = [];
      this.currentSessionId = null;
    }
  }

  // JSON serialization helpers for Date objects
  private dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  private dateReviver(key: string, value: any): any {
    if (typeof value === 'object' && value !== null && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }
}

// Singleton instance
export const debugSessionManager = DebugSessionManager.getInstance();