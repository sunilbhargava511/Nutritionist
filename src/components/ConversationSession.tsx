'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MessageSquare, 
  TrendingUp, 
  User, 
  Download,
  Share2,
  Star,
  ChevronDown,
  ChevronUp,
  Calendar,
  BarChart3
} from 'lucide-react';

interface ConversationSessionProps {
  sessionId?: string;
  isLive?: boolean;
}

interface SessionData {
  id: string;
  conversationId: string;
  agentId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  transcript: TranscriptEntry[];
  analysis: {
    summary: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    keyTopics: string[];
    actionItems: string[];
    insights: string[];
    recommendations: string[];
    financialTopics: string[];
    clientGoals: string[];
    riskAssessment: string;
  };
  metrics: {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    averageResponseTime: number;
    engagementScore: number;
    conversationQuality: string;
    topicsDiscussed: number;
    actionItemsGenerated: number;
  };
  rating?: number;
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ConversationSession({ sessionId, isLive = false }: ConversationSessionProps) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    transcript: true,
    analysis: true,
    metrics: false
  });
  const [rating, setRating] = useState<number>(0);

  useEffect(() => {
    if (sessionId) {
      loadSessionData(sessionId);
    } else if (isLive) {
      // Initialize live session
      initializeLiveSession();
    }
  }, [sessionId, isLive]);

  const loadSessionData = async (id: string) => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from your database
      // For now, we'll simulate with mock data
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      const mockSession: SessionData = {
        id,
        conversationId: `conv_${id}`,
        agentId: 'sanjay-bhargava',
        userId: 'user_123',
        startTime: new Date(Date.now() - 300000), // 5 minutes ago
        endTime: new Date(),
        duration: 300, // 5 minutes
        transcript: [
          {
            role: 'assistant',
            content: "Hi there! I'm the AI version of Sanjay Bhargava, one of the founding members of PayPal. What's on your mind financially today?",
            timestamp: new Date(Date.now() - 300000)
          },
          {
            role: 'user',
            content: "I'm worried about my retirement savings. I'm 35 and feel like I'm behind.",
            timestamp: new Date(Date.now() - 280000)
          },
          {
            role: 'assistant',
            content: "I understand that concern. At 35, you actually have plenty of time to build wealth. Let me help you assess your situation. What's your current annual income, and how much are you currently saving for retirement?",
            timestamp: new Date(Date.now() - 270000)
          }
        ],
        analysis: {
          summary: "Client expressed concern about retirement savings at age 35. Initial discussion about current financial situation and savings rate.",
          sentiment: 'neutral',
          keyTopics: ['retirement planning', 'savings anxiety', 'age 35 concerns'],
          actionItems: [
            'Assess current retirement savings rate',
            'Calculate retirement needs based on income',
            'Create systematic savings plan'
          ],
          insights: [
            'Client feels behind on retirement savings despite being relatively young',
            'Opportunity to address retirement anxiety with education and planning'
          ],
          recommendations: [
            'Increase 401k contribution if available',
            'Consider opening IRA account',
            'Set up automatic savings transfers'
          ],
          financialTopics: ['retirement planning', '401k', 'savings rate'],
          clientGoals: ['secure retirement', 'catch up on savings'],
          riskAssessment: 'moderate - concerned about timing but willing to take action'
        },
        metrics: {
          totalMessages: 3,
          userMessages: 1,
          assistantMessages: 2,
          averageResponseTime: 15000,
          engagementScore: 75,
          conversationQuality: 'High',
          topicsDiscussed: 3,
          actionItemsGenerated: 3
        }
      };
      
      setSessionData(mockSession);
      setRating(mockSession.rating || 0);
    } catch (error) {
      console.error('Failed to load session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeLiveSession = () => {
    const liveSession: SessionData = {
      id: `live_${Date.now()}`,
      conversationId: 'live',
      agentId: 'sanjay-bhargava',
      startTime: new Date(),
      duration: 0,
      transcript: [],
      analysis: {
        summary: 'Live conversation in progress...',
        sentiment: 'neutral',
        keyTopics: [],
        actionItems: [],
        insights: [],
        recommendations: [],
        financialTopics: [],
        clientGoals: [],
        riskAssessment: 'Unknown'
      },
      metrics: {
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        averageResponseTime: 0,
        engagementScore: 0,
        conversationQuality: 'Unknown',
        topicsDiscussed: 0,
        actionItemsGenerated: 0
      }
    };
    
    setSessionData(liveSession);
    setLoading(false);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const exportSession = () => {
    if (!sessionData) return;
    
    const exportData = {
      ...sessionData,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${sessionData.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const rateSession = (newRating: number) => {
    setRating(newRating);
    // In a real implementation, this would save to your database
    console.log('Session rated:', newRating);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No session data available</p>
      </div>
    );
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'negative': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'High': return 'text-green-600 bg-green-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Session Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isLive ? 'Live Conversation' : 'Conversation Session'}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {sessionData.startTime.toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {isLive ? 'In Progress' : formatDuration(sessionData.duration)}
                </div>
                <div className={`px-2 py-1 rounded-full text-xs ${getSentimentColor(sessionData.analysis.sentiment)}`}>
                  {sessionData.analysis.sentiment}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isLive && (
              <>
                <button
                  onClick={exportSession}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  title="Export Session"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  title="Share Session"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{sessionData.metrics.totalMessages}</div>
            <div className="text-sm text-gray-600">Messages</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{sessionData.metrics.topicsDiscussed}</div>
            <div className="text-sm text-gray-600">Topics</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{sessionData.metrics.actionItemsGenerated}</div>
            <div className="text-sm text-gray-600">Action Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{sessionData.metrics.engagementScore}</div>
            <div className="text-sm text-gray-600">Engagement</div>
          </div>
        </div>

        {!isLive && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Rate this session:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => rateSession(star)}
                    className={`p-1 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transcript Section */}
      <div className="bg-white rounded-xl shadow-lg">
        <button
          onClick={() => toggleSection('transcript')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Conversation Transcript</h3>
            <span className="text-sm text-gray-500">({sessionData.transcript.length} messages)</span>
          </div>
          {expandedSections.transcript ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {expandedSections.transcript && (
          <div className="px-6 pb-6">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {sessionData.transcript.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                sessionData.transcript.map((message, index) => (
                  <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-2xl px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <div className="text-xs opacity-75 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Analysis Section */}
      <div className="bg-white rounded-xl shadow-lg">
        <button
          onClick={() => toggleSection('analysis')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">AI Analysis</h3>
          </div>
          {expandedSections.analysis ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {expandedSections.analysis && (
          <div className="px-6 pb-6 space-y-6">
            {/* Summary */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
              <p className="text-gray-600 text-sm leading-relaxed">{sessionData.analysis.summary}</p>
            </div>

            {/* Key Topics */}
            {sessionData.analysis.keyTopics.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Key Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {sessionData.analysis.keyTopics.map((topic, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {sessionData.analysis.actionItems.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Action Items</h4>
                <ul className="space-y-1">
                  {sessionData.analysis.actionItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Insights */}
            {sessionData.analysis.insights.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Insights</h4>
                <ul className="space-y-1">
                  {sessionData.analysis.insights.map((insight, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risk Assessment */}
            {sessionData.analysis.riskAssessment !== 'Unknown' && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Risk Assessment</h4>
                <p className="text-sm text-gray-600">{sessionData.analysis.riskAssessment}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metrics Section */}
      <div className="bg-white rounded-xl shadow-lg">
        <button
          onClick={() => toggleSection('metrics')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold">Session Metrics</h3>
          </div>
          {expandedSections.metrics ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {expandedSections.metrics && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-900">{sessionData.metrics.userMessages}</div>
                <div className="text-sm text-gray-600">User Messages</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-900">{sessionData.metrics.assistantMessages}</div>
                <div className="text-sm text-gray-600">Assistant Messages</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-900">{Math.round(sessionData.metrics.averageResponseTime / 1000)}s</div>
                <div className="text-sm text-gray-600">Avg Response Time</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-900">{sessionData.metrics.engagementScore}</div>
                <div className="text-sm text-gray-600">Engagement Score</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className={`text-lg font-bold px-2 py-1 rounded ${getQualityColor(sessionData.metrics.conversationQuality)}`}>
                  {sessionData.metrics.conversationQuality}
                </div>
                <div className="text-sm text-gray-600">Quality Rating</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-900">{sessionData.metrics.topicsDiscussed}</div>
                <div className="text-sm text-gray-600">Topics Discussed</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}