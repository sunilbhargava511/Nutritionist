import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { serviceSummary } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDB();
    
    // Get service summary information
    const summaries = await db.select().from(serviceSummary).limit(1);
    const summary = summaries[0] || null;
    
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
      keyBenefits
    } = body;

    // Validate required fields
    if (!serviceDescription || !keyBenefits) {
      return NextResponse.json(
        { success: false, error: 'Service description and key benefits are required' },
        { status: 400 }
      );
    }

    // Check if service summary already exists
    const existing = await db.select().from(serviceSummary).limit(1);
    
    if (existing.length > 0) {
      // Update existing service summary
      await db.update(serviceSummary)
        .set({
          serviceDescription,
          keyBenefits,
          updatedAt: new Date().toISOString()
        })
        .where(eq(serviceSummary.id, 'default'));
    } else {
      // Create new service summary
      await db.insert(serviceSummary).values({
        id: 'default',
        serviceDescription,
        keyBenefits
      });
    }

    // Return the updated service summary
    const updated = await db.select().from(serviceSummary).limit(1);
    
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