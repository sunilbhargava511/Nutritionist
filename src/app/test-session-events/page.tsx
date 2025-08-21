'use client';

import React, { useState } from 'react';

export default function TestSessionEventsPage() {
  const [status, setStatus] = useState<string>('Ready to test');
  const [events, setEvents] = useState<any[]>([]);

  const createTestEvents = async () => {
    setStatus('Creating test session events...');
    
    try {
      const response = await fetch('/api/test-session-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-test-events' })
      });

      const data = await response.json();

      if (data.success) {
        setEvents(data.events || []);
        setStatus(data.message);
      } else {
        throw new Error(data.error || 'API call failed');
      }
      
    } catch (error) {
      console.error('Error creating test events:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clearEvents = async () => {
    try {
      const response = await fetch('/api/test-session-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-events' })
      });

      const data = await response.json();

      if (data.success) {
        setEvents([]);
        setStatus(data.message);
      } else {
        throw new Error(data.error || 'API call failed');
      }
    } catch (error) {
      console.error('Error clearing events:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Test Session Events</h1>
          <p className="text-gray-600 mb-6">
            This page allows you to create test session events to verify the debug panel functionality.
          </p>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={createTestEvents}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Test Events
            </button>
            <button
              onClick={clearEvents}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Clear Events
            </button>
            <a
              href="/debug-llm"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 inline-block text-center"
            >
              View Debug Panel
            </a>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Status:</h3>
            <p className="text-sm text-gray-700 bg-gray-100 rounded p-3">{status}</p>
          </div>

          {events.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Created Events ({events.length}):</h3>
              <div className="space-y-3">
                {events.map((event, index) => (
                  <div key={index} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{event.title}</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {event.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{event.summary}</p>
                    <div className="text-xs text-gray-500">
                      ID: {event.id} | Time: {event.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}