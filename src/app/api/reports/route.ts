import { NextRequest, NextResponse } from 'next/server';
import { generateSessionReport } from '@/lib/report-generator';
import { educationalSessionService } from '@/lib/educational-session';
import { db } from '@/lib/database';
import * as schema from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { action, sessionId, options } = await request.json();

    switch (action) {
      case 'generate':
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        // Check if session exists
        const session = await educationalSessionService.getSession(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        // Generate the report
        const reportData = await generateSessionReport(sessionId, options);
        
        // Save report to database
        const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const reportPath = `/reports/${sessionId}/${reportId}.pdf`;

        await db.insert(schema.sessionReports).values({
          id: reportId,
          sessionId,
          reportPath,
          reportData,
          generatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          reportId,
          reportPath,
          message: 'Report generated successfully'
        });

      case 'download':
        const { reportId: downloadReportId } = await request.json();
        if (!downloadReportId) {
          return NextResponse.json(
            { success: false, error: 'Report ID is required' },
            { status: 400 }
          );
        }

        // Fetch report from database
        const downloadReports = await db
          .select()
          .from(schema.sessionReports)
          .where(eq(schema.sessionReports.id, downloadReportId))
          .limit(1);

        if (downloadReports.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Report not found' },
            { status: 404 }
          );
        }

        const downloadReport = downloadReports[0];
        
        // Return PDF data
        return new NextResponse(Buffer.from(downloadReport.reportData as any), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="session-report-${downloadReport.sessionId}.pdf"`,
          },
        });

      case 'list':
        const { sessionId: listSessionId } = await request.json();
        
        let allReports;
        if (listSessionId) {
          allReports = await db
            .select()
            .from(schema.sessionReports)
            .where(eq(schema.sessionReports.sessionId, listSessionId));
        } else {
          allReports = await db
            .select()
            .from(schema.sessionReports);
        }
        
        const reportList = allReports.map(r => ({
          id: r.id,
          sessionId: r.sessionId,
          reportPath: r.reportPath,
          generatedAt: r.generatedAt,
        }));

        return NextResponse.json({
          success: true,
          reports: reportList
        });

      case 'delete':
        const { reportId: deleteReportId } = await request.json();
        if (!deleteReportId) {
          return NextResponse.json(
            { success: false, error: 'Report ID is required' },
            { status: 400 }
          );
        }

        await db
          .delete(schema.sessionReports)
          .where(eq(schema.sessionReports.id, deleteReportId));

        return NextResponse.json({
          success: true,
          message: 'Report deleted successfully'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Reports API error:', error);
    
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

// GET endpoint for downloading reports by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');
    const sessionId = searchParams.get('sessionId');

    if (reportId) {
      // Download specific report
      const getReports = await db
        .select()
        .from(schema.sessionReports)
        .where(eq(schema.sessionReports.id, reportId))
        .limit(1);

      if (getReports.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Report not found' },
          { status: 404 }
        );
      }

      const getReport = getReports[0];
      
      return new NextResponse(Buffer.from(getReport.reportData as any), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="session-report-${getReport.sessionId}.pdf"`,
        },
      });
    } else {
      // List reports
      let getAllReports;
      if (sessionId) {
        getAllReports = await db
          .select()
          .from(schema.sessionReports)
          .where(eq(schema.sessionReports.sessionId, sessionId));
      } else {
        getAllReports = await db
          .select()
          .from(schema.sessionReports);
      }
      
      const reportList = getAllReports.map(r => ({
        id: r.id,
        sessionId: r.sessionId,
        reportPath: r.reportPath,
        generatedAt: r.generatedAt,
      }));

      return NextResponse.json({
        success: true,
        reports: reportList
      });
    }
  } catch (error) {
    console.error('Reports GET API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}