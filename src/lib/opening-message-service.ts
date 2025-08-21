import { db } from './database';
import * as schema from './database/schema';
import { eq, and } from 'drizzle-orm';
import { audioCacheService, AudioGenerationOptions } from './audio-cache-service';

export interface VoiceSettings {
  voiceId: string;
  speed?: number;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface CreateOpeningMessageData {
  type: 'general_opening' | 'lesson_intro';
  lessonId?: string;
  messageContent: string;
  voiceSettings?: VoiceSettings;
  generateAudio?: boolean; // Whether to auto-generate audio
}

export interface OpeningMessageWithAudio extends schema.OpeningMessage {
  cachedAudioUrl?: string | null;
  needsAudioRegeneration?: boolean;
}

export class OpeningMessageService {
  // Get general opening message with audio cache
  async getGeneralOpeningMessage(): Promise<OpeningMessageWithAudio | null> {
    const messages = await db.select()
      .from(schema.openingMessages)
      .where(
        and(
          eq(schema.openingMessages.type, 'general_opening'),
          eq(schema.openingMessages.active, true)
        )
      )
      .limit(1);
    
    if (messages.length === 0) return null;
    
    const message = messages[0];
    return this.enrichWithAudioCache(message);
  }

  // Get lesson intro message with audio cache
  async getLessonIntroMessage(lessonId: string): Promise<OpeningMessageWithAudio | null> {
    const messages = await db.select()
      .from(schema.openingMessages)
      .where(
        and(
          eq(schema.openingMessages.type, 'lesson_intro'),
          eq(schema.openingMessages.lessonId, lessonId),
          eq(schema.openingMessages.active, true)
        )
      )
      .limit(1);
    
    if (messages.length === 0) return null;
    
    const message = messages[0];
    return this.enrichWithAudioCache(message);
  }

  // Create or update general opening message with audio generation
  async setGeneralOpeningMessage(
    messageContent: string, 
    voiceSettings?: VoiceSettings, 
    generateAudio: boolean = true
  ): Promise<OpeningMessageWithAudio> {
    // First, deactivate existing general opening messages
    await db.update(schema.openingMessages)
      .set({ active: false })
      .where(eq(schema.openingMessages.type, 'general_opening'));

    // Create new general opening message
    const messageId = `opening_general_${Date.now()}`;
    
    const newMessage: schema.NewOpeningMessage = {
      id: messageId,
      type: 'general_opening',
      messageContent,
      voiceSettings: voiceSettings ? JSON.stringify(voiceSettings) : null,
      active: true
    };

    await db.insert(schema.openingMessages).values(newMessage);
    
    // Generate audio if requested
    if (generateAudio) {
      try {
        await audioCacheService.generateAndCacheAudio(
          messageId,
          messageContent,
          voiceSettings
        );
      } catch (error) {
        console.error('[OpeningMessage] Failed to generate audio for general message:', error);
        // Don't fail the entire operation if audio generation fails
      }
    }
    
    const created = await db.select()
      .from(schema.openingMessages)
      .where(eq(schema.openingMessages.id, messageId))
      .limit(1);
    
    if (created.length === 0) {
      throw new Error('Failed to create general opening message');
    }
    
    return this.enrichWithAudioCache(created[0]);
  }

  // Create or update lesson intro message with audio generation
  async setLessonIntroMessage(
    lessonId: string, 
    messageContent: string, 
    voiceSettings?: VoiceSettings,
    generateAudio: boolean = true
  ): Promise<OpeningMessageWithAudio> {
    // First, deactivate existing lesson intro messages for this lesson
    await db.update(schema.openingMessages)
      .set({ active: false })
      .where(
        and(
          eq(schema.openingMessages.type, 'lesson_intro'),
          eq(schema.openingMessages.lessonId, lessonId)
        )
      );

    // Create new lesson intro message
    const messageId = `opening_lesson_${lessonId}_${Date.now()}`;
    
    const newMessage: schema.NewOpeningMessage = {
      id: messageId,
      type: 'lesson_intro',
      lessonId,
      messageContent,
      voiceSettings: voiceSettings ? JSON.stringify(voiceSettings) : null,
      active: true
    };

    await db.insert(schema.openingMessages).values(newMessage);
    
    // Generate audio if requested
    if (generateAudio) {
      try {
        await audioCacheService.generateAndCacheAudio(
          messageId,
          messageContent,
          voiceSettings
        );
      } catch (error) {
        console.error(`[OpeningMessage] Failed to generate audio for lesson ${lessonId}:`, error);
        // Don't fail the entire operation if audio generation fails
      }
    }
    
    const created = await db.select()
      .from(schema.openingMessages)
      .where(eq(schema.openingMessages.id, messageId))
      .limit(1);
    
    if (created.length === 0) {
      throw new Error('Failed to create lesson intro message');
    }
    
    return this.enrichWithAudioCache(created[0]);
  }

  // Get all lesson intro messages
  async getAllLessonIntroMessages(): Promise<schema.OpeningMessage[]> {
    return await db.select()
      .from(schema.openingMessages)
      .where(
        and(
          eq(schema.openingMessages.type, 'lesson_intro'),
          eq(schema.openingMessages.active, true)
        )
      );
  }

  // Delete opening message
  async deleteOpeningMessage(messageId: string): Promise<void> {
    await db.delete(schema.openingMessages)
      .where(eq(schema.openingMessages.id, messageId));
  }

  // Parse voice settings
  parseVoiceSettings(voiceSettingsJson: string | null): VoiceSettings | null {
    if (!voiceSettingsJson) return null;
    
    try {
      return JSON.parse(voiceSettingsJson);
    } catch (error) {
      console.error('Failed to parse voice settings:', error);
      return null;
    }
  }

  // Get default voice settings
  getDefaultVoiceSettings(): VoiceSettings {
    return {
      voiceId: 'MXGyTMlsvQgQ4BL0emIa', // Professional male voice
      speed: 0.85,
      stability: 0.6,
      similarityBoost: 0.8,
      style: 0.4,
      useSpeakerBoost: true
    };
  }

  // Initialize default messages if they don't exist
  async initializeDefaultMessages(): Promise<void> {
    // Check if general opening message exists
    const generalMessage = await this.getGeneralOpeningMessage();
    if (!generalMessage) {
      await this.setGeneralOpeningMessage(
        "Hello! I'm Sanjay, your AI financial advisor. I'm here to help you build a healthier relationship with money and work toward your financial goals. What would you like to talk about today?",
        this.getDefaultVoiceSettings()
      );
    }

    // For lesson intro messages, we'll create them when lessons are created
    // This is handled in the lesson service or admin panel
  }

  // Update opening message content only
  async updateMessageContent(messageId: string, messageContent: string): Promise<void> {
    await db.update(schema.openingMessages)
      .set({ 
        messageContent,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.openingMessages.id, messageId));
  }

  // Update voice settings only
  async updateVoiceSettings(messageId: string, voiceSettings: VoiceSettings): Promise<void> {
    await db.update(schema.openingMessages)
      .set({ 
        voiceSettings: JSON.stringify(voiceSettings),
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.openingMessages.id, messageId));
  }

  // Audio cache management methods

  // Enrich message with audio cache information
  private async enrichWithAudioCache(message: schema.OpeningMessage): Promise<OpeningMessageWithAudio> {
    const cachedAudio = await audioCacheService.getCachedAudio(message.id);
    
    let cachedAudioUrl: string | null = null;
    if (cachedAudio?.audioBlob) {
      // Use API endpoint to serve cached audio instead of data URL
      cachedAudioUrl = `/api/cached-audio/${message.id}`;
    }
    
    return {
      ...message,
      cachedAudioUrl,
      needsAudioRegeneration: cachedAudio?.needsRegeneration ?? true
    };
  }

  // Force regenerate audio for a message
  async regenerateAudio(messageId: string): Promise<void> {
    const message = await db.select()
      .from(schema.openingMessages)
      .where(eq(schema.openingMessages.id, messageId))
      .limit(1);
    
    if (message.length === 0) {
      throw new Error('Message not found');
    }
    
    const msg = message[0];
    const voiceSettings = msg.voiceSettings ? JSON.parse(msg.voiceSettings) : null;
    
    await audioCacheService.generateAndCacheAudio(
      messageId,
      msg.messageContent,
      voiceSettings
    );
  }

  // Get audio cache statistics
  async getAudioCacheStats(): Promise<{
    totalMessages: number;
    cachedMessages: number;
    cacheHitRate: number;
    totalCacheSize: number;
  }> {
    const stats = await audioCacheService.getStatistics();
    
    return {
      totalMessages: stats.totalMessages,
      cachedMessages: stats.cachedMessages,
      cacheHitRate: stats.totalMessages > 0 ? (stats.cachedMessages / stats.totalMessages) * 100 : 0,
      totalCacheSize: stats.totalCacheSize
    };
  }

  // Regenerate all audio
  async regenerateAllAudio(): Promise<{
    total: number;
    succeeded: number;
    failed: number;
  }> {
    return await audioCacheService.regenerateAllAudio();
  }

  // Check if message needs audio regeneration
  async needsAudioRegeneration(messageId: string): Promise<boolean> {
    const message = await db.select()
      .from(schema.openingMessages)
      .where(eq(schema.openingMessages.id, messageId))
      .limit(1);
    
    if (message.length === 0) return true;
    
    const msg = message[0];
    const voiceSettings = msg.voiceSettings ? JSON.parse(msg.voiceSettings) : null;
    
    return await audioCacheService.needsRegeneration(
      messageId,
      msg.messageContent,
      voiceSettings
    );
  }
}

// Singleton instance
export const openingMessageService = new OpeningMessageService();

// Export service instance as default
export default openingMessageService;