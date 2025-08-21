'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BasePopup } from './PopupManager';
import { DatabaseDebugEntry } from '@/lib/debug-database-service';
import { Search, ArrowUp, ArrowDown, User, Bot, Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { Message } from '@/types';

interface TranscriptPopupProps {
  entry: DatabaseDebugEntry;
  onClose: () => void;
}

export function TranscriptPopup({ entry, onClose }: TranscriptPopupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse messages from the debug entry
  const messages: Message[] = entry.request.messages || [];

  // Focus search input when popup opens
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    const results: number[] = [];
    const query = searchQuery.toLowerCase();

    messages.forEach((message, index) => {
      if (message.content.toLowerCase().includes(query)) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, messages]);

  // Scroll to search result
  useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults.length > 0) {
      const messageIndex = searchResults[currentSearchIndex];
      const messageElement = document.getElementById(`message-${messageIndex}`);
      if (messageElement && messagesContainerRef.current) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentSearchIndex, searchResults]);

  const scrollToTop = () => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({ 
        top: messagesContainerRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  };

  const nextSearchResult = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex((prev) => (prev + 1) % searchResults.length);
  };

  const prevSearchResult = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
  };

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

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Detect if this is a lesson-related conversation
  const hasLessonContent = messages.some(msg => 
    msg.content.toLowerCase().includes('lesson') || 
    msg.content.toLowerCase().includes('chapter') ||
    msg.content.toLowerCase().includes('module')
  );

  return (
    <BasePopup
      isOpen={true}
      onClose={onClose}
      title={`Conversation Transcript - ${entry.type.toUpperCase()}`}
      size="large"
    >
      <div className="flex flex-col h-full">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search within transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {searchResults.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {currentSearchIndex + 1} of {searchResults.length}
                </span>
                <button
                  onClick={prevSearchResult}
                  className="p-1 hover:bg-gray-200 rounded"
                  disabled={searchResults.length === 0}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={nextSearchResult}
                  className="p-1 hover:bg-gray-200 rounded"
                  disabled={searchResults.length === 0}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          {/* Navigation Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Session: {formatTimestamp(entry.timestamp)}</span>
              <span className="mx-2">•</span>
              <span>{messages.length} messages</span>
              {hasLessonContent && (
                <>
                  <span className="mx-2">•</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    Lesson Content
                  </span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={scrollToTop}
                className="flex items-center gap-1 px-3 py-1 text-sm border rounded hover:bg-gray-100"
              >
                <ChevronUp className="w-4 h-4" />
                Top
              </button>
              <button
                onClick={scrollToBottom}
                className="flex items-center gap-1 px-3 py-1 text-sm border rounded hover:bg-gray-100"
              >
                <ChevronDown className="w-4 h-4" />
                Bottom
              </button>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500">No messages in this conversation</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isUser = (message.sender || message.type) === 'user';
              const isCurrentSearchResult = searchResults.includes(index) && 
                                          searchResults[currentSearchIndex] === index;
              
              return (
                <div 
                  key={message.id || index}
                  id={`message-${index}`}
                  className={`flex gap-3 p-4 rounded-lg transition-all duration-200 ${
                    isCurrentSearchResult ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''
                  } ${
                    isUser ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isUser ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  
                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${
                        isUser ? 'text-blue-800' : 'text-gray-800'
                      }`}>
                        {isUser ? 'User' : 'Sanjay (Advisor)'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {highlightText(message.content, searchQuery)}
                    </div>
                    
                    {/* Message Metadata */}
                    {message.citedArticles && message.citedArticles.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        📚 Referenced {message.citedArticles.length} knowledge base article(s)
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          
          {/* Event Markers for Lesson Transitions */}
          {hasLessonContent && (
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-gray-300"></div>
              <div className="px-3 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                📖 Lesson-based conversation detected
              </div>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>
          )}
        </div>
        
        {/* Footer Stats */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>Total Messages: {messages.length}</span>
              <span>User Messages: {messages.filter(m => (m.sender || m.type) === 'user').length}</span>
              <span>Assistant Messages: {messages.filter(m => (m.sender || m.type) === 'assistant').length}</span>
            </div>
            {searchQuery && (
              <div>
                Search Results: {searchResults.length}
              </div>
            )}
          </div>
        </div>
      </div>
    </BasePopup>
  );
}