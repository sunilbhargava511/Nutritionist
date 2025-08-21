/**
 * ElevenLabs Conversational AI Service using FTherapy Pattern
 * This implements the exact pattern from FTherapy with conversation.startSession()
 */

import { Conversation, type PartialOptions } from '@elevenlabs/client';

export interface FTherapySessionConfig {
  agentId?: string;
  signedUrl?: string;
  conversationToken?: string;
  connectionType: 'webrtc' | 'websocket';
  firstMessage?: string;
  voiceId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
  };
  callbacks?: {
    onConnect?: () => void;
    onDisconnect?: (details?: any) => void;
    onMessage?: (message: { role: string; message: string }) => void;
    onError?: (error: string) => void;
    onStatusChange?: (status: string) => void;
    onModeChange?: (mode: { mode: string; isInterrupting: boolean }) => void;
  };
}

export class ElevenLabsConversationService {
  private conversation: any = null;

  /**
   * Start a conversation session using the FTherapy pattern
   * This matches the implementation from FTherapy with proper SDK usage
   */
  async startSession(config: FTherapySessionConfig): Promise<{
    conversationId: string;
    success: boolean;
    conversation: any;
  }> {
    try {
      console.log('[ElevenLabs] Starting conversation session with config:', {
        connectionType: config.connectionType,
        hasSignedUrl: !!config.signedUrl,
        hasToken: !!config.conversationToken,
        hasAgentId: !!config.agentId,
        hasFirstMessage: !!config.firstMessage
      });

      // Build options for Conversation.startSession (matching FTherapy pattern)
      const options: any = {
        // Use signed URL for WebSocket connections (FTherapy pattern)
        ...(config.signedUrl && { 
          signedUrl: config.signedUrl,
          connectionType: 'websocket'
        }),
        // Use conversation token for WebRTC connections
        ...(config.conversationToken && { 
          conversationToken: config.conversationToken,
          connectionType: 'webrtc'
        }),
        // Fallback to agent ID if neither signed URL nor token provided
        ...(config.agentId && !config.signedUrl && !config.conversationToken && { 
          agentId: config.agentId,
          connectionType: config.connectionType || 'webrtc'
        }),
        
        // Overrides (FTherapy pattern)
        overrides: {
          ...(config.firstMessage && {
            agent: {
              firstMessage: config.firstMessage
            }
          }),
          ...(config.voiceId && {
            tts: {
              voiceId: config.voiceId
            }
          })
        },
        
        // Callbacks with safety fallbacks
        onConnect: config.callbacks?.onConnect || (() => {}),
        onDisconnect: config.callbacks?.onDisconnect || (() => {}),
        onMessage: config.callbacks?.onMessage 
          ? (props: { message: string; source: string }) => config.callbacks!.onMessage!({ role: props.source, message: props.message })
          : (() => {}),
        onError: config.callbacks?.onError || (() => {}),
        onStatusChange: config.callbacks?.onStatusChange 
          ? (prop: { status: string }) => config.callbacks!.onStatusChange!(prop.status)
          : (() => {}),
        onModeChange: config.callbacks?.onModeChange 
          ? (prop: { mode: string }) => config.callbacks!.onModeChange!({ mode: prop.mode, isInterrupting: false })
          : (() => {})
      };

      console.log('[ElevenLabs] Starting conversation with options:', {
        connectionType: options.connectionType,
        hasOverrides: !!options.overrides,
        hasCallbacks: !!config.callbacks
      });

      // Start the conversation using the SDK (FTherapy pattern)
      console.log('[ElevenLabs] Final options being passed to SDK:', JSON.stringify({
        ...options,
        callbacks: 'functions_present'
      }, null, 2));
      
      this.conversation = await Conversation.startSession(options);
      
      console.log('[ElevenLabs] Conversation started successfully');
      
      return {
        conversationId: this.conversation?.conversationId || `conv_${Date.now()}`,
        success: true,
        conversation: this.conversation
      };
      
    } catch (error) {
      console.error('[ElevenLabs] Failed to start conversation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start conversation';
      config.callbacks?.onError?.(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * End the conversation session
   */
  async endSession(): Promise<void> {
    if (this.conversation) {
      try {
        // The SDK's conversation object has methods to end the session
        if (this.conversation.endSession) {
          await this.conversation.endSession();
        } else if (this.conversation.disconnect) {
          await this.conversation.disconnect();
        }
        this.conversation = null;
        console.log('[ElevenLabs] Conversation ended successfully');
      } catch (error) {
        console.error('[ElevenLabs] Error ending conversation:', error);
      }
    }
  }

  /**
   * Send a text message to the conversation
   */
  async sendText(text: string): Promise<void> {
    if (!this.conversation) {
      throw new Error('No active conversation');
    }

    try {
      if (this.conversation.sendUserInput) {
        await this.conversation.sendUserInput(text);
      } else if (this.conversation.sendText) {
        await this.conversation.sendText(text);
      }
    } catch (error) {
      console.error('[ElevenLabs] Failed to send text:', error);
      throw error;
    }
  }

  /**
   * Get conversation instance
   */
  getConversation(): any {
    return this.conversation;
  }

  /**
   * Check if conversation is active
   */
  isActive(): boolean {
    return this.conversation !== null;
  }
}

// Export singleton instance for easy use
export const elevenLabsConversation = new ElevenLabsConversationService();