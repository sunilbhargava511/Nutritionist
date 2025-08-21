'use client';

import React, { useState } from 'react';
import { Activity, Calendar, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { SessionEvent } from '@/types';
import SessionEventCard from './SessionEventCard';

interface SessionEventsPanelProps {
  events: SessionEvent[];
  onViewEventDetails: (event: SessionEvent) => void;
}

type EventTypeFilter = 'all' | 'session_started' | 'elevenlabs_conversation_started' | 'lesson_started' | 'lesson_qa_started' | 'open_conversation_started';
type EventStatusFilter = 'all' | 'active' | 'completed' | 'interrupted';

export default function SessionEventsPanel({ events, onViewEventDetails }: SessionEventsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EventTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>('all');

  // Filter events based on selected filters
  const filteredEvents = events.filter(event => {
    const typeMatch = typeFilter === 'all' || event.type === typeFilter;
    const statusMatch = statusFilter === 'all' || event.status === statusFilter;
    return typeMatch && statusMatch;
  });

  // Get event type display name
  const getEventTypeDisplayName = (type: EventTypeFilter) => {
    switch (type) {
      case 'session_started': return 'Session Started';
      case 'elevenlabs_conversation_started': return 'Voice Started';
      case 'lesson_started': return 'Lesson Started';
      case 'lesson_qa_started': return 'Lesson Q&A';
      case 'open_conversation_started': return 'Open Chat';
      default: return 'All Events';
    }
  };

  // Get event counts by type
  const eventCounts = {
    all: events.length,
    session_started: events.filter(e => e.type === 'session_started').length,
    elevenlabs_conversation_started: events.filter(e => e.type === 'elevenlabs_conversation_started').length,
    lesson_started: events.filter(e => e.type === 'lesson_started').length,
    lesson_qa_started: events.filter(e => e.type === 'lesson_qa_started').length,
    open_conversation_started: events.filter(e => e.type === 'open_conversation_started').length,
  };

  return (
    <div className="border-r border-gray-200 h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-indigo-800 uppercase tracking-wide">
              Session Events
            </h4>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-indigo-100 rounded"
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-indigo-600" />
            ) : (
              <ChevronUp className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        </div>
        
        {/* Event Summary */}
        <div className="mt-2 flex items-center gap-4 text-xs text-indigo-700">
          <span>{events.length} total events</span>
          <span>{filteredEvents.length} filtered</span>
          <span>{events.filter(e => e.status === 'active').length} active</span>
        </div>
      </div>

      {/* Filters */}
      {!isCollapsed && (
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="space-y-2">
            {/* Type Filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Event Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as EventTypeFilter)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Types ({eventCounts.all})</option>
                <option value="session_started">Session Started ({eventCounts.session_started})</option>
                <option value="elevenlabs_conversation_started">Voice Started ({eventCounts.elevenlabs_conversation_started})</option>
                <option value="lesson_started">Lesson Started ({eventCounts.lesson_started})</option>
                <option value="lesson_qa_started">Lesson Q&A ({eventCounts.lesson_qa_started})</option>
                <option value="open_conversation_started">Open Chat ({eventCounts.open_conversation_started})</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as EventStatusFilter)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="interrupted">Interrupted</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      {!isCollapsed && (
        <div className="p-4 space-y-3 max-h-[550px] overflow-y-auto">
          {filteredEvents.length > 0 ? (
            <>
              {/* Current Filter Info */}
              {(typeFilter !== 'all' || statusFilter !== 'all') && (
                <div className="text-xs text-gray-600 bg-gray-100 rounded p-2 mb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Filter className="w-3 h-3" />
                    Active Filters:
                  </div>
                  {typeFilter !== 'all' && (
                    <div>Type: {getEventTypeDisplayName(typeFilter)}</div>
                  )}
                  {statusFilter !== 'all' && (
                    <div>Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</div>
                  )}
                </div>
              )}

              {/* Event Cards */}
              {filteredEvents.map((event) => (
                <SessionEventCard
                  key={event.id}
                  event={event}
                  onViewDetails={() => onViewEventDetails(event)}
                />
              ))}
            </>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-2">No session events</p>
              <p className="text-xs text-gray-500">
                {events.length === 0
                  ? 'Session events will appear here when they occur'
                  : 'No events match the current filters'}
              </p>
              {events.length > 0 && filteredEvents.length === 0 && (
                <button
                  onClick={() => {
                    setTypeFilter('all');
                    setStatusFilter('all');
                  }}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsed State */}
      {isCollapsed && (
        <div className="p-3 text-center">
          <div className="text-xs text-gray-600">
            {events.length} events
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Click to expand
          </div>
        </div>
      )}
    </div>
  );
}