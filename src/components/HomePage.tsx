'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  BookOpen, 
  History, 
  User, 
  Mic,
  Bot,
  Sparkles,
  Target,
  TrendingUp,
  Settings,
  Play,
  Clock,
  Eye,
  Heart,
  Activity,
  Award,
  Salad,
  Menu,
  X,
  Shield
} from 'lucide-react';
import { Session, Lesson } from '@/types';
import { EnhancedSessionStorage } from '@/lib/session-enhanced';
import ConversationalInterface from '@/components/ConversationalInterface';
import KnowledgeBase from '@/components/knowledge/KnowledgeBase';
import LessonInterface from '@/components/LessonInterface';

type ViewType = 'home' | 'voice' | 'knowledge' | 'sessions' | 'lesson';

export default function HomePage() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [userName] = useState('Sarah'); // Could be dynamic from user settings
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu && !(event.target as Element)?.closest('.menu-container')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    // Load recent sessions
    const sessions = EnhancedSessionStorage.getAllSessions().slice(0, 5);
    
    // Add mock conversations if no real sessions exist
    if (sessions.length === 0) {
      const mockSessions = [
        {
          id: 'mock_1',
          title: 'Meal Planning for Busy Week',
          updatedAt: new Date(),
          summary: 'Discussed quick breakfast options and meal prep strategies for your upcoming conference week...',
          messages: [],
          notes: [],
          createdAt: new Date(),
          isActive: false
        },
        {
          id: 'mock_2', 
          title: 'Post-Workout Nutrition',
          updatedAt: new Date(Date.now() - 86400000), // Yesterday
          summary: 'Covered protein timing, hydration needs, and specific snack recommendations for your training schedule...',
          messages: [],
          notes: [],
          createdAt: new Date(Date.now() - 86400000),
          isActive: false
        },
        {
          id: 'mock_3',
          title: 'Managing Sugar Cravings',
          updatedAt: new Date(Date.now() - 7 * 86400000), // Week ago
          summary: 'Explored strategies for reducing afternoon sugar cravings and healthier alternative snacks...',
          messages: [],
          notes: [],
          createdAt: new Date(Date.now() - 7 * 86400000),
          isActive: false
        }
      ];
      setRecentSessions(mockSessions);
    } else {
      setRecentSessions(sessions);
    }
    
    // Load lessons
    loadLessons();
  }, []);
  
  const loadLessons = async () => {
    try {
      const response = await fetch('/api/lessons?activeOnly=true');
      if (response.ok) {
        const data = await response.json();
        if (data.lessons && data.lessons.length > 0) {
          setLessons(data.lessons);
        } else {
          // Add mock lessons if none exist
          setLessons([
            {
              id: 'mock_lesson_1',
              title: 'Building Balanced Meals',
              videoUrl: '',
              videoSummary: 'Learn how to create nutritionally balanced meals',
              orderIndex: 0,
              active: true,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 'mock_lesson_2', 
              title: 'Protein Sources Guide',
              videoUrl: '',
              videoSummary: 'Comprehensive guide to protein sources',
              orderIndex: 1,
              active: true,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 'mock_lesson_3',
              title: 'Smart Snacking Strategies', 
              videoUrl: '',
              videoSummary: 'Healthy snacking strategies and options',
              orderIndex: 2,
              active: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to load lessons:', error);
      // Add mock lessons on error too
      setLessons([
        {
          id: 'mock_lesson_1',
          title: 'Building Balanced Meals',
          videoUrl: '',
          videoSummary: 'Learn how to create nutritionally balanced meals',
          orderIndex: 0,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'mock_lesson_2', 
          title: 'Protein Sources Guide',
          videoUrl: '',
          videoSummary: 'Comprehensive guide to protein sources', 
          orderIndex: 1,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'mock_lesson_3',
          title: 'Smart Snacking Strategies',
          videoUrl: '',
          videoSummary: 'Healthy snacking strategies and options',
          orderIndex: 2,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    }
  };

  const handleStartNewSession = async () => {
    try {
      // Set flag to auto-start conversation
      localStorage.setItem('autoStartConversation', 'true');
      
      // Create a new educational session
      const response = await fetch('/api/educational-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          // No explicit personalization/conversation aware settings - will use admin defaults
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Store session ID in localStorage for the conversation interface
        localStorage.setItem('currentEducationalSessionId', data.session.id);
        
        // Store the conversation mode for the voice interface to use
        localStorage.setItem('conversationMode', data.conversationMode);
        
        if (data.conversationMode === 'open-ended') {
          // Structured conversation is disabled - notify user about open-ended conversation mode
          console.log('Structured conversation is disabled, starting open-ended conversation mode');
          // Remove the alert - it's too disruptive
          // alert('Structured conversation is currently disabled. Starting open-ended conversation mode instead.');
        }
        
        setCurrentView('voice');
      } else {
        // Generic error handling for actual failures
        const errorData = await response.json();
        console.error('Failed to create session:', errorData.error || 'Unknown error');
        alert(errorData.error || 'Failed to start session. Please try again.');
        // Clear auto-start flag on error
        localStorage.removeItem('autoStartConversation');
      }
    } catch (error) {
      console.error('Error creating educational session:', error);
      alert('Failed to start educational session. Please try again.');
      // Clear auto-start flag on error
      localStorage.removeItem('autoStartConversation');
    }
  };

  const handleLoadSession = () => {
    setCurrentView('voice');
  };
  
  const handleLessonClick = async (lesson: Lesson) => {
    try {
      // Generate or get existing session ID
      let sessionId = localStorage.getItem('currentUserSessionId');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('currentUserSessionId', sessionId);
      }
      
      setCurrentLessonId(lesson.id);
      setCurrentSessionId(sessionId);
      setCurrentView('lesson');
      
    } catch (error) {
      console.error('Error starting lesson:', error);
      alert('Failed to start lesson. Please try again.');
    }
  };
  
  const getProgressStats = () => {
    const totalSessions = recentSessions.length;
    const totalLessons = lessons.length;
    const completedLessons = Math.floor(totalLessons * 0.6); // Mock completed percentage
    const conversationsThisMonth = Math.max(12, totalSessions); // Mock data
    const goalsAchieved = '85%'; // Mock data
    const weekStreak = 4; // Mock data
    
    return {
      conversationsThisMonth,
      sessionsCount: totalSessions,
      completedLessons,
      goalsAchieved,
      weekStreak
    };
  };

  if (currentView === 'voice') {
    return <ConversationalInterface />;
  }


  if (currentView === 'knowledge') {
    return <KnowledgeBase onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'lesson' && currentLessonId && currentSessionId) {
    return (
      <LessonInterface
        lessonId={currentLessonId}
        sessionId={currentSessionId}
        onBack={() => setCurrentView('home')}
        onComplete={() => {
          // Mark lesson as completed and return to home
          setCurrentView('home');
          // Optionally refresh lessons to show progress
          loadLessons();
        }}
      />
    );
  }

  const stats = getProgressStats();
  
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif' }}>
      {/* Header */}
      <header className="bg-white sticky top-0 z-50" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div className="max-w-6xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold" style={{ color: '#2d7d46' }}>
              NutritionAssist
            </div>
            <div className="flex items-center gap-3">
              <span style={{ color: '#1a1a1a' }}>Hi, {userName}</span>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: 'linear-gradient(135deg, #2d7d46, #4ca666)' }}>
                {userName.charAt(0)}
              </div>
              {/* Hamburger Menu Button */}
              <div className="menu-container relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
                  style={{ color: '#2d7d46' }}
                >
                  {showMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                  <div className="absolute right-0 top-full w-64 bg-white shadow-lg border border-gray-200 rounded-lg mt-2 z-50">
                    <div className="py-2">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">Menu</div>
                        <div className="text-xs text-gray-500">Navigation & Settings</div>
                      </div>
                      
                      <button
                        onClick={() => {
                          window.open('/admin', '_blank');
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <Shield className="w-5 h-5 text-blue-600" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Admin Panel</div>
                          <div className="text-xs text-gray-500">Manage system settings</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setCurrentView('knowledge');
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <BookOpen className="w-5 h-5 text-green-600" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Knowledge Base</div>
                          <div className="text-xs text-gray-500">Browse all lessons</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setCurrentView('sessions');
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <History className="w-5 h-5 text-purple-600" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Session History</div>
                          <div className="text-xs text-gray-500">View past conversations</div>
                        </div>
                      </button>

                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            alert('Settings coming soon!');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                        >
                          <Settings className="w-5 h-5 text-gray-600" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">Settings</div>
                            <div className="text-xs text-gray-500">User preferences</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-5 py-8">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1a1a1a' }}>
            Welcome back, {userName}!
          </h1>
          <p className="text-lg" style={{ color: '#666' }}>
            Ready to continue your nutrition journey?
          </p>
        </div>

        {/* Quick Start Card */}
        <div 
          className="rounded-2xl p-10 text-white mb-10 relative overflow-hidden" 
          style={{ background: 'linear-gradient(135deg, #2d7d46 0%, #4ca666 100%)' }}
        >
          <div 
            className="absolute w-48 h-48 rounded-full" 
            style={{ 
              right: '-50px', 
              top: '-50px', 
              background: 'rgba(255,255,255,0.1)' 
            }}
          ></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-3">
              Start a Conversation
            </h2>
            <p className="text-lg mb-6" style={{ opacity: 0.9 }}>
              Ask any nutrition question or get personalized guidance from Dr. Smith
            </p>
            <button
              onClick={handleStartNewSession}
              className="bg-white px-8 py-4 text-lg font-semibold rounded-xl flex items-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-200" 
              style={{ color: '#2d7d46' }}
            >
              <div 
                className="w-6 h-6 rounded-full" 
                style={{ backgroundColor: '#2d7d46' }}
              ></div>
              Start Talking
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          {/* Recent Conversations */}
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold" style={{ color: '#1a1a1a' }}>Recent Conversations</h3>
              <button 
                onClick={() => setCurrentView('sessions')}
                className="text-sm font-medium" 
                style={{ color: '#2d7d46' }}
              >
                View all →
              </button>
            </div>
            <div className="space-y-3">
              {recentSessions.slice(0, 3).map((session) => (
                <div 
                  key={session.id}
                  onClick={handleLoadSession}
                  className="p-4 rounded-xl cursor-pointer transition-colors" 
                  style={{ backgroundColor: '#f8fafb' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafb'}
                >
                  <div className="text-xs mb-1" style={{ color: '#999' }}>
                    {session.updatedAt instanceof Date 
                      ? session.updatedAt.toLocaleDateString()
                      : new Date(session.updatedAt).toLocaleDateString()
                    }
                  </div>
                  <div className="font-medium mb-1" style={{ color: '#1a1a1a' }}>
                    {session.title}
                  </div>
                  <div className="text-sm line-clamp-2" style={{ color: '#666' }}>
                    {session.summary || `${session.messages.length} messages exchanged`}
                  </div>
                </div>
              ))}
              {recentSessions.length === 0 && (
                <div className="text-center py-8" style={{ color: '#999' }}>
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No recent conversations</p>
                </div>
              )}
            </div>
          </div>

          {/* Recommended Lessons */}
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold" style={{ color: '#1a1a1a' }}>Recommended Lessons</h3>
              <button 
                onClick={() => setCurrentView('knowledge')}
                className="text-sm font-medium" 
                style={{ color: '#2d7d46' }}
              >
                Browse all →
              </button>
            </div>
            <div className="space-y-3">
              {lessons.slice(0, 3).map((lesson, index) => {
                const icons = ['🥗', '💪', '🍎'];
                return (
                  <div 
                    key={lesson.id}
                    onClick={() => handleLessonClick(lesson)}
                    className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-colors" 
                    style={{ backgroundColor: '#f8fafb' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafb'}
                  >
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" 
                      style={{ background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' }}
                    >
                      {icons[index] || '🥗'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium mb-1" style={{ color: '#1a1a1a' }}>
                        {lesson.title}
                      </div>
                      <div className="text-sm" style={{ color: '#666' }}>
                        15 min lesson
                      </div>
                    </div>
                  </div>
                );
              })}
              {lessons.length === 0 && (
                <div className="text-center py-8" style={{ color: '#999' }}>
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No lessons available yet</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Progress Overview */}
        <div 
          className="bg-white rounded-2xl p-6 col-span-full" 
          style={{ 
            background: 'linear-gradient(135deg, #f3e5f5, #e1bee7)', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)' 
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold" style={{ color: '#1a1a1a' }}>Your Progress</h3>
            <button className="text-sm font-medium" style={{ color: '#2d7d46' }}>
              View details →
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold mb-1" style={{ color: '#6a1b9a' }}>
                {stats.conversationsThisMonth}
              </div>
              <div className="text-sm" style={{ color: '#666' }}>Conversations This Month</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1" style={{ color: '#6a1b9a' }}>
                {stats.completedLessons}
              </div>
              <div className="text-sm" style={{ color: '#666' }}>Lessons Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1" style={{ color: '#6a1b9a' }}>
                {stats.goalsAchieved}
              </div>
              <div className="text-sm" style={{ color: '#666' }}>Goals Achieved</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1" style={{ color: '#6a1b9a' }}>
                {stats.weekStreak}
              </div>
              <div className="text-sm" style={{ color: '#666' }}>Week Streak</div>
            </div>
          </div>
          <div 
            className="rounded-xl h-48 flex items-center justify-center" 
            style={{ 
              background: 'rgba(255,255,255,0.5)', 
              color: '#999' 
            }}
          >
            [Progress visualization would go here]
          </div>
        </div>
        
      </main>
    </div>
  );
}