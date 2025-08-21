'use client';

import React from 'react';
import { X, Calendar, Clock, User, Settings, MessageSquare, Activity, Copy, Check } from 'lucide-react';
import { SessionEvent } from '@/types';

interface EventDetailsPopupProps {
  event: SessionEvent;
  onClose: () => void;
}

export default function EventDetailsPopup({ event, onClose }: EventDetailsPopupProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // Copy text to clipboard
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Format metadata for display
  const formatMetadataValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') {
      if (value instanceof Date) return value.toLocaleString();
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Get organized metadata sections
  const getMetadataSections = () => {
    const metadata = event.metadata;
    const sections: Array<{
      title: string;
      items: Array<{ key: string; label: string; value: any; copyable?: boolean }>;
    }> = [];

    // Common section
    sections.push({
      title: 'General',
      items: [
        { key: 'sessionId', label: 'Session ID', value: metadata.sessionId, copyable: true },
        { key: 'timestamp', label: 'Event Time', value: metadata.timestamp },
        { key: 'userId', label: 'User ID', value: metadata.userId || 'Anonymous' }
      ]
    });

    // Event-specific sections
    switch (event.type) {
      case 'session_started':
        sections.push({
          title: 'Session Details',
          items: [
            { key: 'userAgent', label: 'User Agent', value: metadata.userAgent, copyable: true },
            { key: 'timezone', label: 'Timezone', value: metadata.timezone },
            { key: 'previousSessionDate', label: 'Previous Session', value: metadata.previousSessionDate }
          ]
        });
        break;

      case 'elevenlabs_conversation_started':
        sections.push({
          title: 'Voice Configuration',
          items: [
            { key: 'agentId', label: 'Agent ID', value: metadata.agentId, copyable: true },
            { key: 'conversationId', label: 'Conversation ID', value: metadata.conversationId, copyable: true }
          ]
        });
        
        if (metadata.voiceSettings) {
          sections.push({
            title: 'Voice Settings',
            items: [
              { key: 'voiceId', label: 'Voice ID', value: metadata.voiceSettings.voiceId, copyable: true },
              { key: 'stability', label: 'Stability', value: metadata.voiceSettings.stability },
              { key: 'similarityBoost', label: 'Similarity Boost', value: metadata.voiceSettings.similarityBoost },
              { key: 'style', label: 'Style', value: metadata.voiceSettings.style }
            ]
          });
        }
        break;

      case 'lesson_started':
        sections.push({
          title: 'Lesson Details',
          items: [
            { key: 'lessonId', label: 'Lesson ID', value: metadata.lessonId, copyable: true },
            { key: 'lessonTitle', label: 'Lesson Title', value: metadata.lessonTitle },
            { key: 'lessonProgress', label: 'Progress', value: metadata.lessonProgress },
            { key: 'difficulty', label: 'Difficulty', value: metadata.difficulty },
            { key: 'estimatedDuration', label: 'Est. Duration (min)', value: metadata.estimatedDuration }
          ]
        });
        break;

      case 'lesson_qa_started':
        sections.push({
          title: 'Q&A Details',
          items: [
            { key: 'parentLessonId', label: 'Parent Lesson ID', value: metadata.parentLessonId, copyable: true },
            { key: 'availableQuestions', label: 'Available Questions', value: metadata.availableQuestions },
            { key: 'questionTypes', label: 'Question Types', value: metadata.questionTypes?.join(', ') || 'N/A' }
          ]
        });
        break;

      case 'open_conversation_started':
        sections.push({
          title: 'Conversation Context',
          items: [
            { key: 'conversationContext', label: 'Context', value: metadata.conversationContext },
            { key: 'detectedIntent', label: 'Detected Intent', value: metadata.detectedIntent },
            { key: 'userMood', label: 'User Mood', value: metadata.userMood }
          ]
        });
        break;
    }

    return sections.filter(section => 
      section.items.some(item => item.value !== null && item.value !== undefined && item.value !== 'N/A')
    );
  };

  const metadataSections = getMetadataSections();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{event.icon}</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{event.title}</h2>
              <p className="text-sm text-gray-600">
                {new Date(event.timestamp).toLocaleString()} • Status: {event.status}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex">
          {/* Left Panel - Basic Info */}
          <div className="w-1/2 p-6 border-r border-gray-200">
            <div className="space-y-6">
              {/* Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Event Summary
                </h3>
                <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">
                  {event.summary}
                </p>
              </div>

              {/* First Message */}
              {event.firstMessage && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    First Message
                  </h3>
                  <div className="bg-blue-50 rounded p-3 relative">
                    <p className="text-sm text-gray-700 mb-2">{event.firstMessage}</p>
                    <button
                      onClick={() => copyToClipboard(event.firstMessage!, 'firstMessage')}
                      className="absolute top-2 right-2 p-1 hover:bg-blue-100 rounded text-blue-600"
                    >
                      {copiedField === 'firstMessage' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Basic Properties */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Properties
                </h3>
                <div className="bg-gray-50 rounded p-3 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">Event ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 font-mono text-xs">{event.id}</span>
                      <button
                        onClick={() => copyToClipboard(event.id, 'eventId')}
                        className="p-1 hover:bg-gray-200 rounded text-gray-600"
                      >
                        {copiedField === 'eventId' ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">Type:</span>
                    <span className="text-gray-900">{event.type}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      event.status === 'active' ? 'bg-green-100 text-green-800' :
                      event.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {event.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Detailed Metadata */}
          <div className="w-1/2 p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Event Metadata
            </h3>

            <div className="space-y-4">
              {metadataSections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="border border-gray-200 rounded">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {section.title}
                    </h4>
                  </div>
                  <div className="p-3 space-y-2">
                    {section.items
                      .filter(item => item.value !== null && item.value !== undefined && item.value !== 'N/A')
                      .map((item, itemIndex) => (
                        <div key={itemIndex} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600">
                              {item.label}:
                            </span>
                            {item.copyable && (
                              <button
                                onClick={() => copyToClipboard(String(item.value), item.key)}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500"
                              >
                                {copiedField === item.key ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                          <div className="text-sm text-gray-900 bg-white rounded p-2 break-all">
                            {formatMetadataValue(item.key, item.value)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}

              {metadataSections.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Settings className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No additional metadata available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}