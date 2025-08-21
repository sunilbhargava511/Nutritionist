import { Session, SessionNote, Message } from '@/types';

export interface SessionMetrics {
  totalMessages: number;
  averageResponseTime: number;
  notesGenerated: number;
  sessionsThisWeek: number;
  lastSessionDate: Date | null;
}

export class EnhancedSessionStorage {
  private static readonly STORAGE_KEY = 'nutritionist_sessions';
  private static readonly CURRENT_SESSION_KEY = 'nutritionist_current_session';
  private static readonly METRICS_KEY = 'nutritionist_metrics';
  private static readonly ELEVENLABS_SESSION_MAP_KEY = 'elevenlabs_session_mapping';
  
  // ElevenLabs conversation ID to session ID mapping
  static mapElevenLabsConversation(elevenLabsId: string, sessionId: string): void {
    const mapping = this.getElevenLabsMapping();
    mapping[elevenLabsId] = sessionId;
    localStorage.setItem(this.ELEVENLABS_SESSION_MAP_KEY, JSON.stringify(mapping));
  }

  static getSessionByElevenLabsId(elevenLabsId: string): Session | null {
    const mapping = this.getElevenLabsMapping();
    const sessionId = mapping[elevenLabsId];
    return sessionId ? this.getSession(sessionId) : null;
  }

  private static getElevenLabsMapping(): Record<string, string> {
    try {
      const mapping = localStorage.getItem(this.ELEVENLABS_SESSION_MAP_KEY);
      return mapping ? JSON.parse(mapping) : {};
    } catch {
      return {};
    }
  }

  // Lesson State Management
  static setLessonState(sessionId: string, lessonId: string, phase: 'start_message' | 'video' | 'conversation' | 'completed', conversationId?: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.currentLessonId = lessonId;
    session.lessonPhase = phase;
    if (conversationId) {
      session.lessonConversationId = conversationId;
      // Also map the ElevenLabs conversation to this session
      this.mapElevenLabsConversation(conversationId, sessionId);
    }
    
    this.saveSession(session);
  }

  static getCurrentLessonState(sessionId: string): { lessonId: string; phase: string; conversationId?: string } | null {
    const session = this.getSession(sessionId);
    if (!session || !session.currentLessonId) return null;

    return {
      lessonId: session.currentLessonId,
      phase: session.lessonPhase || 'start_message',
      conversationId: session.lessonConversationId
    };
  }

  static clearLessonState(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.currentLessonId = undefined;
    session.lessonPhase = undefined;
    session.lessonConversationId = undefined;
    
    this.saveSession(session);
  }

  // Check if any session is currently in a lesson with given conversation ID
  static getLessonStateByConversationId(conversationId: string): { sessionId: string; lessonId: string; phase: string } | null {
    const sessionId = this.getElevenLabsMapping()[conversationId];
    if (!sessionId) return null;

    const session = this.getSession(sessionId);
    if (!session || !session.currentLessonId || session.lessonConversationId !== conversationId) {
      return null;
    }

    return {
      sessionId,
      lessonId: session.currentLessonId,
      phase: session.lessonPhase || 'conversation'
    };
  }

  // Session Management
  static createNewSession(title?: string): Session {
    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || `Session ${new Date().toLocaleDateString()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      notes: [],
      isActive: true
    };
    
    this.saveSession(session);
    this.setCurrentSession(session.id);
    this.updateMetrics();
    
    return session;
  }

  static saveSession(session: Session): void {
    session.updatedAt = new Date();
    const sessions = this.getAllSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    
    // Keep only last 50 sessions to avoid storage bloat
    const sortedSessions = sessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const limitedSessions = sortedSessions.slice(0, 50);
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limitedSessions, this.dateReplacer));
    } catch (error) {
      console.error('Failed to save session:', error);
      // If storage is full, remove oldest sessions and try again
      const reducedSessions = limitedSessions.slice(0, 25);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reducedSessions, this.dateReplacer));
    }
  }

  static getSession(sessionId: string): Session | null {
    const sessions = this.getAllSessions();
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) return null;
    
    // Ensure date objects are properly converted
    return {
      ...session,
      createdAt: session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt),
      updatedAt: session.updatedAt instanceof Date ? session.updatedAt : new Date(session.updatedAt),
      messages: session.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
      })),
      notes: session.notes.map(note => ({
        ...note,
        timestamp: note.timestamp instanceof Date ? note.timestamp : new Date(note.timestamp)
      }))
    };
  }

  static getAllSessions(): Session[] {
    try {
      const sessionsData = localStorage.getItem(this.STORAGE_KEY);
      if (!sessionsData) return [];
      
      const sessions = JSON.parse(sessionsData, this.dateReviver);
      if (!Array.isArray(sessions)) return [];
      
      // Ensure all date fields are properly converted to Date objects
      return sessions.map(session => ({
        ...session,
        createdAt: session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt),
        updatedAt: session.updatedAt instanceof Date ? session.updatedAt : new Date(session.updatedAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
        })),
        notes: session.notes.map((note: any) => ({
          ...note,
          timestamp: note.timestamp instanceof Date ? note.timestamp : new Date(note.timestamp)
        }))
      }));
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  static getCurrentSession(): Session | null {
    const currentSessionId = localStorage.getItem(this.CURRENT_SESSION_KEY);
    if (!currentSessionId) return null;
    
    return this.getSession(currentSessionId);
  }

  static setCurrentSession(sessionId: string): void {
    localStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
  }

  // Message Management
  static addMessage(sessionId: string, message: Message): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    session.messages.push(message);
    this.saveSession(session);
  }

  // Note Management
  static addNote(sessionId: string, noteData: Omit<SessionNote, 'id' | 'timestamp' | 'autoGenerated'>): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    const note: SessionNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      autoGenerated: false,
      priority: 'medium',
      ...noteData
    };
    
    session.notes.push(note);
    this.saveSession(session);
  }

  // Metrics Management
  static updateMetrics(): void {
    const sessions = this.getAllSessions();
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    
    const metrics: SessionMetrics = {
      totalMessages: sessions.reduce((total, session) => total + session.messages.length, 0),
      averageResponseTime: this.calculateAverageResponseTime(sessions),
      notesGenerated: sessions.reduce((total, session) => total + session.notes.length, 0),
      sessionsThisWeek: sessions.filter(session => 
        new Date(session.createdAt) >= weekStart
      ).length,
      lastSessionDate: sessions.length > 0 
        ? new Date(Math.max(...sessions.map(s => new Date(s.updatedAt).getTime())))
        : null
    };
    
    localStorage.setItem(this.METRICS_KEY, JSON.stringify(metrics, this.dateReplacer));
  }

  static getMetrics(): SessionMetrics {
    try {
      const metricsData = localStorage.getItem(this.METRICS_KEY);
      if (!metricsData) {
        this.updateMetrics();
        return this.getMetrics();
      }
      
      return JSON.parse(metricsData, this.dateReviver);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      return {
        totalMessages: 0,
        averageResponseTime: 0,
        notesGenerated: 0,
        sessionsThisWeek: 0,
        lastSessionDate: null
      };
    }
  }

  private static calculateAverageResponseTime(sessions: Session[]): number {
    let totalTime = 0;
    let pairs = 0;
    
    sessions.forEach(session => {
      for (let i = 1; i < session.messages.length; i++) {
        const current = session.messages[i];
        const previous = session.messages[i - 1];
        
        if (current.sender !== previous.sender) {
          const timeDiff = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
          totalTime += timeDiff;
          pairs++;
        }
      }
    });
    
    return pairs > 0 ? totalTime / pairs : 0;
  }

  // Utility functions for JSON serialization with Date objects
  private static dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  private static dateReviver(key: string, value: any): any {
    if (typeof value === 'object' && value !== null && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }

  // Cleanup and maintenance
  static clearAllSessions(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.CURRENT_SESSION_KEY);
    localStorage.removeItem(this.METRICS_KEY);
    localStorage.removeItem(this.ELEVENLABS_SESSION_MAP_KEY);
  }

  // Debug and maintenance helpers
  static debugSession(sessionId?: string): void {
    console.group('🔍 Session Debug Info');
    
    if (sessionId) {
      const session = this.getSession(sessionId);
      console.log(`Session ${sessionId}:`, session);
      if (session) {
        console.log(`Messages: ${session.messages.length}`);
        console.log(`Notes: ${session.notes.length}`);
        console.log(`Active: ${session.isActive}`);
        console.log(`Created: ${session.createdAt}`);
        console.log(`Updated: ${session.updatedAt}`);
      }
    } else {
      console.log('All Sessions:', this.getAllSessions());
      console.log('Current Session:', this.getCurrentSession());
      console.log('ElevenLabs Mapping:', this.getElevenLabsMapping());
      console.log('Metrics:', this.getMetrics());
    }
    
    console.groupEnd();
  }

  static repairSessions(): number {
    console.log('🔧 Repairing session data...');
    
    try {
      const sessions = this.getAllSessions();
      let repairedCount = 0;
      
      const repairedSessions = sessions.map(session => {
        let needsRepair = false;
        
        // Ensure proper date objects
        if (!(session.createdAt instanceof Date)) {
          session.createdAt = new Date(session.createdAt);
          needsRepair = true;
        }
        
        if (!(session.updatedAt instanceof Date)) {
          session.updatedAt = new Date(session.updatedAt);
          needsRepair = true;
        }
        
        // Repair messages
        session.messages = session.messages.map(msg => {
          if (!(msg.timestamp instanceof Date)) {
            msg.timestamp = new Date(msg.timestamp);
            needsRepair = true;
          }
          return msg;
        });
        
        // Repair notes
        session.notes = session.notes.map(note => {
          if (!(note.timestamp instanceof Date)) {
            note.timestamp = new Date(note.timestamp);
            needsRepair = true;
          }
          return note;
        });
        
        if (needsRepair) {
          repairedCount++;
        }
        
        return session;
      });
      
      if (repairedCount > 0) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(repairedSessions, this.dateReplacer));
        console.log(`✅ Repaired ${repairedCount} sessions`);
      } else {
        console.log('✅ No repairs needed');
      }
      
      return repairedCount;
    } catch (error) {
      console.error('❌ Session repair failed:', error);
      return 0;
    }
  }
}

export const SessionStorage = EnhancedSessionStorage;