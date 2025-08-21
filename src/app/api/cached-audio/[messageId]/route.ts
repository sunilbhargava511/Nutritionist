import { NextRequest, NextResponse } from 'next/server';
import { audioCacheService } from '@/lib/audio-cache-service';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    await ensureDatabase();
    
    const { messageId } = await params;
    
    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Message ID is required' },
        { status: 400 }
      );
    }

    // Get cached audio from the service
    const cachedAudio = await audioCacheService.getCachedAudio(messageId);
    
    if (!cachedAudio?.audioBlob) {
      return NextResponse.json(
        { success: false, error: 'Cached audio not found' },
        { status: 404 }
      );
    }

    // Convert base64 to binary data
    const audioBuffer = Buffer.from(cachedAudio.audioBlob, 'base64');
    
    // Return the audio file with proper headers
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('[CachedAudio] Error serving cached audio:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to serve cached audio' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}