# PDF Report Template System

The financial advisor application now supports **custom PDF report templates** that provide professional branding and styling for session reports.

## How It Works

Each generated report contains **three sections**:

### 1. **Base Template** (Part 1)
- Your uploaded PDF template containing:
  - Company branding and logos
  - Professional styling and formatting  
  - Introduction content
  - Legal disclaimers or compliance text
  - Any static content you want in every report

### 2. **Q&A Summary** (Part 2) 
- Automatically generated section containing:
  - Key insights extracted from user responses
  - Highlighted Q&A interactions (top 5)
  - Behavioral patterns identified
  - Session metadata

### 3. **Full Transcript** (Part 3)
- Complete conversation record with:
  - All user messages and AI responses
  - Timestamps (if enabled)
  - Full chronological conversation flow

## Setting Up Templates

### Admin Panel Setup
1. Navigate to **Admin Panel** → **Report Template** tab
2. Upload your PDF template file in the **Base Report Template** section
3. Template is immediately active for all new reports
4. View recent generated reports in the same tab

### Template Requirements
- **File format**: PDF only
- **Recommended size**: Letter/A4 format
- **Content**: Include your branding, intro content, styling
- **File size**: Reasonable size (under 10MB recommended)

### Template Best Practices
- Use professional fonts and consistent styling
- Include your company logo and branding
- Add introduction explaining the report purpose
- Consider including:
  - Contact information
  - Legal disclaimers
  - Methodology explanations
  - Your company's approach to financial planning

## Technical Implementation

### PDF Generation Process
```
1. Load base template PDF from database
2. Generate Q&A summary using jsPDF
3. Generate transcript using jsPDF  
4. Merge all three parts using pdf-lib
5. Save final PDF to database
```

### Database Storage
- Templates stored as binary data in `admin_settings.baseReportTemplate`
- Efficient retrieval for report generation
- No external file dependencies

### Fallback Behavior
- If no template uploaded: Uses jsPDF-only generation
- If template load fails: Automatically falls back to standard report
- Robust error handling ensures reports are always generated

## Usage Examples

### For Financial Planning Firms
Upload a template with:
- Firm logo and letterhead
- Compliance disclaimers
- Introduction to your planning methodology
- Contact information for follow-up

### For Independent Advisors
Upload a template with:
- Personal branding
- Certifications and credentials
- Educational content about your approach
- Next steps and recommendations

### For Corporate Training
Upload a template with:
- Company training program branding
- Learning objectives
- Internal contact information
- HR department resources

## Managing Templates

### Uploading New Templates
- Replace existing template anytime
- Changes affect all future reports
- Existing reports maintain their original format

### Removing Templates
- Click remove button in admin panel
- System reverts to jsPDF-only generation
- Confirms before deletion

### Template Status
- Green indicator shows active template
- Clear messaging about report structure
- Easy template management interface

## Report Generation Flow

1. **User completes educational session**
2. **System triggers auto-report generation**
3. **Template-based generation attempts first**
4. **Falls back to jsPDF if template unavailable**
5. **Final report stored in database**
6. **Admin can download via Reports tab**

This system provides professional, branded reports while maintaining the automated generation and comprehensive content that makes the educational sessions valuable for users.