'use client';

import React from 'react';
import { Eye, User, Mic, BookOpen, HelpCircle, MessageCircle, Clock, Activity } from 'lucide-react';
import { SessionEvent } from '@/types';

interface SessionEventCardProps {
  event: SessionEvent;
  onViewDetails: () => void;
}

export default function SessionEventCard({ event, onViewDetails }: SessionEventCardProps) {
  // Get icon component based on event type
  const getEventIcon = () => {
    switch (event.type) {
      case 'session_started':
        return <User className="w-4 h-4" />;
      case 'elevenlabs_conversation_started':
        return <Mic className="w-4 h-4" />;
      case 'lesson_started':
        return <BookOpen className="w-4 h-4" />;
      case 'lesson_qa_started':
        return <HelpCircle className="w-4 h-4" />;
      case 'open_conversation_started':
        return <MessageCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  // Get color scheme based on event type
  const getColorScheme = () => {
    switch (event.type) {
      case 'session_started':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          iconBg: 'bg-blue-100',
          iconText: 'text-blue-600',
          titleText: 'text-blue-800',
          badge: 'bg-blue-100 text-blue-800'
        };
      case 'elevenlabs_conversation_started':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          iconBg: 'bg-green-100',
          iconText: 'text-green-600',
          titleText: 'text-green-800',
          badge: 'bg-green-100 text-green-800'
        };
      case 'lesson_started':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          iconBg: 'bg-purple-100',
          iconText: 'text-purple-600',
          titleText: 'text-purple-800',
          badge: 'bg-purple-100 text-purple-800'
        };
      case 'lesson_qa_started':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          iconBg: 'bg-orange-100',
          iconText: 'text-orange-600',
          titleText: 'text-orange-800',
          badge: 'bg-orange-100 text-orange-800'
        };
      case 'open_conversation_started':
        return {
          bg: 'bg-indigo-50',
          border: 'border-indigo-200',
          iconBg: 'bg-indigo-100',
          iconText: 'text-indigo-600',
          titleText: 'text-indigo-800',
          badge: 'bg-indigo-100 text-indigo-800'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          iconBg: 'bg-gray-100',
          iconText: 'text-gray-600',
          titleText: 'text-gray-800',
          badge: 'bg-gray-100 text-gray-800'
        };
    }
  };

  // Get status indicator
  const getStatusIndicator = () => {
    switch (event.status) {
      case 'active':
        return <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />;
      case 'completed':
        return <div className="w-2 h-2 bg-blue-400 rounded-full" />;
      case 'interrupted':
        return <div className="w-2 h-2 bg-red-400 rounded-full" />;
      default:
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    }
  };

  // Get key metadata to display
  const getKeyMetadata = () => {
    const metadata = event.metadata;
    const items: Array<{ label: string; value: string }> = [];

    switch (event.type) {
      case 'session_started':
        if (metadata.timezone) items.push({ label: 'Timezone', value: metadata.timezone });
        if (metadata.previousSessionDate) {
          items.push({ 
            label: 'Previous Session', 
            value: new Date(metadata.previousSessionDate).toLocaleDateString() 
          });
        }
        break;

      case 'elevenlabs_conversation_started':
        if (metadata.agentId) items.push({ label: 'Agent', value: metadata.agentId });
        if (metadata.voiceSettings?.voiceId) {
          items.push({ label: 'Voice', value: metadata.voiceSettings.voiceId });
        }
        if (metadata.conversationId) {
          items.push({ label: 'Conv. ID', value: metadata.conversationId.substring(0, 8) + '...' });
        }
        break;

      case 'lesson_started':
        if (metadata.lessonTitle) items.push({ label: 'Lesson', value: metadata.lessonTitle });
        if (metadata.lessonProgress) items.push({ label: 'Progress', value: metadata.lessonProgress });
        if (metadata.estimatedDuration) {
          items.push({ label: 'Duration', value: `${metadata.estimatedDuration} min` });
        }
        break;

      case 'lesson_qa_started':
        if (metadata.availableQuestions) {
          items.push({ label: 'Questions', value: metadata.availableQuestions.toString() });
        }
        if (metadata.parentLessonId) {
          items.push({ label: 'Parent Lesson', value: metadata.parentLessonId });
        }
        break;

      case 'open_conversation_started':
        if (metadata.detectedIntent) items.push({ label: 'Intent', value: metadata.detectedIntent });
        if (metadata.conversationContext) {
          items.push({ label: 'Context', value: metadata.conversationContext });
        }
        break;
    }

    return items;
  };

  const colors = getColorScheme();
  const metadata = getKeyMetadata();

  return (
    <div className={`border rounded-lg p-3 ${colors.bg} ${colors.border} hover:shadow-sm transition-shadow`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${colors.iconBg}`}>
            <div className={colors.iconText}>
              {getEventIcon()}
            </div>
          </div>
          <div>
            <div className={`text-sm font-medium ${colors.titleText}`}>
              {event.title}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(event.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {getStatusIndicator()}
          <span className={`px-2 py-1 rounded text-xs font-medium ${colors.badge}`}>
            {event.status}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-700 mb-3">
        {event.summary}
      </div>

      {/* Key Metadata */}
      {metadata.length > 0 && (
        <div className="space-y-1 mb-3">
          {metadata.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">{item.label}:</span>
              <span className="text-gray-800">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* First Message Preview */}
      {event.firstMessage && (
        <div className="border-t pt-2 mt-2">
          <div className="text-xs text-gray-600 font-medium mb-1 flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            First Message
          </div>
          <div className="text-sm text-gray-700 bg-white bg-opacity-50 rounded p-2 line-clamp-2">
            {event.firstMessage.substring(0, 120)}
            {event.firstMessage.length > 120 && '...'}
          </div>
        </div>
      )}

      {/* View Details Button */}
      <div className="flex justify-end mt-3">
        <button
          onClick={onViewDetails}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-white bg-opacity-80 border rounded hover:bg-opacity-100 transition-colors"
        >
          <Eye className="w-3 h-3" />
          View Details
        </button>
      </div>
    </div>
  );
}