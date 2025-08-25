import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { webapp } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const webappKey = searchParams.get('webapp_key') || 'default';
    
    // Get website configuration from webapp table
    const webapps = await db.select({
      lessonsName: webapp.lessonsName,
      lessonsDescription: webapp.lessonsDescription,
      conversationName: webapp.conversationName,
      conversationDescription: webapp.conversationDescription
    }).from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    
    const config = webapps[0] || null;
    
    return NextResponse.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error fetching website config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch website config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDB();
    const body = await request.json();
    
    const {
      lessonsName,
      lessonsDescription,
      conversationName,
      conversationDescription,
      webappKey = 'default'
    } = body;

    // Validate required fields
    if (!lessonsName || !lessonsDescription || !conversationName || !conversationDescription) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Update webapp table instead of website config table
    await db.update(webapp)
      .set({
        lessonsName,
        lessonsDescription,
        conversationName,
        conversationDescription,
        updatedAt: new Date().toISOString()
      })
      .where(eq(webapp.webappKey, webappKey));

    // Return the updated data
    const updated = await db.select({
      lessonsName: webapp.lessonsName,
      lessonsDescription: webapp.lessonsDescription,
      conversationName: webapp.conversationName,
      conversationDescription: webapp.conversationDescription
    }).from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    
    return NextResponse.json({
      success: true,
      config: updated[0],
      message: 'Website configuration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating website config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update website config' },
      { status: 500 }
    );
  }
}