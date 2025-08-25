import { getDB } from './database';
import * as schema from './database/schema';
import { eq, and } from 'drizzle-orm';
import { voiceConfigService, VoiceConfigService } from './voice-config-service';

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
    const messages = await getDB().select()
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
    
    // No fallback logic - voice config must be available
    
    return this.enrichWithAudioCache(message);
  }

  // Get lesson intro message with audio cache
  async getLessonIntroMessage(lessonId: string): Promise<OpeningMessageWithAudio | null> {
    const messages = await getDB().select()
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

  // Get all lesson intro messages
  async getAllLessonIntroMessages(): Promise<OpeningMessageWithAudio[]> {
    const messages = await getDB().select()
      .from(schema.openingMessages)
      .where(
        and(
          eq(schema.openingMessages.type, 'lesson_intro'),
          eq(schema.openingMessages.active, true)
        )
      );
    
    const enrichedMessages = await Promise.all(
      messages.map(msg => this.enrichWithAudioCache(msg))
    );
    
    return enrichedMessages;
  }

  // Set general opening message
  async setGeneralOpeningMessage(
    messageContent: string,
    voiceSettings?: VoiceSettings,
    generateAudio: boolean = true,
    isGenerated: boolean = false
  ): Promise<OpeningMessageWithAudio> {
    // Deactivate existing general messages
    await getDB()
      .update(schema.openingMessages)
      .set({ active: false })
      .where(eq(schema.openingMessages.type, 'general_opening'));

    // Create new message
    const messageId = `general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const audioHash = this.generateAudioHash(messageContent, voiceSettings);
    
    const newMessage = await getDB().insert(schema.openingMessages).values({
      id: messageId,
      type: 'general_opening',
      lessonId: null,
      messageContent,
      voiceSettings: voiceSettings ? JSON.stringify(voiceSettings) : null,
      active: true,
      isGenerated,
      generatedAt: isGenerated ? new Date().toISOString() : null,
      audioHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    const message = newMessage[0];
    
    // Generate audio if requested
    if (generateAudio) {
      await this.generateAudio(message.id, messageContent, voiceSettings);
    }
    
    return this.enrichWithAudioCache(message);
  }

  // Set lesson intro message
  async setLessonIntroMessage(
    lessonId: string,
    messageContent: string,
    voiceSettings?: VoiceSettings,
    generateAudio: boolean = true,
    isGenerated: boolean = false
  ): Promise<OpeningMessageWithAudio> {
    // Deactivate existing lesson intro messages for this lesson
    await getDB()
      .update(schema.openingMessages)
      .set({ active: false })
      .where(
        and(
          eq(schema.openingMessages.type, 'lesson_intro'),
          eq(schema.openingMessages.lessonId, lessonId)
        )
      );

    // Create new message
    const messageId = `lesson_${lessonId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const audioHash = this.generateAudioHash(messageContent, voiceSettings);
    
    const newMessage = await getDB().insert(schema.openingMessages).values({
      id: messageId,
      type: 'lesson_intro',
      lessonId,
      messageContent,
      voiceSettings: voiceSettings ? JSON.stringify(voiceSettings) : null,
      active: true,
      isGenerated,
      generatedAt: isGenerated ? new Date().toISOString() : null,
      audioHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    const message = newMessage[0];
    
    // Generate audio if requested
    if (generateAudio) {
      await this.generateAudio(message.id, messageContent, voiceSettings);
    }
    
    return this.enrichWithAudioCache(message);
  }

  // Update message content
  async updateMessageContent(messageId: string, messageContent: string): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const voiceSettings = message.voiceSettings ? JSON.parse(message.voiceSettings) : null;
    const newAudioHash = this.generateAudioHash(messageContent, voiceSettings);
    
    // Update message and mark audio for regeneration if content changed
    await getDB()
      .update(schema.openingMessages)
      .set({
        messageContent,
        audioHash: newAudioHash,
        needsAudioRegeneration: newAudioHash !== message.audioHash,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.openingMessages.id, messageId));
  }

  // Update voice settings
  async updateVoiceSettings(messageId: string, voiceSettings: VoiceSettings): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const newAudioHash = this.generateAudioHash(message.messageContent, voiceSettings);
    
    // Update voice settings and mark audio for regeneration if settings changed
    await getDB()
      .update(schema.openingMessages)
      .set({
        voiceSettings: JSON.stringify(voiceSettings),
        audioHash: newAudioHash,
        needsAudioRegeneration: newAudioHash !== message.audioHash,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.openingMessages.id, messageId));
  }

  // Delete opening message
  async deleteOpeningMessage(messageId: string): Promise<void> {
    // Delete audio cache first
    await getDB()
      .delete(schema.audioCache)
      .where(eq(schema.audioCache.messageId, messageId));
    
    // Delete the message
    await getDB()
      .delete(schema.openingMessages)
      .where(eq(schema.openingMessages.id, messageId));
  }

  // Initialize default messages
  async initializeDefaultMessages(): Promise<void> {
    // Check if general opening message exists
    const existingGeneral = await this.getGeneralOpeningMessage();
    if (!existingGeneral) {
      await this.setGeneralOpeningMessage(
        "Welcome to your personalized nutrition journey! I'm here to guide you through evidence-based nutrition education and answer any questions you might have. Let's begin exploring how to build healthier eating habits together.",
        this.getDefaultVoiceSettingsSync(),
        true,
        false
      );
    }
  }

  // Get message by ID
  private async getMessageById(messageId: string): Promise<schema.OpeningMessage | null> {
    const messages = await getDB()
      .select()
      .from(schema.openingMessages)
      .where(eq(schema.openingMessages.id, messageId))
      .limit(1);
    
    return messages.length > 0 ? messages[0] : null;
  }

  // Enrich message with audio cache information
  private async enrichWithAudioCache(message: schema.OpeningMessage): Promise<OpeningMessageWithAudio> {
    const enriched = message as OpeningMessageWithAudio;
    
    // Check if audio exists and is current
    if (message.audioHash && message.audioUrl) {
      const currentHash = this.generateAudioHash(
        message.messageContent,
        message.voiceSettings ? JSON.parse(message.voiceSettings) : null
      );
      
      enriched.cachedAudioUrl = message.audioUrl;
      enriched.needsAudioRegeneration = currentHash !== message.audioHash;
    } else {
      enriched.cachedAudioUrl = null;
      enriched.needsAudioRegeneration = true;
    }
    
    return enriched;
  }

  // Generate audio for message (placeholder - would integrate with ElevenLabs)
  private async generateAudio(
    messageId: string,
    content: string,
    voiceSettings?: VoiceSettings
  ): Promise<void> {
    try {
      // This would integrate with ElevenLabs API
      // For now, just mark as generated
      const audioHash = this.generateAudioHash(content, voiceSettings);
      
      await getDB()
        .update(schema.openingMessages)
        .set({
          audioGeneratedAt: new Date().toISOString(),
          audioHash,
          needsAudioRegeneration: false,
        })
        .where(eq(schema.openingMessages.id, messageId));
        
      console.log(`Audio generation requested for message ${messageId}`);
    } catch (error) {
      console.error('Audio generation failed:', error);
    }
  }

  // Generate hash for audio cache invalidation
  private generateAudioHash(content: string, voiceSettings?: VoiceSettings | null): string {
    const data = JSON.stringify({
      content,
      voiceSettings: voiceSettings || this.getDefaultVoiceSettingsSync()
    });
    
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Get default voice settings from centralized config
  async getDefaultVoiceSettings(): Promise<VoiceSettings> {
    try {
      const voiceConfig = await voiceConfigService.getVoiceConfig();
      return {
        voiceId: voiceConfig.voiceId,
        speed: 1.0,
        stability: voiceConfig.stability || 0.5,
        similarityBoost: voiceConfig.similarityBoost || 0.75,
        style: voiceConfig.style || 0.3,
        useSpeakerBoost: voiceConfig.useSpeakerBoost !== false,
      };
    } catch (error) {
      console.error('❌ Failed to get voice config:', error);
      // Re-throw the error - no fallback allowed
      throw new Error(`Voice configuration required: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Synchronous fallback for compatibility
  getDefaultVoiceSettingsSync(): VoiceSettings {
    const voiceConfig = voiceConfigService.getVoiceConfigSync();
    return {
      voiceId: voiceConfig.voiceId,
      speed: 1.0,
      stability: voiceConfig.stability || 0.5,
      similarityBoost: voiceConfig.similarityBoost || 0.75,
      style: voiceConfig.style || 0.3,
      useSpeakerBoost: voiceConfig.useSpeakerBoost !== false,
    };
  }

  // Style message content with LLM (placeholder)
  async styleMessageContent(
    messageId: string,
    userInput: string,
    stylePrompt?: string
  ): Promise<string> {
    // Store original user input
    await getDB()
      .update(schema.openingMessages)
      .set({
        originalUserInput: userInput,
        isStyled: false,
      })
      .where(eq(schema.openingMessages.id, messageId));
    
    // This would integrate with Claude/LLM for styling
    // For now, return the input as-is
    return userInput;
  }

  // Revert to original user input
  async revertToOriginal(messageId: string): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message || !message.originalUserInput) {
      throw new Error('No original content to revert to');
    }
    
    await this.updateMessageContent(messageId, message.originalUserInput);
    
    await getDB()
      .update(schema.openingMessages)
      .set({
        isStyled: false,
        styledAt: null,
      })
      .where(eq(schema.openingMessages.id, messageId));
  }

  // Revert to AI-generated content
  async revertToGenerated(messageId: string): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message || !message.originalGeneratedContent) {
      throw new Error('No generated content to revert to');
    }
    
    await this.updateMessageContent(messageId, message.originalGeneratedContent);
  }

  /**
   * Regenerate audio for all opening messages
   */
  async regenerateAllAudio(): Promise<{ total: number; succeeded: number; failed: number; errors: string[] }> {
    const db = getDB();
    const allMessages = await db
      .select()
      .from(schema.openingMessages)
      .all();

    const result = {
      total: allMessages.length,
      succeeded: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const message of allMessages) {
      try {
        await this.regenerateAudio(message.id);
        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Message ${message.id}: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`Failed to regenerate audio for message ${message.id}:`, error);
      }
    }

    return result;
  }

  /**
   * Regenerate audio for a specific message
   */
  async regenerateAudio(messageId: string): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    const db = getDB();
    
    // Clear any existing audio cache for this message
    await db
      .delete(schema.audioCache)
      .where(eq(schema.audioCache.messageId, messageId));

    // Generate new audio using the audio cache service
    const { audioCacheService } = await import('./audio-cache-service');
    
    // Get voice settings for this message
    const voiceSettings = message.voiceSettings 
      ? JSON.parse(message.voiceSettings) 
      : await this.getDefaultVoiceSettings();

    try {
      const audioResult = await audioCacheService.generateAudio(
        message.messageContent,
        {
          voiceId: voiceSettings.voiceId,
          stability: voiceSettings.stability,
          similarityBoost: voiceSettings.similarityBoost,
          style: voiceSettings.style,
          useSpeakerBoost: voiceSettings.useSpeakerBoost
        }
      );

      console.log(`Successfully regenerated audio for message ${messageId}`);
    } catch (error) {
      console.error(`Failed to regenerate audio for message ${messageId}:`, error);
      throw new Error(`Audio generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a message needs audio regeneration (content or settings changed)
   */
  async needsAudioRegeneration(messageId: string): Promise<boolean> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      return false;
    }

    const db = getDB();
    
    // Check if there's cached audio for this message
    const cachedAudio = await db
      .select()
      .from(schema.audioCache)
      .where(eq(schema.audioCache.messageId, messageId))
      .get();

    if (!cachedAudio) {
      return true; // No cached audio exists
    }

    // Compare current voice settings with cached ones
    const currentVoiceSettings = message.voiceSettings 
      ? JSON.parse(message.voiceSettings) 
      : await this.getDefaultVoiceSettings();
    
    const cachedVoiceSettings = cachedAudio.voiceSettings 
      ? JSON.parse(cachedAudio.voiceSettings) 
      : null;
    
    // Check if voice settings or content have changed
    if (!cachedVoiceSettings) {
      return true; // No voice settings stored, needs regeneration
    }
    
    // Compare voice settings
    const settingsChanged = 
      currentVoiceSettings.voiceId !== cachedVoiceSettings.voiceId ||
      currentVoiceSettings.stability !== cachedVoiceSettings.stability ||
      currentVoiceSettings.similarityBoost !== cachedVoiceSettings.similarityBoost ||
      currentVoiceSettings.style !== cachedVoiceSettings.style ||
      currentVoiceSettings.useSpeakerBoost !== cachedVoiceSettings.useSpeakerBoost;
    
    return settingsChanged;
  }

  /**
   * Get comprehensive audio cache statistics
   */
  async getAudioCacheStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    cacheHitRate: number;
    oldestFile: Date | null;
    newestFile: Date | null;
    messageStats: Array<{
      messageId: string;
      messageType: string;
      hasAudio: boolean;
      needsRegeneration: boolean;
      audioSize?: number;
      lastGenerated?: Date;
    }>;
  }> {
    const db = getDB();
    
    // Get all opening messages
    const allMessages = await db
      .select()
      .from(schema.openingMessages)
      .all();

    // Get all cached audio
    const allCachedAudio = await db
      .select()
      .from(schema.audioCache)
      .all();

    // Calculate basic stats
    const totalSize = allCachedAudio.reduce((sum, audio) => sum + (audio.sizeBytes || 0), 0);
    const dates = allCachedAudio
      .map(audio => audio.generatedAt)
      .filter(date => date)
      .map(date => new Date(date));
    
    const oldestFile = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const newestFile = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

    // Build message stats
    const messageStats = [];
    for (const message of allMessages) {
      const cachedAudio = allCachedAudio.find(audio => audio.messageId === message.id);
      const hasAudio = !!cachedAudio;
      const needsRegeneration = hasAudio ? await this.needsAudioRegeneration(message.id) : true;
      
      messageStats.push({
        messageId: message.id,
        messageType: message.messageType || 'unknown',
        hasAudio,
        needsRegeneration,
        audioSize: cachedAudio?.sizeBytes,
        lastGenerated: cachedAudio?.generatedAt ? new Date(cachedAudio.generatedAt) : undefined
      });
    }

    // Calculate cache hit rate (messages with audio vs total messages)
    const messagesWithAudio = messageStats.filter(stat => stat.hasAudio).length;
    const cacheHitRate = allMessages.length > 0 ? (messagesWithAudio / allMessages.length) * 100 : 0;

    return {
      totalFiles: allCachedAudio.length,
      totalSize,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      oldestFile,
      newestFile,
      messageStats
    };
  }
}

// Export singleton instance
export const openingMessageService = new OpeningMessageService();