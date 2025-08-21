import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { firstMessage, voiceId, voiceSettings } = await request.json();
    
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      console.error('Missing ElevenLabs configuration:', { 
        hasApiKey: !!apiKey, 
        hasAgentId: !!agentId 
      });
      
      return NextResponse.json(
        { 
          error: 'ElevenLabs configuration missing',
          details: 'Please check environment variables' 
        },
        { status: 500 }
      );
    }

    console.log('Creating ElevenLabs conversation with overrides:', {
      agentId,
      voiceId,
      firstMessageLength: firstMessage?.length,
      voiceSettings
    });

    // Create conversation with overrides using ElevenLabs Conversation API (FTherapy pattern)
    const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        require_auth: false,
        conversation_config_override: {
          agent: {
            first_message: firstMessage // Override with Anthropic-generated message
          },
          tts: {
            voice_id: voiceId || 'MXGyTMlsvQgQ4BL0emIa',
            stability: voiceSettings?.stability || 0.6,
            similarity_boost: voiceSettings?.similarity_boost || 0.8,
            style: voiceSettings?.style || 0.4,
            use_speaker_boost: voiceSettings?.use_speaker_boost !== false,
            speed: voiceSettings?.speed || 0.85
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs Conversation API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to create conversation with overrides',
          details: `ElevenLabs API error: ${response.status}`,
          message: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.signed_url || !data.conversation_id) {
      console.error('Invalid response from ElevenLabs:', data);
      return NextResponse.json(
        { 
          error: 'Invalid response from ElevenLabs',
          details: 'Missing signed_url or conversation_id' 
        },
        { status: 500 }
      );
    }

    console.log('Successfully created ElevenLabs conversation:', {
      conversationId: data.conversation_id,
      expiresAt: data.expires_at
    });

    // Return the conversation data with override confirmation
    return NextResponse.json({
      signedUrl: data.signed_url,
      conversationId: data.conversation_id,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      overrides: {
        firstMessage,
        voiceId: voiceId || 'MXGyTMlsvQgQ4BL0emIa',
        voiceSettings: {
          stability: voiceSettings?.stability || 0.6,
          similarity_boost: voiceSettings?.similarity_boost || 0.8,
          style: voiceSettings?.style || 0.4,
          use_speaker_boost: voiceSettings?.use_speaker_boost !== false,
          speed: voiceSettings?.speed || 0.85
        }
      },
      metadata: {
        agentId,
        apiMethod: 'create_conversation_with_overrides',
        createdAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error creating ElevenLabs conversation:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'ElevenLabs Conversation Creation Endpoint',
      description: 'POST to create conversation with voice and message overrides',
      method: 'FTherapy Pattern Implementation',
      parameters: {
        firstMessage: 'required - Anthropic-generated welcome message',
        voiceId: 'optional - ElevenLabs voice ID (default: MXGyTMlsvQgQ4BL0emIa)',
        voiceSettings: {
          stability: '0.0-1.0 (default: 0.6)',
          similarity_boost: '0.0-1.0 (default: 0.8)', 
          style: '0.0-1.0 (default: 0.4)',
          use_speaker_boost: 'boolean (default: true)',
          speed: '0.0-2.0 (default: 0.85)'
        }
      },
      requirements: [
        'ELEVENLABS_API_KEY environment variable',
        'ELEVENLABS_AGENT_ID environment variable'
      ]
    },
    { status: 200 }
  );
}