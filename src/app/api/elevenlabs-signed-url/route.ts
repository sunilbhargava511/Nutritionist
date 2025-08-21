import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
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

    // Get signed URL from ElevenLabs Conversational API (correct endpoint)
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to get conversation URL',
          details: `ElevenLabs API error: ${response.status}`,
          message: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.signed_url) {
      console.error('No signed URL in response:', data);
      return NextResponse.json(
        { 
          error: 'No signed URL received',
          details: 'Invalid response from ElevenLabs' 
        },
        { status: 500 }
      );
    }

    // Return the signed URL and any additional conversation data
    return NextResponse.json({
      signedUrl: data.signed_url,
      conversationId: data.conversation_id,
      expiresAt: data.expires_at,
      // Include any additional metadata
      metadata: {
        agentId,
        createdAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error getting ElevenLabs signed URL:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to initialize conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'ElevenLabs Signed URL Endpoint',
      description: 'POST to this endpoint to get a signed URL for starting a conversation',
      requirements: [
        'ELEVENLABS_API_KEY environment variable',
        'ELEVENLABS_AGENT_ID environment variable'
      ]
    },
    { status: 200 }
  );
}