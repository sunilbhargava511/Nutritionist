import { NextRequest, NextResponse } from 'next/server';
import { youtubeTranscriptService } from '@/lib/youtube-transcript';
import { createYouTubeApiService } from '@/lib/youtube-api-transcript';
import { getClaudeService } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, title, lessonId, useOfficialApi } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }

    console.log('[YouTube Transcript V2] Extracting transcript for:', videoUrl);
    console.log('[YouTube Transcript V2] Using method:', useOfficialApi ? 'Official API' : 'Web scraping');
    
    let transcriptResult;
    
    if (useOfficialApi) {
      // Use official YouTube API (requires API key)
      const apiKey = process.env.YOUTUBE_API_KEY;
      
      if (!apiKey) {
        return NextResponse.json({
          success: false,
          error: 'YouTube API key not configured. Please add YOUTUBE_API_KEY to your environment variables.'
        }, { status: 500 });
      }
      
      try {
        const apiService = createYouTubeApiService(apiKey);
        transcriptResult = await apiService.extractTranscript(videoUrl);
      } catch (error: any) {
        console.error('[YouTube API] Error:', error);
        
        // Provide helpful error messages
        if (error.message.includes('API access denied')) {
          return NextResponse.json({
            success: false,
            error: 'YouTube API access denied. Please check your API key and ensure the YouTube Data API is enabled in Google Cloud Console.'
          }, { status: 403 });
        }
        
        if (error.message.includes('Caption download not permitted')) {
          return NextResponse.json({
            success: false,
            error: 'Caption download requires OAuth authentication. For now, please use the web scraping method or copy the transcript manually from YouTube.'
          }, { status: 403 });
        }
        
        throw error;
      }
    } else {
      // Use web scraping method (no API key needed)
      transcriptResult = await youtubeTranscriptService.extractTranscript(videoUrl);
    }
    
    const { transcript, wordCount, duration } = transcriptResult;
    
    // Generate AI content using Claude
    console.log('[YouTube Transcript V2] Generating AI content...');
    const claudeService = getClaudeService();
    
    // Generate all AI content in parallel for speed
    const [summary, startMessage, keyTopics] = await Promise.all([
      claudeService.generateVideoSummary(transcript, title),
      claudeService.generateStartMessage(transcript, title || 'this lesson'),
      claudeService.generateKeyTopics(transcript)
    ]);
    
    // Format duration for display
    const formattedDuration = youtubeTranscriptService.formatDuration(duration);
    
    console.log('[YouTube Transcript V2] Successfully generated all content');
    
    // If lessonId provided, we could update the lesson directly here
    // For now, return the data for the frontend to handle
    
    return NextResponse.json({
      success: true,
      data: {
        transcript,
        summary,
        startMessage,
        keyTopics,
        wordCount,
        duration: formattedDuration,
        language: transcriptResult.language || 'en',
        extractedAt: new Date().toISOString(),
        method: useOfficialApi ? 'official_api' : 'web_scraping'
      }
    });

  } catch (error) {
    console.error('[YouTube Transcript V2] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract transcript'
    }, { status: 400 });
  }
}