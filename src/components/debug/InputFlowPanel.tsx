'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Bot, MessageSquare, Settings, BookOpen } from 'lucide-react';
import { LLMDebugEntry } from '@/lib/debug-session-manager';
import { debugLLMService } from '@/lib/debug-llm-service';

interface InputFlowPanelProps {
  entry: LLMDebugEntry;
}

export default function InputFlowPanel({ entry }: InputFlowPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    transcript: false,
    parameters: false,
    knowledge: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Format the session transcript
  const transcriptData = debugLLMService.formatSessionTranscript(
    entry.request.messages,
    expandedSections.transcript
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Input Flow
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Model Info */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-sm">Model</span>
          </div>
          <div className="text-sm text-gray-700 font-mono">
            {entry.request.model}
          </div>
        </div>

        {/* System Prompt */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-green-600" />
            <span className="font-medium text-sm">System Prompt</span>
          </div>
          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border-l-4 border-l-green-500 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap font-mono text-xs">
              {entry.request.systemPrompt}
            </pre>
          </div>
        </div>

        {/* Session Transcript */}
        <div className="border rounded-lg p-3">
          <button
            onClick={() => toggleSection('transcript')}
            className="flex items-center gap-2 w-full text-left mb-2 hover:text-blue-600"
          >
            {expandedSections.transcript ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <MessageSquare className="w-4 h-4 text-purple-600" />
            <span className="font-medium text-sm">
              Session Transcript ({entry.request.messages.length} messages)
            </span>
          </button>

          {!expandedSections.transcript ? (
            <div className="text-sm text-gray-600 space-y-2">
              {/* Key Events */}
              <div>
                <div className="font-medium text-xs text-gray-500 mb-1">Key Events:</div>
                <ul className="text-xs space-y-1">
                  {transcriptData.keyEvents.map((event, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                      {event}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Last 200 words */}
              {transcriptData.lastWords && (
                <div>
                  <div className="font-medium text-xs text-gray-500 mb-1">Last 200 words:</div>
                  <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                    {transcriptData.lastWords}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono text-xs">
                {transcriptData.fullTranscript}
              </pre>
            </div>
          )}
        </div>

        {/* Parameters */}
        <div className="border rounded-lg p-3">
          <button
            onClick={() => toggleSection('parameters')}
            className="flex items-center gap-2 w-full text-left mb-2 hover:text-blue-600"
          >
            {expandedSections.parameters ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Settings className="w-4 h-4 text-orange-600" />
            <span className="font-medium text-sm">Parameters</span>
          </button>

          <div className="text-sm text-gray-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Temperature:</span>
              <span className="font-mono">{entry.request.temperature}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max Tokens:</span>
              <span className="font-mono">{entry.request.maxTokens}</span>
            </div>
            
            {/* Other Parameters */}
            {expandedSections.parameters && entry.request.otherParameters && (
              <div className="mt-2 pt-2 border-t">
                <div className="text-xs text-gray-500 mb-1">Other Parameters:</div>
                <pre className="text-xs font-mono bg-gray-50 p-2 rounded">
                  {JSON.stringify(entry.request.otherParameters, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Knowledge Context */}
        {entry.request.knowledgeContext && (
          <div className="border rounded-lg p-3">
            <button
              onClick={() => toggleSection('knowledge')}
              className="flex items-center gap-2 w-full text-left mb-2 hover:text-blue-600"
            >
              {expandedSections.knowledge ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm">Knowledge Context</span>
            </button>

            {!expandedSections.knowledge ? (
              <div className="text-sm text-gray-600">
                {entry.response.citedArticles && entry.response.citedArticles.length > 0 ? (
                  <span>{entry.response.citedArticles.length} articles found and injected</span>
                ) : (
                  <span>Knowledge base searched</span>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {entry.request.knowledgeContext}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}