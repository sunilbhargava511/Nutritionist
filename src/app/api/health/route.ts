import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import * as schema from '@/lib/database/schema';

export async function GET(request: NextRequest) {
  try {
    // Basic health check
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    };

    // Optional: Check database connectivity
    try {
      // Simple query to verify database is accessible
      await db.select().from(schema.adminSettings).limit(1);
      health['database'] = 'connected';
    } catch (dbError) {
      // Database might not be initialized yet, which is okay
      health['database'] = 'initializing';
    }

    // Check required environment variables
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

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    // Even on error, return 200 with error info for monitoring
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 }
    );
  }
}