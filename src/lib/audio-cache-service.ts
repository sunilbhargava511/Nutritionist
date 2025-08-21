import { db } from './database';
import * as schema from './database/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface AudioGenerationOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface CachedAudio {
  audioUrl?: string | null;
  audioBlob?: string | null;
  audioDuration?: number | null;
  needsRegeneration: boolean;
}

export class AudioCacheService {
  private readonly ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
  private readonly DEFAULT_VOICE_ID = 'MXGyTMlsvQgQ4BL0emIa';
  
  /**
   * Generate hash for content + voice settings to detect changes
   */
  private generateAudioHash(content: string, voiceSettings: any): string {
    const dataToHash = JSON.stringify({
      content: content.trim(),
      voiceSettings: voiceSettings || {}
    });
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }

  /**
   * Check if audio needs regeneration based on content/settings changes
   */
  async needsRegeneration(messageId: string, content: string, voiceSettings: any): Promise<boolean> {
    const message = await db.select()
      .from(schema.openingMessages)
      .where(eq(schema.openingMessages.id, messageId))
      .limit(1);
    
    if (message.length === 0) return true;
    
    const currentHash = this.generateAudioHash(content, voiceSettings);
    const storedHash = message[0].audioHash;
    
    // Check if hash matches and audio exists
    return !storedHash || storedHash !== currentHash || !message[0].audioBlob;
  }

  /**
   * Generate audio using ElevenLabs TTS API
   */
  async generateAudio(text: string, options?: AudioGenerationOptions): Promise<{
    audioData: string;
    duration: number;
    mimeType: string;
  }> {
    if (!this.ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key is not configured');
    }

    const voiceId = options?.voiceId || this.DEFAULT_VOICE_ID;
    const voiceSettings = {
      stability: options?.stability ?? 0.6,
      similarity_boost: options?.similarityBoost ?? 0.8,
      style: options?.style ?? 0.4,
      use_speaker_boost: options?.useSpeakerBoost ?? true
    };

    try {
      console.log('[AudioCache] Generating audio for text:', text.substring(0, 50) + '...');
      
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: voiceSettings
          })
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      // Convert audio to base64
      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      
      // Calculate duration (estimate based on typical speech rate)
      // More accurate duration would require audio analysis
      const wordCount = text.split(' ').length;
      const estimatedDuration = (wordCount / 150) * 60; // 150 words per minute average
      
      console.log('[AudioCache] Audio generated successfully, size:', audioBuffer.byteLength, 'bytes');
      
      return {
        audioData: audioBase64,
        duration: estimatedDuration,
        mimeType: 'audio/mpeg'
      };
    } catch (error) {
      console.error('[AudioCache] Failed to generate audio:', error);
      throw error;
    }
  }

  /**
   * Store generated audio in database
   */
  async storeAudio(
    messageId: string,
    content: string,
    voiceSettings: any,
    audioData: string,
    duration: number
  ): Promise<void> {
    const audioHash = this.generateAudioHash(content, voiceSettings);
    const now = new Date().toISOString();
    
    // Update opening message with cached audio
    await db.update(schema.openingMessages)
      .set({
        audioBlob: audioData,
        audioHash: audioHash,
        audioGeneratedAt: now,
        audioDuration: duration,
        updatedAt: now
      })
      .where(eq(schema.openingMessages.id, messageId));
    
    // Also store in audio_cache table for redundancy
    const cacheId = `cache_${messageId}_${Date.now()}`;
    await db.insert(schema.audioCache).values({
      id: cacheId,
      messageId: messageId,
      audioData: audioData,
      mimeType: 'audio/mpeg',
      sizeBytes: Math.floor(audioData.length * 0.75), // Approximate size from base64
      durationSeconds: duration,
      voiceId: voiceSettings?.voiceId || this.DEFAULT_VOICE_ID,
      voiceSettings: JSON.stringify(voiceSettings),
      generatedAt: now,
      accessedAt: now,
      accessCount: 0
    });
    
    console.log('[AudioCache] Audio cached for message:', messageId);
  }

  /**
   * Get cached audio for a message
   */
  async getCachedAudio(messageId: string): Promise<CachedAudio | null> {
    const message = await db.select()
      .from(schema.openingMessages)
      .where(eq(schema.openingMessages.id, messageId))
      .limit(1);
    
    if (message.length === 0) {
      return null;
    }
    
    const msg = message[0];
    
    // Check if regeneration is needed
    const needsRegeneration = await this.needsRegeneration(
      messageId,
      msg.messageContent,
      msg.voiceSettings ? JSON.parse(msg.voiceSettings) : null
    );
    
    // Update access count if audio exists
    if (msg.audioBlob) {
      await db.update(schema.audioCache)
        .set({
          accessedAt: new Date().toISOString(),
          accessCount: sql`${schema.audioCache.accessCount} + 1`
        })
        .where(eq(schema.audioCache.messageId, messageId));
    }
    
    return {
      audioUrl: msg.audioUrl,
      audioBlob: msg.audioBlob,
      audioDuration: msg.audioDuration,
      needsRegeneration
    };
  }

  /**
   * Generate and cache audio for a message
   */
  async generateAndCacheAudio(
    messageId: string,
    content: string,
    voiceSettings?: any
  ): Promise<CachedAudio> {
    try {
      // Parse voice settings if string
      const settings = typeof voiceSettings === 'string' 
        ? JSON.parse(voiceSettings) 
        : voiceSettings;
      
      // Generate audio
      const { audioData, duration } = await this.generateAudio(content, settings);
      
      // Store in database
      await this.storeAudio(messageId, content, settings, audioData, duration);
      
      return {
        audioBlob: audioData,
        audioDuration: duration,
        audioUrl: null,
        needsRegeneration: false
      };
    } catch (error) {
      console.error('[AudioCache] Failed to generate and cache audio:', error);
      throw error;
    }
  }

  /**
   * Regenerate audio for all messages (admin function)
   */
  async regenerateAllAudio(): Promise<{
    total: number;
    succeeded: number;
    failed: number;
  }> {
    const messages = await db.select().from(schema.openingMessages);
    
    let succeeded = 0;
    let failed = 0;
    
    for (const message of messages) {
      try {
        const voiceSettings = message.voiceSettings 
          ? JSON.parse(message.voiceSettings) 
          : null;
        
        await this.generateAndCacheAudio(
          message.id,
          message.messageContent,
          voiceSettings
        );
        
        succeeded++;
      } catch (error) {
        console.error(`[AudioCache] Failed to regenerate audio for message ${message.id}:`, error);
        failed++;
      }
    }
    
    return {
      total: messages.length,
      succeeded,
      failed
    };
  }

  /**
   * Clear old cached audio (cleanup function)
   */
  async clearOldCache(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const oldEntries = await db.select()
      .from(schema.audioCache)
      .where(sql`${schema.audioCache.accessedAt} < ${cutoffDate.toISOString()}`);
    
    if (oldEntries.length > 0) {
      await db.delete(schema.audioCache)
        .where(sql`${schema.audioCache.accessedAt} < ${cutoffDate.toISOString()}`);
    }
    
    return oldEntries.length;
  }

  /**
   * Convert base64 audio to data URL for browser playback
   */
  static audioDataToUrl(base64Data: string, mimeType: string = 'audio/mpeg'): string {
    return `data:${mimeType};base64,${base64Data}`;
  }

  /**
   * Get audio statistics
   */
  async getStatistics(): Promise<{
    totalMessages: number;
    cachedMessages: number;
    totalCacheSize: number;
    averageDuration: number;
  }> {
    const messages = await db.select().from(schema.openingMessages);
    const cached = messages.filter(m => m.audioBlob);
    
    const cacheEntries = await db.select().from(schema.audioCache);
    const totalSize = cacheEntries.reduce((sum, entry) => sum + (entry.sizeBytes || 0), 0);
    const totalDuration = cached.reduce((sum, msg) => sum + (msg.audioDuration || 0), 0);
    
    return {
      totalMessages: messages.length,
      cachedMessages: cached.length,
      totalCacheSize: totalSize,
      averageDuration: cached.length > 0 ? totalDuration / cached.length : 0
    };
  }
}

// Export singleton instance
export const audioCacheService = new AudioCacheService();