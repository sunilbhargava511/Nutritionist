import { YoutubeTranscript } from 'youtube-transcript';

export interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

export interface TranscriptResult {
  transcript: string;
  items: TranscriptItem[];
  duration: number;
  wordCount: number;
}

export class YouTubeTranscriptService {
  
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
    
    return null;
  }

  /**
   * Extract transcript from YouTube video URL
   */
  async extractTranscript(videoUrl: string): Promise<TranscriptResult> {
    try {
      const videoId = this.extractVideoId(videoUrl);
      
      if (!videoId) {
        throw new Error('Invalid YouTube URL format');
      }

      console.log(`Extracting transcript for video ID: ${videoId}`);
      
      // Fetch transcript using the youtube-transcript library
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (!transcriptItems || transcriptItems.length === 0) {
        throw new Error('No transcript available for this video');
      }

      // Process transcript items
      const processedItems: TranscriptItem[] = transcriptItems.map((item: any) => ({
        text: item.text,
        duration: item.duration || 0,
        offset: item.offset || 0,
      }));

      // Combine all text for full transcript
      const fullTranscript = processedItems
        .map(item => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Calculate total duration (in seconds)
      const totalDuration = processedItems.length > 0
        ? Math.max(...processedItems.map(item => item.offset + item.duration))
        : 0;

      // Count words
      const wordCount = fullTranscript.split(/\s+/).length;

      return {
        transcript: fullTranscript,
        items: processedItems,
        duration: totalDuration,
        wordCount,
      };
    } catch (error) {
      console.error('Error extracting YouTube transcript:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Could not find')) {
          throw new Error('This video does not have captions or transcripts available');
        }
        if (error.message.includes('private')) {
          throw new Error('This video is private or unavailable');
        }
        throw error;
      }
      
      throw new Error('Failed to extract transcript from YouTube video');
    }
  }

  /**
   * Format transcript with timestamps for display
   */
  formatTranscriptWithTimestamps(items: TranscriptItem[]): string {
    return items.map(item => {
      const minutes = Math.floor(item.offset / 60);
      const seconds = Math.floor(item.offset % 60);
      const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
      return `${timestamp} ${item.text}`;
    }).join('\n');
  }

  /**
   * Get a preview of the transcript (first N words)
   */
  getTranscriptPreview(transcript: string, wordLimit: number = 100): string {
    const words = transcript.split(/\s+/);
    if (words.length <= wordLimit) {
      return transcript;
    }
    return words.slice(0, wordLimit).join(' ') + '...';
  }

  /**
   * Format duration from seconds to readable format
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Check if a YouTube URL has captions available (without downloading full transcript)
   */
  async hasTranscript(videoUrl: string): Promise<boolean> {
    try {
      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) return false;
      
      // Try to fetch just the first item to check availability
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      return transcriptItems && transcriptItems.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract key sentences from transcript for summary
   */
  extractKeySentences(transcript: string, sentenceCount: number = 5): string[] {
    // Split into sentences
    const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [];
    
    if (sentences.length <= sentenceCount) {
      return sentences.map(s => s.trim());
    }

    // For now, return evenly distributed sentences
    // This could be enhanced with NLP for better selection
    const step = Math.floor(sentences.length / sentenceCount);
    const keySentences: string[] = [];
    
    for (let i = 0; i < sentenceCount; i++) {
      const index = Math.min(i * step, sentences.length - 1);
      keySentences.push(sentences[index].trim());
    }
    
    return keySentences;
  }
}

// Export singleton instance
export const youtubeTranscriptService = new YouTubeTranscriptService();