import { Session, SessionNote, Message } from '@/types';

export class SessionStorage {
  private static readonly STORAGE_KEY = 'nutritionist_sessions';
  private static readonly CURRENT_SESSION_KEY = 'nutritionist_current_session';

  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateNoteId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static createNewSession(title?: string): Session {
    const session: Session = {
      id: this.generateSessionId(),
      title: title || `Session ${new Date().toLocaleDateString()}`,
      messages: [],
      notes: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Session starts empty - no hardcoded greeting
    return session;
  }

  static saveSession(session: Session): void {
    if (typeof window === 'undefined') return;

    try {
      const sessions = this.getAllSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      session.updatedAt = new Date();
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.unshift(session); // Add new sessions at the beginning
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
      localStorage.setItem(this.CURRENT_SESSION_KEY, session.id);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  static getCurrentSession(): Session | null {
    if (typeof window === 'undefined') return null;

    try {
      const currentSessionId = localStorage.getItem(this.CURRENT_SESSION_KEY);
      if (!currentSessionId) return null;

      const sessions = this.getAllSessions();
      const session = sessions.find(s => s.id === currentSessionId);
      
      return session ? this.deserializeSession(session) : null;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  static getAllSessions(): Session[] {
    if (typeof window === 'undefined') return [];

    try {
      const sessionsJson = localStorage.getItem(this.STORAGE_KEY);
      if (!sessionsJson) return [];

      const sessions = JSON.parse(sessionsJson);
      return sessions.map(this.deserializeSession);
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return [];
    }
  }

  static getSession(sessionId: string): Session | null {
    const sessions = this.getAllSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  static deleteSession(sessionId: string): void {
    if (typeof window === 'undefined') return;

    try {
      const sessions = this.getAllSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredSessions));
      
      // If we deleted the current session, clear the current session reference
      const currentSessionId = localStorage.getItem(this.CURRENT_SESSION_KEY);
      if (currentSessionId === sessionId) {
        localStorage.removeItem(this.CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  static addMessage(sessionId: string, message: Message): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.messages.push(message);
    this.saveSession(session);
  }

  static addNote(sessionId: string, note: Omit<SessionNote, 'id' | 'timestamp'>): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    const newNote: SessionNote = {
      ...note,
      id: this.generateNoteId(),
      timestamp: new Date()
    };

    session.notes.push(newNote);
    this.saveSession(session);
  }

  static updateNote(sessionId: string, noteId: string, content: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    const note = session.notes.find(n => n.id === noteId);
    if (note) {
      note.content = content;
      note.timestamp = new Date();
      this.saveSession(session);
    }
  }

  static deleteNote(sessionId: string, noteId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.notes = session.notes.filter(n => n.id !== noteId);
    this.saveSession(session);
  }

  static updateSessionSummary(sessionId: string, summary: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.summary = summary;
    this.saveSession(session);
  }

  static exportSession(sessionId: string): string {
    const session = this.getSession(sessionId);
    if (!session) return '';

    const content = [
      `Retirement Planning Session: ${session.title}`,
      `Date: ${session.createdAt.toLocaleDateString()}`,
      `Duration: ${session.createdAt.toLocaleTimeString()} - ${session.updatedAt.toLocaleTimeString()}`,
      '',
      '=== SESSION SUMMARY ===',
      session.summary || 'No summary available',
      '',
      '=== CONVERSATION ===',
      ...session.messages.map(msg => 
        `${msg.type === 'user' ? 'You' : 'Sanjay'} (${msg.timestamp.toLocaleTimeString()}): ${msg.content}`
      ),
      '',
      '=== SESSION NOTES ===',
      ...session.notes.map(note => 
        `[${note.type.toUpperCase()}] ${note.content} (${note.timestamp.toLocaleTimeString()})`
      )
    ].join('\n');

    return content;
  }

  private static deserializeSession(sessionData: Session): Session {
    return {
      ...sessionData,
      createdAt: new Date(sessionData.createdAt),
      updatedAt: new Date(sessionData.updatedAt),
      messages: sessionData.messages.map((msg: Message) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })),
      notes: sessionData.notes.map((note: SessionNote) => ({
        ...note,
        timestamp: new Date(note.timestamp)
      }))
    };
  }
}