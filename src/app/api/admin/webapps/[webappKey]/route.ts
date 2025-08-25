import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { webapp } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

// GET /api/admin/webapps/[webappKey] - Get specific webapp
export async function GET(request: NextRequest, { params }: { params: { webappKey: string } }) {
  try {
    const db = getDB();
    const { webappKey } = params;
    
    const webappData = await db.select().from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    
    if (webappData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Webapp not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      webapp: webappData[0]
    });
  } catch (error) {
    console.error('Error fetching webapp:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch webapp' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/webapps/[webappKey] - Update specific webapp
export async function PUT(request: NextRequest, { params }: { params: { webappKey: string } }) {
  try {
    const db = getDB();
    const { webappKey } = params;
    const body = await request.json();
    
    // Check if webapp exists
    const existing = await db.select().from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Webapp not found' },
        { status: 404 }
      );
    }

    // Prepare update data (only include provided fields)
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    // Map allowed fields for update
    const allowedFields = [
      'serviceDescription', 'keyBenefits', 'businessName', 'address', 
      'phoneNumber', 'email', 'website', 'lessonsName', 'lessonsDescription',
      'conversationName', 'conversationDescription', 'subdomain', 'customDomain',
      'primaryColor', 'secondaryColor', 'accentColor', 'neutralColor',
      'backgroundColor', 'textColor', 'headerBgColor', 'headerTextColor',
      'theme', 'borderRadius', 'fontFamily', 'navigationStyle', 'buttonStyle',
      'buttonSize', 'customCss', 'customFonts', 'tagline', 'welcomeMessage',
      'showLogo', 'showTagline', 'customFavicon', 'isActive'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'isActive' || field === 'showLogo' || field === 'showTagline') {
          updateData[field] = body[field] ? 1 : 0;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Update the webapp
    const updated = await db.update(webapp)
      .set(updateData)
      .where(eq(webapp.webappKey, webappKey))
      .returning();

    return NextResponse.json({
      success: true,
      webapp: updated[0],
      message: 'Webapp updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating webapp:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update webapp' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/webapps/[webappKey] - Delete specific webapp
export async function DELETE(request: NextRequest, { params }: { params: { webappKey: string } }) {
  try {
    const db = getDB();
    const { webappKey } = params;
    
    // Check if webapp exists
    const existing = await db.select().from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Webapp not found' },
        { status: 404 }
      );
    }

    // Note: Due to foreign key constraints, deleting the webapp will cascade delete
    // all related data (lessons, admin_settings, conversations, etc.)
    const deleted = await db.delete(webapp)
      .where(eq(webapp.webappKey, webappKey))
      .returning();

    return NextResponse.json({
      success: true,
      deletedWebapp: deleted[0],
      message: 'Webapp and all associated data deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting webapp:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete webapp' },
      { status: 500 }
    );
  }
}