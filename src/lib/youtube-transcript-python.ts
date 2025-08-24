import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptResult {
  transcript: string;
  items: TranscriptItem[];
  duration: number;
  wordCount: number;
  language: string;
}

export class YouTubePythonTranscriptService {
  private pythonScriptPath: string;
  
  constructor() {
    // Path to the Python script
    this.pythonScriptPath = path.join(process.cwd(), 'src', 'lib', 'extract-transcript.py');
  }
  
  /**
   * Extract transcript from YouTube video using Python
   */
  async extractTranscript(videoUrl: string): Promise<TranscriptResult> {
    try {
      console.log(`[Python Transcript] Extracting transcript for: ${videoUrl}`);
      
      // Execute Python script
      const command = `python3 "${this.pythonScriptPath}" "${videoUrl}"`;
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large transcripts
        timeout: 30000, // 30 seconds timeout
      });
      
      if (stderr && !stderr.includes('WARNING')) {
        console.warn('[Python Transcript] Python stderr:', stderr);
      }
      
      // Parse JSON response
      const result = JSON.parse(stdout);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to extract transcript');
      }
      
      console.log(`[Python Transcript] Successfully extracted ${result.data.wordCount} words`);
      
      return {
        transcript: result.data.transcript,
        items: result.data.items || [],
        duration: result.data.duration || 0,
        wordCount: result.data.wordCount || 0,
        language: result.data.language || 'en',
      };
      
    } catch (error) {
      console.error('[Python Transcript] Error:', error);
      
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('python3: command not found')) {
          throw new Error('Python 3 is not installed. Please install Python 3 to use transcript extraction.');
        }
        if (error.message.includes('ModuleNotFoundError')) {
          throw new Error('youtube-transcript-api Python package is not installed. Run: pip3 install youtube-transcript-api');
        }
        if (error.message.includes('Transcripts are disabled')) {
          throw new Error('Transcripts are disabled for this video');
        }
        if (error.message.includes('Video is unavailable')) {
          throw new Error('Video is unavailable (private, deleted, or region-locked)');
        }
        if (error.message.includes('No transcript found')) {
          throw new Error('No transcript available for this video');
        }
        
        throw error;
      }
      
      throw new Error('Failed to extract transcript from YouTube video');
    }
  }
  
  /**
   * Check if Python and required packages are installed
   */
  async checkDependencies(): Promise<{ python: boolean; package: boolean; errors: string[] }> {
    const errors: string[] = [];
    let pythonInstalled = false;
    let packageInstalled = false;
    
    try {
      // Check Python 3
      await execAsync('python3 --version');
      pythonInstalled = true;
    } catch {
      errors.push('Python 3 is not installed');
    }
    
    if (pythonInstalled) {
      try {
        // Check youtube-transcript-api package
        await execAsync('python3 -c "import youtube_transcript_api"');
        packageInstalled = true;
      } catch {
        errors.push('youtube-transcript-api package is not installed');
      }
    }
    
    return {
      python: pythonInstalled,
      package: packageInstalled,
      errors,
    };
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
   * Get transcript preview (first N words)
   */
  getTranscriptPreview(transcript: string, wordLimit: number = 100): string {
    const words = transcript.split(/\s+/);
    if (words.length <= wordLimit) {
      return transcript;
    }
    return words.slice(0, wordLimit).join(' ') + '...';
  }
}

// Export singleton instance
export const youtubePythonTranscriptService = new YouTubePythonTranscriptService();