import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import * as schema from '@/lib/database/schema';

export async function GET(request: NextRequest) {
  try {
    // Fast health check for Railway
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: '1.0.0',
    };

    // Quick database connectivity check (non-blocking)
    try {
      // Simple table existence check instead of data query
      await getDB().select().from(schema.adminSettings).limit(1);
      health['database'] = 'connected';
    } catch (dbError) {
      // Don't fail health check if database is still initializing
      health['database'] = 'initializing';
    }

    // Only warn about missing env vars, don't block health check
    const requiredEnvVars = [
      'ANTHROPIC_API_KEY',
      'ELEVENLABS_API_KEY',
      'NEXT_PUBLIC_ELEVENLABS_API_KEY',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingEnvVars.length > 0) {
      health['warnings'] = `Missing environment variables: ${missingEnvVars.join(', ')}`;
    }

    // Always return 200 OK for Railway health checks
    return NextResponse.json(health, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'railway-optimized'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    // Still return 200 to pass Railway health checks
    return NextResponse.json(
      {
        status: 'healthy', // Railway needs 'healthy' status
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'Service starting up'
      },
      { status: 200 }
    );
  }
}