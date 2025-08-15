import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';

export class ContentIngestionService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }

  async processText(text: string, chunkDurationMinutes: number): Promise<any[]> {
    const wordsPerMinute = 150;
    const wordsPerChunk = wordsPerMinute * chunkDurationMinutes;
    
    const chunks = await this.intelligentChunking(text, wordsPerChunk);
    
    return chunks.map((chunk, index) => ({
      index,
      content: chunk,
      duration: chunkDurationMinutes,
      type: 'content',
      hasQA: index < chunks.length - 1,
    }));
  }

  async processPdf(filePath: string, chunkDurationMinutes: number): Promise<any[]> {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return this.processText(data.text, chunkDurationMinutes);
  }

  async processDocx(filePath: string, chunkDurationMinutes: number): Promise<any[]> {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return this.processText(result.value, chunkDurationMinutes);
  }

  async processUrl(url: string, chunkDurationMinutes: number): Promise<any[]> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // Remove scripts and styles
      $('script, style').remove();
      
      // Extract main content
      const content = $('article, main, .content, #content, body').first().text();
      const cleanContent = content.replace(/\s+/g, ' ').trim();
      
      return this.processText(cleanContent, chunkDurationMinutes);
    } catch (error) {
      console.error('Error processing URL:', error);
      throw new Error('Failed to process URL content');
    }
  }

  async processYouTube(url: string, chunkDurationMinutes: number): Promise<any[]> {
    try {
      // Extract video ID from URL
      const videoId = this.extractYouTubeId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // This is a placeholder - in production, you'd use YouTube API or a transcript service
      // For now, we'll return a message that manual transcript upload is needed
      return [{
        index: 0,
        content: `YouTube video processing requires transcript. Please upload the transcript text manually for video: ${videoId}`,
        duration: chunkDurationMinutes,
        type: 'placeholder',
        hasQA: false,
      }];
    } catch (error) {
      console.error('Error processing YouTube:', error);
      throw new Error('Failed to process YouTube video');
    }
  }

  private async intelligentChunking(text: string, wordsPerChunk: number): Promise<string[]> {
    const prompt = `You are a content structuring assistant for nutritionist educational content.
    
    Please divide the following text into logical chunks for a lesson format. Each chunk should:
    1. Be approximately ${wordsPerChunk} words (can vary by 20% for better logical breaks)
    2. End at a natural break point (end of topic, paragraph, or concept)
    3. Be self-contained enough to understand without immediate context
    4. Flow naturally into the next chunk
    
    Return the chunks as a JSON array of strings.
    
    Text to chunk:
    ${text}`;

    try {
      const completion = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.3,
        system: prompt + '\n\nPlease respond with valid JSON only.',
        messages: [{ role: 'user', content: 'Chunk this content.' }],
      });

      const responseText = completion.content[0].type === 'text' ? completion.content[0].text : '{"chunks":[]}';
      const result = JSON.parse(responseText);
      return result.chunks || [text];
    } catch (error) {
      console.error('Intelligent chunking failed, falling back to simple chunking:', error);
      return this.simpleChunking(text, wordsPerChunk);
    }
  }

  private simpleChunking(text: string, wordsPerChunk: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunk = words.slice(i, i + wordsPerChunk).join(' ');
      chunks.push(chunk);
    }
    
    return chunks;
  }

  private extractYouTubeId(url: string): string | null {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  async generateLessonSummary(content: any[]): Promise<string> {
    const fullContent = content.map(c => c.content).join('\n\n');
    
    const prompt = `Summarize this nutrition lesson content in 2-3 sentences:
    ${fullContent.substring(0, 2000)}`;

    try {
      const completion = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        temperature: 0.3,
        system: prompt,
        messages: [{ role: 'user', content: 'Generate a title for this content.' }],
      });

      return completion.content[0].type === 'text' ? completion.content[0].text : 'Nutrition lesson content';
    } catch (error) {
      console.error('Failed to generate summary:', error);
      return 'Nutrition lesson content';
    }
  }

  async extractKeyTopics(content: any[]): Promise<string[]> {
    const fullContent = content.map(c => c.content).join('\n\n');
    
    const prompt = `Extract 3-5 key nutrition topics from this content as a JSON array:
    ${fullContent.substring(0, 2000)}`;

    try {
      const completion = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        temperature: 0.3,
        system: prompt + '\n\nPlease respond with valid JSON only.',
        messages: [{ role: 'user', content: 'Extract topics from this content.' }],
      });

      const responseText = completion.content[0].type === 'text' ? completion.content[0].text : '{"topics":[]}';
      const result = JSON.parse(responseText);
      return result.topics || [];
    } catch (error) {
      console.error('Failed to extract topics:', error);
      return [];
    }
  }
}

export default ContentIngestionService;