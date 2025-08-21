'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  onVideoEnd?: () => void;
  onVideoStart?: () => void;
  onTTSComplete?: () => void; // Called when TTS intro finishes
  autoPlay?: boolean;
  waitForTTS?: boolean; // If true, don't auto-play until TTS completes
  className?: string;
}

export interface VideoPlayerRef {
  handleTTSComplete: () => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(function VideoPlayer({
  videoUrl,
  title,
  onVideoEnd,
  onVideoStart,
  onTTSComplete,
  autoPlay = false,
  waitForTTS = false,
  className = ''
}, ref) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ttsCompleted, setTtsCompleted] = useState(!waitForTTS); // If not waiting for TTS, mark as completed
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Extract YouTube video ID from URL
  const extractVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const videoId = extractVideoId(videoUrl);
  
  // Validate YouTube URL
  useEffect(() => {
    if (!videoId) {
      setError('Invalid YouTube URL');
      setIsLoading(false);
    } else {
      setError(null);
    }
  }, [videoId]);

  // Handle TTS completion
  const handleTTSComplete = () => {
    setTtsCompleted(true);
    onTTSComplete?.();
  };

  // Expose methods to parent components via ref
  useImperativeHandle(ref, () => ({
    handleTTSComplete
  }));

  // Create YouTube embed URL with parameters
  const getEmbedUrl = () => {
    if (!videoId) return '';
    
    // Only auto-play if autoPlay is true AND (not waiting for TTS OR TTS is completed)
    const shouldAutoPlay = autoPlay && ttsCompleted;
    
    const params = new URLSearchParams({
      enablejsapi: '1',
      origin: window.location.origin,
      autoplay: shouldAutoPlay ? '1' : '0',
      rel: '0', // Don't show related videos from other channels
      modestbranding: '1', // Minimal YouTube branding
      controls: '1', // Show player controls
      disablekb: '0', // Enable keyboard controls
      fs: '1', // Allow fullscreen
      iv_load_policy: '3', // Hide annotations
    });

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  };

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  // Handle video control actions (limited due to YouTube embed restrictions)
  const handlePlayPause = () => {
    // Note: Direct control of YouTube embeds requires the YouTube API
    // For now, users will need to use YouTube's native controls
    if (iframeRef.current) {
      // Focus the iframe so keyboard controls work
      iframeRef.current.focus();
    }
  };

  const handleRestart = () => {
    if (iframeRef.current && videoId) {
      // Reload the iframe to restart the video
      iframeRef.current.src = getEmbedUrl();
      setHasEnded(false);
      setHasStarted(false);
    }
  };

  const handleFullscreen = () => {
    if (iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen();
      }
    }
  };

  // Listen for YouTube player events (requires postMessage API)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;
      
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'video-progress') {
          // Video is playing
          if (!hasStarted) {
            setHasStarted(true);
            onVideoStart?.();
          }
          setIsPlaying(true);
        } else if (data.event === 'video-pause') {
          setIsPlaying(false);
        } else if (data.event === 'video-ended') {
          setHasEnded(true);
          setIsPlaying(false);
          onVideoEnd?.();
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [hasStarted, onVideoStart, onVideoEnd]);

  // Re-render iframe when TTS completes to trigger autoplay if needed
  useEffect(() => {
    if (ttsCompleted && autoPlay && iframeRef.current && !hasStarted) {
      // Reload iframe to trigger autoplay now that TTS is complete
      iframeRef.current.src = getEmbedUrl();
    }
  }, [ttsCompleted, autoPlay, hasStarted]);

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <VolumeX className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-800">Video Error</h3>
            <p className="text-red-600">{error}</p>
            <p className="text-sm text-red-500 mt-1">
              Please check that the YouTube URL is valid and the video is publicly accessible.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {/* Video Header */}
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">Educational Video</p>
        </div>
      )}

      {/* Video Container */}
      <div className="relative bg-black">
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white">Loading video...</p>
            </div>
          </div>
        )}

        {/* YouTube Embed */}
        <div className="relative pb-[56.25%] h-0"> {/* 16:9 aspect ratio */}
          <iframe
            ref={iframeRef}
            src={getEmbedUrl()}
            title={title || 'Educational Video'}
            className="absolute top-0 left-0 w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={handleIframeLoad}
          />
        </div>

        {/* Custom Controls Overlay (Limited functionality with YouTube embeds) */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasEnded && (
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                title="Restart video"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleFullscreen}
              className="p-2 bg-black bg-opacity-50 text-white rounded-md hover:bg-opacity-75 transition-colors"
              title="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Video Status */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {isLoading ? (
              <span>Loading...</span>
            ) : waitForTTS && !ttsCompleted ? (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span>Listen to introduction first</span>
              </>
            ) : hasEnded ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Video completed</span>
              </>
            ) : hasStarted ? (
              <>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Watching video</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span>Ready to watch</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Manual Continue Button */}
            {onVideoEnd && (
              <button
                onClick={onVideoEnd}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                title="Finished watching? Continue to discussion"
              >
                Continue to Q&A →
              </button>
            )}
            
            <div className="text-sm text-gray-500">
              Use YouTube controls to play/pause
            </div>
          </div>
        </div>
      </div>

      {/* Completion Message */}
      {hasEnded && onVideoEnd && (
        <div className="px-4 py-3 bg-green-50 border-t border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Play className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-green-800 font-medium">Video completed!</p>
              <p className="text-green-600 text-sm">Ready to continue with the Q&A session.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;