import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/admin-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const action = formData.get('action') as string;

    switch (action) {
      case 'upload':
        const file = formData.get('file') as File;
        if (!file) {
          return NextResponse.json(
            { success: false, error: 'No file provided' },
            { status: 400 }
          );
        }

        await adminService.uploadBaseReportTemplate(file);
        
        return NextResponse.json({
          success: true,
          message: 'Base report template uploaded successfully'
        });

      case 'remove':
        await adminService.removeBaseReportTemplate();
        
        return NextResponse.json({
          success: true,
          message: 'Base report template removed successfully'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Base template API error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check if template exists
export async function GET() {
  try {
    const template = await adminService.getBaseReportTemplate();
    const hasTemplate = template !== null;
    
    return NextResponse.json({
      success: true,
      hasTemplate,
      message: hasTemplate 
        ? 'Base template is available'
        : 'No base template uploaded'
    });
  } catch (error) {
    console.error('Error checking base template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check template status' },
      { status: 500 }
    );
  }
}