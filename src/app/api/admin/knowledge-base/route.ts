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
    const files = await adminService.getAllKnowledgeBaseFiles();
    
    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error('Error fetching knowledge base files:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch knowledge base files' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const indexedContent = formData.get('indexedContent') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf', 'text/csv'];
    const fileType = file.type || 'text/plain';
    
    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { success: false, error: `File type ${fileType} not supported. Supported types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const newFile = await adminService.uploadKnowledgeBaseFile(
      file,
      indexedContent || undefined
    );

    return NextResponse.json({
      success: true,
      file: newFile,
    });
  } catch (error) {
    console.error('Error uploading knowledge base file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload knowledge base file' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }

    await adminService.deleteKnowledgeBaseFile(fileId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge base file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete knowledge base file' },
      { status: 500 }
    );
  }
}