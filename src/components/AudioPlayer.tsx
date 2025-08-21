'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string | null;
  autoPlay?: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
  title?: string;
}

export default function AudioPlayer({
  audioUrl,
  autoPlay = false,
  onComplete,
  onError,
  className = '',
  title = 'Audio Message'
}: AudioPlayerProps) {
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio when audioUrl changes
  useEffect(() => {
    if (!audioUrl) {
      setError('No audio available');
      onError?.('No audio available');
      return;
    }

    console.log('[AudioPlayer] Loading cached audio URL:', audioUrl);
    setIsLoading(true);
    setError(null);
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      setIsLoading(false);
      console.log('[AudioPlayer] Audio loaded, duration:', audio.duration);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setProgress(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      console.log('[AudioPlayer] Audio playback completed');
      onComplete?.();
    });

    audio.addEventListener('error', (e) => {
      console.error('[AudioPlayer] Audio failed to load:', e);
      const errorMsg = 'Failed to load audio';
      setError(errorMsg);
      setIsLoading(false);
      setIsPlaying(false);
      onError?.(errorMsg);
    });

    // Auto-play if requested
    if (autoPlay) {
      console.log('[AudioPlayer] Auto-play triggered');
      // Small delay to ensure audio is loaded
      setTimeout(() => {
        handlePlay();
      }, 100);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audio) {
        audio.pause();
        audio.removeEventListener('loadedmetadata', () => {});
        audio.removeEventListener('ended', () => {});
        audio.removeEventListener('error', () => {});
      }
    };
  }, [audioUrl, autoPlay, onComplete, onError]);

  const handlePlay = async () => {
    if (!audioRef.current) {
      console.error('[AudioPlayer] No audio element available');
      return;
    }

    try {
      console.log('[AudioPlayer] Starting audio playback');
      await audioRef.current.play();
      setIsPlaying(true);
      setError(null);
      
      // Start progress tracking
      intervalRef.current = setInterval(() => {
        if (audioRef.current) {
          const currentTime = audioRef.current.currentTime;
          const duration = audioRef.current.duration;
          setProgress((currentTime / duration) * 100);
        }
      }, 100);
    } catch (err) {
      console.error('[AudioPlayer] Audio playback failed:', err);
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
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
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

  // If no audio URL provided, show message
  if (!audioUrl) {
    return (
      <div className={`flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <VolumeX className="w-5 h-5 text-yellow-500" />
        <div className="flex-1">
          <p className="text-sm text-yellow-700">No Audio Available</p>
          <p className="text-xs text-yellow-600">Audio has not been generated for this message</p>
        </div>
      </div>
    );
  }

  // If error occurred, show error state
  if (error) {
    return (
      <div className={`flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <VolumeX className="w-5 h-5 text-red-500" />
        <div className="flex-1">
          <p className="text-sm text-red-700">Audio Error</p>
          <p className="text-xs text-red-600">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-red-600 hover:text-red-700 underline"
        >
          Retry
        </button>
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
          <p className="text-sm font-medium text-blue-900">{title}</p>
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
      </div>
    </div>
  );
}