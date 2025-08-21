'use client';

import React, { useState } from 'react';
import { BasePopup } from './PopupManager';
import { DatabaseDebugEntry } from '@/lib/debug-database-service';
import { Article } from '@/types';
import { Search, FileText, Eye, ExternalLink, Tag, Clock, Target } from 'lucide-react';

interface KnowledgeBasePopupProps {
  entry: DatabaseDebugEntry;
  onClose: () => void;
}

interface ContentViewerPopupProps {
  article: Article;
  onClose: () => void;
}

function ContentViewerPopup({ article, onClose }: ContentViewerPopupProps) {
  return (
    <BasePopup
      isOpen={true}
      onClose={onClose}
      title={`Full Content: ${article.title}`}
      size="full"
    >
      <div className="p-6">
        {/* Article Header */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{article.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Tag className="w-4 h-4" />
              {article.category}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {article.readTime}
            </span>
            <span>By {article.author}</span>
            <span>Updated: {new Date(article.lastUpdated).toLocaleDateString()}</span>
          </div>
          
          {article.summary && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-1">Summary</h3>
              <p className="text-sm text-blue-700">{article.summary}</p>
            </div>
          )}
          
          {article.tags && article.tags.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1">
                {article.tags.map((tag, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Article Content */}
        <div className="prose max-w-none">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {article.content}
          </div>
        </div>
      </div>
    </BasePopup>
  );
}

export function KnowledgeBasePopup({ entry, onClose }: KnowledgeBasePopupProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  
  // Get knowledge base context and cited articles
  const knowledgeContext = entry.request.knowledgeContext || '';
  const citedArticles = entry.response.citedArticles || [];
  
  // Extract search query from knowledge context or infer from user messages
  const extractSearchQuery = (): string => {
    // Try to find the last user message as the likely search query
    const userMessages = entry.request.messages.filter(m => (m.sender || m.type) === 'user');
    if (userMessages.length > 0) {
      const lastUserMessage = userMessages[userMessages.length - 1];
      return lastUserMessage.content.substring(0, 100); // First 100 chars as query
    }
    return 'Unable to determine search query';
  };
  
  const searchQuery = extractSearchQuery();
  
  // Determine if content is a full file or extracted chunk
  const analyzeContent = (article: Article) => {
    const contentLength = article.content.length;
    const hasMarkdownStructure = article.content.includes('# ') || article.content.includes('## ');
    const hasMetadata = article.content.includes('**Category:**') || article.content.includes('**Read Time:**');
    
    // Heuristics for full file vs chunk
    const isFullFile = contentLength > 1000 && hasMarkdownStructure && hasMetadata;
    
    return {
      isFullFile,
      contentType: isFullFile ? 'Full File' : 'Extracted Content',
      size: contentLength,
      preview: article.content.substring(0, 300),
      hasMore: contentLength > 300
    };
  };
  
  return (
    <>
      <BasePopup
        isOpen={true}
        onClose={onClose}
        title="Knowledge Base Context"
        size="large"
      >
        <div className="p-6">
          {/* Search Context */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-800">Search Context</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-blue-700">Query that triggered search:</span>
                <p className="text-blue-600 bg-white p-2 rounded border mt-1 italic">
                  "{searchQuery}"
                </p>
              </div>
              <div className="flex items-center gap-4 text-blue-700">
                <span><strong>Articles Found:</strong> {citedArticles.length}</span>
                <span><strong>Request Type:</strong> {entry.type.toUpperCase()}</span>
                <span><strong>Processing Time:</strong> {entry.response.processingTime}ms</span>
              </div>
            </div>
          </div>
          
          {/* Articles List */}
          {citedArticles.length === 0 ? (
            <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No knowledge base articles were used</p>
                {knowledgeContext && (
                  <p className="text-xs text-gray-400 mt-1">But knowledge context was provided</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Retrieved Articles ({citedArticles.length})
              </h3>
              
              {citedArticles.map((article, index) => {
                const analysis = analyzeContent(article);
                
                return (
                  <div key={article.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                    {/* Article Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-medium text-gray-900">{article.title}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            analysis.isFullFile 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {analysis.contentType}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          <span className="flex items-center gap-1">
                            <Tag className="w-4 h-4" />
                            {article.category}
                          </span>
                          <span>Size: {analysis.size.toLocaleString()} characters</span>
                          <span>Read time: {article.readTime}</span>
                        </div>
                        
                        {/* Relevance Indicators */}
                        <div className="flex items-center gap-2 mb-3">
                          <Target className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-700">Matched in:</span>
                          <div className="flex gap-1">
                            {['content', 'title'].map((field) => (
                              <span key={field} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setSelectedArticle(article)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Full Content
                      </button>
                    </div>
                    
                    {/* Content Preview */}
                    <div className="space-y-3">
                      {article.summary && (
                        <div className="p-3 bg-gray-50 rounded">
                          <div className="text-sm font-medium text-gray-700 mb-1">Summary</div>
                          <div className="text-sm text-gray-600">{article.summary}</div>
                        </div>
                      )}
                      
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                          <span>Content Preview</span>
                          {analysis.isFullFile ? (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Complete file loaded
                            </span>
                          ) : (
                            <span className="text-xs text-orange-600 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Relevant sections extracted
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 leading-relaxed">
                          {analysis.preview}
                          {analysis.hasMore && (
                            <span className="text-blue-600 font-medium"> ...read more</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Tags */}
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {article.tags.map((tag, tagIndex) => (
                            <span 
                              key={tagIndex}
                              className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Source Information */}
                      <div className="pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-500 space-y-1">
                          <div><strong>Source ID:</strong> {article.id}</div>
                          <div><strong>Last Updated:</strong> {new Date(article.lastUpdated).toLocaleDateString()}</div>
                          <div><strong>Author:</strong> {article.author}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Raw Knowledge Context */}
          {knowledgeContext && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-semibold text-yellow-800 mb-2">Raw Knowledge Context</h3>
              <div className="text-sm text-yellow-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {knowledgeContext.substring(0, 500)}
                {knowledgeContext.length > 500 && '...'}
              </div>
            </div>
          )}
        </div>
      </BasePopup>
      
      {/* Content Viewer Popup */}
      {selectedArticle && (
        <ContentViewerPopup
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </>
  );
}