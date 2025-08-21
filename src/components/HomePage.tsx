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
  Salad
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
  
  useEffect(() => {
    // Load recent sessions
    const sessions = EnhancedSessionStorage.getAllSessions().slice(0, 5);
    setRecentSessions(sessions);
    
    // Load lessons
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-emerald-700">
              NutritionAssist
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-700">Hi, {userName}</span>
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold">
                {userName.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-5 py-8">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {userName}!
          </h1>
          <p className="text-lg text-gray-600">
            Ready to continue your nutrition journey?
          </p>
        </div>

        {/* Quick Start Card */}
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-3xl p-10 text-white mb-10 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white bg-opacity-10 rounded-full"></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-3">
              Start a Conversation
            </h2>
            <p className="text-lg mb-6 opacity-90">
              Ask any nutrition question or get personalized guidance from Dr. Smith
            </p>
            <button
              onClick={handleStartNewSession}
              className="bg-white text-emerald-700 px-8 py-4 text-lg font-semibold rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex items-center gap-3"
            >
              <div className="w-6 h-6 bg-emerald-700 rounded-full flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
              Start Talking
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          {/* Recommended Lessons */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold text-gray-900">Recommended Lessons</h3>
              <button 
                onClick={() => setCurrentView('knowledge')}
                className="text-emerald-700 text-sm font-medium hover:text-emerald-800"
              >
                Browse all →
              </button>
            </div>
            <div className="space-y-3">
              {lessons.slice(0, 3).map((lesson) => (
                <div 
                  key={lesson.id}
                  onClick={() => handleLessonClick(lesson)}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center text-2xl">
                    🥗
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 mb-1">
                      {lesson.title}
                    </div>
                    <div className="text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      15 min lesson
                    </div>
                  </div>
                </div>
              ))}
              {lessons.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No lessons available yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Conversations */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold text-gray-900">Recent Conversations</h3>
              <button 
                onClick={() => setCurrentView('sessions')}
                className="text-emerald-700 text-sm font-medium hover:text-emerald-800"
              >
                View all →
              </button>
            </div>
            <div className="space-y-3">
              {recentSessions.slice(0, 3).map((session) => (
                <div 
                  key={session.id}
                  onClick={handleLoadSession}
                  className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {session.updatedAt instanceof Date 
                      ? session.updatedAt.toLocaleDateString()
                      : new Date(session.updatedAt).toLocaleDateString()
                    }
                  </div>
                  <div className="font-medium text-gray-900 mb-1">
                    {session.title}
                  </div>
                  <div className="text-sm text-gray-600 line-clamp-2">
                    {session.summary || `${session.messages.length} messages exchanged`}
                  </div>
                </div>
              ))}
              {recentSessions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No recent conversations</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Your Progress</h3>
            <button className="text-emerald-700 text-sm font-medium hover:text-emerald-800">
              View details →
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700 mb-1">
                {stats.conversationsThisMonth}
              </div>
              <div className="text-sm text-gray-600">Conversations This Month</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700 mb-1">
                {stats.completedLessons}
              </div>
              <div className="text-sm text-gray-600">Lessons Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700 mb-1">
                {stats.goalsAchieved}
              </div>
              <div className="text-sm text-gray-600">Goals Achieved</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700 mb-1">
                {stats.weekStreak}
              </div>
              <div className="text-sm text-gray-600">Week Streak</div>
            </div>
          </div>
          <div className="bg-white bg-opacity-50 rounded-xl h-48 flex items-center justify-center text-gray-500">
            [Progress visualization would go here]
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="mt-8 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setCurrentView('knowledge')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Nutrition Library
            </button>
            <button
              onClick={() => setCurrentView('sessions')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <History className="w-4 h-4" />
              Session History
            </button>
            <a
              href="/admin"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Admin Panel
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}