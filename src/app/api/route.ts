import { NextRequest, NextResponse } from 'next/server';

// Root API endpoint - Railway load balancer health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    app: 'nutritionist-learning',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    message: 'Nutritionist Learning API is running'
  }, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

// Support HEAD requests  
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}