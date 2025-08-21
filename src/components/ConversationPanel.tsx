'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  User,
  Bot,
  Settings,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
// Note: Using API calls instead of direct service import for client-side safety

interface SessionTranscriptMessage {
  id: string;
  sessionId: string;
  messageType: 'tts_opening' | 'tts_lesson_intro' | 'user_voice' | 'assistant_voice' | 'llm_qa_start' | 'system';
  content: string;
  speaker: 'user' | 'assistant' | 'system';
  elevenlabsMessageId?: string;
  lessonContextId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface ConversationPanelProps {
  sessionId: string;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

interface SessionInfo {
  id: string;
  sessionType: 'open_ended' | 'lesson_based';
  lessonPhase?: string;
  currentLessonId?: string;
  status: string;
  startedAt: string;
}

export default function ConversationPanel({ 
  sessionId, 
  isOpen, 
  onToggle, 
  className = '' 
}: ConversationPanelProps) {
  const [transcript, setTranscript] = useState<SessionTranscriptMessage[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Real-time transcript updates
  useEffect(() => {
    if (!sessionId || !isOpen) return;
    
    const fetchTranscript = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch session and transcript from API
        const response = await fetch(`/api/session-transcript?sessionId=${sessionId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch session data');
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'API error');
        }
        
        // Update session info
        if (data.session) {
          setSession({
            id: data.session.id,
            sessionType: data.session.sessionType as 'open_ended' | 'lesson_based',
            lessonPhase: data.session.lessonPhase || undefined,
            currentLessonId: data.session.currentLessonId || undefined,
            status: data.session.status,
            startedAt: data.session.startedAt
          });
        }
        
        // Update transcript (convert timestamp strings to Date objects)
        if (data.transcript) {
          const formattedTranscript = data.transcript.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setTranscript(formattedTranscript);
          
          if (formattedTranscript.length > 0) {
            setLastMessageId(formattedTranscript[formattedTranscript.length - 1].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch transcript:', error);
        setError('Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    };

    // Initial load
    fetchTranscript();
    
    // Poll for updates every 3 seconds
    const interval = setInterval(fetchTranscript, 3000);
    return () => clearInterval(interval);
  }, [sessionId, isOpen]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && transcript.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageTypeDisplay = (message: SessionTranscriptMessage) => {
    switch (message.messageType) {
      case 'tts_opening':
        return { icon: '🔊', label: 'Session Start (TTS)', color: 'bg-blue-100 text-blue-700' };
      case 'tts_lesson_intro':
        return { icon: '🎓', label: 'Lesson Intro (TTS)', color: 'bg-purple-100 text-purple-700' };
      case 'llm_qa_start':
        return { icon: '🤖', label: 'Q&A Start (LLM)', color: 'bg-green-100 text-green-700' };
      case 'user_voice':
        return { icon: '🎤', label: 'You', color: 'bg-blue-100 text-blue-700' };
      case 'assistant_voice':
        return { icon: '🤖', label: 'Sanjay (LLM)', color: 'bg-green-100 text-green-700' };
      case 'system':
        return { icon: '⚙️', label: 'System', color: 'bg-gray-100 text-gray-700' };
      default:
        return { icon: '💬', label: 'Message', color: 'bg-gray-100 text-gray-700' };
    }
  };

  const getSpeakerAvatar = (speaker: string) => {
    switch (speaker) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'assistant':
        return <Bot className="w-4 h-4" />;
      case 'system':
        return <Settings className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getSessionTypeLabel = () => {
    if (!session) return '';
    
    if (session.sessionType === 'lesson_based') {
      const phase = session.lessonPhase ? ` (${session.lessonPhase.replace('_', ' ')})` : '';
      return `Lesson Q&A${phase}`;
    }
    
    return 'Open-ended conversation';
  };

  return (
    <div className={`conversation-panel transition-all duration-300 ${isOpen ? 'w-80' : 'w-12'} ${className}`}>
      {/* Panel Header */}
      <div className="panel-header bg-gray-50 px-4 py-3 border-b border-gray-200 h-16 flex items-center">
        {isOpen ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 text-sm truncate">Conversation Transcript</h3>
                {session && (
                  <div className="text-xs text-gray-500 truncate">
                    {getSessionTypeLabel()}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">
                ({transcript.length})
              </span>
            </div>
            <button
              onClick={onToggle}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded flex-shrink-0"
              title="Hide conversation panel"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={onToggle}
            className="flex items-center justify-center w-full h-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            title="Show conversation panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Panel Content */}
      {isOpen && (
        <div className="panel-content flex flex-col h-full">
          {/* Session Info */}
          {session && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
              <div className="text-xs text-blue-700">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3" />
                  Started: {new Date(session.startedAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    session.status === 'active' ? 'bg-green-500' : 
                    session.status === 'paused' ? 'bg-yellow-500' : 
                    'bg-gray-500'
                  }`} />
                  Status: {session.status}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 bg-white"
          >
            {isLoading && transcript.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p>Loading conversation...</p>
              </div>
            ) : error ? (
              <div className="text-center text-red-500 py-8">
                <p className="text-sm">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="text-xs mt-2 px-3 py-1 bg-red-100 rounded"
                >
                  Retry
                </button>
              </div>
            ) : transcript.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">No messages in this session yet</p>
                <p className="text-xs mt-1">Start talking to see the conversation appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transcript.map((message, index) => {
                  const display = getMessageTypeDisplay(message);
                  const isConsecutive = index > 0 && transcript[index - 1].speaker === message.speaker;
                  
                  return (
                    <div 
                      key={message.id} 
                      className={`message-item ${isConsecutive ? 'mt-1' : 'mt-3'}`}
                    >
                      {/* Message Header (only for first in sequence) */}
                      {!isConsecutive && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            message.speaker === 'user' 
                              ? 'bg-blue-100 text-blue-600' 
                              : message.speaker === 'assistant'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {getSpeakerAvatar(message.speaker)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {message.speaker === 'user' ? 'You' : 
                                 message.speaker === 'assistant' ? 'Sanjay' : 'System'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(message.timestamp)}
                              </span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded ${display.color}`}>
                              {display.icon} {display.label}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div className={`message-content ml-8 ${
                        message.metadata?.is_opening_message ? 'bg-yellow-50 border-l-2 border-yellow-200 pl-3' : ''
                      }`}>
                        <div className={`p-3 rounded-lg text-sm ${
                          message.speaker === 'user' 
                            ? 'bg-blue-50 text-blue-900' 
                            : message.speaker === 'assistant'
                            ? 'bg-green-50 text-green-900'
                            : 'bg-gray-50 text-gray-700'
                        }`}>
                          {message.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel Footer */}
          <div className="panel-footer px-4 py-2 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Session: {sessionId.slice(-8)}</span>
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>Live updates</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}