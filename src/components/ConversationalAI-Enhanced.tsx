'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, AlertCircle } from 'lucide-react';
import { useConversation } from '@elevenlabs/react';

interface ConversationalAIProps {
  sessionId: string;
  onMessage?: (message: { role: 'user' | 'assistant'; content: string; timestamp: Date }) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: string) => void;
  className?: string;
  skipOpeningMessage?: boolean; // Skip playing the opening message (useful for lesson Q&A)
  autoStart?: boolean; // Auto-start the conversation on mount
  lessonContext?: {
    lessonId: string;
    lessonTitle: string;
    orderIndex: number;
    conversationState: string;
  }; // Optional lesson context for post-lesson Q&A
}

type ConnectionStatus = 'idle' | 'requesting_permission' | 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Enhanced ConversationalAI Component for Unified Session System
 * Works with sessionId and the new session-transcript API
 */
export default function ConversationalAI({
  sessionId,
  onMessage,
  onStatusChange,
  onError,
  className = '',
  skipOpeningMessage = false,
  autoStart = false,
  lessonContext
}: ConversationalAIProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  
  // Refs for conversation management
  const streamRef = useRef<MediaStream | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Update status and notify parent
  const updateStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    onStatusChange?.(status);
  }, [onStatusChange]);

  // Handle errors
  const handleError = useCallback((errorMessage: string) => {
    console.error('[Enhanced ConversationalAI] Error:', errorMessage);
    setError(errorMessage);
    updateStatus('error');
    onError?.(errorMessage);
  }, [updateStatus, onError]);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: async (details) => {
      console.log('[Enhanced ConversationalAI] ElevenLabs connected:', details);
      if (details.conversationId) {
        conversationIdRef.current = details.conversationId;
        
        // Link ElevenLabs conversation to our session with optional lesson context
        try {
          await fetch('/api/session-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'link_elevenlabs',
              sessionId,
              conversationId: details.conversationId,
              lessonContext
            })
          });
          console.log('[Enhanced ConversationalAI] Session linked to ElevenLabs conversation', lessonContext ? 'with lesson context' : '');
        } catch (error) {
          console.error('[Enhanced ConversationalAI] Failed to link session:', error);
        }
      }
      
      updateStatus('connected');
      setIsConnecting(false);
    },
    onDisconnect: (details) => {
      console.log('[Enhanced ConversationalAI] Disconnected:', details);
      updateStatus('disconnected');
      setIsConnecting(false);
    },
    onMessage: (message) => {
      console.log('[Enhanced ConversationalAI] Message received:', message);
      
      // Notify parent component
      onMessage?.({
        role: message.source === 'user' ? 'user' : 'assistant',
        content: message.message,
        timestamp: new Date()
      });
    },
    onError: (error) => {
      console.error('[Enhanced ConversationalAI] ElevenLabs error:', error);
      handleError(typeof error === 'string' ? error : (error as any)?.message || 'Conversation error');
    },
    onAudio: (audio) => {
      console.log('[Enhanced ConversationalAI] Audio event:', audio);
    },
    onDebug: (info) => {
      console.log('[Enhanced ConversationalAI] Debug info:', info);
    }
  });

  // Request microphone permission
  const requestMicrophonePermission = useCallback(async (): Promise<MediaStream> => {
    try {
      updateStatus('requesting_permission');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      
      streamRef.current = stream;
      return stream;
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Microphone permission denied. Please allow microphone access.');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone.');
        }
      }
      throw new Error('Failed to access microphone');
    }
  }, [updateStatus]);

  // Get session's opening message for firstMessage
  const getSessionOpeningMessage = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch(`/api/session-transcript?sessionId=${sessionId}&action=transcript`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch session transcript');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.transcript || data.transcript.length === 0) {
        throw new Error('No transcript found');
      }
      
      // Find the first opening message (TTS opening or lesson intro)
      const openingMessage = data.transcript.find((msg: any) => 
        msg.messageType === 'tts_opening' || msg.messageType === 'tts_lesson_intro'
      );
      
      if (openingMessage) {
        return openingMessage.content;
      }
      
      // Fallback message
      return "Hello! I'm Sanjay, your AI financial advisor. How can I help you today?";
      
    } catch (error) {
      console.error('[Enhanced ConversationalAI] Failed to get opening message:', error);
      return "Hello! I'm Sanjay, your AI financial advisor. How can I help you today?";
    }
  }, [sessionId]);

  // Start conversation
  const startConversation = useCallback(async () => {
    if (isConnecting || connectionStatus === 'connected') {
      console.log('[Enhanced ConversationalAI] Already connecting or connected');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Step 1: Request microphone permission
      await requestMicrophonePermission();
      
      // Step 2: Get opening message (or use default for Q&A)
      const openingMessage = skipOpeningMessage 
        ? "Hi! I'm ready to answer any questions about what you just learned. What would you like to discuss?"
        : await getSessionOpeningMessage();
      
      updateStatus('connecting');
      
      // Step 3: Start ElevenLabs conversation with appropriate message
      console.log('[Enhanced ConversationalAI] Starting conversation with message:', openingMessage.substring(0, 50) + '...', skipOpeningMessage ? '(Q&A mode)' : '(Opening mode)');
      
      const sessionConfig = {
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        connectionType: 'webrtc' as const,
        overrides: {
          agent: {
            firstMessage: openingMessage,
            interruptible: true
          },
          tts: {
            voiceId: 'MXGyTMlsvQgQ4BL0emIa',
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.4,
            use_speaker_boost: true,
            speed: 0.85
          }
        }
      };

      console.log('[Enhanced ConversationalAI] Starting ElevenLabs session...');
      const result = await conversation.startSession(sessionConfig);
      console.log('[Enhanced ConversationalAI] ElevenLabs session started:', result);
      
    } catch (error) {
      console.error('[Enhanced ConversationalAI] Failed to start conversation:', error);
      handleError(error instanceof Error ? error.message : 'Failed to start conversation');
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, isConnecting, connectionStatus, requestMicrophonePermission, updateStatus, handleError, getSessionOpeningMessage, skipOpeningMessage]);

  // End conversation
  const endConversation = useCallback(async () => {
    try {
      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // End ElevenLabs conversation
      if (conversation) {
        await conversation.endSession();
        console.log('[Enhanced ConversationalAI] Conversation ended');
      }

      // Reset state
      conversationIdRef.current = null;
      updateStatus('disconnected');
      setError(null);
      
    } catch (error) {
      console.error('[Enhanced ConversationalAI] Error ending conversation:', error);
      handleError('Failed to end conversation properly');
    }
  }, [conversation, updateStatus, handleError]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Auto-start conversation on mount if needed
  useEffect(() => {
    if (!hasAutoStarted && connectionStatus === 'idle' && !isConnecting) {
      const autoStartFromStorage = localStorage.getItem('autoStartConversation');
      
      if (autoStart || autoStartFromStorage === 'true') {
        console.log('[Enhanced ConversationalAI] Auto-starting conversation...');
        setHasAutoStarted(true);
        
        // Start immediately without delay for smoother UX
        startConversation();
        
        // Clean up localStorage flag if it was set
        if (autoStartFromStorage === 'true') {
          localStorage.removeItem('autoStartConversation');
        }
      }
    }
  }, [hasAutoStarted, connectionStatus, isConnecting, startConversation, autoStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionStatus === 'connected') {
        endConversation();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render status message
  const getStatusMessage = () => {
    switch (connectionStatus) {
      case 'requesting_permission':
        return 'Requesting microphone permission...';
      case 'connecting':
        return 'Connecting to Sanjay...';
      case 'connected':
        return 'Connected - Speak naturally';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return error || 'Connection error';
      default:
        return 'Ready to connect';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
      case 'requesting_permission':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className={`conversational-ai-enhanced ${className}`}>
      {/* Connection Status */}
      <div className="mb-6 text-center">
        <div className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusMessage()}
        </div>
        {error && (
          <div className="mt-2 text-xs text-red-500 flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>

      {/* Main Control Button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={connectionStatus === 'connected' ? endConversation : startConversation}
          disabled={isConnecting}
          className={`
            w-32 h-32 rounded-full flex items-center justify-center text-white font-bold text-lg
            transition-all duration-200 transform hover:scale-105 shadow-2xl
            ${isConnecting
              ? 'bg-yellow-500 animate-pulse cursor-not-allowed'
              : connectionStatus === 'connected'
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-blue-500 hover:bg-blue-600'
            }
          `}
          aria-label={connectionStatus === 'connected' ? 'End conversation' : 'Start conversation'}
        >
          {isConnecting ? (
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
              <span className="text-sm">Connecting</span>
            </div>
          ) : connectionStatus === 'connected' ? (
            <div className="flex flex-col items-center">
              <PhoneOff className="w-8 h-8 mb-2" />
              <span className="text-sm">End Call</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Phone className="w-8 h-8 mb-2" />
              <span className="text-sm">Start Call</span>
            </div>
          )}
        </button>

        {/* Mute Button (only shown when connected) */}
        {connectionStatus === 'connected' && (
          <button
            onClick={toggleMute}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2
              ${isMuted
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isMuted ? 'Muted' : 'Unmute'}
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center text-sm text-gray-600">
        {connectionStatus === 'idle' && (
          <p>Click to start a voice conversation with Sanjay</p>
        )}
        {connectionStatus === 'connected' && (
          <p>Speak naturally - Sanjay is listening</p>
        )}
      </div>

      {/* Session Info */}
      <div className="mt-4 text-center text-xs text-gray-400">
        Session: {sessionId.slice(-8)} | Enhanced Session System v2.0
      </div>
    </div>
  );
}