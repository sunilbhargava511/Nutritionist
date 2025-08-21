import { db } from './database';
import * as schema from './database/schema';
import { eq, and, asc } from 'drizzle-orm';
import { 
  Conversation,
  EducationalSession, // Keep for backward compatibility
  AdminSettings,
  SystemPrompt,
  ConversationState,
  EducationalSessionState // Keep for backward compatibility
} from '@/types';

export class EducationalSessionService {
  
  // Helper: Get admin defaults for new sessions
  async getAdminDefaults(): Promise<{personalizationEnabled: boolean, conversationAware: boolean}> {
    const adminSettings = await this.getAdminSettings();
    return {
      personalizationEnabled: adminSettings?.personalizationEnabled || false,
      conversationAware: adminSettings?.conversationAware !== false // Default to true if not set
    };
  }

  // Session Management
  async createNewSession(
    personalizationEnabled?: boolean, 
    customSessionId?: string,
    conversationType: 'structured' | 'open-ended' = 'structured',
    conversationAware?: boolean,
    conversationId?: string
  ): Promise<EducationalSession> {
    const sessionId = customSessionId || conversationId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get admin defaults if not explicitly provided
    const defaults = await this.getAdminDefaults();
    const finalPersonalizationEnabled = personalizationEnabled !== undefined ? personalizationEnabled : defaults.personalizationEnabled;
    const finalConversationAware = conversationAware !== undefined ? conversationAware : defaults.conversationAware;
    
    const newSession = await db.insert(schema.conversations).values({
      id: sessionId,
      conversationId: conversationId || sessionId, // Store ElevenLabs conversation_id
      conversationType,
      completed: false,
      personalizationEnabled: finalPersonalizationEnabled,
      conversationAware: finalConversationAware,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return this.convertDatabaseSession(newSession[0]);
  }

  async getSession(sessionId: string): Promise<EducationalSession | null> {
    const sessions = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, sessionId))
      .limit(1);

    if (sessions.length === 0) return null;
    return this.convertDatabaseSession(sessions[0]);
  }

  async updateSession(sessionId: string, updates: Partial<EducationalSession>): Promise<void> {
    // Convert Date objects to strings for database storage
    const dbUpdates: any = { ...updates };
    if (dbUpdates.createdAt instanceof Date) {
      dbUpdates.createdAt = dbUpdates.createdAt.toISOString();
    }
    if (dbUpdates.updatedAt instanceof Date) {
      dbUpdates.updatedAt = dbUpdates.updatedAt.toISOString();
    }
    
    await db
      .update(schema.conversations)
      .set({
        ...dbUpdates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.conversations.id, sessionId));
  }

  // Content Chunk Management (legacy - disabled)
  async getAllActiveChunks(): Promise<any[]> {
    // Legacy chunk system - return empty array
    return [];
  }

  async getChunkByIndex(index: number): Promise<any | null> {
    // Legacy chunk system - return null
    return null;
  }

  async getCurrentChunk(sessionId: string): Promise<any | null> {
    // Legacy chunk system - return null
    return null;
  }

  async getNextChunk(sessionId: string): Promise<any | null> {
    // Legacy chunk system - return null
    return null;
  }

  async advanceToNextChunk(sessionId: string): Promise<boolean> {
    // Legacy chunk system - return false
    return false;
  }

  // Legacy chunk methods - disabled
  async markChunkAsDelivered(sessionId: string, chunkIndex: number): Promise<void> {
    // Legacy chunk system - disabled
    return;
  }

  async markChunkAsSent(sessionId: string, chunkIndex: number): Promise<void> {
    // Legacy chunk system - disabled
    return;
  }

  // Response Management (legacy - disabled)
  async saveChunkResponse(
    sessionId: string,
    chunkId: string,
    userResponse: string,
    aiResponse: string
  ): Promise<void> {
    // Legacy chunk response system - disabled
    return;
  }

  async getSessionResponses(sessionId: string): Promise<any[]> {
    const responses = await db
      .select()
      .from(schema.sessionProgress)
      .where(eq(schema.sessionProgress.sessionId, sessionId));

    return responses.map(this.convertDatabaseResponse);
  }

  // System Configuration
  async getAdminSettings(): Promise<AdminSettings | null> {
    const settings = await db
      .select()
      .from(schema.adminSettings)
      .limit(1);

    if (settings.length === 0) return null;
    return this.convertDatabaseSettings(settings[0]);
  }

  async getSystemPrompt(type: 'content' | 'qa' | 'report'): Promise<SystemPrompt | null> {
    const prompts = await db
      .select()
      .from(schema.systemPrompts)
      .where(and(
        eq(schema.systemPrompts.type, type),
        eq(schema.systemPrompts.active, true)
      ))
      .limit(1);

    if (prompts.length === 0) return null;
    return this.convertDatabasePrompt(prompts[0]);
  }

  // Session State Management
  async getSessionState(sessionId: string): Promise<EducationalSessionState | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    // Chunk functionality removed

    return {
      conversation: session, // ConversationState property
      session, // EducationalSessionState property (alias)
      isPersonalizationEnabled: session.personalizationEnabled,
    };
  }

  // Enhanced Content Processing with Conversation Aware Lead-ins
  async processChunkContent(
    sessionId: string,
    chunkContent: string,
    personalizationEnabled: boolean
  ): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return chunkContent;
    }

    // Check if conversation awareness is enabled (either for session or admin default)
    const adminSettings = await this.getAdminSettings();
    const isConversationAware = session.conversationAware !== undefined 
      ? session.conversationAware 
      : (adminSettings?.conversationAware !== false);

    // If conversation awareness is disabled, return content as-is
    if (!isConversationAware) {
      return chunkContent;
    }

    // Get conversation history to generate smooth lead-in
    const responses = await this.getSessionResponses(sessionId);
    
    if (responses.length === 0) {
      return chunkContent; // First chunk, no history yet
    }

    // Generate smooth lead-in using conversation history
    try {
      const leadIn = await this.generateConversationAwareLeadIn(responses, chunkContent);
      if (leadIn) {
        return `${leadIn}\n\n${chunkContent}`;
      }
    } catch (error) {
      console.error('Failed to generate conversation-aware lead-in:', error);
      // Fall back to original content if lead-in generation fails
    }

    return chunkContent;
  }

  // Generate a smooth lead-in based on conversation history
  private async generateConversationAwareLeadIn(
    responses: any[],
    upcomingChunkContent: string
  ): Promise<string | null> {
    if (responses.length === 0) return null;

    // Get the most recent conversation exchange
    const recentResponse = responses[responses.length - 1];
    
    // Create a prompt for generating smooth transitions
    const leadInPrompt = `You are an AI financial advisor creating smooth transitions between educational content topics.

CONTEXT:
Recent conversation:
User: "${recentResponse.userResponse}"
Assistant: "${recentResponse.aiResponse}"

TASK:
Generate a brief 1-2 sentence transition that:
1. Acknowledges the previous conversation naturally
2. Smoothly introduces the upcoming topic
3. Maintains conversational flow
4. Keeps the transition concise and natural

UPCOMING CONTENT PREVIEW:
"${upcomingChunkContent.substring(0, 200)}..."

IMPORTANT:
- Write ONLY the transition sentences (no explanations)
- Keep it conversational and warm
- Don't repeat content from the upcoming chunk
- Make it feel like a natural conversation flow

Transition:`;

    try {
      // Import Claude service dynamically to avoid circular imports
      const { getClaudeService } = await import('./claude');
      const claudeService = getClaudeService();
      
      const leadIn = await claudeService.sendMessage([{
        role: 'user',
        content: leadInPrompt
      }]);

      // Clean up the response (remove any extra formatting)
      return leadIn.trim().replace(/^(Transition:|Here's a transition:)\s*/i, '');
      
    } catch (error) {
      console.error('Error generating lead-in with Claude:', error);
      return null;
    }
  }

  // Utility Methods
  private convertDatabaseSession(dbSession: any): EducationalSession {
    return {
      id: dbSession.id,
      conversationId: dbSession.conversationId,
      conversationType: dbSession.conversationType || 'structured',
      userId: dbSession.userId,
      completed: Boolean(dbSession.completed),
      personalizationEnabled: Boolean(dbSession.personalizationEnabled),
      conversationAware: dbSession.conversationAware !== null ? Boolean(dbSession.conversationAware) : undefined,
      createdAt: new Date(dbSession.createdAt),
      updatedAt: new Date(dbSession.updatedAt),
    };
  }

  private convertDatabaseChunk(dbChunk: any): any {
    // Legacy chunk system - return empty object
    return {};
  }

  private convertDatabaseResponse(dbResponse: any): any {
    return {
      id: dbResponse.id,
      sessionId: dbResponse.sessionId,
      chunkId: dbResponse.chunkId,
      userResponse: dbResponse.userResponse,
      aiResponse: dbResponse.aiResponse,
      timestamp: new Date(dbResponse.timestamp),
    };
  }

  private convertDatabaseSettings(dbSettings: any): AdminSettings {
    return {
      id: dbSettings.id,
      voiceId: dbSettings.voiceId,
      voiceDescription: dbSettings.voiceDescription,
      personalizationEnabled: Boolean(dbSettings.personalizationEnabled),
      conversationAware: Boolean(dbSettings.conversationAware),
      useStructuredConversation: Boolean(dbSettings.useStructuredConversation),
      debugLlmEnabled: Boolean(dbSettings.debugLlmEnabled),
      baseReportPath: dbSettings.baseReportPath,
      baseReportTemplate: dbSettings.baseReportTemplate,
      updatedAt: new Date(dbSettings.updatedAt),
    };
  }

  private convertDatabasePrompt(dbPrompt: any): SystemPrompt {
    return {
      id: dbPrompt.id,
      type: dbPrompt.type,
      content: dbPrompt.content,
      active: Boolean(dbPrompt.active),
      createdAt: new Date(dbPrompt.createdAt),
      updatedAt: new Date(dbPrompt.updatedAt),
    };
  }

  private determineDeliveryState(
    session: EducationalSession,
    responses: any[]
  ): any {
    if (session.completed) return 'completed';
    
    // Legacy chunk system - return processing state
    return 'processing';

    return 'loading'; // Default state for next chunk
  }

  // Session Completion
  async completeSession(sessionId: string): Promise<void> {
    await this.updateSession(sessionId, { 
      completed: true,
      updatedAt: new Date()
    });
  }

  async isSessionCompleted(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    // Legacy chunk system - just check completed status
    return session.completed;
  }

  // Voice Integration Helper
  async getVoiceSettings(): Promise<{ voiceId: string; description: string } | null> {
    const settings = await this.getAdminSettings();
    if (!settings) return null;

    return {
      voiceId: settings.voiceId,
      description: settings.voiceDescription,
    };
  }
}

// Export singleton instance
export const educationalSessionService = new EducationalSessionService();