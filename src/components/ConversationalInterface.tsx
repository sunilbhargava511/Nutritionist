'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  MessageSquare,
  User,
  Bot,
  Play,
  BookOpen,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import ConversationalAI from './ConversationalAI-RealFTherapy'; // Using REAL FTherapy pattern
import VideoPlayer from './VideoPlayer';
import { Lesson, UserSession, LessonProgress } from '@/types';

interface ConversationSession {
  id: string;
  status: 'idle' | 'connecting' | 'active' | 'ended';
  startTime?: Date;
  endTime?: Date;
  transcript: TranscriptEntry[];
  duration: number;
  currentLesson?: Lesson;
  userSession?: UserSession;
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type ConnectionStatus = 'idle' | 'requesting_permission' | 'connecting' | 'connected' | 'disconnected' | 'error';

type InterfaceMode = 'introduction' | 'lesson_selection' | 'video' | 'qa' | 'completed';

export default function ConversationalInterface() {
  const [session, setSession] = useState<ConversationSession>({
    id: `session_${Date.now()}`,
    status: 'idle',
    transcript: [],
    duration: 0
  });
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [showTranscript, setShowTranscript] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Lesson system state
  const [currentMode, setCurrentMode] = useState<InterfaceMode>('introduction');
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [sessionProgress, setSessionProgress] = useState<LessonProgress | null>(null);
  const [recommendedLesson, setRecommendedLesson] = useState<Lesson | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [isVideoCompleted, setIsVideoCompleted] = useState(false);

  // Initialize lesson-based session on component mount
  useEffect(() => {
    const initializeLessonSession = async () => {
      try {
        // Create or get user session
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start',
            // userId: undefined for now (anonymous sessions)
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('User session created:', data.session.id);
          
          setUserSession(data.session);
          setSession(prev => ({ ...prev, userSession: data.session }));
          
          // Store session ID for persistence
          localStorage.setItem('currentUserSessionId', data.session.id);
          
          // Load session progress
          await loadSessionProgress(data.session.id);
          
        } else {
          console.error('Failed to create user session');
          setError('Failed to initialize session. Please refresh and try again.');
        }
      } catch (error) {
        console.error('Error initializing lesson session:', error);
        setError('Failed to initialize session. Please refresh and try again.');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeLessonSession();
  }, []);

  // Load session progress and determine next steps
  const loadSessionProgress = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions?sessionId=${sessionId}&action=progress`);
      if (response.ok) {
        const data = await response.json();
        setSessionProgress(data.progress);
        
        // Determine the appropriate mode based on progress
        if (data.progress.nextRecommendedLesson) {
          setRecommendedLesson(data.progress.nextRecommendedLesson);
          setCurrentMode('lesson_selection');
        } else if (data.progress.percentComplete === 100) {
          setCurrentMode('completed');
        } else {
          setCurrentMode('introduction');
        }
      }
    } catch (error) {
      console.error('Error loading session progress:', error);
    }
  };
  
  // Handle new messages from ConversationalAI
  const handleMessage = useCallback((message: { role: 'user' | 'assistant'; content: string; timestamp: Date }) => {
    setSession(prev => ({
      ...prev,
      transcript: [...prev.transcript, message]
    }));
  }, []);

  // Lesson flow handlers
  const handleAcceptLesson = useCallback(async (lesson: Lesson) => {
    if (!userSession) return;
    
    try {
      // End current conversation
      setConnectionStatus('disconnected');
      
      // Set lesson as current and switch to video mode
      setCurrentLesson(lesson);
      setCurrentMode('video');
      setIsVideoCompleted(false);
      
    } catch (error) {
      console.error('Error starting lesson:', error);
      setError('Failed to start lesson. Please try again.');
    }
  }, [userSession]);

  const handleDeclineLesson = useCallback(() => {
    setCurrentMode('introduction');
    setRecommendedLesson(null);
  }, []);

  const handleVideoEnd = useCallback(async () => {
    if (!userSession || !currentLesson) return;
    
    try {
      setIsVideoCompleted(true);
      
      // Start lesson conversation
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_lesson_conversation',
          sessionId: userSession.id,
          lessonId: currentLesson.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Lesson conversation started:', data.conversation.id);
        
        // Store the lesson conversation context
        localStorage.setItem('currentLessonConversationId', data.conversation.id);
        localStorage.setItem('currentLessonId', currentLesson.id);
        
        // Switch to Q&A mode
        setCurrentMode('qa');
        
      } else {
        console.error('Failed to start lesson conversation');
        setError('Failed to start Q&A session. Please try again.');
      }
    } catch (error) {
      console.error('Error starting Q&A:', error);
      setError('Failed to start Q&A session. Please try again.');
    }
  }, [userSession, currentLesson]);

  const handleVideoRestart = useCallback(() => {
    setIsVideoCompleted(false);
  }, []);

  const handleQAComplete = useCallback(async () => {
    if (!userSession || !currentLesson) return;
    
    try {
      // Mark lesson as completed
      const conversationId = localStorage.getItem('currentLessonConversationId');
      if (conversationId) {
        await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete_lesson_conversation',
            conversationId,
          }),
        });
      }
      
      // Reload progress and determine next step
      await loadSessionProgress(userSession.id);
      
      // Clear lesson context
      localStorage.removeItem('currentLessonConversationId');
      localStorage.removeItem('currentLessonId');
      setCurrentLesson(null);
      
    } catch (error) {
      console.error('Error completing lesson:', error);
      setError('Failed to complete lesson. Please try again.');
    }
  }, [userSession, currentLesson]);

  const handleReturnToIntroduction = useCallback(() => {
    setCurrentMode('introduction');
    setCurrentLesson(null);
    setRecommendedLesson(null);
    setIsVideoCompleted(false);
    setConnectionStatus('idle');
  }, []);

  // Handle connection status changes
  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    
    // Update session status based on connection
    setSession(prev => {
      switch (status) {
        case 'connected':
          return {
            ...prev,
            status: 'active',
            startTime: prev.startTime || new Date()
          };
        case 'disconnected':
          return {
            ...prev,
            status: 'ended',
            endTime: new Date(),
            duration: prev.startTime ? 
              Math.floor((new Date().getTime() - prev.startTime.getTime()) / 1000) : 0
          };
        default:
          return prev;
      }
    });
  }, []);

  // Handle errors from ConversationalAI
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    console.error('ConversationalInterface Error:', errorMessage);
  }, []);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Initializing Session</h2>
          <p className="text-gray-600 mb-4">Setting up your conversation with Sanjay...</p>
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Render different modes
  const renderModeContent = () => {
    switch (currentMode) {
      case 'lesson_selection':
        return (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Recommended Lesson
                </h2>
                {recommendedLesson && (
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">
                      {recommendedLesson.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {recommendedLesson.videoSummary.length > 150 
                        ? recommendedLesson.videoSummary.substring(0, 150) + '...'
                        : recommendedLesson.videoSummary
                      }
                    </p>
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => handleAcceptLesson(recommendedLesson)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Play className="w-5 h-5" />
                        Start Lesson
                      </button>
                      <button
                        onClick={handleDeclineLesson}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Continue Q&A
                      </button>
                    </div>
                  </div>
                )}
                {sessionProgress && (
                  <div className="text-sm text-gray-500">
                    Progress: {sessionProgress.completedLessons.length} of {sessionProgress.totalLessons} lessons completed
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-4xl w-full">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentLesson?.title}
                </h2>
                <p className="text-gray-600">
                  Watch the lesson video, then we'll discuss what you learned
                </p>
              </div>
              {currentLesson && (
                <VideoPlayer
                  videoUrl={currentLesson.videoUrl}
                  title={currentLesson.title}
                  onVideoEnd={handleVideoEnd}
                  className="w-full"
                />
              )}
              <div className="mt-6 flex justify-center gap-4">
                {isVideoCompleted && (
                  <button
                    onClick={() => setCurrentMode('qa')}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ArrowRight className="w-5 h-5" />
                    Continue to Q&A
                  </button>
                )}
                <button
                  onClick={handleReturnToIntroduction}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Back to Menu
                </button>
              </div>
            </div>
          </div>
        );

      case 'qa':
        return (
          <div className="h-full flex flex-col">
            {/* Q&A Header */}
            <div className="bg-white/80 backdrop-blur-sm p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Q&A Session: {currentLesson?.title}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Discuss what you learned from the video
                  </p>
                </div>
                <button
                  onClick={handleQAComplete}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Lesson
                </button>
              </div>
            </div>
            
            {/* Q&A Content */}
            <div className="flex-1 flex">
              {/* Conversation Area */}
              <div className="flex-1 flex flex-col">
                <ConversationalAI
                  onMessage={handleMessage}
                  onStatusChange={handleStatusChange}
                  onError={handleError}
                  className="flex-1"
                />
              </div>
              
              {/* Transcript Sidebar */}
              {showTranscript && (
                <div className="w-80 bg-white/90 backdrop-blur-sm border-l border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Transcript</h3>
                      <button
                        onClick={() => setShowTranscript(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="p-4 overflow-y-auto h-full">
                    <div className="space-y-4">
                      {session.transcript.map((entry, index) => (
                        <div key={index} className="flex gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            entry.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            {entry.role === 'user' ? (
                              <User className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Bot className="w-4 h-4 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-gray-500 mb-1">
                              {entry.role === 'user' ? 'You' : 'Sanjay'} • {entry.timestamp.toLocaleTimeString()}
                            </div>
                            <div className="text-sm text-gray-900">
                              {entry.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'completed':
        return (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Congratulations!
                </h2>
                <p className="text-gray-600 mb-6">
                  You've completed all available lessons. You can continue with open-ended financial discussions or review previous lessons.
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handleReturnToIntroduction}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Continue Discussion
                  </button>
                </div>
                {sessionProgress && (
                  <div className="mt-4 text-sm text-gray-500">
                    {sessionProgress.completedLessons.length} lessons completed
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default: // 'introduction'
        return (
          <div className="h-full flex flex-col">
            {/* Introduction Header */}
            <div className="bg-white/80 backdrop-blur-sm p-4 border-b border-gray-200">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  Welcome to Financial Learning with Sanjay
                </h2>
                <p className="text-sm text-gray-600">
                  Start a conversation to get personalized lesson recommendations
                </p>
              </div>
            </div>
            
            {/* Introduction Content */}
            <div className="flex-1 flex">
              {/* Conversation Area */}
              <div className="flex-1 flex flex-col">
                <ConversationalAI
                  onMessage={handleMessage}
                  onStatusChange={handleStatusChange}
                  onError={handleError}
                  className="flex-1"
                />
              </div>
              
              {/* Transcript Sidebar */}
              {showTranscript && (
                <div className="w-80 bg-white/90 backdrop-blur-sm border-l border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Transcript</h3>
                      <button
                        onClick={() => setShowTranscript(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="p-4 overflow-y-auto h-full">
                    <div className="space-y-4">
                      {session.transcript.map((entry, index) => (
                        <div key={index} className="flex gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            entry.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            {entry.role === 'user' ? (
                              <User className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Bot className="w-4 h-4 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-gray-500 mb-1">
                              {entry.role === 'user' ? 'You' : 'Sanjay'} • {entry.timestamp.toLocaleTimeString()}
                            </div>
                            <div className="text-sm text-gray-900">
                              {entry.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Initializing Session</h2>
          <p className="text-gray-600 mb-4">Setting up your lesson-based learning experience...</p>
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50">
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

      {/* Main Interface */}
      <div className="h-full flex flex-col">
        {/* Mode Content */}
        {renderModeContent()}
        
        {/* Status Footer */}
        <div className="bg-white/80 backdrop-blur-sm p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                  'bg-gray-400'
                }`}></div>
                <span className="text-sm text-gray-600 capitalize">
                  {connectionStatus === 'connected' ? 'Voice Active' : 
                   connectionStatus === 'connecting' ? 'Connecting...' : 
                   'Voice Inactive'}
                </span>
              </div>
              {sessionProgress && (
                <div className="text-sm text-gray-500">
                  Progress: {sessionProgress.completedLessons.length}/{sessionProgress.totalLessons} lessons
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {currentMode === 'introduction' || currentMode === 'qa' ? (
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  {showTranscript ? 'Hide' : 'Show'} Transcript
                </button>
              ) : null}
              <div className="text-sm text-gray-500">
                Mode: {currentMode.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}