import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const db = getDB();
    
    // Add new transcript columns to existing lessons table if they don't exist
    try {
      console.log('Adding transcript columns to lessons table...');
      
      await db.exec(`
        ALTER TABLE lessons ADD COLUMN video_transcript TEXT;
      `);
      console.log('✅ video_transcript column added');
      
      await db.exec(`
        ALTER TABLE lessons ADD COLUMN transcript_extracted_at TEXT;
      `);
      console.log('✅ transcript_extracted_at column added');
      
      await db.exec(`
        ALTER TABLE lessons ADD COLUMN transcript_language TEXT DEFAULT 'en';
      `);
      console.log('✅ transcript_language column added');

      console.log('✅ All transcript columns added to lessons table');
      
    } catch (error: any) {
      // Columns might already exist, which is fine
      if (error.message && error.message.includes('duplicate column name')) {
        console.log('ℹ️ Transcript columns already exist');
      } else {
        console.log('ℹ️ Some transcript columns might already exist:', error.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Transcript migration completed successfully'
    });

  } catch (error) {
    console.error('Transcript migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to migrate transcript schema'
    }, { status: 500 });
  }
}