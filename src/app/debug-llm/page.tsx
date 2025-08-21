'use client';

import React, { useState, useEffect } from 'react';
import { Bug, Download, Trash2, RefreshCw, Play, Pause, Eye, Users, MessageSquare, Settings, FileText, Clock } from 'lucide-react';
import { DatabaseDebugEntry } from '@/lib/debug-database-service';
import { PopupManager } from '@/components/debug/PopupManager';
import { TranscriptPopup } from '@/components/debug/TranscriptPopup';
import { KnowledgeBasePopup } from '@/components/debug/KnowledgeBasePopup';
import { SystemPromptPopup } from '@/components/debug/SystemPromptPopup';
import { ResponseDetailPopup } from '@/components/debug/ResponseDetailPopup';
import SessionEventsPanel from '@/components/debug/SessionEventsPanel';
import EventDetailsPopup from '@/components/debug/EventDetailsPopup';
import AppHeader from '@/components/AppHeader';
import { SessionEvent } from '@/types';

interface DebugStats {
  isEnabled: boolean;
  currentSessionId: string | null;
  totalSessions: number;
  currentSessionEntries: number;
}

interface PopupState {
  transcript: boolean;
  knowledgeBase: boolean;
  systemPrompt: boolean;
  responseDetail: boolean;
  eventDetails: boolean;
}

type TimeFilter = 'all' | '5m' | '10m' | '30m' | '1h' | '3h' | '24h';

interface TimeFilterOption {
  value: TimeFilter;
  label: string;
  minutes?: number;
}

const TIME_FILTER_OPTIONS: TimeFilterOption[] = [
  { value: 'all', label: 'All entries' },
  { value: '5m', label: 'Last 5 minutes', minutes: 5 },
  { value: '10m', label: 'Last 10 minutes', minutes: 10 },
  { value: '30m', label: 'Last 30 minutes', minutes: 30 },
  { value: '1h', label: 'Last 1 hour', minutes: 60 },
  { value: '3h', label: 'Last 3 hours', minutes: 180 },
  { value: '24h', label: 'Last 24 hours', minutes: 1440 }
];

export default function DebugLLMPage() {
  const [entries, setEntries] = useState<DatabaseDebugEntry[]>([]);
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DatabaseDebugEntry | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SessionEvent | null>(null);
  const [popupState, setPopupState] = useState<PopupState>({
    transcript: false,
    knowledgeBase: false,
    systemPrompt: false,
    responseDetail: false,
    eventDetails: false
  });
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const [isRealTime, setIsRealTime] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Load debug data on mount and when time filter changes
  useEffect(() => {
    loadDebugData();
  }, [refreshKey, timeFilter]);

  // Real-time updates
  useEffect(() => {
    if (!isRealTime) return;

    const interval = setInterval(() => {
      loadDebugData();
    }, 10000); // Update every 10 seconds instead of 3

    return () => clearInterval(interval);
  }, [isRealTime]);

  const loadDebugData = async () => {
    try {
      // Don't show loading spinner on refresh, only on initial load
      if (entries.length === 0) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      // Calculate 'since' timestamp based on time filter
      let sinceParam = '';
      if (timeFilter !== 'all') {
        const filterOption = TIME_FILTER_OPTIONS.find(opt => opt.value === timeFilter);
        if (filterOption?.minutes) {
          const since = new Date(Date.now() - filterOption.minutes * 60 * 1000).toISOString();
          sinceParam = `&since=${encodeURIComponent(since)}`;
        }
      }

      // Fetch debug stats, entries, and session events
      const [statsResponse, entriesResponse, eventsResponse] = await Promise.all([
        fetch('/api/debug-llm?action=stats'),
        fetch(`/api/debug-llm?action=current-session${sinceParam}`),
        fetch(`/api/debug-llm?action=session-events${sinceParam}`)
      ]);

      if (!statsResponse.ok || !entriesResponse.ok) {
        throw new Error('Failed to fetch debug data');
      }

      const statsData = await statsResponse.json();
      const entriesData = await entriesResponse.json();
      
      // Session events is optional, don't fail if it's not available
      let eventsData = { success: false, events: [] };
      if (eventsResponse.ok) {
        eventsData = await eventsResponse.json();
      }

      if (statsData.success) {
        setDebugStats(statsData.stats);
      }

      if (entriesData.success) {
        setEntries(entriesData.entries || []);
      }

      if (eventsData.success) {
        setSessionEvents(eventsData.events || []);
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading debug data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load debug data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all debug data?')) {
      try {
        const response = await fetch('/api/debug-llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear' })
        });

        if (response.ok) {
          await loadDebugData();
        } else {
          throw new Error('Failed to clear debug data');
        }
      } catch (err) {
        console.error('Error clearing debug data:', err);
        setError('Failed to clear debug data');
      }
    }
  };

  const handleExport = () => {
    if (!entries.length) return;
    
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        debugStats,
        entries
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-llm-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export debug data');
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleViewEventDetails = (event: SessionEvent) => {
    setSelectedEvent(event);
    setPopupState(prev => ({ ...prev, eventDetails: true }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading debug data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Bug className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Debug Data</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* App Header */}
      <div className="mb-6">
        <AppHeader />
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Bug className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Debug LLM</h1>
            </div>
            
            {/* Debug Status */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Status: {debugStats?.isEnabled ? '✅ Enabled' : '❌ Disabled'}
              </span>
              <span className="text-sm text-gray-600">
                Entries: {entries.length}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Time Filter Dropdown */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIME_FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {/* Real-time toggle */}
            <button
              onClick={() => setIsRealTime(!isRealTime)}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium ${
                isRealTime
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isRealTime ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isRealTime ? 'Real-time: ON' : 'Real-time: OFF'}
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={!entries.length}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Download className="w-3 h-3" />
              Export
            </button>

            {/* Clear All */}
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm font-medium"
            >
              <Trash2 className="w-3 h-3" />
              Clear All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
          <span>Debug Status: {debugStats?.isEnabled ? '✅ Enabled' : '❌ Disabled'}</span>
          <span>Total Sessions: {debugStats?.totalSessions || 0}</span>
          <span>Current Session Entries: {debugStats?.currentSessionEntries || 0}</span>
          {debugStats?.currentSessionId && (
            <>
              <span>•</span>
              <span>Session ID: {debugStats.currentSessionId}</span>
            </>
          )}
          {lastUpdated && (
            <>
              <span>•</span>
              <span className="text-xs">Last updated: {lastUpdated.toLocaleTimeString()}</span>
            </>
          )}
        </div>
      </div>

      {/* Debug Panel - Three-Column Layout */}
      {(entries.length > 0 || sessionEvents.length > 0) ? (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">LLM Debug Interface</h3>
            <p className="text-sm text-gray-600 mt-1">Session events (left), LLM inputs (center), and outputs (right) with detailed inspection</p>
          </div>
          
          <div className="grid grid-cols-3 gap-0 min-h-[600px]">
            {/* Left Panel - Session Events */}
            <div className="w-full">
              <SessionEventsPanel
                events={sessionEvents}
                onViewEventDetails={handleViewEventDetails}
              />
            </div>
            {/* Center Panel - INPUT */}
            <div className="border-r border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-blue-50">
                <h4 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">INPUT</h4>
              </div>
              <div className="p-4 space-y-4 max-h-[550px] overflow-y-auto">
                {entries.map((entry, index) => (
                  <div key={entry.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                    {/* Entry Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          entry.status === 'success' ? 'bg-green-100 text-green-800' :
                          entry.status === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {entry.status}
                        </span>
                        <span className="text-sm font-medium text-gray-700">{entry.type}</span>
                        <span className="text-xs text-gray-500">{entry.request.model}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {/* Input Summaries with Eye Icons */}
                    <div className="space-y-2">
                      {/* System Prompt */}
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4 text-gray-600" />
                          <div>
                            <div className="text-xs font-medium text-gray-700">System Prompt</div>
                            <div className="text-xs text-gray-500">
                              {entry.request.systemPrompt.length} characters
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedEntry(entry);
                            setPopupState(prev => ({ ...prev, systemPrompt: true }));
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </div>
                      
                      {/* Transcript */}
                      {entry.request.messages.length > 0 && (
                        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-gray-600" />
                            <div>
                              <div className="text-xs font-medium text-gray-700">Transcript</div>
                              <div className="text-xs text-gray-500">
                                {entry.request.messages.length} messages
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedEntry(entry);
                              setPopupState(prev => ({ ...prev, transcript: true }));
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </div>
                      )}
                      
                      {/* Knowledge Base */}
                      {entry.request.knowledgeContext && (
                        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-600" />
                            <div>
                              <div className="text-xs font-medium text-gray-700">Knowledge Base</div>
                              <div className="text-xs text-gray-500">
                                {entry.response.citedArticles?.length || 0} articles found
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedEntry(entry);
                              setPopupState(prev => ({ ...prev, knowledgeBase: true }));
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </div>
                      )}
                      
                      {/* Parameters */}
                      <div className="text-xs text-gray-600 pt-1 border-t">
                        Temp: {entry.request.temperature || 'default'} | 
                        Tokens: {entry.request.maxTokens || 'default'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Right Panel - OUTPUT */}
            <div>
              <div className="p-4 border-b border-gray-200 bg-green-50">
                <h4 className="text-sm font-semibold text-green-800 uppercase tracking-wide">OUTPUT</h4>
              </div>
              <div className="p-4 space-y-4 max-h-[550px] overflow-y-auto">
                {entries.map((entry, index) => (
                  <div key={`output-${entry.id}`} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                    {/* Response Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Response</span>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{entry.response.processingTime}ms</span>
                          <span>•</span>
                          <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedEntry(entry);
                          setPopupState(prev => ({ ...prev, responseDetail: true }));
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                      >
                        <Eye className="w-3 h-3" />
                        View Full
                      </button>
                    </div>
                    
                    {/* Response Content Preview */}
                    <div className="space-y-2">
                      {entry.status === 'success' ? (
                        <div className="p-2 bg-green-50 rounded">
                          <div className="text-xs text-green-800 font-medium mb-1">Content Preview</div>
                          <div className="text-sm text-gray-700 line-clamp-3">
                            {entry.response.content.substring(0, 200)}
                            {entry.response.content.length > 200 && '...'}
                          </div>
                        </div>
                      ) : entry.error ? (
                        <div className="p-2 bg-red-50 rounded">
                          <div className="text-xs text-red-800 font-medium mb-1">Error</div>
                          <div className="text-sm text-red-700">{entry.error}</div>
                        </div>
                      ) : (
                        <div className="p-2 bg-yellow-50 rounded">
                          <div className="text-sm text-yellow-700">Pending...</div>
                        </div>
                      )}
                      
                      {/* Response Metadata */}
                      {entry.status === 'success' && (
                        <div className="text-xs text-gray-600 pt-1 border-t">
                          {entry.response.usage?.tokens && `Tokens: ${entry.response.usage.tokens} | `}
                          {entry.response.citedArticles && `Articles: ${entry.response.citedArticles.length}`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Bug className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Debug Data Available</h3>
          <p className="text-gray-600 mb-4">
            {debugStats?.isEnabled
              ? 'Debug capture is enabled. LLM interactions will appear here when they occur.'
              : 'Debug capture is disabled. Enable it in the admin panel to see LLM interactions.'}
          </p>
          <div className="text-sm text-gray-500">
            Try making some API calls to /api/chat/completions to generate debug data.
          </div>
        </div>
      )}
      
      {/* Popups */}
      <PopupManager>
        {selectedEntry && popupState.transcript && (
          <TranscriptPopup
            entry={selectedEntry}
            onClose={() => setPopupState(prev => ({ ...prev, transcript: false }))}
          />
        )}
        
        {selectedEntry && popupState.knowledgeBase && (
          <KnowledgeBasePopup
            entry={selectedEntry}
            onClose={() => setPopupState(prev => ({ ...prev, knowledgeBase: false }))}
          />
        )}
        
        {selectedEntry && popupState.systemPrompt && (
          <SystemPromptPopup
            entry={selectedEntry}
            onClose={() => setPopupState(prev => ({ ...prev, systemPrompt: false }))}
          />
        )}
        
        {selectedEntry && popupState.responseDetail && (
          <ResponseDetailPopup
            entry={selectedEntry}
            onClose={() => setPopupState(prev => ({ ...prev, responseDetail: false }))}
          />
        )}
        
        {selectedEvent && popupState.eventDetails && (
          <EventDetailsPopup
            event={selectedEvent}
            onClose={() => setPopupState(prev => ({ ...prev, eventDetails: false }))}
          />
        )}
      </PopupManager>
    </div>
  );
}