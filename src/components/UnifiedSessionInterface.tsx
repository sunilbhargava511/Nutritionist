'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bot,
  MessageSquare,
  Play,
  BookOpen,
  ArrowRight,
  Clock,
  User,
  Mic,
  PhoneOff,
  Pause,
  RotateCcw
} from 'lucide-react';
import ConversationPanel from './ConversationPanel';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import ConversationalAI from './ConversationalAI-Enhanced';
import AudioPlayer from './AudioPlayer';
import LessonProgressBar, { LessonPhase } from './LessonProgressBar';
import { Lesson } from '@/types';

interface UnifiedSessionInterfaceProps {
  onBack?: () => void;
}

interface SessionData {
  id: string;
  sessionType: 'open_ended' | 'lesson_based';
  lessonPhase?: 'lesson_intro' | 'video_watching' | 'qa_conversation';
  currentLessonId?: string;
  status: 'active' | 'paused' | 'completed';
  startedAt: string;
}

type InterfaceMode = 'session_select' | 'lesson_selection' | 'video' | 'conversation';
type ConnectionStatus = 'idle' | 'requesting_permission' | 'connecting' | 'connected' | 'disconnected' | 'error';

export default function UnifiedSessionInterface({ onBack }: UnifiedSessionInterfaceProps) {
  const [currentMode, setCurrentMode] = useState<InterfaceMode>('session_select');
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [showConversationPanel, setShowConversationPanel] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVideoCompleted, setIsVideoCompleted] = useState(false);
  
  // Lesson phase tracking
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>('intro');
  const [introCompleted, setIntroCompleted] = useState(false);
  const [lessonIntroMessage, setLessonIntroMessage] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  // Video player ref for TTS coordination
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  // Load lessons on component mount
  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      const response = await fetch('/api/lessons?activeOnly=true');
      if (response.ok) {
        const data = await response.json();
        setLessons(data.lessons || []);
      }
    } catch (error) {
      console.error('Failed to load lessons:', error);
    }
  };

  // Start open-ended session
  const handleStartOpenEndedSession = async () => {
    try {
      setIsInitializing(true);
      setError(null);

      // Create session
      const response = await fetch('/api/session-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_session',
          sessionType: 'open_ended'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Session creation failed');
      }

      setCurrentSession(data.session);

      // Add general opening message
      await fetch('/api/session-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_opening_message',
          sessionId: data.session.id,
          messageType: 'general_opening'
        })
      });

      // Set auto-start flag for ConversationalAI component
      localStorage.setItem('autoStartConversation', 'true');

      // Switch to conversation mode
      setCurrentMode('conversation');
      setShowConversationPanel(true);

    } catch (error) {
      console.error('Error starting open-ended session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start session');
    } finally {
      setIsInitializing(false);
    }
  };

  // Start lesson-based session
  const handleStartLessonSession = async (lesson: Lesson) => {
    try {
      setIsInitializing(true);
      setError(null);

      // Create lesson-based session
      const response = await fetch('/api/session-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_session',
          sessionType: 'lesson_based',
          currentLessonId: lesson.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create lesson session');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Lesson session creation failed');
      }

      setCurrentSession(data.session);
      setCurrentLesson(lesson);

      // Add lesson intro message
      const introResponse = await fetch('/api/session-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_opening_message',
          sessionId: data.session.id,
          messageType: 'lesson_intro',
          lessonId: lesson.id
        })
      });

      if (introResponse.ok) {
        const introData = await introResponse.json();
        // Use the opening message from the API response, or fallback to lesson's startMessage
        const introMessage = introData.openingMessage || lesson.startMessage;
        setDebugLog(prev => [...prev, `✅ API Success: Got message (${introMessage?.length} chars)`]);
        console.log('[UnifiedSession] Setting lesson intro message:', introMessage?.substring(0, 100) + '...');
        setLessonIntroMessage(introMessage);
      } else {
        setDebugLog(prev => [...prev, `❌ API Failed: ${introResponse.status} ${introResponse.statusText}`]);
        console.error('[UnifiedSession] Opening message API failed:', introResponse.status, introResponse.statusText);
        // Fallback to lesson's startMessage if API fails
        const fallbackMessage = lesson.startMessage || 'Welcome to this lesson. Let\'s begin!';
        setDebugLog(prev => [...prev, `📋 Using fallback: ${fallbackMessage?.length} chars`]);
        console.log('[UnifiedSession] Using fallback intro message:', fallbackMessage?.substring(0, 100) + '...');
        setLessonIntroMessage(fallbackMessage);
      }

      // Reset lesson progress states
      setLessonPhase('intro');
      setIntroCompleted(false);
      setIsVideoCompleted(false);

      // Switch to video mode
      setCurrentMode('video');
      setShowConversationPanel(true);

    } catch (error) {
      console.error('Error starting lesson session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start lesson');
    } finally {
      setIsInitializing(false);
    }
  };

  // Handle video completion
  const handleVideoEnd = async () => {
    if (!currentSession || !currentLesson) return;

    try {
      setIsVideoCompleted(true);
      setLessonPhase('qa');

      // Start lesson Q&A
      const response = await fetch('/api/session-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_lesson_qa',
          sessionId: currentSession.id,
          lessonId: currentLesson.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start Q&A');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Q&A start failed');
      }

      // Update session state
      setCurrentSession(prev => prev ? {
        ...prev,
        lessonPhase: 'qa_conversation'
      } : null);

      // Set auto-start flag for ConversationalAI component (for Q&A after video)
      localStorage.setItem('autoStartConversation', 'true');

      // Switch to conversation mode
      setCurrentMode('conversation');

    } catch (error) {
      console.error('Error starting Q&A:', error);
      setError(error instanceof Error ? error.message : 'Failed to start Q&A');
    }
  };

  // Handle conversation status changes
  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    
    // Link ElevenLabs conversation when connected
    if (status === 'connected' && currentSession) {
      // This will be handled by the ConversationalAI component
      console.log('Connected to ElevenLabs for session:', currentSession.id);
    }
  }, [currentSession]);

  // Handle conversation errors
  const handleConversationError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    console.error('Conversation Error:', errorMessage);
  }, []);

  // Handle TTS intro completion
  const handleTTSComplete = useCallback(() => {
    setIntroCompleted(true);
    setLessonPhase('video');
    
    // Notify video player that TTS is complete
    if (videoPlayerRef.current) {
      videoPlayerRef.current.handleTTSComplete();
    }
  }, []);

  // End current session
  const handleEndSession = async () => {
    if (!currentSession) return;

    try {
      await fetch('/api/session-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end_session',
          sessionId: currentSession.id
        })
      });

      // Reset state
      setCurrentSession(null);
      setCurrentLesson(null);
      setCurrentMode('session_select');
      setConnectionStatus('idle');
      setShowConversationPanel(false);
      setError(null);

    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  // Render different modes
  const renderModeContent = () => {
    switch (currentMode) {
      case 'session_select':
        return (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-4xl w-full">
              <div className="text-center mb-8">
                <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome to Financial Learning with Sanjay
                </h1>
                <p className="text-lg text-gray-600">
                  Choose how you'd like to start your session
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Open-ended conversation */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border-2 hover:border-blue-300 transition-colors">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">
                      Open Conversation
                    </h2>
                    <p className="text-gray-600 mb-6">
                      Start a free-form discussion about your financial goals, questions, or concerns
                    </p>
                    <button
                      onClick={handleStartOpenEndedSession}
                      disabled={isInitializing}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isInitializing ? 'Starting...' : 'Start Conversation'}
                    </button>
                  </div>
                </div>

                {/* Lesson-based learning */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border-2 hover:border-green-300 transition-colors">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">
                      Guided Lessons
                    </h2>
                    <p className="text-gray-600 mb-6">
                      Choose a specific lesson to learn about financial topics with guided discussion
                    </p>
                    <button
                      onClick={() => setCurrentMode('lesson_selection')}
                      className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Browse Lessons
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'lesson_selection':
        return (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-4xl w-full">
              <div className="text-center mb-8">
                <BookOpen className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Choose a Lesson
                </h2>
                <p className="text-gray-600">
                  Select a lesson to start your guided learning session
                </p>
              </div>

              {/* TTS Test - Inline for Debugging */}
              <div className="mb-6 p-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-yellow-800 mb-3">🔊 TTS Test</h3>
                <button
                  onClick={() => {
                    console.log('TTS Test button clicked');
                    if ('speechSynthesis' in window) {
                      const utterance = new SpeechSynthesisUtterance('Hello! This is a test of text to speech. Can you hear me?');
                      utterance.rate = 0.9;
                      utterance.onstart = () => console.log('TTS started');
                      utterance.onend = () => console.log('TTS ended');
                      utterance.onerror = (e) => console.error('TTS error:', e);
                      window.speechSynthesis.speak(utterance);
                    } else {
                      alert('Speech synthesis not supported');
                    }
                  }}
                  className="px-6 py-3 text-lg bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  🎤 Test Browser TTS
                </button>
                <p className="text-sm text-yellow-600 mt-3">
                  Click this button to test if text-to-speech works in your browser
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {lessons.map((lesson) => (
                  <div 
                    key={lesson.id}
                    className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-2 hover:border-green-300"
                    onClick={() => handleStartLessonSession(lesson)}
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                        💰
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        {lesson.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {lesson.videoSummary.length > 100 
                          ? lesson.videoSummary.substring(0, 100) + '...'
                          : lesson.videoSummary
                        }
                      </p>
                      <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        Video + Discussion
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <button
                  onClick={() => setCurrentMode('session_select')}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  ← Back to Session Options
                </button>
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="flex-1 flex flex-col p-6">
            <div className="max-w-5xl w-full mx-auto">
              {/* Lesson Progress Bar */}
              <LessonProgressBar
                currentPhase={lessonPhase}
                introCompleted={introCompleted}
                videoCompleted={isVideoCompleted}
                videoDuration={300} // TODO: Get actual video duration
                introDuration={45} // Approximate TTS duration
                className="mb-6"
              />

              <div className="mb-4 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentLesson?.title}
                </h2>
                <p className="text-gray-600">
                  {lessonPhase === 'intro' && 'Listen to the introduction to understand what you\'ll learn'}
                  {lessonPhase === 'video' && 'Watch the lesson video carefully'}
                  {lessonPhase === 'qa' && 'Ready to discuss what you learned!'}
                </p>
              </div>

              
              {/* Debug Info */}
              <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
                <div><strong>Lesson Phase:</strong> {lessonPhase}</div>
                <div><strong>Intro Message Length:</strong> {lessonIntroMessage?.length || 0}</div>
                <div><strong>Intro Completed:</strong> {introCompleted.toString()}</div>
                <div><strong>Has Message:</strong> {!!lessonIntroMessage}</div>
                {lessonIntroMessage && (
                  <div><strong>Message Preview:</strong> {lessonIntroMessage.substring(0, 100)}...</div>
                )}
                <div className="mt-2">
                  <strong>Debug Log:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {debugLog.map((log, i) => (
                      <li key={i} className="text-xs">{log}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {/* TTS Player for Introduction */}
              {lessonPhase === 'intro' && lessonIntroMessage && (
                <div className="mb-6">
                  <AudioPlayer
                    audioUrl={null}
                    autoPlay={true}
                    onComplete={handleTTSComplete}
                    onError={(error) => {
                      console.error('Audio Error:', error);
                      // Still allow progression to video even if audio fails
                      handleTTSComplete();
                    }}
                    title="Lesson Introduction"
                    className="mb-4"
                  />
                  
                  {/* Skip button for intro */}
                  <div className="text-center">
                    <button
                      onClick={handleTTSComplete}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Skip introduction and go to video
                    </button>
                  </div>
                </div>
              )}
              
              {/* Video Player */}
              {currentLesson && (
                <div className={lessonPhase === 'intro' ? 'opacity-50 pointer-events-none' : ''}>
                  <VideoPlayer
                    ref={videoPlayerRef}
                    videoUrl={currentLesson.videoUrl}
                    title={currentLesson.title}
                    onVideoEnd={handleVideoEnd}
                    autoPlay={true}
                    waitForTTS={true}
                    className="w-full"
                  />
                </div>
              )}
              
              <div className="mt-6 flex justify-center gap-4">
                {isVideoCompleted && (
                  <button
                    onClick={() => setCurrentMode('conversation')}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ArrowRight className="w-5 h-5" />
                    Continue to Q&A Discussion
                  </button>
                )}
                <button
                  onClick={handleEndSession}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        );

      case 'conversation':
        return (
          <div className="h-full flex flex-col">
            {/* Conversation Header */}
            <div className="bg-white/80 backdrop-blur-sm p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {currentSession?.sessionType === 'lesson_based' && currentLesson ? 
                      `Q&A: ${currentLesson.title}` : 
                      'Financial Conversation with Sanjay'
                    }
                  </h2>
                  <p className="text-sm text-gray-600">
                    {currentSession?.sessionType === 'lesson_based' ? 
                      'Discuss what you learned from the video' :
                      'Ask any financial questions or share your concerns'
                    }
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Connection Status */}
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-green-500' : 
                      connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                      'bg-gray-400'
                    }`}></div>
                    <span className="text-sm text-gray-600">
                      {connectionStatus === 'connected' ? 'Connected' : 
                       connectionStatus === 'connecting' ? 'Connecting...' : 
                       'Ready'}
                    </span>
                  </div>
                  
                  <button
                    onClick={handleEndSession}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    End Session
                  </button>
                </div>
              </div>
            </div>
            
            {/* Conversation Content */}
            <div className="flex-1 flex">
              {/* Conversation Area */}
              <div className="flex-1 flex flex-col">
                {currentSession && (
                  <ConversationalAI
                    sessionId={currentSession.id}
                    onStatusChange={handleStatusChange}
                    onError={handleConversationError}
                    className="flex-1"
                  />
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Error Alert */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-50 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <div className="text-red-600">⚠️</div>
            <span className="text-red-800 flex-1">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Back Button - Always show when not on home */}
        {currentMode !== 'session_select' && (
          <div className="p-4">
            <button
              onClick={() => {
                handleEndSession();
                setCurrentMode('session_select');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        )}

        {/* Original Back Button (if provided) */}
        {onBack && currentMode === 'session_select' && (
          <div className="p-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Mode Content */}
        {renderModeContent()}
      </div>

      {/* Collapsible Conversation Panel */}
      {currentSession && (currentMode === 'conversation' || showConversationPanel) && (
        <ConversationPanel
          sessionId={currentSession.id}
          isOpen={showConversationPanel}
          onToggle={() => setShowConversationPanel(!showConversationPanel)}
          className="border-l border-gray-200 bg-white"
        />
      )}
    </div>
  );
}