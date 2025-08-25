import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { webapp } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const webappKey = searchParams.get('webapp_key') || 'default';
    
    // Get service provider information from webapp table
    const webapps = await db.select({
      businessName: webapp.businessName,
      address: webapp.address,
      phoneNumber: webapp.phoneNumber,
      email: webapp.email,
      website: webapp.website,
      logoUrl: webapp.logoUrl,
      logoPath: webapp.logoPath,
      logoMimeType: webapp.logoMimeType,
      logoSize: webapp.logoSize
    }).from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    
    const provider = webapps[0] || null;
    
    return NextResponse.json({
      success: true,
      provider
    });
  } catch (error) {
    console.error('Error fetching service provider:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service provider' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDB();
    const body = await request.json();
    
    const {
      businessName,
      address,
      phoneNumber,
      email,
      website,
      webappKey = 'default'
    } = body;

    // Validate required fields
    if (!businessName || !address || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Business name, address, and phone number are required' },
        { status: 400 }
      );
    }

    // Update webapp table instead of service provider table
    await db.update(webapp)
      .set({
        businessName,
        address,
        phoneNumber,
        email: email || '',
        website: website || '',
        updatedAt: new Date().toISOString()
      })
      .where(eq(webapp.webappKey, webappKey));

    // Return the updated data
    const updated = await db.select({
      businessName: webapp.businessName,
      address: webapp.address,
      phoneNumber: webapp.phoneNumber,
      email: webapp.email,
      website: webapp.website,
      logoUrl: webapp.logoUrl,
      logoPath: webapp.logoPath,
      logoMimeType: webapp.logoMimeType,
      logoSize: webapp.logoSize
    }).from(webapp).where(eq(webapp.webappKey, webappKey)).limit(1);
    
    return NextResponse.json({
      success: true,
      provider: updated[0],
      message: 'Service provider information updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating service provider:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update service provider' },
      { status: 500 }
    );
  }
}