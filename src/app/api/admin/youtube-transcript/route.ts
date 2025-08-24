import { NextRequest, NextResponse } from 'next/server';
import { youtubeTranscriptService } from '@/lib/youtube-transcript';
import { youtubePythonTranscriptService } from '@/lib/youtube-transcript-python';
import { getClaudeService } from '@/lib/claude';
import { getDB } from '@/lib/database';
import { lessons } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl, title, lessonId, persona } = body;

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }

    // Step 1: Extract transcript from YouTube
    console.log('[YouTube Transcript] Extracting transcript for:', videoUrl);
    
    let transcriptResult;
    let extractionMethod = 'none';
    
    // Try Python method first (most reliable)
    try {
      console.log('[YouTube Transcript] Trying Python method...');
      transcriptResult = await youtubePythonTranscriptService.extractTranscript(videoUrl);
      extractionMethod = 'python';
      console.log('[YouTube Transcript] Python method succeeded');
    } catch (pythonError) {
      console.log('[YouTube Transcript] Python method failed:', pythonError);
      
      // Fallback to JavaScript method
      try {
        console.log('[YouTube Transcript] Trying JavaScript method...');
        transcriptResult = await youtubeTranscriptService.extractTranscript(videoUrl);
        extractionMethod = 'javascript';
        console.log('[YouTube Transcript] JavaScript method succeeded');
      } catch (jsError) {
        console.error('[YouTube Transcript] All extraction methods failed');
        return NextResponse.json({
          success: false,
          error: pythonError instanceof Error ? pythonError.message : 'Failed to extract transcript'
        }, { status: 400 });
      }
    }

    const { transcript, duration, wordCount } = transcriptResult;
    
    console.log(`[YouTube Transcript] Extracted ${wordCount} words, duration: ${duration}s`);

    // Step 2: Generate AI content using Claude
    const claudeService = getClaudeService();
    
    console.log('[Claude] Generating engaging lesson title...');
    const generatedTitle = await claudeService.generateLessonTitle(transcript, persona);
    
    console.log('[Claude] Generating video summary...');
    const summary = await claudeService.generateVideoSummary(transcript, generatedTitle, persona);
    
    console.log('[Claude] Generating start message...');
    const startMessage = await claudeService.generateStartMessage(transcript, generatedTitle, persona);
    
    console.log('[Claude] Extracting key topics...');
    const keyTopics = await claudeService.generateKeyTopics(transcript);

    // Step 3: Update lesson in database if lessonId provided
    if (lessonId) {
      console.log('[Database] Updating lesson with transcript and generated content...');
      
      try {
        await getDB()
          .update(lessons)
          .set({
            title: generatedTitle,
            videoSummary: summary,
            startMessage: startMessage,
            videoTranscript: transcript,
            transcriptExtractedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(lessons.id, lessonId));
        
        console.log('[Database] Lesson updated successfully');
      } catch (dbError) {
        console.error('[Database] Failed to update lesson:', dbError);
        // Don't fail the whole request if DB update fails
        // The generated content can still be used
      }
    }

    // Format duration for display
    const formattedDuration = typeof duration === 'number' 
      ? youtubeTranscriptService.formatDuration(duration)
      : duration;

    // Return all generated content
    return NextResponse.json({
      success: true,
      transcript: transcript,
      title: generatedTitle,
      summary: summary,
      startMessage: startMessage,
      keyTopics: keyTopics,
      wordCount: wordCount,
      duration: formattedDuration,
      extractionMethod: extractionMethod,
      message: 'Content generated successfully'
    });

  } catch (error) {
    console.error('[YouTube Transcript API] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred while processing the video'
    }, { status: 500 });
  }
}

// GET endpoint to check if a video has transcript available
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('videoUrl');

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }

    const hasTranscript = await youtubeTranscriptService.hasTranscript(videoUrl);

    return NextResponse.json({
      success: true,
      hasTranscript,
      message: hasTranscript 
        ? 'Transcript is available for this video' 
        : 'No transcript available for this video'
    });

  } catch (error) {
    console.error('[YouTube Transcript Check] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check transcript availability'
    }, { status: 500 });
  }
}