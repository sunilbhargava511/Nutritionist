import { useState, useEffect, useCallback } from 'react';
import { VoiceConfig, voiceConfigService } from '@/lib/voice-config-service';

export interface UseVoiceConfigResult {
  voiceConfig: VoiceConfig | null;
  voiceId: string | null;
  isLoading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
}

/**
 * React hook for accessing centralized voice configuration
 * Automatically handles loading, error states, and cache refresh
 */
export function useVoiceConfig(): UseVoiceConfigResult {
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVoiceConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const config = await voiceConfigService.getVoiceConfig();
      setVoiceConfig(config);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load voice configuration';
      setError(errorMessage);
      console.error('useVoiceConfig: Failed to load configuration:', err);
      
      // Use fallback config on error
      setVoiceConfig({
        voiceId: 'pNInz6obpgDQGcFmaJgB',
        description: 'Fallback voice',
        stability: 0.6,
        similarityBoost: 0.8,
        style: 0.4,
        useSpeakerBoost: true
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    voiceConfigService.clearCache();
    await loadVoiceConfig();
  }, [loadVoiceConfig]);

  useEffect(() => {
    loadVoiceConfig();
  }, [loadVoiceConfig]);

  return {
    voiceConfig,
    voiceId: voiceConfig?.voiceId || null,
    isLoading,
    error,
    refreshConfig
  };
}

/**
 * Simplified hook that returns just the voice ID
 * Useful for components that only need the voice ID
 */
export function useVoiceId(): {
  voiceId: string | null;
  isLoading: boolean;
  error: string | null;
} {
  const { voiceId, isLoading, error } = useVoiceConfig();
  return { voiceId, isLoading, error };
}

/**
 * Hook that returns ElevenLabs-formatted voice settings
 * Ready to use with ElevenLabs API calls
 */
export function useElevenLabsVoiceSettings(): {
  voiceSettings: {
    voiceId: string;
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  } | null;
  isLoading: boolean;
  error: string | null;
} {
  const { voiceConfig, isLoading, error } = useVoiceConfig();
  
  const voiceSettings = voiceConfig ? {
    voiceId: voiceConfig.voiceId,
    stability: voiceConfig.stability || 0.6,
    similarity_boost: voiceConfig.similarityBoost || 0.8,
    style: voiceConfig.style || 0.4,
    use_speaker_boost: voiceConfig.useSpeakerBoost !== false
  } : null;

  return {
    voiceSettings,
    isLoading,
    error
  };
}