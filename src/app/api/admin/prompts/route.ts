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
    const prompts = await adminService.getAllSystemPrompts();
    
    return NextResponse.json({
      success: true,
      prompts,
    });
  } catch (error) {
    console.error('Error fetching system prompts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system prompts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { type, content, lessonId } = await request.json();
    
    if (!type || !content) {
      return NextResponse.json(
        { success: false, error: 'Type and content are required' },
        { status: 400 }
      );
    }

    if (!['qa', 'lesson_qa', 'report'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be one of: qa, lesson_qa, report' },
        { status: 400 }
      );
    }

    const newPrompt = await adminService.uploadSystemPrompt(type, content, lessonId);
    
    return NextResponse.json({
      success: true,
      prompt: newPrompt,
    });
  } catch (error) {
    console.error('Error uploading system prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload system prompt' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { promptId, content } = await request.json();
    
    if (!promptId || !content) {
      return NextResponse.json(
        { success: false, error: 'Prompt ID and content are required' },
        { status: 400 }
      );
    }

    await adminService.updateSystemPrompt(promptId, content);
    
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error updating system prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update system prompt' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get('id');

    if (!promptId) {
      return NextResponse.json(
        { success: false, error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    await adminService.deleteSystemPrompt(promptId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting system prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete system prompt' },
      { status: 500 }
    );
  }
}