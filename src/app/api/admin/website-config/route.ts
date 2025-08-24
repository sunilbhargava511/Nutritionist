import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { websiteConfig } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDB();
    
    // Get website configuration
    const configs = await db.select().from(websiteConfig).limit(1);
    const config = configs[0] || null;
    
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
      conversationDescription
    } = body;

    // Validate required fields
    if (!lessonsName || !lessonsDescription || !conversationName || !conversationDescription) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if website config already exists
    const existing = await db.select().from(websiteConfig).limit(1);
    
    if (existing.length > 0) {
      // Update existing config
      await db.update(websiteConfig)
        .set({
          lessonsName,
          lessonsDescription,
          conversationName,
          conversationDescription,
          updatedAt: new Date().toISOString()
        })
        .where(eq(websiteConfig.id, 'default'));
    } else {
      // Create new config
      await db.insert(websiteConfig).values({
        id: 'default',
        lessonsName,
        lessonsDescription,
        conversationName,
        conversationDescription
      });
    }

    // Return the updated config
    const updated = await db.select().from(websiteConfig).limit(1);
    
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