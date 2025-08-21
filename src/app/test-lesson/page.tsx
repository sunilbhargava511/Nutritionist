'use client';

import React, { useState, useEffect } from 'react';
import LessonInterface from '@/components/LessonInterface';
import { BookOpen, Play, MessageCircle, CheckCircle } from 'lucide-react';

export default function TestLessonPage() {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showLesson, setShowLesson] = useState(false);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'select' | 'lesson' | 'complete'>('select');

  // Load available lessons
  useEffect(() => {
    const loadLessons = async () => {
      try {
        const response = await fetch('/api/lessons');
        const data = await response.json();
        if (data.success && data.lessons) {
          setLessons(data.lessons);
          // Automatically select the test lesson if available
          const testLesson = data.lessons.find((l: any) => 
            l.title.includes('Test Enhanced Lesson')
          );
          if (testLesson) {
            setLessonId(testLesson.id);
          }
        }
      } catch (error) {
        console.error('Failed to load lessons:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLessons();
  }, []);

  // Generate session ID
  useEffect(() => {
    const id = `test_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(id);
  }, []);

  const startLesson = () => {
    if (lessonId && sessionId) {
      setShowLesson(true);
      setPhase('lesson');
    }
  };

  const handleLessonComplete = () => {
    setPhase('complete');
    setShowLesson(false);
  };

  const handleBack = () => {
    setShowLesson(false);
    setPhase('select');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lessons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Test Enhanced Lesson System
          </h1>
          <p className="text-gray-600">
            Experience the enhanced lesson flow with TTS introduction, video content, and contextual Q&A
          </p>
          
          {/* System Status */}
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              <CheckCircle className="w-4 h-4" />
              Webhook Enhanced
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              <CheckCircle className="w-4 h-4" />
              Lesson Context Active
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              <MessageCircle className="w-4 h-4" />
              Session: {sessionId?.slice(0, 20)}...
            </div>
          </div>
        </div>

        {/* Phase: Select Lesson */}
        {phase === 'select' && !showLesson && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Select a Lesson to Test
            </h2>
            
            {lessons.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">No lessons available</p>
                <p className="text-sm text-gray-500">Create lessons using the API first</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      lessonId === lesson.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setLessonId(lesson.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{lesson.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{lesson.videoSummary}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Order: {lesson.orderIndex}</span>
                          <span>ID: {lesson.id.slice(0, 20)}...</span>
                        </div>
                      </div>
                      {lessonId === lesson.id && (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {lessonId && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={startLesson}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Play className="w-5 h-5" />
                  Start Selected Lesson
                </button>
              </div>
            )}
          </div>
        )}

        {/* Phase: Lesson Active */}
        {phase === 'lesson' && showLesson && lessonId && sessionId && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <BookOpen className="w-4 h-4" />
                <span>Active Lesson Session</span>
              </div>
            </div>
            
            <LessonInterface
              lessonId={lessonId}
              sessionId={sessionId}
              onBack={handleBack}
              onComplete={handleLessonComplete}
            />
          </div>
        )}

        {/* Phase: Complete */}
        {phase === 'complete' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Lesson Complete!
              </h2>
              <p className="text-gray-600 mb-6">
                Great job! You've completed the enhanced lesson experience.
              </p>
              
              <div className="space-y-3 max-w-md mx-auto">
                <div className="bg-gray-50 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-gray-900 mb-2">What happened:</h3>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>✅ TTS introduction played (if available)</li>
                    <li>✅ Video content displayed</li>
                    <li>✅ Conversation started with lesson context</li>
                    <li>✅ AI had full awareness of lesson content</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setPhase('select');
                    setLessonId(null);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Try Another Lesson
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Restart Test
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Debug Info */}
        <div className="mt-6 bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs">
          <div className="mb-2 text-gray-400">Debug Information:</div>
          <div className="space-y-1">
            <div>Phase: <span className="text-yellow-400">{phase}</span></div>
            <div>Session ID: <span className="text-green-400">{sessionId}</span></div>
            <div>Lesson ID: <span className="text-blue-400">{lessonId || 'none'}</span></div>
            <div>Show Lesson: <span className="text-purple-400">{showLesson.toString()}</span></div>
            <div>Total Lessons: <span className="text-orange-400">{lessons.length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}