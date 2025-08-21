'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, MessageSquare, BookOpen, BarChart3, AlertCircle } from 'lucide-react';
import { LLMDebugEntry } from '@/lib/debug-session-manager';

interface OutputPanelProps {
  entry: LLMDebugEntry;
}

export default function OutputPanel({ entry }: OutputPanelProps) {
  const [expandedResponse, setExpandedResponse] = useState(false);

  const getStatusIcon = () => {
    switch (entry.status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (entry.status) {
      case 'success':
        return `Success (${entry.response.processingTime}ms)`;
      case 'error':
        return `Failed (${entry.response.processingTime || 0}ms)`;
      case 'pending':
        return 'Processing...';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Output
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium text-sm">{getStatusText()}</span>
          </div>
          
          {entry.status === 'error' && entry.error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              {entry.error}
            </div>
          )}
        </div>

        {/* Response Content */}
        {entry.status === 'success' && entry.response.content && (
          <div className="border rounded-lg p-3">
            <button
              onClick={() => setExpandedResponse(!expandedResponse)}
              className="flex items-center gap-2 w-full text-left mb-2 hover:text-blue-600"
            >
              {expandedResponse ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm">Response Content</span>
            </button>

            {!expandedResponse ? (
              <div className="text-sm text-gray-600">
                {entry.response.content.length > 100
                  ? `${entry.response.content.substring(0, 100)}...`
                  : entry.response.content}
              </div>
            ) : (
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-96 overflow-y-auto border-l-4 border-l-blue-500">
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {entry.response.content}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Metrics */}
        {entry.status === 'success' && (
          <div className="space-y-3">
            {/* Token Usage */}
            {entry.response.usage?.tokens && (
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-sm">Token Usage</span>
                </div>
                <div className="text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Tokens Used:</span>
                    <span className="font-mono">{entry.response.usage.tokens}</span>
                  </div>
                  {entry.request.maxTokens && (
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Limit:</span>
                      <span className="font-mono">{entry.request.maxTokens}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Articles Used */}
            {entry.response.citedArticles && entry.response.citedArticles.length > 0 && (
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-sm">Articles Used ({entry.response.citedArticles.length})</span>
                </div>
                <div className="space-y-2">
                  {entry.response.citedArticles.map((article, index) => (
                    <div key={index} className="text-sm">
                      <div className="font-medium text-gray-700">{article.title}</div>
                      <div className="text-xs text-gray-500">{article.category}</div>
                      {article.summary && (
                        <div className="text-xs text-gray-600 mt-1">
                          {article.summary.length > 100
                            ? `${article.summary.substring(0, 100)}...`
                            : article.summary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Processing Time */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="font-medium text-sm">Performance</span>
              </div>
              <div className="text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Processing Time:</span>
                  <span className="font-mono">{formatTime(entry.response.processingTime)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Request Type:</span>
                  <span className="capitalize">{entry.type}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending State */}
        {entry.status === 'pending' && (
          <div className="border rounded-lg p-3 text-center">
            <div className="inline-flex items-center gap-2 text-yellow-600">
              <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Processing request...</span>
            </div>
          </div>
        )}

        {/* Request Info */}
        <div className="text-xs text-gray-400 pt-2 border-t">
          <div>Request ID: {entry.id}</div>
          <div>Timestamp: {(entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp)).toLocaleString()}</div>
          <div>Type: {entry.type}</div>
        </div>
      </div>
    </div>
  );
}