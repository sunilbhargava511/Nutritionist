import { AdminSettings } from '@/types';

export interface VoiceConfig {
  voiceId: string;
  description: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface ElevenLabsVoiceSettings {
  voiceId: string;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

/**
 * Centralized Voice Configuration Service
 * Single source of truth for all voice settings in the application
 */
export class VoiceConfigService {
  private static instance: VoiceConfigService;
  private cachedConfig: VoiceConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Fallback voice configuration - only used if admin settings are unavailable
  private readonly FALLBACK_CONFIG: VoiceConfig = {
    voiceId: '4n2FYtLoSkOUG7xRbnu9', // User requested voice ID
    description: 'Professional voice',
    stability: 0.6,
    similarityBoost: 0.8,
    style: 0.4,
    useSpeakerBoost: true
  };

  private constructor() {
    // No dependencies needed - using API calls
  }

  static getInstance(): VoiceConfigService {
    if (!VoiceConfigService.instance) {
      VoiceConfigService.instance = new VoiceConfigService();
    }
    return VoiceConfigService.instance;
  }

  /**
   * Get voice configuration from admin settings with caching
   */
  async getVoiceConfig(): Promise<VoiceConfig> {
    // Check cache first
    if (this.cachedConfig && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedConfig;
    }

    try {
      // Use API call instead of direct database access for client compatibility
      const response = await fetch('/api/admin/settings');
      
      if (response.ok) {
        const data = await response.json();
        const adminSettings = data.success ? data.settings : null;
        
        if (adminSettings) {
          this.cachedConfig = {
            voiceId: adminSettings.voiceId,
            description: adminSettings.voiceDescription,
            stability: 0.6, // Default stability
            similarityBoost: 0.8, // Default similarity boost
            style: 0.4, // Default style
            useSpeakerBoost: true // Default speaker boost
          };
        } else {
          console.warn('No admin settings found, using fallback voice configuration');
          console.log('🎙️ Using default voice ID: 4n2FYtLoSkOUG7xRbnu9');
          this.cachedConfig = { ...this.FALLBACK_CONFIG };
        }
      } else {
        console.warn('Failed to fetch admin settings, using fallback voice configuration');
        console.log('🎙️ Using default voice ID: 4n2FYtLoSkOUG7xRbnu9');
        this.cachedConfig = { ...this.FALLBACK_CONFIG };
      }

      this.cacheTimestamp = Date.now();
      return this.cachedConfig;
    } catch (error) {
      console.error('Failed to load voice configuration from admin settings:', error);
      return { ...this.FALLBACK_CONFIG };
    }
  }

  /**
   * Get voice configuration synchronously (uses cache or fallback)
   */
  getVoiceConfigSync(): VoiceConfig {
    if (this.cachedConfig && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedConfig;
    }
    return { ...this.FALLBACK_CONFIG };
  }

  /**
   * Get ElevenLabs-formatted voice settings
   */
  async getElevenLabsVoiceSettings(): Promise<ElevenLabsVoiceSettings> {
    const config = await this.getVoiceConfig();
    return {
      voiceId: config.voiceId,
      stability: config.stability || 0.6,
      similarity_boost: config.similarityBoost || 0.8,
      style: config.style || 0.4,
      use_speaker_boost: config.useSpeakerBoost !== false
    };
  }

  /**
   * Get just the voice ID (most common use case)
   */
  async getVoiceId(): Promise<string> {
    const config = await this.getVoiceConfig();
    return config.voiceId;
  }

  /**
   * Get voice ID synchronously (uses cache or fallback)
   */
  getVoiceIdSync(): string {
    const config = this.getVoiceConfigSync();
    return config.voiceId;
  }

  /**
   * Clear cache to force refresh on next request
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Validate if a voice ID looks like a valid ElevenLabs voice ID
   */
  isValidVoiceId(voiceId: string): boolean {
    // ElevenLabs voice IDs are typically 20 characters long, alphanumeric
    const voiceIdRegex = /^[a-zA-Z0-9]{20}$/;
    return voiceIdRegex.test(voiceId);
  }

  /**
   * Get formatted voice settings for opening messages
   */
  async getOpeningMessageVoiceSettings(): Promise<{
    voiceId: string;
    speed: number;
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
  }> {
    const config = await this.getVoiceConfig();
    return {
      voiceId: config.voiceId,
      speed: 1.0, // Default speed for opening messages
      stability: config.stability || 0.6,
      similarityBoost: config.similarityBoost || 0.8,
      style: config.style || 0.4,
      useSpeakerBoost: config.useSpeakerBoost !== false
    };
  }

  /**
   * Get voice configuration with custom overrides
   */
  async getVoiceConfigWithOverrides(overrides: Partial<VoiceConfig>): Promise<VoiceConfig> {
    const baseConfig = await this.getVoiceConfig();
    return {
      ...baseConfig,
      ...overrides
    };
  }
}

// Export singleton instance for easy access
export const voiceConfigService = VoiceConfigService.getInstance();

// Export convenience functions for common use cases
export const getVoiceId = () => voiceConfigService.getVoiceId();
export const getVoiceIdSync = () => voiceConfigService.getVoiceIdSync();
export const getVoiceConfig = () => voiceConfigService.getVoiceConfig();
export const getElevenLabsVoiceSettings = () => voiceConfigService.getElevenLabsVoiceSettings();