import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { webapp } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

// GET /api/admin/webapps - List all webapps
export async function GET() {
  try {
    const db = getDB();
    
    const webapps = await db.select().from(webapp).orderBy(webapp.businessName);
    
    return NextResponse.json({
      success: true,
      webapps
    });
  } catch (error) {
    console.error('Error fetching webapps:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch webapps' },
      { status: 500 }
    );
  }
}

// POST /api/admin/webapps - Create new webapp
export async function POST(request: NextRequest) {
  try {
    const db = getDB();
    const body = await request.json();
    
    const {
      webappKey,
      businessName,
      serviceDescription,
      keyBenefits,
      address,
      phoneNumber,
      email,
      website,
      lessonsName,
      lessonsDescription,
      conversationName,
      conversationDescription,
      subdomain,
      customDomain,
      primaryColor,
      secondaryColor,
      accentColor,
      theme,
      tagline,
      welcomeMessage,
      isActive = true
    } = body;

    // Validate required fields
    if (!webappKey || !businessName) {
      return NextResponse.json(
        { success: false, error: 'webappKey and businessName are required' },
        { status: 400 }
      );
    }

    // Check if webapp key already exists
    const existing = await db.select().from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Webapp key already exists' },
        { status: 400 }
      );
    }

    // Create new webapp
    const newWebapp = await db.insert(webapp).values({
      id: `webapp-${webappKey}`,
      webappKey,
      serviceDescription: serviceDescription || '',
      keyBenefits: keyBenefits || '',
      businessName,
      address: address || '',
      phoneNumber: phoneNumber || '',
      email: email || '',
      website: website || '',
      lessonsName: lessonsName || 'Lessons',
      lessonsDescription: lessonsDescription || 'Educational video content',
      conversationName: conversationName || 'Chat',
      conversationDescription: conversationDescription || 'Open conversation with AI',
      subdomain,
      customDomain,
      primaryColor: primaryColor || '#3b82f6',
      secondaryColor: secondaryColor || '#ef4444',
      accentColor: accentColor || '#10b981',
      theme: theme || 'light',
      tagline,
      welcomeMessage,
      isActive: isActive ? 1 : 0
    }).returning();

    return NextResponse.json({
      success: true,
      webapp: newWebapp[0],
      message: 'Webapp created successfully'
    });
    
  } catch (error) {
    console.error('Error creating webapp:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create webapp' },
      { status: 500 }
    );
  }
}