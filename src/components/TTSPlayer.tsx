'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface TTSPlayerProps {
  text: string;
  audioUrl?: string | null;
  autoPlay?: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function TTSPlayer({
  text,
  audioUrl,
  autoPlay = false,
  onComplete,
  onError,
  className = ''
}: TTSPlayerProps) {
  
  // Debug logging - log props on every render
  console.log('[TTSPlayer] Render with props:', {
    textLength: text?.length || 0,
    audioUrl: audioUrl,
    autoPlay: autoPlay
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate ElevenLabs TTS audio
  const generateElevenLabsAudio = async () => {
    if (!text || isGenerating) return;

    setIsLoading(true);
    setIsGenerating(true);
    setError(null);

    try {
      console.log('[TTSPlayer] Generating ElevenLabs TTS for:', text.substring(0, 50) + '...');
      
      const response = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voiceSettings: {
            voiceId: 'MXGyTMlsvQgQ4BL0emIa',
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.4,
            use_speaker_boost: true
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS generation failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      console.log('[TTSPlayer] ElevenLabs TTS generated successfully');
      setGeneratedAudioUrl(audioUrl);
      setIsGenerating(false);
      
      // Create audio element and play
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
        setIsLoading(false);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(0);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        onComplete?.();
        // Clean up blob URL
        URL.revokeObjectURL(audioUrl);
      });

      audio.addEventListener('error', () => {
        const errorMsg = 'Audio playback failed';
        setError(errorMsg);
        setIsLoading(false);
        setIsPlaying(false);
        onError?.(errorMsg);
        URL.revokeObjectURL(audioUrl);
      });

      // Auto-play if requested
      if (autoPlay) {
        await audio.play();
        setIsPlaying(true);
        
        // Start progress tracking
        intervalRef.current = setInterval(() => {
          if (audio) {
            const currentTime = audio.currentTime;
            const duration = audio.duration;
            setProgress((currentTime / duration) * 100);
          }
        }, 100);
      }

    } catch (error) {
      console.error('[TTSPlayer] ElevenLabs TTS generation failed:', error);
      const errorMsg = 'Failed to generate TTS audio';
      setError(errorMsg);
      setIsLoading(false);
      setIsGenerating(false);
      onError?.(errorMsg);
    }
  };

  // Generate ElevenLabs audio if no cached audio is available and autoplay is requested
  useEffect(() => {
    console.log('[TTSPlayer] Checking for ElevenLabs generation need - audioUrl:', audioUrl, 'autoPlay:', autoPlay, 'text:', text?.substring(0, 50) + '...');
    
    if (!audioUrl && autoPlay && text) {
      console.log('[TTSPlayer] No cached audio available, generating ElevenLabs TTS');
      generateElevenLabsAudio();
    }
  }, [text, autoPlay, audioUrl]);

  // Initialize audio when audioUrl changes
  useEffect(() => {
    if (audioUrl) {
      console.log('[TTSPlayer] Using cached audio URL:', audioUrl);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
        setIsLoading(false);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(0);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        onComplete?.();
      });

      audio.addEventListener('error', (e) => {
        console.error('[TTSPlayer] Cached audio failed to load:', e);
        const errorMsg = 'Cached audio failed to load';
        setError(errorMsg);
        setIsLoading(false);
        setIsPlaying(false);
        
        // Fallback to ElevenLabs if cached audio fails
        if (autoPlay && text) {
          console.log('[TTSPlayer] Falling back to ElevenLabs due to cached audio error');
          generateElevenLabsAudio();
        } else {
          onError?.(errorMsg);
        }
      });

      // Auto-play if requested
      if (autoPlay) {
        console.log('[TTSPlayer] Auto-play triggered for cached audio URL:', audioUrl?.substring(0, 50) + '...');
        setIsLoading(true);
        
        // Add a small delay to ensure audio is loaded
        setTimeout(() => {
          handlePlay();
        }, 100);
      }

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        audio.pause();
        audio.removeEventListener('loadedmetadata', () => {});
        audio.removeEventListener('ended', () => {});
        audio.removeEventListener('error', () => {});
      };
    }
  }, [audioUrl, autoPlay, onComplete, onError]);

  const handlePlay = async () => {
    if (!audioRef.current) {
      // Fall back to browser TTS if no audio URL
      console.log('[TTSPlayer] Using browser TTS for text:', text.substring(0, 100) + '...');
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onstart = () => {
          console.log('[TTSPlayer] Browser TTS started');
          setIsPlaying(true);
        };
        utterance.onend = () => {
          console.log('[TTSPlayer] Browser TTS completed');
          setIsPlaying(false);
          onComplete?.();
        };
        utterance.onerror = (event) => {
          console.error('[TTSPlayer] Browser TTS error:', event);
          const errorMsg = 'Browser TTS failed';
          setError(errorMsg);
          setIsPlaying(false);
          onError?.(errorMsg);
        };
        
        console.log('[TTSPlayer] Starting speech synthesis...');
        window.speechSynthesis.speak(utterance);
      } else {
        console.error('[TTSPlayer] Speech synthesis not available');
        const errorMsg = 'Audio playback not available';
        setError(errorMsg);
        onError?.(errorMsg);
      }
      return;
    }

    try {
      setIsLoading(true);
      console.log('[TTSPlayer] Attempting to play audio:', audioRef.current?.src?.substring(0, 50) + '...');
      
      await audioRef.current.play();
      setIsPlaying(true);
      setError(null);
      
      console.log('[TTSPlayer] Audio playback started successfully');
      
      // Start progress tracking
      intervalRef.current = setInterval(() => {
        if (audioRef.current) {
          const currentTime = audioRef.current.currentTime;
          const duration = audioRef.current.duration;
          setProgress((currentTime / duration) * 100);
        }
      }, 100);
    } catch (err) {
      console.error('[TTSPlayer] Audio playback failed:', err);
      let errorMsg = 'Failed to play audio';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMsg = 'Audio playback blocked by browser. Please click to play.';
        } else if (err.name === 'NotSupportedError') {
          errorMsg = 'Audio format not supported by browser';
        } else {
          errorMsg = `Audio error: ${err.message}`;
        }
      }
      
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    } else {
      // Stop browser TTS
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = clickX / rect.width;
    const newTime = clickRatio * audioRef.current.duration;
    
    audioRef.current.currentTime = newTime;
    setProgress(clickRatio * 100);
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className={`flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <VolumeX className="w-5 h-5 text-red-500" />
        <div className="flex-1">
          <p className="text-sm text-red-700">Audio Error</p>
          <p className="text-xs text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
      <button
        onClick={isPlaying ? handlePause : handlePlay}
        disabled={isLoading}
        className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-full flex items-center justify-center transition-colors"
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Volume2 className="w-4 h-4 text-blue-600" />
          <p className="text-sm font-medium text-blue-900">Lesson Introduction</p>
        </div>
        
        {audioRef.current && (
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <span>{formatTime((progress / 100) * duration)}</span>
            <div 
              className="flex-1 h-1 bg-blue-200 rounded-full cursor-pointer"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        )}

        <p className="text-sm text-blue-800 mt-2 line-clamp-2">{text}</p>
      </div>
    </div>
  );
}