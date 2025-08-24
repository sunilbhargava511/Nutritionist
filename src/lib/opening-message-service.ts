import { getDB } from './database';
import * as schema from './database/schema';
import { eq, and } from 'drizzle-orm';

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
        this.getDefaultVoiceSettings(),
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
      voiceSettings: voiceSettings || this.getDefaultVoiceSettings()
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

  // Get default voice settings
  getDefaultVoiceSettings(): VoiceSettings {
    return {
      voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice
      speed: 1.0,
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.3,
      useSpeakerBoost: true,
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
}

// Export singleton instance
export const openingMessageService = new OpeningMessageService();