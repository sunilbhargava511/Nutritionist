import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed-data';
import { initializeDatabase } from '@/lib/database';

export async function POST() {
  try {
    // Initialize database first
    await initializeDatabase();
    
    // Seed with sample data
    await seedDatabase();
    
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully with sample educational content'
    });
  } catch (error) {
    console.error('Seeding error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Seeding failed' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to seed the database with sample content'
  });
}