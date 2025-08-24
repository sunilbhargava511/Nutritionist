import { google } from 'googleapis';

export interface YouTubeApiConfig {
  apiKey?: string;
  oauth2Client?: any;
}

export interface CaptionTrack {
  id: string;
  videoId: string;
  language: string;
  name: string;
  audioTrackType?: string;
  isCC?: boolean;
  isAutoSynced?: boolean;
  isDraft?: boolean;
}

export interface TranscriptResult {
  transcript: string;
  items: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
  language: string;
  wordCount: number;
  duration: number;
}

export class YouTubeApiTranscriptService {
  private youtube;
  
  constructor(config: YouTubeApiConfig) {
    if (!config.apiKey && !config.oauth2Client) {
      throw new Error('Either API key or OAuth2 client is required');
    }
    
    this.youtube = google.youtube({
      version: 'v3',
      auth: config.oauth2Client || config.apiKey
    });
  }
  
  /**
   * Extract video ID from various YouTube URL formats
   */
  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // If no pattern matches, assume it's already a video ID
    return url;
  }
  
  /**
   * List available caption tracks for a video
   */
  async listCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
    try {
      const response = await this.youtube.captions.list({
        videoId: videoId,
        part: ['snippet']
      });
      
      if (!response.data.items || response.data.items.length === 0) {
        return [];
      }
      
      return response.data.items.map((item: any) => ({
        id: item.id,
        videoId: item.snippet.videoId,
        language: item.snippet.language,
        name: item.snippet.name,
        audioTrackType: item.snippet.audioTrackType,
        isCC: item.snippet.isCC,
        isAutoSynced: item.snippet.isAutoSynced,
        isDraft: item.snippet.isDraft
      }));
    } catch (error: any) {
      console.error('Error listing caption tracks:', error);
      
      // Check if it's a quota or permission error
      if (error.code === 403) {
        throw new Error('API access denied. Check your API key and video permissions.');
      }
      if (error.code === 404) {
        throw new Error('Video not found or no captions available.');
      }
      
      throw error;
    }
  }
  
  /**
   * Download caption content
   */
  async downloadCaption(captionId: string, format: 'srt' | 'ttml' | 'vtt' = 'srt'): Promise<string> {
    try {
      const response = await this.youtube.captions.download({
        id: captionId,
        tfmt: format
      });
      
      return response.data as string;
    } catch (error: any) {
      console.error('Error downloading caption:', error);
      
      if (error.code === 403) {
        throw new Error('Caption download not permitted. This might require OAuth authentication.');
      }
      
      throw error;
    }
  }
  
  /**
   * Extract transcript from YouTube video URL using official API
   */
  async extractTranscript(videoUrl: string, languageCode: string = 'en'): Promise<TranscriptResult> {
    try {
      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL format');
      }
      
      console.log(`[YouTube API] Extracting transcript for video: ${videoId}`);
      
      // List available captions
      const tracks = await this.listCaptionTracks(videoId);
      
      if (tracks.length === 0) {
        throw new Error('No captions available for this video');
      }
      
      // Find the preferred language track (or auto-generated)
      let selectedTrack = tracks.find(t => t.language === languageCode);
      
      // If no exact match, try to find auto-generated English
      if (!selectedTrack) {
        selectedTrack = tracks.find(t => 
          t.language.startsWith(languageCode.split('-')[0]) && t.isAutoSynced
        );
      }
      
      // Fall back to first available track
      if (!selectedTrack) {
        selectedTrack = tracks[0];
        console.log(`[YouTube API] No ${languageCode} track found, using ${selectedTrack.language}`);
      }
      
      // Download the caption
      const captionContent = await this.downloadCaption(selectedTrack.id);
      
      // Parse the caption content based on format
      const { text, items, duration } = this.parseCaptionContent(captionContent);
      
      return {
        transcript: text,
        items: items,
        language: selectedTrack.language,
        wordCount: text.split(/\s+/).length,
        duration: duration
      };
      
    } catch (error) {
      console.error('[YouTube API] Transcript extraction failed:', error);
      throw error;
    }
  }
  
  /**
   * Parse SRT format caption content
   */
  private parseCaptionContent(content: string): {
    text: string;
    items: Array<{ text: string; start: number; duration: number }>;
    duration: number;
  } {
    const lines = content.split('\n');
    const items: Array<{ text: string; start: number; duration: number }> = [];
    let text = '';
    let maxTime = 0;
    
    // Parse SRT format
    let i = 0;
    while (i < lines.length) {
      // Skip sequence number
      if (lines[i].match(/^\d+$/)) {
        i++;
        
        // Parse timestamp
        if (i < lines.length && lines[i].includes('-->')) {
          const [startTime, endTime] = lines[i].split('-->').map(t => t.trim());
          const start = this.parseTimestamp(startTime);
          const end = this.parseTimestamp(endTime);
          const duration = end - start;
          i++;
          
          // Collect text lines
          let captionText = '';
          while (i < lines.length && lines[i].trim() !== '') {
            captionText += (captionText ? ' ' : '') + lines[i].trim();
            i++;
          }
          
          if (captionText) {
            items.push({
              text: captionText,
              start: start,
              duration: duration
            });
            text += (text ? ' ' : '') + captionText;
            maxTime = Math.max(maxTime, end);
          }
        }
      }
      i++;
    }
    
    return {
      text: text,
      items: items,
      duration: maxTime
    };
  }
  
  /**
   * Parse SRT timestamp to seconds
   */
  private parseTimestamp(timestamp: string): number {
    const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) return 0;
    
    const [_, hours, minutes, seconds, milliseconds] = match;
    return (
      parseInt(hours) * 3600 +
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      parseInt(milliseconds) / 1000
    );
  }
  
  /**
   * Get video metadata
   */
  async getVideoMetadata(videoId: string): Promise<any> {
    try {
      const response = await this.youtube.videos.list({
        id: [videoId],
        part: ['snippet', 'contentDetails', 'statistics']
      });
      
      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Video not found');
      }
      
      return response.data.items[0];
    } catch (error) {
      console.error('Error fetching video metadata:', error);
      throw error;
    }
  }
}

// Factory function for easier instantiation
export function createYouTubeApiService(apiKey: string): YouTubeApiTranscriptService {
  return new YouTubeApiTranscriptService({ apiKey });
}