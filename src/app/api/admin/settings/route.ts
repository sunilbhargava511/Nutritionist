import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET() {
  try {
    await ensureDatabase();
    const settings = await adminService.getAdminSettings();
    const statistics = await adminService.getContentStatistics();
    
    return NextResponse.json({
      success: true,
      settings,
      statistics,
    });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch admin settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const updates = await request.json();
    
    // Validate the updates
    const allowedFields = [
      'voiceId',
      'voiceDescription', 
      'personalizationEnabled',
      'conversationAware',
      'useStructuredConversation',
      'debugLlmEnabled',
      'baseReportPath'
    ];
    
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .filter(key => updates[key] !== null && updates[key] !== undefined) // Filter out null/undefined values
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    await adminService.updateAdminSettings(filteredUpdates);
    
    // Return updated settings
    const updatedSettings = await adminService.getAdminSettings();
    
    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('Error updating admin settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update admin settings' },
      { status: 500 }
    );
  }
}