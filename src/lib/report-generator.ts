import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { EducationalSession } from '@/types';
import { educationalSessionService } from './educational-session';

export interface ReportOptions {
  includeResponses: boolean;
  includeTimestamps: boolean;
  includePersonalizationNotes: boolean;
  useBaseTemplate: boolean;
}

export class ReportGenerator {
  private pdf: jsPDF;
  private currentY: number = 20;
  private pageNumber: number = 1;
  private readonly pageHeight: number = 280;
  private readonly pageWidth: number = 190;
  private readonly margin: number = 20;
  private readonly lineHeight: number = 7;

  constructor() {
    this.pdf = new jsPDF();
    this.setupFonts();
  }

  // Method to get base template from database
  private async getBaseTemplate(): Promise<Uint8Array | null> {
    try {
      const { db } = await import('./database');
      const { adminSettings } = await import('./database/schema');
      const { eq } = await import('drizzle-orm');

      const settings = await db
        .select()
        .from(adminSettings)
        .where(eq(adminSettings.id, 'default'))
        .limit(1);

      if (settings.length === 0 || !settings[0].baseReportTemplate) {
        return null;
      }

      // The template is stored as blob in the database
      return (settings[0].baseReportTemplate as Uint8Array) || null;
    } catch (error) {
      console.error('Error fetching base template:', error);
      return null;
    }
  }

  private setupFonts(): void {
    this.pdf.setFont('helvetica');
  }

  private checkPageBreak(requiredSpace: number = 20): void {
    if (this.currentY + requiredSpace > this.pageHeight) {
      this.addNewPage();
    }
  }

  private addNewPage(): void {
    this.pdf.addPage();
    this.pageNumber++;
    this.currentY = 20;
    this.addPageNumber();
  }

  private addPageNumber(): void {
    this.pdf.setFontSize(10);
    this.pdf.setTextColor(128, 128, 128);
    this.pdf.text(`Page ${this.pageNumber}`, this.pageWidth - 30, this.pageHeight + 10);
    this.pdf.setTextColor(0, 0, 0);
  }

  private addTitle(title: string): void {
    this.pdf.setFontSize(20);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, this.margin, this.currentY);
    this.currentY += 15;
    this.pdf.setFont('helvetica', 'normal');
  }

  private addSubtitle(subtitle: string): void {
    this.checkPageBreak(15);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(subtitle, this.margin, this.currentY);
    this.currentY += 10;
    this.pdf.setFont('helvetica', 'normal');
  }

  private addSection(title: string): void {
    this.checkPageBreak(20);
    this.currentY += 5;
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, this.margin, this.currentY);
    this.currentY += 8;
    this.pdf.setFont('helvetica', 'normal');
  }

  private addText(text: string, indent: number = 0): void {
    this.pdf.setFontSize(11);
    const lines = this.pdf.splitTextToSize(text, this.pageWidth - this.margin * 2 - indent);
    
    for (const line of lines) {
      this.checkPageBreak(this.lineHeight);
      this.pdf.text(line, this.margin + indent, this.currentY);
      this.currentY += this.lineHeight;
    }
  }

  private addBulletPoint(text: string): void {
    this.checkPageBreak(this.lineHeight);
    this.pdf.text('•', this.margin + 5, this.currentY);
    const lines = this.pdf.splitTextToSize(text, this.pageWidth - this.margin * 2 - 15);
    
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        this.checkPageBreak(this.lineHeight);
      }
      this.pdf.text(lines[i], this.margin + 15, this.currentY);
      this.currentY += this.lineHeight;
    }
  }

  private addHorizontalLine(): void {
    this.checkPageBreak(10);
    this.currentY += 5;
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 10;
    this.pdf.setDrawColor(0, 0, 0);
  }

  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async generateSessionReport(
    sessionId: string,
    options: Partial<ReportOptions> = {}
  ): Promise<Uint8Array> {
    const reportOptions: ReportOptions = {
      includeResponses: true,
      includeTimestamps: true,
      includePersonalizationNotes: true,
      useBaseTemplate: true,
      ...options
    };

    // Try to use PDF template merging if requested
    if (reportOptions.useBaseTemplate) {
      try {
        return await this.generateWithPDFTemplate(sessionId, reportOptions);
      } catch (error) {
        console.error('Template-based generation failed, falling back to jsPDF:', error);
        // Fall back to jsPDF generation
      }
    }

    return await this.generateWithJsPDF(sessionId, reportOptions);
  }

  // New method for PDF template-based generation
  private async generateWithPDFTemplate(
    sessionId: string,
    options: ReportOptions
  ): Promise<Uint8Array> {
    // Get base template
    const baseTemplate = await this.getBaseTemplate();
    if (!baseTemplate) {
      throw new Error('No base template available');
    }

    // Fetch session data
    const session = await educationalSessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const responses = await educationalSessionService.getSessionResponses(sessionId);

    // Create final PDF by merging base template with generated content
    const finalPdf = await PDFDocument.create();
    
    // Part 1: Add base template pages
    const templatePdf = await PDFDocument.load(baseTemplate);
    const templatePages = await finalPdf.copyPages(templatePdf, templatePdf.getPageIndices());
    templatePages.forEach(page => finalPdf.addPage(page));

    // Part 2: Generate Q&A Summary as PDF
    const qaSummaryPdf = await this.generateQASummaryPDF(sessionId, responses, options);
    const qaSummaryDoc = await PDFDocument.load(qaSummaryPdf);
    const qaSummaryPages = await finalPdf.copyPages(qaSummaryDoc, qaSummaryDoc.getPageIndices());
    qaSummaryPages.forEach(page => finalPdf.addPage(page));

    // Part 3: Generate Transcript as PDF
    const transcriptPdf = await this.generateTranscriptPDF(sessionId, responses, options);
    const transcriptDoc = await PDFDocument.load(transcriptPdf);
    const transcriptPages = await finalPdf.copyPages(transcriptDoc, transcriptDoc.getPageIndices());
    transcriptPages.forEach(page => finalPdf.addPage(page));

    // Return final merged PDF
    return await finalPdf.save();
  }

  // Generate Q&A Summary section
  private async generateQASummaryPDF(
    sessionId: string,
    responses: any[],
    options: ReportOptions
  ): Promise<Uint8Array> {
    // Reset PDF state
    this.pdf = new jsPDF();
    this.setupFonts();
    this.currentY = 20;
    this.pageNumber = 1;

    this.addTitle('Session Q&A Summary');
    this.addText(`Session ID: ${sessionId}`);
    this.addText(`Generated: ${this.formatDate(new Date())}`);
    this.addHorizontalLine();

    // Extract key insights and themes
    const insights = this.extractInsights(responses);
    
    this.addSubtitle('Key Insights & Themes');
    if (insights.length > 0) {
      for (const insight of insights) {
        this.addBulletPoint(insight);
      }
    } else {
      this.addText('No specific insights identified from this session.');
    }

    this.addHorizontalLine();

    // Q&A Highlights
    this.addSubtitle('Q&A Highlights');
    if (responses.length > 0) {
      for (let i = 0; i < Math.min(responses.length, 5); i++) { // Show top 5 interactions
        const response = responses[i];
        this.addSection(`Interaction ${i + 1}:`);
        
        if (options.includeTimestamps) {
          this.pdf.setFontSize(9);
          this.pdf.setTextColor(128, 128, 128);
          this.addText(`[${this.formatDate(response.timestamp)}]`, 5);
          this.pdf.setTextColor(0, 0, 0);
          this.pdf.setFontSize(11);
        }

        this.addText('Question/Response:', 5);
        this.addText(response.userResponse, 10);
        
        this.currentY += 2;
        this.addText('AI Response Summary:', 5);
        // Truncate long responses for summary
        const responseSummary = response.aiResponse.length > 200 
          ? response.aiResponse.substring(0, 200) + '...'
          : response.aiResponse;
        this.addText(responseSummary, 10);
        
        if (i < responses.length - 1) {
          this.currentY += 5;
        }
      }
    } else {
      this.addText('No Q&A interactions recorded.');
    }

    const arrayBuffer = this.pdf.output('arraybuffer') as ArrayBuffer;
    return new Uint8Array(arrayBuffer);
  }

  // Generate Transcript section
  private async generateTranscriptPDF(
    sessionId: string,
    responses: any[],
    options: ReportOptions
  ): Promise<Uint8Array> {
    // Reset PDF state
    this.pdf = new jsPDF();
    this.setupFonts();
    this.currentY = 20;
    this.pageNumber = 1;

    this.addTitle('Complete Session Transcript');
    this.addText(`Session ID: ${sessionId}`);
    this.addText(`Generated: ${this.formatDate(new Date())}`);
    this.addHorizontalLine();

    if (responses.length === 0) {
      this.addText('No conversation recorded for this session.');
      const arrayBuffer = this.pdf.output('arraybuffer') as ArrayBuffer;
    return new Uint8Array(arrayBuffer);
    }

    // Full conversation transcript
    this.addSubtitle('Full Conversation');
    
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      
      // User message
      if (options.includeTimestamps) {
        this.pdf.setFontSize(9);
        this.pdf.setTextColor(128, 128, 128);
        this.addText(`[${this.formatDate(response.timestamp)}]`, 5);
        this.pdf.setTextColor(0, 0, 0);
        this.pdf.setFontSize(11);
      }

      this.pdf.setFont('helvetica', 'bold');
      this.addText('User:', 5);
      this.pdf.setFont('helvetica', 'normal');
      this.addText(response.userResponse, 10);
      
      this.currentY += 3;
      
      // AI response
      this.pdf.setFont('helvetica', 'bold');
      this.addText('AI Assistant:', 5);
      this.pdf.setFont('helvetica', 'normal');
      this.addText(response.aiResponse, 10);
      
      if (i < responses.length - 1) {
        this.addHorizontalLine();
      }
    }

    const arrayBuffer = this.pdf.output('arraybuffer') as ArrayBuffer;
    return new Uint8Array(arrayBuffer);
  }

  // Fallback method using existing jsPDF generation
  private async generateWithJsPDF(
    sessionId: string,
    options: ReportOptions
  ): Promise<Uint8Array> {
    const reportOptions = options;

    // Fetch session data
    const session = await educationalSessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Legacy chunk system - get responses only
    const responses = await educationalSessionService.getSessionResponses(sessionId);
    const adminSettings = await educationalSessionService.getAdminSettings();

    // Generate report header
    this.addTitle('Educational Session Report');
    this.addText(`Session ID: ${session.id}`);
    this.addText(`Date: ${this.formatDate(session.createdAt)}`);
    
    if (session.personalizationEnabled) {
      this.addText('Personalization: Enabled');
    }

    this.addHorizontalLine();

    // Summary section
    this.addSubtitle('Session Summary');
    this.addText(`Session Status: ${session.completed ? 'Completed' : 'In Progress'}`);
    
    if (responses.length > 0) {
      this.addText(`Total Interactions: ${responses.length}`);
    }

    this.addHorizontalLine();

    // Content and Responses section
    this.addSubtitle('Educational Content & Responses');

    // Legacy chunk system - just show responses if any exist
    if (responses.length > 0) {
      responses.forEach((response, i) => {
        this.addSection(`Interaction ${i + 1}`);
        
        if (reportOptions.includeTimestamps) {
          this.pdf.setFontSize(9);
          this.pdf.setTextColor(128, 128, 128);
          this.addText(`[${this.formatDate(response.timestamp)}]`, 5);
          this.pdf.setTextColor(0, 0, 0);
          this.pdf.setFontSize(11);
        }

        this.addText('User Response:', 5);
        this.addText(response.userResponse, 10);
        
        this.currentY += 2;
        this.addText('AI Response:', 5);
        this.addText(response.aiResponse, 10);

        if (i < responses.length - 1) {
          this.addHorizontalLine();
        }
      });
    }

    // Insights and Recommendations section
    if (session.personalizationEnabled && reportOptions.includePersonalizationNotes) {
      this.addNewPage();
      this.addSubtitle('Personalized Insights & Recommendations');

      // Analyze responses for key themes
      const insights = this.extractInsights(responses);
      
      if (insights.length > 0) {
        this.addSection('Key Insights:');
        for (const insight of insights) {
          this.addBulletPoint(insight);
        }
      }

      // Add recommendations based on session completion
      this.currentY += 5;
      this.addSection('Next Steps:');
      
      if (session.completed) {
        this.addBulletPoint('Review the key concepts covered in this session');
        this.addBulletPoint('Apply the learned strategies to your financial planning');
        this.addBulletPoint('Schedule a follow-up session to track progress');
      } else {
        this.addBulletPoint('Complete the remaining educational content');
        this.addBulletPoint('Reflect on the questions posed in each section');
        this.addBulletPoint('Take notes on areas requiring further clarification');
      }
    }

    // Footer
    this.addNewPage();
    this.addSubtitle('Report Information');
    this.addText(`Generated on: ${this.formatDate(new Date())}`);
    this.addText(`Report Format: Educational Session Summary`);
    
    if (adminSettings) {
      this.addText(`Voice Profile: ${adminSettings.voiceDescription}`);
    }

    // Add final page number
    this.addPageNumber();

    // Return PDF as Uint8Array
    const arrayBuffer = this.pdf.output('arraybuffer') as ArrayBuffer;
    return new Uint8Array(arrayBuffer);
  }

  private extractInsights(responses: any[]): string[] {
    const insights: string[] = [];
    
    // Extract key themes from user responses
    const userResponses = responses.map(r => r.userResponse.toLowerCase());
    
    // Simple keyword analysis (in production, this would use NLP)
    if (userResponses.some(r => r.includes('risk') || r.includes('volatility'))) {
      insights.push('User shows awareness of investment risks and market volatility');
    }
    
    if (userResponses.some(r => r.includes('retirement') || r.includes('retire'))) {
      insights.push('Retirement planning is a primary concern');
    }
    
    if (userResponses.some(r => r.includes('family') || r.includes('children'))) {
      insights.push('Family financial security is an important consideration');
    }
    
    if (userResponses.some(r => r.includes('tax') || r.includes('taxes'))) {
      insights.push('Tax optimization strategies may be beneficial');
    }
    
    // Add engagement insight
    if (responses.length > 0) {
      const avgResponseLength = userResponses.reduce((sum, r) => sum + r.length, 0) / userResponses.length;
      if (avgResponseLength > 100) {
        insights.push('High engagement level with detailed responses throughout the session');
      }
    }

    return insights;
  }

  // Static method for quick report generation
  static async generateReport(
    sessionId: string,
    options?: Partial<ReportOptions>
  ): Promise<Uint8Array> {
    const generator = new ReportGenerator();
    return generator.generateSessionReport(sessionId, options);
  }
}

// Export convenience function
export async function generateSessionReport(
  sessionId: string,
  options?: Partial<ReportOptions>
): Promise<Uint8Array> {
  return ReportGenerator.generateReport(sessionId, options);
}