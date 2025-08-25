import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { webapp } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const webappKey = searchParams.get('webapp_key') || 'default';
    
    // Get service summary information from webapp table
    const webapps = await db.select({
      serviceDescription: webapp.serviceDescription,
      keyBenefits: webapp.keyBenefits
    }).from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    
    const summary = webapps[0] || null;
    
    return NextResponse.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error fetching service summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service summary' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDB();
    const body = await request.json();
    
    const {
      serviceDescription,
      keyBenefits,
      webappKey = 'default'
    } = body;

    // Validate required fields
    if (!serviceDescription || !keyBenefits) {
      return NextResponse.json(
        { success: false, error: 'Service description and key benefits are required' },
        { status: 400 }
      );
    }

    // Update webapp table instead of service summary table
    await db.update(webapp)
      .set({
        serviceDescription,
        keyBenefits,
        updatedAt: new Date().toISOString()
      })
      .where(eq(webapp.webappKey, webappKey));

    // Return the updated data
    const updated = await db.select({
      serviceDescription: webapp.serviceDescription,
      keyBenefits: webapp.keyBenefits
    }).from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    
    return NextResponse.json({
      success: true,
      summary: updated[0],
      message: 'Service summary updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating service summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update service summary' },
      { status: 500 }
    );
  }
}