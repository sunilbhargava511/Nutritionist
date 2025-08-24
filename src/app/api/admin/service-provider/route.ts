import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { serviceProvider } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDB();
    
    // Get service provider information
    const providers = await db.select().from(serviceProvider).limit(1);
    const provider = providers[0] || null;
    
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
      website
    } = body;

    // Validate required fields
    if (!businessName || !address || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Business name, address, and phone number are required' },
        { status: 400 }
      );
    }

    // Check if service provider already exists
    const existing = await db.select().from(serviceProvider).limit(1);
    
    if (existing.length > 0) {
      // Update existing service provider
      await db.update(serviceProvider)
        .set({
          businessName,
          address,
          phoneNumber,
          email: email || '',
          website: website || '',
          updatedAt: new Date().toISOString()
        })
        .where(eq(serviceProvider.id, 'default'));
    } else {
      // Create new service provider
      await db.insert(serviceProvider).values({
        id: 'default',
        businessName,
        address,
        phoneNumber,
        email: email || '',
        website: website || ''
      });
    }

    // Return the updated service provider
    const updated = await db.select().from(serviceProvider).limit(1);
    
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