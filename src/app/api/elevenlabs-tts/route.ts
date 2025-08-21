import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceSettings } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Default voice settings
    const defaultVoiceSettings = {
      voiceId: 'MXGyTMlsvQgQ4BL0emIa', // Default voice
      stability: 0.6,
      similarity_boost: 0.8,
      style: 0.4,
      use_speaker_boost: true
    };

    const finalVoiceSettings = { ...defaultVoiceSettings, ...voiceSettings };

    // Generate TTS using ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceSettings.voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: finalVoiceSettings.stability,
            similarity_boost: finalVoiceSettings.similarity_boost,
            style: finalVoiceSettings.style,
            use_speaker_boost: finalVoiceSettings.use_speaker_boost
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return NextResponse.json(
        { error: 'Failed to generate TTS audio' },
        { status: response.status }
      );
    }

    // Get the audio buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Return the audio as a blob URL that can be used by the audio player
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    
  } catch (error) {
    console.error('Error generating ElevenLabs TTS:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate TTS audio' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'ElevenLabs TTS Generation Endpoint',
      description: 'POST with { text, voiceSettings } to generate TTS audio',
      usage: {
        method: 'POST',
        body: {
          text: 'string (required)',
          voiceSettings: {
            voiceId: 'string (optional)',
            stability: 'number (optional)',
            similarity_boost: 'number (optional)',
            style: 'number (optional)',
            use_speaker_boost: 'boolean (optional)'
          }
        }
      }
    },
    { status: 200 }
  );
}