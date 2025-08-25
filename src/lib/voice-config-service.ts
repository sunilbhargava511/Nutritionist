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

  // No fallback configuration - we throw errors instead
  private readonly NO_FALLBACK_POLICY = 'Voice configuration required - no fallback allowed';

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
   * Get voice configuration from admin settings with caching and retry logic
   */
  async getVoiceConfig(): Promise<VoiceConfig> {
    // Check cache first
    if (this.cachedConfig && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
      console.log('🎯 Voice config: Using cached configuration');
      return this.cachedConfig;
    }

    console.log('🔄 Voice config: Loading from API...');
    
    // Retry logic for transient network issues
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🌐 Voice config: API request attempt ${attempt}/${maxRetries}`);
        
        // Use API call instead of direct database access for client compatibility
        const response = await fetch('/api/admin/settings', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        console.log(`📡 Voice config: API response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Voice config: API response received:', { success: data.success, hasSettings: !!data.settings });
          
          const adminSettings = data.success ? data.settings : null;
          
          if (adminSettings && adminSettings.voiceId) {
            this.cachedConfig = {
              voiceId: adminSettings.voiceId,
              description: adminSettings.voiceDescription || 'Professional voice',
              stability: 0.6, // Default stability
              similarityBoost: 0.8, // Default similarity boost
              style: 0.4, // Default style
              useSpeakerBoost: true // Default speaker boost
            };
            
            this.cacheTimestamp = Date.now();
            console.log('🎉 Voice config: Successfully loaded voice ID:', this.cachedConfig.voiceId);
            return this.cachedConfig;
          } else {
            console.error('❌ Voice config: No valid admin settings or voice ID found in response');
            throw new Error('Voice configuration not found. Please configure voice settings in the admin panel.');
          }
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`❌ Voice config: API request failed with status ${response.status}:`, errorText);
          throw new Error(`Failed to load voice configuration (${response.status}). Please check your connection.`);
        }
      } catch (error) {
        console.error(`❌ Voice config: Attempt ${attempt}/${maxRetries} failed:`, error);
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error instanceof Error ? error : new Error('Unknown error loading voice configuration');
        }
        
        // Wait before retrying (except for the last attempt)
        console.log(`⏳ Voice config: Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // This should never be reached, but TypeScript requires it
    throw new Error('Failed to load voice configuration after all retry attempts');
  }

  /**
   * Get voice configuration synchronously (uses cache or throws error)
   */
  getVoiceConfigSync(): VoiceConfig {
    if (this.cachedConfig && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedConfig;
    }
    // No cached config available - throw error
    throw new Error('Voice configuration not loaded. Please ensure admin settings are configured.');
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