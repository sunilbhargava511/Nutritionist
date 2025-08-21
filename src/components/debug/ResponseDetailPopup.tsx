'use client';

import React, { useState } from 'react';
import { BasePopup } from './PopupManager';
import { DatabaseDebugEntry } from '@/lib/debug-database-service';
import { MessageSquare, Copy, Check, Clock, Zap, FileText, Search, Tag, BarChart3 } from 'lucide-react';

interface ResponseDetailPopupProps {
  entry: DatabaseDebugEntry;
  onClose: () => void;
}

export function ResponseDetailPopup({ entry, onClose }: ResponseDetailPopupProps) {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const response = entry.response;
  const isError = entry.status === 'error';
  const content = isError ? (entry.error || 'Unknown error') : response.content;
  
  // Analyze the response
  const analyzeResponse = () => {
    if (isError) {
      return {
        length: entry.error?.length || 0,
        wordCount: entry.error?.split(/\s+/).filter(word => word.length > 0).length || 0,
        paragraphs: entry.error?.split('\n\n').length || 0,
        sentences: entry.error?.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 0,
        avgWordsPerSentence: 0,
        readingTime: 0,
        hasFormatting: false,
        hasReferences: false,
        tone: 'error'
      };
    }
    
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    
    // Detect formatting and structure
    const hasFormatting = content.includes('**') || content.includes('*') || content.includes('###') || content.includes('- ');
    const hasReferences = response.citedArticles && response.citedArticles.length > 0;
    const hasNumbers = /\d/.test(content);
    const hasQuestions = content.includes('?');
    const hasExclamations = content.includes('!');
    
    // Estimate tone (simplified)
    let tone = 'neutral';
    if (content.toLowerCase().includes('great') || content.toLowerCase().includes('excellent')) {
      tone = 'positive';
    } else if (content.toLowerCase().includes('concern') || content.toLowerCase().includes('difficult')) {
      tone = 'empathetic';
    } else if (content.toLowerCase().includes('recommend') || content.toLowerCase().includes('suggest')) {
      tone = 'advisory';
    }
    
    return {
      length: content.length,
      wordCount: words.length,
      paragraphs: paragraphs.length,
      sentences: sentences.length,
      avgWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
      readingTime: Math.ceil(words.length / 200), // Assuming 200 WPM
      hasFormatting,
      hasReferences,
      hasNumbers,
      hasQuestions,
      hasExclamations,
      tone
    };
  };
  
  const analysis = analyzeResponse();
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };
  
  // Highlight search results
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => (
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 text-yellow-800 px-1 rounded">
          {part}
        </span>
      ) : (
        part
      )
    ));
  };
  
  const getToneColor = (tone: string) => {
    switch (tone) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'empathetic': return 'bg-blue-100 text-blue-800';
      case 'advisory': return 'bg-purple-100 text-purple-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <BasePopup
      isOpen={true}
      onClose={onClose}
      title={isError ? 'Error Response Details' : 'Response Details'}
      size="large"
    >
      <div className="p-6">
        {/* Response Analysis Header */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            {isError ? (
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            ) : (
              <MessageSquare className="w-5 h-5 text-gray-600" />
            )}
            <h3 className="text-lg font-semibold text-gray-900">Response Analysis</h3>
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
              isError ? 'bg-red-100 text-red-800' : getToneColor(analysis.tone)
            }`}>
              {isError ? 'ERROR' : analysis.tone.toUpperCase()}
            </span>
          </div>
          
          {!isError && (
            <>
              {/* Performance Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center p-2 bg-white rounded border">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="text-lg font-semibold text-gray-900">{response.processingTime}ms</div>
                  <div className="text-xs text-gray-600">Processing</div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="text-lg font-semibold text-gray-900">{analysis.wordCount.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Words</div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="text-lg font-semibold text-gray-900">{analysis.sentences}</div>
                  <div className="text-xs text-gray-600">Sentences</div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="text-lg font-semibold text-gray-900">{analysis.readingTime}min</div>
                  <div className="text-xs text-gray-600">Read Time</div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="text-lg font-semibold text-gray-900">{response.usage?.tokens || 'N/A'}</div>
                  <div className="text-xs text-gray-600">Tokens</div>
                </div>
              </div>
              
              {/* Content Features */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700">Features:</span>
                  <div className="flex flex-wrap gap-1">
                    {analysis.hasFormatting && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Formatted</span>
                    )}
                    {analysis.hasReferences && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">References</span>
                    )}
                    {analysis.hasNumbers && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">Numbers</span>
                    )}
                    {analysis.hasQuestions && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Questions</span>
                    )}
                    {analysis.hasExclamations && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">Emphasis</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700">Structure:</span>
                  <span className="text-gray-600">
                    {analysis.paragraphs} paragraphs | 
                    Avg {analysis.avgWordsPerSentence} words/sentence
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search within response..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Response'}
          </button>
          <span className="text-xs text-gray-500">
            {analysis.length.toLocaleString()} characters total
          </span>
        </div>
        
        {/* Response Content */}
        <div className="mb-6 border border-gray-200 rounded-lg">
          <div className={`px-4 py-3 border-b border-gray-200 ${
            isError ? 'bg-red-50' : 'bg-gray-50'
          }`}>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <h4 className="font-semibold text-gray-900">
                {isError ? 'Error Message' : 'Response Content'}
              </h4>
            </div>
          </div>
          
          <div className="p-4">
            <div className={`text-sm leading-relaxed whitespace-pre-wrap ${
              isError ? 'text-red-800 font-mono bg-red-50 p-3 rounded' : 'text-gray-800'
            }`}>
              {highlightText(content, searchQuery)}
            </div>
          </div>
        </div>
        
        {/* Cited Articles (if any) */}
        {response.citedArticles && response.citedArticles.length > 0 && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Referenced Knowledge Base Articles ({response.citedArticles.length})
            </h3>
            <div className="space-y-2">
              {response.citedArticles.map((article, index) => (
                <div key={article.id} className="p-2 bg-white rounded border border-green-200">
                  <div className="font-medium text-green-900">{article.title}</div>
                  <div className="text-sm text-green-700">{article.category}</div>
                  {article.tags && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {article.tags.slice(0, 3).map((tag, tagIndex) => (
                        <span key={tagIndex} className="px-1 py-0.5 bg-green-100 text-green-600 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Response Metadata */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Response Metadata
          </h3>
          <div className="text-sm text-blue-700 space-y-1">
            <div><strong>Entry ID:</strong> {entry.id}</div>
            <div><strong>Session ID:</strong> {entry.sessionId}</div>
            <div><strong>Request Type:</strong> {entry.type.toUpperCase()}</div>
            <div><strong>Status:</strong> {entry.status.toUpperCase()}</div>
            <div><strong>Timestamp:</strong> {new Date(entry.timestamp).toLocaleString()}</div>
            <div><strong>Model:</strong> {entry.request.model}</div>
            {response.usage?.tokens && (
              <div><strong>Token Usage:</strong> {response.usage.tokens} tokens</div>
            )}
            <div><strong>Processing Time:</strong> {response.processingTime}ms</div>
            {entry.request.temperature && (
              <div><strong>Temperature:</strong> {entry.request.temperature}</div>
            )}
            {entry.request.maxTokens && (
              <div><strong>Max Tokens:</strong> {entry.request.maxTokens}</div>
            )}
          </div>
        </div>
      </div>
    </BasePopup>
  );
}