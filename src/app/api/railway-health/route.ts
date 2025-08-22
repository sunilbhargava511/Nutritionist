import { NextRequest, NextResponse } from 'next/server';

// Railway-specific health check endpoint
export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  return NextResponse.json({
    status: 'healthy',
    service: 'nutritionist-app',
    timestamp,
    railway: {
      environment: process.env.RAILWAY_ENVIRONMENT || 'unknown',
      service: process.env.RAILWAY_SERVICE_NAME || 'unknown',
      port: process.env.PORT || '3000',
      hostname: process.env.HOSTNAME || 'localhost'
    },
    message: 'Railway health check successful'
  }, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/json'
    }
  });
}

// Support HEAD requests for health checks
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}