'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, BookOpen, MessageCircle, Play } from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import { Lesson } from '@/types';
import { EnhancedSessionStorage } from '@/lib/session-enhanced';

interface LessonInterfaceProps {
  lessonId: string;
  sessionId: string;
  onBack?: () => void;
  onComplete?: () => void;
  className?: string;
}

interface LessonData {
  lesson: Lesson;
  startMessage?: {
    text: string;
    audioUrl: string | null;
    error?: string;
  };
}

type LessonPhase = 'loading' | 'start_message' | 'video' | 'conversation' | 'error';

export default function LessonInterface({
  lessonId,
  sessionId,
  onBack,
  onComplete,
  className = ''
}: LessonInterfaceProps) {
  const [phase, setPhase] = useState<LessonPhase>('loading');
  const [lessonData, setLessonData] = useState<LessonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  // Load lesson data
  useEffect(() => {
    const loadLesson = async () => {
      try {
        setPhase('loading');
        
        const response = await fetch('/api/start-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, sessionId })
        });

        if (!response.ok) {
          throw new Error('Failed to load lesson');
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to load lesson');
        }

        setLessonData(data);
        
        // Move to appropriate phase and track lesson state
        if (data.startMessage) {
          setPhase('start_message');
          EnhancedSessionStorage.setLessonState(sessionId, lessonId, 'start_message');
        } else {
          setPhase('video');
          EnhancedSessionStorage.setLessonState(sessionId, lessonId, 'video');
        }
        
      } catch (err) {
        console.error('Error loading lesson:', err);
        setError(err instanceof Error ? err.message : 'Failed to load lesson');
        setPhase('error');
      }
    };

    loadLesson();
  }, [lessonId, sessionId]);

  // Handle audio completion
  const handleAudioComplete = () => {
    setPhase('video');
    EnhancedSessionStorage.setLessonState(sessionId, lessonId, 'video');
    // Notify video player that audio is complete
    videoPlayerRef.current?.handleTTSComplete();
  };

  // Handle video completion
  const handleVideoEnd = async () => {
    try {
      // Start lesson conversation
      const response = await fetch('/api/start-lesson-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, sessionId })
      });

      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to start conversation');
      }

      setConversationUrl(data.conversationUrl);
      setPhase('conversation');
      EnhancedSessionStorage.setLessonState(sessionId, lessonId, 'conversation', data.conversationId);
      
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
      setPhase('error');
    }
  };

  // Handle lesson completion
  const handleLessonComplete = () => {
    EnhancedSessionStorage.setLessonState(sessionId, lessonId, 'completed');
    onComplete?.();
  };

  // Skip start message and go directly to video
  const skipToVideo = () => {
    setPhase('video');
    EnhancedSessionStorage.setLessonState(sessionId, lessonId, 'video');
    videoPlayerRef.current?.handleTTSComplete();
  };

  if (phase === 'loading') {
    return (
      <div className={`flex items-center justify-center min-h-[400px] ${className}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Lesson Error</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!lessonData) {
    return null;
  }

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{lessonData.lesson.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              <span>Educational Lesson</span>
            </div>
            {phase === 'start_message' && (
              <div className="flex items-center gap-1 text-blue-600">
                <Play className="w-4 h-4" />
                <span>Introduction</span>
              </div>
            )}
            {phase === 'video' && (
              <div className="flex items-center gap-1 text-blue-600">
                <Play className="w-4 h-4" />
                <span>Video Content</span>
              </div>
            )}
            {phase === 'conversation' && (
              <div className="flex items-center gap-1 text-green-600">
                <MessageCircle className="w-4 h-4" />
                <span>Q&A Discussion</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Start Message Phase */}
      {phase === 'start_message' && lessonData.startMessage && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">Lesson Introduction</h2>
            <p className="text-blue-800 mb-4">
              Listen to this introduction before watching the video content.
            </p>
            
            <AudioPlayer
              audioUrl={lessonData.startMessage.audioUrl}
              autoPlay={true}
              onComplete={handleAudioComplete}
              onError={(error) => {
                console.error('Audio Error:', error);
                // Continue to video even if audio fails
                handleAudioComplete();
              }}
              title="Lesson Introduction"
              className="mb-4"
            />
            
            <button
              onClick={skipToVideo}
              className="text-blue-600 hover:text-blue-700 text-sm underline"
            >
              Skip introduction and go to video
            </button>
          </div>
        </div>
      )}

      {/* Video Phase */}
      {(phase === 'video' || phase === 'conversation') && (
        <div className="space-y-6">
          <VideoPlayer
            ref={videoPlayerRef}
            videoUrl={lessonData.lesson.videoUrl}
            title={lessonData.lesson.title}
            autoPlay={phase === 'video'} // Auto-play when we're in video phase
            waitForTTS={!!lessonData.startMessage} // Wait for TTS if there was a start message
            onVideoEnd={handleVideoEnd}
            onVideoStart={() => {
              // Optional: Track video start analytics
            }}
            className="mb-6"
          />
        </div>
      )}

      {/* Conversation Phase */}
      {phase === 'conversation' && conversationUrl && (
        <div className="mt-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-green-900 mb-3">Q&A Discussion</h2>
            <p className="text-green-800 mb-4">
              Now let's discuss what you learned in the video. Click the button below to start your voice conversation.
            </p>
            
            <div className="flex gap-3">
              <a
                href={conversationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Start Voice Discussion
              </a>
              
              <button
                onClick={handleLessonComplete}
                className="px-6 py-3 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
              >
                Complete Lesson
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}