'use client';

import React, { useState } from 'react';
import { BasePopup } from './PopupManager';
import { DatabaseDebugEntry } from '@/lib/debug-database-service';
import { Settings, Copy, Check, FileText, Tag, Search } from 'lucide-react';

interface SystemPromptPopupProps {
  entry: DatabaseDebugEntry;
  onClose: () => void;
}

export function SystemPromptPopup({ entry, onClose }: SystemPromptPopupProps) {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const systemPrompt = entry.request.systemPrompt || '';
  
  // Analyze the prompt to extract metadata
  const analyzePrompt = () => {
    const lines = systemPrompt.split('\n');
    const promptLength = systemPrompt.length;
    const wordCount = systemPrompt.split(/\s+/).filter(word => word.length > 0).length;
    
    // Detect prompt type and characteristics
    const hasKnowledgeBase = systemPrompt.toLowerCase().includes('knowledge base') || 
                           systemPrompt.toLowerCase().includes('relevant knowledge');
    const hasRoleDefinition = systemPrompt.toLowerCase().includes('you are') || 
                             systemPrompt.toLowerCase().includes('your role');
    const hasInstructions = systemPrompt.toLowerCase().includes('instructions') ||
                           systemPrompt.toLowerCase().includes('guidelines');
    const hasExamples = systemPrompt.toLowerCase().includes('example') ||
                       systemPrompt.toLowerCase().includes('for instance');
    
    // Extract potential sections
    const sections = [];
    if (systemPrompt.includes('RELEVANT KNOWLEDGE BASE CONTENT:')) {
      sections.push('Knowledge Base Context');
    }
    if (hasRoleDefinition) {
      sections.push('Role Definition');
    }
    if (hasInstructions) {
      sections.push('Instructions');
    }
    if (hasExamples) {
      sections.push('Examples');
    }
    
    return {
      length: promptLength,
      wordCount,
      lineCount: lines.length,
      hasKnowledgeBase,
      hasRoleDefinition,
      hasInstructions,
      hasExamples,
      sections,
      type: entry.type === 'rag' ? 'RAG-Enhanced' : 'Standard'
    };
  };
  
  const analysis = analyzePrompt();
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(systemPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };
  
  // Highlight search results in the prompt
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
  
  // Extract sections from the prompt
  const extractSections = () => {
    const sections = [];
    let currentSection = { title: 'Main Content', content: systemPrompt, type: 'base' as const };
    
    // Look for knowledge base section
    if (systemPrompt.includes('RELEVANT KNOWLEDGE BASE CONTENT:')) {
      const parts = systemPrompt.split('RELEVANT KNOWLEDGE BASE CONTENT:');
      if (parts.length === 2) {
        sections.push({
          title: 'Base System Prompt',
          content: parts[0].trim(),
          type: 'base' as const
        });
        sections.push({
          title: 'Knowledge Base Context',
          content: parts[1].trim(),
          type: 'knowledge' as const
        });
        return sections;
      }
    }
    
    return [currentSection];
  };
  
  const sections = extractSections();
  
  return (
    <BasePopup
      isOpen={true}
      onClose={onClose}
      title="System Prompt Details"
      size="large"
    >
      <div className="p-6">
        {/* Prompt Analysis Header */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Prompt Analysis</h3>
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
              analysis.type === 'RAG-Enhanced' 
                ? 'bg-purple-100 text-purple-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {analysis.type}
            </span>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-2 bg-white rounded border">
              <div className="text-lg font-semibold text-gray-900">{analysis.length.toLocaleString()}</div>
              <div className="text-xs text-gray-600">Characters</div>
            </div>
            <div className="text-center p-2 bg-white rounded border">
              <div className="text-lg font-semibold text-gray-900">{analysis.wordCount.toLocaleString()}</div>
              <div className="text-xs text-gray-600">Words</div>
            </div>
            <div className="text-center p-2 bg-white rounded border">
              <div className="text-lg font-semibold text-gray-900">{analysis.lineCount}</div>
              <div className="text-xs text-gray-600">Lines</div>
            </div>
            <div className="text-center p-2 bg-white rounded border">
              <div className="text-lg font-semibold text-gray-900">{sections.length}</div>
              <div className="text-xs text-gray-600">Sections</div>
            </div>
          </div>
          
          {/* Features */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">Features:</span>
              <div className="flex flex-wrap gap-1">
                {analysis.hasKnowledgeBase && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Knowledge Base</span>
                )}
                {analysis.hasRoleDefinition && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Role Definition</span>
                )}
                {analysis.hasInstructions && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">Instructions</span>
                )}
                {analysis.hasExamples && (
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">Examples</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">Context:</span>
              <span className="text-gray-600">
                Request Type: {entry.type.toUpperCase()} | 
                Model: {entry.request.model} | 
                Temperature: {entry.request.temperature || 'default'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search within prompt..."
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
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
          <span className="text-xs text-gray-500">
            Tip: Use Ctrl+F to search within sections
          </span>
        </div>
        
        {/* Prompt Content Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="border border-gray-200 rounded-lg">
              <div className={`px-4 py-3 border-b border-gray-200 ${
                section.type === 'knowledge' ? 'bg-green-50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <h4 className="font-semibold text-gray-900">{section.title}</h4>
                  {section.type && (
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      section.type === 'knowledge' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {section.type === 'knowledge' ? 'Dynamic Context' : 'Static Prompt'}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {section.content.length.toLocaleString()} characters
                </div>
              </div>
              
              <div className="p-4">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                  {highlightText(section.content, searchQuery)}
                </pre>
              </div>
            </div>
          ))}
        </div>
        
        {/* Request Context */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Request Context</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <div><strong>Entry ID:</strong> {entry.id}</div>
            <div><strong>Session ID:</strong> {entry.sessionId}</div>
            <div><strong>Timestamp:</strong> {new Date(entry.timestamp).toLocaleString()}</div>
            <div><strong>Status:</strong> {entry.status}</div>
            {entry.request.otherParameters && (
              <div><strong>Additional Parameters:</strong> {JSON.stringify(entry.request.otherParameters, null, 2)}</div>
            )}
          </div>
        </div>
      </div>
    </BasePopup>
  );
}