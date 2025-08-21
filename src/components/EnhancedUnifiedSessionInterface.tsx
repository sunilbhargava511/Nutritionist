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
  RotateCcw,
  Settings,
  TrendingUp,
  Shield,
  Star,
  Sparkles,
  Heart,
  Users,
  Target,
  ChevronRight,
  ChevronLeft,
  PlayCircle,
  PauseCircle,
  Volume2,
  Zap,
  Award,
  CheckCircle,
  Bug
} from 'lucide-react';
import ConversationPanel from './ConversationPanel';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import ConversationalAI from './ConversationalAI-Enhanced';
import AppHeader from './AppHeader';
import AudioPlayer from './AudioPlayer';
import { Lesson } from '@/types';

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

export default function EnhancedUnifiedSessionInterface() {
  const [currentMode, setCurrentMode] = useState<InterfaceMode>('session_select');
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [showConversationPanel, setShowConversationPanel] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVideoCompleted, setIsVideoCompleted] = useState(false);
  
  // Lesson intro TTS state
  const [lessonPhase, setLessonPhase] = useState<'intro' | 'video' | 'qa'>('intro');
  const [introCompleted, setIntroCompleted] = useState(false);
  const [lessonIntroMessage, setLessonIntroMessage] = useState<string | null>(null);
  const [lessonIntroAudioUrl, setLessonIntroAudioUrl] = useState<string | null>(null);
  
  // Video player ref for TTS coordination
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [userStats, setUserStats] = useState({ 
    totalSessions: 12, 
    completedLessons: 3, 
    streak: 5 
  });

  // Load lessons on component mount
  useEffect(() => {
    loadLessons();
    loadUserStats();
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

  const loadUserStats = async () => {
    // Mock user stats - in real app, this would come from API
    setUserStats({
      totalSessions: Math.floor(Math.random() * 20) + 5,
      completedLessons: Math.floor(Math.random() * 8) + 1,
      streak: Math.floor(Math.random() * 10) + 1
    });
  };

  // Start open-ended session
  const handleStartOpenEndedSession = async () => {
    try {
      setIsInitializing(true);
      setError(null);

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

      // Switch to conversation mode
      setCurrentMode('conversation');
      // Start with transcript panel collapsed
      setShowConversationPanel(false);

    } catch (error) {
      console.error('Error starting open-ended session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start session');
    } finally {
      setIsInitializing(false);
    }
  };

  // Handle TTS intro completion
  const handleTTSComplete = useCallback(() => {
    setIntroCompleted(true);
    setLessonPhase('video');
    
    // Notify video player that TTS is complete
    if (videoPlayerRef.current) {
      videoPlayerRef.current.handleTTSComplete();
    }
  }, []);

  // Start lesson-based session
  const handleStartLessonSession = async (lesson: Lesson) => {
    try {
      setIsInitializing(true);
      setError(null);

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

      // Fetch lesson intro message and cached audio for TTS
      console.log('[EnhancedUnified] Fetching opening message for lesson:', lesson.id);
      const introResponse = await fetch(`/api/opening-messages/lesson/${lesson.id}`);
      
      if (introResponse.ok) {
        const introData = await introResponse.json();
        const openingMessageData = introData.openingMessageData;
        
        if (openingMessageData) {
          const introMessage = openingMessageData.messageContent;
          const cachedAudioUrl = openingMessageData.cachedAudioUrl;
          
          console.log('[EnhancedUnified] Setting lesson intro message:', introMessage?.substring(0, 100) + '...');
          console.log('[EnhancedUnified] Cached audio URL:', cachedAudioUrl);
          
          setLessonIntroMessage(introMessage);
          setLessonIntroAudioUrl(cachedAudioUrl);
        } else {
          // Fallback to lesson's startMessage if no opening message configured
          const fallbackMessage = lesson.startMessage || 'Welcome to this lesson. Let\'s begin!';
          console.log('[EnhancedUnified] Using lesson startMessage fallback:', fallbackMessage?.substring(0, 100) + '...');
          setLessonIntroMessage(fallbackMessage);
          setLessonIntroAudioUrl(null);
        }
      } else {
        console.error('[EnhancedUnified] Opening message API failed:', introResponse.status, introResponse.statusText);
        // Fallback to lesson's startMessage if API fails
        const fallbackMessage = lesson.startMessage || 'Welcome to this lesson. Let\'s begin!';
        console.log('[EnhancedUnified] Using fallback intro message:', fallbackMessage?.substring(0, 100) + '...');
        setLessonIntroMessage(fallbackMessage);
        setLessonIntroAudioUrl(null);
      }

      // Add lesson intro message to transcript
      await fetch('/api/session-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_opening_message',
          sessionId: data.session.id,
          messageType: 'lesson_intro',
          lessonId: lesson.id
        })
      });

      // Reset lesson progress states
      setLessonPhase('intro');
      setIntroCompleted(false);
      setIsVideoCompleted(false);

      // Switch to video mode
      setCurrentMode('video');
      // Start with transcript panel collapsed
      setShowConversationPanel(false);

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

      setCurrentSession(prev => prev ? {
        ...prev,
        lessonPhase: 'qa_conversation'
      } : null);

      // Set auto-start flag to automatically start the conversation
      localStorage.setItem('autoStartConversation', 'true');
      
      setCurrentMode('conversation');

    } catch (error) {
      console.error('Error starting Q&A:', error);
      setError(error instanceof Error ? error.message : 'Failed to start Q&A');
    }
  };

  // Handle conversation status changes
  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
  }, []);

  // Handle conversation errors
  const handleConversationError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    console.error('Conversation Error:', errorMessage);
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

  // Feature highlights for session select
  const features = [
    {
      icon: <MessageSquare className="w-5 h-5 text-blue-600" />,
      title: "Personalized Guidance",
      description: "Get tailored financial advice based on your unique situation"
    },
    {
      icon: <BookOpen className="w-5 h-5 text-green-600" />,
      title: "Interactive Lessons",
      description: "Learn through engaging video content with Q&A sessions"
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-purple-600" />,
      title: "Track Progress",
      description: "Monitor your financial learning journey with real-time insights"
    },
    {
      icon: <Shield className="w-5 h-5 text-indigo-600" />,
      title: "Safe & Secure",
      description: "Your financial conversations are private and confidential"
    }
  ];

  // Getting started tips
  const gettingStartedTips = [
    "💡 Start with 'Building Your Emergency Fund' if you're new to financial planning",
    "🎯 Use open conversations to ask specific questions about your situation",
    "📚 Complete lessons in order for a structured learning path",
    "🔄 Review previous sessions in your conversation history"
  ];

  // Render different modes
  const renderModeContent = () => {
    switch (currentMode) {
      case 'session_select':
        return (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
              <div className="absolute top-0 left-0 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl -translate-x-32 -translate-y-32"></div>
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl translate-x-32 translate-y-32"></div>
              
              <div className="relative max-w-7xl mx-auto px-6 py-16">
                {/* Navigation */}
                <nav className="flex items-center justify-between mb-16">
                  <AppHeader />
                  
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowGettingStarted(!showGettingStarted)}
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Getting Started
                    </button>
                    <a
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Admin
                    </a>
                    <a
                      href="/debug-llm"
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
                    >
                      <Bug className="w-4 h-4" />
                      Debug LLM
                    </a>
                  </div>
                </nav>

                {/* Main Hero Content */}
                <div className="text-center mb-16">
                  <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-gray-600 mb-6 border border-white/20">
                    <Zap className="w-4 h-4 text-blue-600" />
                    Powered by Advanced AI
                  </div>
                  
                  <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                    Your Personal
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent block">
                      Financial Guide
                    </span>
                  </h1>
                  
                  <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                    Build a healthier relationship with money through personalized conversations and interactive lessons with Sanjay, your AI financial advisor.
                  </p>

                  {/* User Stats */}
                  <div className="flex items-center justify-center gap-8 mb-12">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{userStats.totalSessions}</div>
                      <div className="text-sm text-gray-600">Sessions</div>
                    </div>
                    <div className="w-px h-8 bg-gray-300"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{userStats.completedLessons}</div>
                      <div className="text-sm text-gray-600">Lessons</div>
                    </div>
                    <div className="w-px h-8 bg-gray-300"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 flex items-center gap-1 justify-center">
                        {userStats.streak}
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      </div>
                      <div className="text-sm text-gray-600">Day Streak</div>
                    </div>
                  </div>
                </div>

                {/* TTS Test Button - Prominent Location */}
                <div className="max-w-md mx-auto mb-8">
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 text-center">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-3">🔊 TTS Test</h3>
                    <button
                      onClick={async () => {
                        console.log('ElevenLabs TTS Test button clicked');
                        try {
                          const response = await fetch('/api/elevenlabs-tts', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              text: 'Hello! This is a test of ElevenLabs text to speech. Can you hear me?',
                              voiceSettings: {
                                voiceId: 'MXGyTMlsvQgQ4BL0emIa',
                                stability: 0.6,
                                similarity_boost: 0.8,
                                style: 0.4,
                                use_speaker_boost: true
                              }
                            })
                          });
                          
                          if (!response.ok) {
                            throw new Error(`TTS failed: ${response.status}`);
                          }
                          
                          const audioBlob = await response.blob();
                          const audioUrl = URL.createObjectURL(audioBlob);
                          const audio = new Audio(audioUrl);
                          
                          audio.onended = () => {
                            URL.revokeObjectURL(audioUrl);
                            console.log('ElevenLabs TTS test completed');
                          };
                          
                          audio.onerror = (e) => {
                            console.error('Audio playback error:', e);
                            URL.revokeObjectURL(audioUrl);
                          };
                          
                          await audio.play();
                          console.log('ElevenLabs TTS test started');
                          
                        } catch (error) {
                          console.error('ElevenLabs TTS test failed:', error);
                          alert('ElevenLabs TTS test failed: ' + (error instanceof Error ? error.message : String(error)));
                        }
                      }}
                      className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                    >
                      🎤 Test ElevenLabs TTS
                    </button>
                    <p className="text-sm text-yellow-600 mt-3">
                      Click to test if ElevenLabs text-to-speech works
                    </p>
                  </div>
                </div>

                {/* Main Action Cards */}
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
                  {/* Open-ended conversation */}
                  <div className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:border-blue-200 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <MessageSquare className="w-8 h-8 text-blue-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                        Start Conversation
                      </h2>
                      <p className="text-gray-600 mb-8 text-center leading-relaxed">
                        Have a free-form discussion about your financial goals, questions, or concerns with personalized guidance.
                      </p>
                      
                      <div className="space-y-3 mb-8">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Personalized financial advice
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Voice or text conversations
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Complete conversation history
                        </div>
                      </div>
                      
                      <button
                        onClick={handleStartOpenEndedSession}
                        disabled={isInitializing}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 font-semibold text-lg shadow-lg hover:shadow-xl group"
                      >
                        {isInitializing ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Starting...
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            Start Conversation
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Lesson-based learning */}
                  <div className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-700 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:border-green-200 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/20">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <BookOpen className="w-8 h-8 text-green-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                        Guided Lessons
                      </h2>
                      <p className="text-gray-600 mb-8 text-center leading-relaxed">
                        Learn specific financial topics through structured video lessons followed by interactive Q&A sessions.
                      </p>
                      
                      <div className="space-y-3 mb-8">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          {lessons.length} interactive lessons available
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Video + discussion format
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Track learning progress
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setCurrentMode('lesson_selection')}
                        className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl hover:from-green-700 hover:to-emerald-800 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl group"
                      >
                        <div className="flex items-center justify-center gap-2">
                          Browse Lessons
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                  {features.map((feature, index) => (
                    <div key={index} className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/80 transition-all duration-300">
                      <div className="mb-4">{feature.icon}</div>
                      <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  ))}
                </div>

                {/* Getting Started Panel */}
                {showGettingStarted && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/20 max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                      <Sparkles className="w-6 h-6 text-purple-600" />
                      <h3 className="text-xl font-semibold text-gray-900">Getting Started Tips</h3>
                    </div>
                    <div className="space-y-4">
                      {gettingStartedTips.map((tip, index) => (
                        <div key={index} className="flex items-start gap-3 text-gray-700">
                          <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 text-sm font-medium flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <p>{tip}</p>
                        </div>
                      ))}
                      
                      {/* TTS Test for Debugging */}
                      <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                        <h4 className="font-semibold text-yellow-800 mb-2">🔊 TTS Test</h4>
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
                          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                        >
                          🎤 Test Browser TTS
                        </button>
                        <p className="text-sm text-yellow-600 mt-2">
                          Click to test if text-to-speech works in your browser
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'lesson_selection':
        return (
          <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <AppHeader onClick={() => setCurrentMode('session_select')} className="mb-6" />
                <button
                  onClick={() => setCurrentMode('session_select')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Back to Home
                </button>
                
                <div className="text-center mb-8">
                  <BookOpen className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h2 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Learning Path</h2>
                  <p className="text-gray-600 text-lg">
                    Select a lesson to start your guided learning journey with interactive Q&A
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lessons.map((lesson, index) => (
                  <div 
                    key={lesson.id}
                    className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-white/20 hover:border-green-300 relative overflow-hidden"
                    onClick={() => handleStartLessonSession(lesson)}
                  >
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-100 to-transparent rounded-full blur-2xl opacity-50"></div>
                    
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
                          <span className="text-2xl">💰</span>
                        </div>
                        <div className="text-sm text-green-600 font-medium bg-green-100 px-3 py-1 rounded-full">
                          Lesson {index + 1}
                        </div>
                      </div>
                      
                      <h3 className="font-bold text-gray-900 mb-3 text-lg group-hover:text-green-700 transition-colors">
                        {lesson.title}
                      </h3>
                      <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                        {lesson.videoSummary.length > 120 
                          ? lesson.videoSummary.substring(0, 120) + '...'
                          : lesson.videoSummary
                        }
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <PlayCircle className="w-4 h-4" />
                          Video + Q&A
                        </div>
                        <div className="flex items-center gap-2 text-green-600 font-medium text-sm group-hover:gap-3 transition-all">
                          Start Lesson
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {lessons.length === 0 && (
                <div className="text-center py-16">
                  <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Lessons Available</h3>
                  <p className="text-gray-600 mb-6">Lessons will appear here once they're created.</p>
                  <a
                    href="/admin"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Go to Admin Panel
                  </a>
                </div>
              )}
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-6">
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <AppHeader onClick={() => setCurrentMode('session_select')} className="mb-6" />
              
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <PlayCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{currentLesson?.title}</h2>
                    <p className="text-gray-600">Watch the lesson, then we'll discuss what you learned</p>
                  </div>
                </div>
              </div>
              
              {currentLesson && (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20">
                  {/* Audio Player for Introduction */}
                  {lessonPhase === 'intro' && lessonIntroMessage && (
                    <div className="mb-6">
                      <AudioPlayer
                        audioUrl={lessonIntroAudioUrl}
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

                  <VideoPlayer
                    ref={videoPlayerRef}
                    videoUrl={currentLesson.videoUrl}
                    title={currentLesson.title}
                    onVideoEnd={handleVideoEnd}
                    waitForTTS={lessonPhase === 'intro'}
                    className="w-full mb-6"
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {isVideoCompleted && (
                        <div className="flex items-center gap-2 text-green-600 font-medium">
                          <CheckCircle className="w-5 h-5" />
                          Video Completed
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      {/* Transcript Toggle Button */}
                      <button
                        onClick={() => setShowConversationPanel(!showConversationPanel)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                          showConversationPanel 
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                        }`}
                        title={showConversationPanel ? "Hide transcript" : "Show lesson transcript"}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Transcript</span>
                        {!showConversationPanel && (
                          <ChevronLeft className="w-3 h-3 text-gray-500 animate-pulse" />
                        )}
                      </button>
                      
                      {isVideoCompleted && (
                        <button
                          onClick={() => {
                            // Set auto-start flag for immediate conversation start
                            localStorage.setItem('autoStartConversation', 'true');
                            setCurrentMode('conversation');
                          }}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg"
                        >
                          <MessageSquare className="w-5 h-5" />
                          Start Q&A Discussion
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
              )}
            </div>
          </div>
        );

      case 'conversation':
        return (
          <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Enhanced Conversation Header */}
            <div className="bg-white/90 backdrop-blur-sm p-4 border-b border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <AppHeader onClick={() => setCurrentMode('session_select')} />
                  <div className="w-px h-8 bg-gray-300"></div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {currentSession?.sessionType === 'lesson_based' && currentLesson ? 
                        `Q&A: ${currentLesson.title}` : 
                        'Financial Conversation with Sanjay'
                      }
                    </h2>
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      {currentSession?.sessionType === 'lesson_based' ? 
                        'Discuss what you learned from the video' :
                        'Ask any financial questions or share your concerns'
                      }
                      <div className={`w-2 h-2 rounded-full ${
                        connectionStatus === 'connected' ? 'bg-green-500' : 
                        connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                        'bg-gray-400'
                      }`}></div>
                      <span className="text-xs">
                        {connectionStatus === 'connected' ? 'Connected' : 
                         connectionStatus === 'connecting' ? 'Connecting...' : 
                         'Ready'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowConversationPanel(!showConversationPanel)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      showConversationPanel 
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                    }`}
                    title={showConversationPanel ? "Hide transcript" : "Show conversation transcript"}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Transcript</span>
                    {!showConversationPanel && (
                      <ChevronLeft className="w-3 h-3 text-gray-500 animate-pulse" />
                    )}
                  </button>
                  
                  <button
                    onClick={handleEndSession}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    End Session
                  </button>
                </div>
              </div>
            </div>
            
            {/* Conversation Content */}
            <div className="flex-1 flex">
              {/* Main Conversation Area */}
              <div className="flex-1 flex flex-col">
                {currentSession && (
                  <ConversationalAI
                    sessionId={currentSession.id}
                    onStatusChange={handleStatusChange}
                    onError={handleConversationError}
                    skipOpeningMessage={currentSession.sessionType === 'lesson_based' && currentSession.lessonPhase === 'qa_conversation'}
                    autoStart={true} // Always auto-start conversations for seamless UX
                    className="flex-1 p-8"
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
    <div className="relative">
      {/* Error Alert */}
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 shadow-lg">
          <div className="text-red-600">⚠️</div>
          <span className="text-red-800 flex-1">{error}</span>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Mode Content */}
      {renderModeContent()}

      {/* Collapsible Conversation Panel */}
      {currentSession && (currentMode === 'conversation' || showConversationPanel) && (
        <ConversationPanel
          sessionId={currentSession.id}
          isOpen={showConversationPanel}
          onToggle={() => setShowConversationPanel(!showConversationPanel)}
          className="fixed right-0 top-0 h-full border-l border-gray-200 bg-white shadow-2xl z-40"
        />
      )}
    </div>
  );
}