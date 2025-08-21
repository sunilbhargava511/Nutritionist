'use client';

import React, { useState, useEffect } from 'react';
import { DebugSession, LLMDebugEntry } from '@/lib/debug-session-manager';
import InputFlowPanel from './InputFlowPanel';
import OutputPanel from './OutputPanel';

interface DebugLLMPanelProps {
  session: DebugSession;
  onClearSession: () => void;
  isRealTime: boolean;
}

export default function DebugLLMPanel({ session, onClearSession, isRealTime }: DebugLLMPanelProps) {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LLMDebugEntry[]>(session.entries);

  // Update entries when session changes or in real-time
  useEffect(() => {
    setEntries([...session.entries].reverse()); // Most recent first
    
    // Auto-select the most recent entry if none selected
    if (!selectedEntryId && session.entries.length > 0) {
      setSelectedEntryId(session.entries[session.entries.length - 1].id);
    }
  }, [session, selectedEntryId]);

  // Real-time updates
  useEffect(() => {
    if (!isRealTime) return;

    const interval = setInterval(() => {
      const updatedEntries = [...session.entries].reverse();
      setEntries(updatedEntries);
    }, 2000);

    return () => clearInterval(interval);
  }, [session, isRealTime]);

  const selectedEntry = entries.find(entry => entry.id === selectedEntryId);

  const handleEntrySelect = (entryId: string) => {
    setSelectedEntryId(entryId);
  };

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <div className="text-gray-500">
          <p className="text-lg font-medium mb-2">No Debug Entries</p>
          <p className="text-sm">This session has no LLM interactions yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Entry List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-900">Debug Entries ({entries.length})</h3>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => handleEntrySelect(entry.id)}
              className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                selectedEntryId === entry.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Status Icon */}
                  <div
                    className={`w-2 h-2 rounded-full ${
                      entry.status === 'success'
                        ? 'bg-green-500'
                        : entry.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                    }`}
                  />
                  
                  {/* Entry Info */}
                  <div>
                    <div className="text-sm font-medium">
                      {entry.type === 'rag' ? 'RAG Request' : 
                       entry.type === 'knowledge-search' ? 'Knowledge Search' : 
                       'Claude Request'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp)).toLocaleTimeString()} • 
                      {entry.status === 'success' && ` ${entry.response.processingTime}ms`}
                      {entry.status === 'error' && ' Failed'}
                      {entry.status === 'pending' && ' Processing...'}
                    </div>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="text-xs text-gray-400">
                  {entry.status === 'success' && entry.response.usage?.tokens && (
                    <span>{entry.response.usage.tokens} tokens</span>
                  )}
                  {entry.response.citedArticles && entry.response.citedArticles.length > 0 && (
                    <span className="ml-2">📚 {entry.response.citedArticles.length}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-Panel Layout */}
      {selectedEntry && (
        <div className="grid grid-cols-5 gap-6">
          {/* Left Panel (60%) - Input Flow */}
          <div className="col-span-3">
            <InputFlowPanel entry={selectedEntry} />
          </div>

          {/* Right Panel (40%) - Output */}
          <div className="col-span-2">
            <OutputPanel entry={selectedEntry} />
          </div>
        </div>
      )}
    </div>
  );
}