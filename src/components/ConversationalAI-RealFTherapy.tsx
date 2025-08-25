'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, AlertCircle } from 'lucide-react';
import { EnhancedSessionStorage } from '@/lib/session-enhanced';
import { useConversation } from '@elevenlabs/react';
import { Session, Message } from '@/types';
import { useVoiceId } from '@/hooks/useVoiceConfig';

interface ConversationalAIProps {
  onMessage?: (message: { role: 'user' | 'assistant'; content: string; timestamp: Date }) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: string) => void;
  className?: string;
}

type ConnectionStatus = 'idle' | 'requesting_permission' | 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * ConversationalAI Component using REAL FTherapy Pattern
 * Based on actual FTherapy source code with useConversation hook
 * 
 * @deprecated This component uses the legacy educational session/chunk system.
 * New implementations should use the lesson-based system with qaStartService.
 */
export default function ConversationalAI({
  onMessage,
  onStatusChange,
  onError,
  className = ''
}: ConversationalAIProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  
  // Get voice ID from centralized config
  const { voiceId, isLoading: voiceLoading, error: voiceError } = useVoiceId();
  
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
    console.error('[Real FTherapy] Error:', errorMessage);
    setError(errorMessage);
    updateStatus('error');
    onError?.(errorMessage);
  }, [updateStatus, onError]);

  // Working Pattern: useConversation hook without apiKey (same as test app)
  const conversation = useConversation({
    onConnect: (details) => {
      console.log('🔍 [FRONTEND-DEBUG] ElevenLabs connected:', details);
      if (details.conversationId) {
        conversationIdRef.current = details.conversationId;
        
        // Optionally update educational session with conversation_id - don't fail if it doesn't work
        const tempEducationalSessionId = localStorage.getItem('currentEducationalSessionId');
        if (tempEducationalSessionId) {
          console.log('🔍 [FRONTEND-DEBUG] Attempting to link educational session to conversation_id:', details.conversationId);
          
          fetch('/api/educational-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_conversation_id',
              tempSessionId: tempEducationalSessionId,
              conversationId: details.conversationId,
            })
          }).then(response => {
            if (response.ok) {
              console.log('🔍 [FRONTEND-DEBUG] Educational session linked successfully');
              localStorage.setItem('currentEducationalSessionId', details.conversationId);
            } else {
              console.log('🔍 [FRONTEND-DEBUG] Educational session linking skipped - continuing with conversation');
            }
          }).catch(error => {
            console.log('[Real FTherapy] Educational session linking failed - continuing with conversation');
          });
        }
      }
      
      updateStatus('connected');
      setIsConnecting(false);
    },
    onDisconnect: (details) => {
      console.log('[Real FTherapy] Disconnected:', details);
      updateStatus('disconnected');
      setIsConnecting(false);
    },
    onMessage: (message) => {
      console.log('[Real FTherapy] Message received:', message);
      
      // Store message in session
      if (currentSession) {
        const messageData: Message = {
          id: `msg_${Date.now()}_${message.source}`,
          content: message.message,
          sender: message.source === 'user' ? 'user' : 'assistant',
          timestamp: new Date()
        };
        
        EnhancedSessionStorage.addMessage(currentSession.id, messageData);
        
        // Notify parent component
        onMessage?.({
          role: message.source === 'user' ? 'user' : 'assistant',
          content: message.message,
          timestamp: new Date()
        });
      }
    },
    onError: (error) => {
      console.error('🔍 [FRONTEND-DEBUG] ElevenLabs connection error:', error);
      handleError(typeof error === 'string' ? error : (error as any)?.message || 'Conversation error');
    },
    onAudio: (audio) => {
      console.log('[Real FTherapy] Audio event:', audio);
    },
    onDebug: (info) => {
      console.log('[Real FTherapy] Debug info:', info);
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

  // Initialize session - always create new and end any existing
  const initializeSession = useCallback(() => {
    // First, end any existing active session
    const existingSession = EnhancedSessionStorage.getCurrentSession();
    if (existingSession && existingSession.isActive) {
      existingSession.isActive = false;
      EnhancedSessionStorage.saveSession(existingSession);
      console.log(`[Real FTherapy] Ended existing session: ${existingSession.id}`);
    }
    
    // Always create a fresh new session
    const session = EnhancedSessionStorage.createNewSession(`Voice Session ${new Date().toLocaleTimeString()}`);
    console.log(`[Real FTherapy] Created fresh session: ${session.id}`);
    
    setCurrentSession(session);
    return session;
  }, []);

  // Generate educational content message
  const generateWelcomeMessage = useCallback(async (): Promise<string> => {
    try {
      // Check if educational mode is enabled
      const educationalSessionId = localStorage.getItem('currentEducationalSessionId');
      
      if (!educationalSessionId) {
        // No educational session - use default welcome
        return "Hello! I'm Sanjay, your AI financial advisor. I'm here to help you with your financial questions and planning. What would you like to discuss today?";
      }

      // Simple check if educational session exists - don't fail if it doesn't
      try {
        const response = await fetch('/api/educational-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_session_state',
            sessionId: educationalSessionId
          }),
        });
        
        if (!response.ok) {
          console.log('[Real FTherapy] Educational session not found, will use default message');
        }
      } catch (error) {
        console.log('[Real FTherapy] Educational session check failed, will use default message');
      }

      // Store session ID for use throughout the conversation
      setSessionId(educationalSessionId);
      
      // Try to get a custom opening message
      let firstMessage = "Hello! I'm Sanjay, your AI nutritionist advisor. I'm here to help you understand nutrition and make healthier food choices. What would you like to learn about today?";
      
      try {
        const openingResponse = await fetch('/api/admin/opening-messages?type=general');
        if (openingResponse.ok) {
          const openingData = await openingResponse.json();
          if (openingData.success && openingData.message) {
            firstMessage = openingData.message.messageContent || openingData.message;
            console.log('[Real FTherapy] Using custom opening message');
          }
        }
      } catch (error) {
        console.log('[Real FTherapy] Using default opening message');
      }
      
      console.log('[Real FTherapy] Opening message prepared');
      
      // No need to advance chunks - the conversation will be handled naturally
      console.log('🔧 [CONVERSATION] Starting conversation with opening message');
      
      return firstMessage;
    } catch (error) {
      console.error('[Real FTherapy] Failed to generate educational content:', error);
      throw new Error(`Educational content generation failed: ${error instanceof Error ? error.message : 'Service unavailable'}`);
    }
  }, []);

  // Real FTherapy Pattern: Start conversation using useConversation hook
  const startConversation = useCallback(async () => {
    // Check voice configuration before starting
    if (!voiceId) {
      const errorMsg = voiceError 
        ? `Voice configuration error: ${voiceError}` 
        : 'Voice ID not loaded. Please check admin settings.';
      console.error('[Real FTherapy] Voice configuration required:', errorMsg);
      setError(errorMsg);
      return;
    }

    if (isConnecting || connectionStatus === 'connected') {
      console.log('[Real FTherapy] Already connecting or connected');
      return;
    }

    console.log('[Real FTherapy] Starting conversation with voice ID:', voiceId);
    setIsConnecting(true);
    setError(null);

    try {
      // Step 1: Initialize session
      const session = initializeSession();
      
      // Step 2: Request microphone permission first (FTherapy pattern)
      await requestMicrophonePermission();
      
      // Step 3: Optional educational session creation - don't fail if it doesn't work
      const educationalSessionId = localStorage.getItem('currentEducationalSessionId');
      if (educationalSessionId) {
        console.log('[Real FTherapy] Attempting to create educational session');
        try {
          const createResponse = await fetch('/api/educational-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              sessionId: educationalSessionId,
            })
          });
          
          if (createResponse.ok) {
            console.log('✅ [EARLY-CREATE] Educational session created successfully');
          } else {
            console.log('ℹ️ [EARLY-CREATE] Educational session creation skipped - using default conversation');
          }
        } catch (error) {
          console.log('[EARLY-CREATE] Educational session creation failed - using default conversation');
        }
      }
      
      // Step 4: Generate welcome message (now that educational session exists)
      let welcomeMessage = '';
      if (session.messages.length === 0) {
        console.log('[Real FTherapy] Generating welcome message for new session');
        welcomeMessage = await generateWelcomeMessage();
      }
      
      // Step 4: Register session for webhook resolution
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      console.log('[Real FTherapy] Registering session:', newSessionId);
      
      try {
        // Get educational session ID from localStorage
        const educationalSessionId = localStorage.getItem('currentEducationalSessionId');
        
        await fetch('/api/register-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: newSessionId,
            conversationId: undefined, // Will be set by ElevenLabs
            timestamp: new Date().toISOString(),
            metadata: {
              therapistId: 'sanjay-financial-advisor',
              educational_session_id: educationalSessionId // Pass educational session ID
            }
          })
        });
        console.log(`[Real FTherapy] Session registered successfully with educational session: ${educationalSessionId}`);
      } catch (error) {
        console.error('[Real FTherapy] Session registration failed:', error);
      }

      updateStatus('connecting');
      
      // Step 5: Start conversation using test app's working pattern 
      console.log('[Real FTherapy] Starting conversation with agentId:', process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID);
      
      const sessionConfig = {
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        connectionType: 'webrtc' as const,
        overrides: {
          agent: {
            firstMessage: welcomeMessage || "Hello! I'm Sanjay, your AI financial advisor. How can I help you today?",
            // Make educational chunks uninterruptible
            interruptible: false
          },
          tts: {
            voiceId: voiceId!, // We validated voiceId exists before reaching this point
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.4,
            use_speaker_boost: true,
            speed: 0.85
          }
        }
      };

      console.log('🔍 [FRONTEND-DEBUG] Starting ElevenLabs session with config:', sessionConfig);
      const result = await conversation.startSession(sessionConfig);
      console.log('🔍 [FRONTEND-DEBUG] ElevenLabs session started result:', result);
      
      // Store welcome message if generated
      if (welcomeMessage) {
        const welcomeMessageData: Message = {
          id: `welcome_${Date.now()}`,
          content: welcomeMessage,
          sender: 'assistant',
          timestamp: new Date()
        };
        
        EnhancedSessionStorage.addMessage(session.id, welcomeMessageData);
        onMessage?.({
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date()
        });
      }
      
      setCurrentSession(EnhancedSessionStorage.getSession(session.id));
      
    } catch (error) {
      console.error('[Real FTherapy] Failed to start conversation:', error);
      handleError(error instanceof Error ? error.message : 'Failed to start conversation');
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, isConnecting, connectionStatus, requestMicrophonePermission, updateStatus, handleError, onMessage, generateWelcomeMessage, initializeSession, voiceId, voiceError]);

  // End conversation using Real FTherapy pattern
  const endConversation = useCallback(async () => {
    try {
      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // End conversation using useConversation hook
      if (conversation) {
        await conversation.endSession();
        console.log('[Real FTherapy] Conversation ended');
      }

      // Mark session as inactive
      if (currentSession) {
        currentSession.isActive = false;
        EnhancedSessionStorage.saveSession(currentSession);
        console.log(`[Real FTherapy] Marked session ${currentSession.id} as inactive`);
      }

      // Reset state
      conversationIdRef.current = null;
      setSessionId(null);
      updateStatus('disconnected');
      setError(null);
      
    } catch (error) {
      console.error('[Real FTherapy] Error ending conversation:', error);
      handleError('Failed to end conversation properly');
    }
  }, [conversation, updateStatus, handleError, currentSession]);

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

  // Auto-start conversation on mount
  useEffect(() => {
    // Check if we should auto-start (only once)
    if (!hasAutoStarted && connectionStatus === 'idle' && !isConnecting) {
      const autoStart = localStorage.getItem('autoStartConversation');
      
      // Auto-start if flag is set or if coming from "Start Talking" button
      if (autoStart === 'true') {
        console.log('[ConversationalAI] Auto-starting conversation...');
        setHasAutoStarted(true);
        
        // Small delay to ensure component is fully mounted
        setTimeout(() => {
          startConversation();
          // Clear the flag after use
          localStorage.removeItem('autoStartConversation');
        }, 500);
      }
    }
  }, [hasAutoStarted, connectionStatus, isConnecting]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className={`conversational-ai-container ${className}`}>
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
            {isMuted ? 'Unmuted' : 'Muted'}
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

      {/* Real FTherapy Pattern Indicator */}
      <div className="mt-4 text-center text-xs text-gray-400">
        Using REAL FTherapy Pattern (useConversation hook + WebRTC)
      </div>
    </div>
  );
}