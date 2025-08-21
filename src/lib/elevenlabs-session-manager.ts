/**
 * Session Manager for ElevenLabs Webhook Integration
 * Database-backed implementation for production deployment
 */

import { db } from '@/lib/database';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export interface SessionData {
  sessionId: string;
  conversationId?: string;
  therapistId?: string;
  registeredAt: string;
  lastActivity?: string;
  messages?: Array<{
    timestamp: string;
    message: string;
    speaker: 'user' | 'agent';
  }>;
  metadata?: Record<string, any>;
}

export interface SessionMessage {
  timestamp: string;
  message: string;
  speaker: 'user' | 'agent';
}

// Database table for ElevenLabs sessions
const elevenlabsSessions = sqliteTable('elevenlabs_sessions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  conversationId: text('conversation_id'),
  therapistId: text('therapist_id'),
  registeredAt: text('registered_at').notNull(),
  lastActivity: text('last_activity'),
  messages: text('messages'), // JSON string
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Database-backed storage adapter
class DatabaseStorageAdapter {
  constructor() {
    // Initialize table if it doesn't exist
    this.initializeTable();
  }

  private async initializeTable(): Promise<void> {
    try {
      // Create table if it doesn't exist
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS elevenlabs_sessions (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          conversation_id TEXT,
          therapist_id TEXT,
          registered_at TEXT NOT NULL,
          last_activity TEXT,
          messages TEXT,
          metadata TEXT,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
          updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
        )
      `);
    } catch (error) {
      console.error('[DatabaseStorageAdapter] Failed to initialize table:', error);
    }
  }

  async save<T>(key: string, data: T): Promise<void> {
    try {
      const serializedData = JSON.stringify(data);
      const now = new Date().toISOString();
      
      const existing = await db.select()
        .from(elevenlabsSessions)
        .where(eq(elevenlabsSessions.id, key))
        .limit(1);

      if (existing.length > 0) {
        await db.update(elevenlabsSessions)
          .set({ 
            metadata: serializedData,
            updatedAt: now
          })
          .where(eq(elevenlabsSessions.id, key));
      } else {
        await db.insert(elevenlabsSessions).values({
          id: key,
          sessionId: key,
          registeredAt: now,
          lastActivity: now,
          metadata: serializedData,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error(`[DatabaseStorageAdapter] Error saving ${key}:`, error);
      throw error;
    }
  }

  async load<T>(key: string): Promise<T | null> {
    try {
      const result = await db.select()
        .from(elevenlabsSessions)
        .where(eq(elevenlabsSessions.id, key))
        .limit(1);

      if (result.length > 0) {
        const record = result[0];
        if (record.metadata) {
          return JSON.parse(record.metadata);
        }
      }
    } catch (error) {
      console.error(`[DatabaseStorageAdapter] Error loading ${key}:`, error);
    }
    return null;
  }

  async delete(key: string): Promise<void> {
    try {
      await db.delete(elevenlabsSessions)
        .where(eq(elevenlabsSessions.id, key));
    } catch (error) {
      console.error(`[DatabaseStorageAdapter] Error deleting ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await db.select({ id: elevenlabsSessions.id })
        .from(elevenlabsSessions)
        .where(eq(elevenlabsSessions.id, key))
        .limit(1);
      return result.length > 0;
    } catch (error) {
      console.error(`[DatabaseStorageAdapter] Error checking existence of ${key}:`, error);
      return false;
    }
  }
}

export class SessionManager {
  private storage: DatabaseStorageAdapter;
  private sessionRegistry: Map<string, SessionData> = new Map();
  private static instance: SessionManager;

  constructor() {
    this.storage = new DatabaseStorageAdapter();
  }

  // Singleton pattern for consistent session management
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async registerSession(sessionData: SessionData): Promise<void> {
    // Store in memory for quick access
    this.sessionRegistry.set(sessionData.sessionId, sessionData);
    
    // Persist to storage
    await this.storage.save(`sessions/${sessionData.sessionId}`, sessionData);
    
    // Also save as latest for webhook access
    await this.storage.save('registry_latest', sessionData);
    
    console.log(`[SessionManager] Registered session: ${sessionData.sessionId}`);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    // Check memory first
    if (this.sessionRegistry.has(sessionId)) {
      return this.sessionRegistry.get(sessionId)!;
    }
    
    // Fall back to storage
    const session = await this.storage.load<SessionData>(`sessions/${sessionId}`);
    if (session) {
      this.sessionRegistry.set(sessionId, session);
    }
    
    return session;
  }

  async getLatestSession(): Promise<SessionData | null> {
    const session = await this.storage.load<SessionData>('registry_latest');
    console.log('🔍 [SESSION-MANAGER-DEBUG] Latest session:', {
      sessionId: session?.sessionId,
      conversationId: session?.conversationId,
      hasMetadata: !!session?.metadata
    });
    return session;
  }

  // Critical method for webhook to resolve session with retry logic
  async resolveSessionWithRetry(maxRetries: number = 3): Promise<SessionData | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const session = await this.getLatestSession();
        
        if (session) {
          console.log(`[SessionManager] Resolved session on attempt ${attempt}: ${session.sessionId}`);
          return session;
        }
        
        if (attempt < maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms
          const delay = 100 * Math.pow(2, attempt - 1);
          console.log(`[SessionManager] Session not found, retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      } catch (error) {
        console.error(`[SessionManager] Resolution attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    
    console.warn('[SessionManager] Could not resolve session after retries');
    return null;
  }

  async addMessage(sessionId: string, message: SessionMessage): Promise<void> {
    const key = `messages/${sessionId}`;
    const messages = await this.storage.load<SessionMessage[]>(key) || [];
    messages.push(message);
    await this.storage.save(key, messages);
    
    // Update session's last activity
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivity = new Date().toISOString();
      if (!session.messages) {
        session.messages = [];
      }
      session.messages.push(message);
      await this.registerSession(session);
    }
  }

  async getMessages(sessionId: string): Promise<SessionMessage[]> {
    return await this.storage.load<SessionMessage[]>(`messages/${sessionId}`) || [];
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivity = new Date().toISOString();
      await this.registerSession(session);
      console.log(`[SessionManager] Updated activity for session: ${sessionId}`);
    }
  }

  // Map ElevenLabs conversation ID to session ID
  async mapConversationToSession(conversationId: string, sessionId: string): Promise<void> {
    await this.storage.save(`conversation_map/${conversationId}`, sessionId);
    console.log(`[SessionManager] Mapped conversation ${conversationId} to session ${sessionId}`);
  }

  async getSessionByConversationId(conversationId: string): Promise<SessionData | null> {
    const sessionId = await this.storage.load<string>(`conversation_map/${conversationId}`);
    if (sessionId) {
      return await this.getSession(sessionId);
    }
    return null;
  }

  // Cleanup old sessions
  async cleanup(olderThanMinutes: number = 60): Promise<void> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    for (const [sessionId, session] of this.sessionRegistry) {
      const lastActivity = new Date(session.lastActivity || session.registeredAt);
      if (lastActivity < cutoff) {
        this.sessionRegistry.delete(sessionId);
        await this.storage.delete(`sessions/${sessionId}`);
        await this.storage.delete(`messages/${sessionId}`);
        console.log(`[SessionManager] Cleaned up old session: ${sessionId}`);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Debug method to list all sessions
  getAllSessions(): SessionData[] {
    return Array.from(this.sessionRegistry.values());
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();