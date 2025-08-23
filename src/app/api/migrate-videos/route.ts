import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { lessons } from '@/lib/database/schema';

export async function POST(request: NextRequest) {
  try {
    const db = getDB();
    
    // Add new columns to existing lessons table if they don't exist
    try {
      await db.exec(`
        ALTER TABLE lessons ADD COLUMN video_path TEXT;
        ALTER TABLE lessons ADD COLUMN video_type TEXT NOT NULL DEFAULT 'url';
        ALTER TABLE lessons ADD COLUMN video_mime_type TEXT;
        ALTER TABLE lessons ADD COLUMN video_size INTEGER;
      `);
      console.log('✅ Video upload columns added to lessons table');
    } catch (error) {
      // Columns might already exist, which is fine
      console.log('ℹ️  Video columns might already exist:', error);
    }

    // Make videoUrl nullable by updating existing records
    try {
      await db.exec(`
        UPDATE lessons 
        SET video_type = 'url' 
        WHERE video_url IS NOT NULL AND video_type IS NULL;
      `);
      console.log('✅ Updated existing lessons to use URL type');
    } catch (error) {
      console.error('Error updating existing lessons:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Video upload migration completed successfully'
    });

  } catch (error) {
    console.error('Video migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to migrate video schema'
    }, { status: 500 });
  }
}