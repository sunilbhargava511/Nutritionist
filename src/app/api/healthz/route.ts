import { NextRequest, NextResponse } from 'next/server';

// Minimal health check endpoint for Railway (no database dependencies)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'nutritionist-app'
  }, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

// Support HEAD requests for health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}