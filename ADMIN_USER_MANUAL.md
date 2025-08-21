# Financial Advisor Admin Panel User Manual

## Overview

The Admin Panel is a comprehensive management interface for configuring your AI Financial Advisor application. Access it by navigating to `/admin` in your web browser.

## Navigation

The admin panel uses a sidebar navigation with 6 main sections:
- **Lessons** - Educational content management
- **System Prompts** - AI personality configuration  
- **Knowledge Base** - Reference document management
- **Opening Messages** - TTS welcome messages
- **Audio Management** - TTS audio cache control *(new)*
- **Report Template** - Session summary configuration
- **Settings** - System-wide preferences

---

## 1. Lessons Management

**Purpose**: Create and manage educational lessons with integrated video content and Q&A interactions.

### Features:
- **Lesson Creation**: Click "Create New Lesson" to add educational content
- **Required Fields**:
  - **Title**: Descriptive lesson name (e.g., "Introduction to Retirement Planning")
  - **Video URL**: YouTube or other video platform URL
  - **Video Summary**: Key points and insights from the video content
  - **Question**: Interactive question to engage users after the lesson
  - **Start Message**: Custom TTS message spoken when lesson begins
- **Lesson Management**:
  - **Edit**: Click pencil icon to modify existing lessons
  - **Reorder**: Drag and drop lessons to change sequence
  - **Toggle Active/Inactive**: Control which lessons are available to users
  - **Delete**: Remove lessons no longer needed

### Best Practices:
- Keep lesson titles clear and descriptive
- Write video summaries in 2-3 concise bullet points
- Frame questions to encourage personal reflection
- Test start messages by speaking them aloud first

---

## 2. System Prompts Management

**Purpose**: Configure how your AI responds in different conversation contexts.

### Prompt Types:
- **Q&A Prompts**: How AI answers user questions during lessons
- **Report Prompts**: Template for generating session summaries
- **Lesson-Specific**: Custom behavior for individual lessons

### Features:
- **Rich Text Editing**: Full-featured editor with formatting options
- **Prompt Templates**: Pre-built templates for common scenarios
- **Active/Inactive Toggle**: Control which prompts are currently in use
- **Preview Mode**: Test prompts before making them live

### Key Guidelines:
- **Tone**: Keep prompts warm, empathetic, and professional
- **Clarity**: Use specific instructions rather than vague descriptions
- **Context**: Reference lesson content and user responses when relevant
- **Consistency**: Maintain the same voice across all prompts

---

## 3. Knowledge Base Management

**Purpose**: Upload reference documents that enhance AI responses with factual information.

### Supported Formats:
- **PDF**: Research papers, guides, regulatory documents
- **TXT**: Plain text reference materials
- **MD**: Markdown-formatted documents

### Features:
- **Drag & Drop Upload**: Easy file uploading interface
- **File Metadata**: View upload date, size, and indexing status
- **Search Integration**: Files are automatically indexed for AI reference
- **File Management**: Preview, download, or delete uploaded files

### Best Practices:
- Upload authoritative, up-to-date financial information
- Keep file names descriptive and organized
- Regularly review and update outdated materials
- Test AI responses after uploading new knowledge

---

## 4. Opening Messages Configuration

**Purpose**: Configure TTS (Text-to-Speech) messages spoken when users begin conversations.

### Message Types:

#### General Opening Message
- **When Used**: Open-ended conversations (not lesson-based)
- **Purpose**: Welcome users and set expectations
- **Voice Settings**: Configurable speed, stability, and similarity boost

#### Lesson-Specific Messages
- **When Used**: Beginning of individual lessons  
- **Purpose**: Introduce lesson topic and create engagement
- **Customization**: Each lesson can have unique opening message

### Configuration Options:
- **Message Content**: The actual text spoken to users
- **Voice Settings**:
  - **Speed**: 0.5 (slow) to 1.5 (fast) - recommended: 0.85
  - **Stability**: 0.0 (variable) to 1.0 (consistent) - recommended: 0.6  
  - **Similarity Boost**: 0.0 (loose) to 1.0 (strict) - recommended: 0.8

### Best Practices:
- Write messages as they would be spoken, not read
- Keep opening messages under 30 seconds when spoken
- Use conversational, welcoming language
- Test messages by listening to generated audio

---

## 5. Audio Management *(New Feature)*

**Purpose**: Manage and control all TTS audio generation and caching.

### Audio Cache Overview:
- **View All Audio**: See every cached TTS file with metadata
- **Cache Status**: Identify which audio needs regeneration
- **Storage Management**: Monitor cache size and usage

### Individual Audio Controls:
- **Play/Preview**: Listen to cached audio directly in admin panel
- **Force Regeneration**: Recreate audio for improved quality
- **Cache Details**: View generation date, voice settings, file size
- **Delete Cache**: Remove individual audio files

### Bulk Operations:
- **Regenerate All Audio**: Refresh entire audio cache (use after voice changes)
- **Clear Old Cache**: Remove audio older than specified days (7/30/90 days)
- **Batch Progress**: Monitor bulk operation status

### Audio Statistics:
- **Cache Metrics**: Total files, storage used, hit rates
- **Voice Usage**: Breakdown by voice ID and settings
- **Performance Data**: Average generation times, success rates

### Quality Control Tools:
- **Test Synthesis**: Preview voice settings with custom text
- **Voice Comparison**: A/B test different voice configurations  
- **Audio Format Settings**: Configure MP3 quality and compression
- **Volume Normalization**: Ensure consistent audio levels

---

## 6. Report Template Management

**Purpose**: Configure the structure and content of session summary reports.

### Features:
- **Base Template Upload**: PDF template defining report structure
- **Template Preview**: See how reports will look before finalizing
- **Variable Mapping**: Define where session data appears in reports

### Report Elements:
- **Session Overview**: Date, duration, topics covered
- **Key Insights**: Important learnings and breakthroughs  
- **Action Items**: Recommended next steps for users
- **Conversation Highlights**: Notable quotes or responses

---

## 7. Settings Configuration

### General Settings:
- **Personalization**: Enable full conversation history usage
- **Conversation Awareness**: Smooth transitions between content
- **LLM Debug Capture**: Monitor AI interactions for troubleshooting

### Voice Settings:
- **ElevenLabs Voice ID**: Primary voice for all TTS generation
- **Voice Characteristics**: Natural language description of desired voice qualities
- **Currency Formatting**: Choose "rupees" (voice-friendly) vs "₹" symbol
- **Number Formatting**: Configure how numbers are spoken

### UI Settings:
- **Educational Toggle**: Show/hide educational content option on homepage
- **Reports Toggle**: Show/hide session reports feature
- **Knowledge Citations**: Display source references in AI responses

---

## Common Workflows

### Setting Up New Educational Content:
1. **Upload Knowledge**: Add reference materials to Knowledge Base
2. **Create Lesson**: Add structured lesson with video and Q&A
3. **Configure Prompts**: Set AI behavior for lesson interactions
4. **Set Opening Message**: Create welcoming TTS introduction
5. **Test Audio**: Use Audio Management to preview and adjust
6. **Review Settings**: Ensure voice and UI preferences are optimal

### Updating Voice Configuration:
1. **Update Voice Settings**: Change ElevenLabs Voice ID or characteristics
2. **Test New Voice**: Use Audio Management test synthesis tool
3. **Regenerate Audio**: Bulk regenerate all cached audio with new voice
4. **Quality Check**: Preview key opening messages and lessons
5. **Clear Old Cache**: Remove outdated audio files

### Troubleshooting Common Issues:
- **Poor Audio Quality**: Use Audio Management to regenerate specific files
- **Outdated Content**: Check lesson active status and knowledge base currency  
- **Inconsistent AI Responses**: Review and update system prompts
- **Performance Issues**: Clear old audio cache and knowledge files

---

## Security and Backup

### Data Safety:
- **Regular Exports**: Download lessons and prompts as backup
- **Knowledge Base Backup**: Keep local copies of uploaded documents
- **Settings Documentation**: Record voice IDs and critical configurations

### Access Control:
- Admin panel requires appropriate authentication
- Changes are logged for audit trail
- Test changes in safe environment before production use

---

## Support and Troubleshooting

### Common Error Messages:
- **"Audio Generation Failed"**: Check ElevenLabs API key and voice ID
- **"Knowledge Upload Error"**: Verify file format and size limits
- **"Prompt Save Failed"**: Check for invalid characters or length limits

### Performance Tips:
- **Regular Maintenance**: Clear old audio cache monthly
- **Content Optimization**: Keep lessons focused and concise
- **Voice Efficiency**: Use consistent voice settings across content

For technical support or advanced configuration questions, refer to the development documentation or contact your system administrator.