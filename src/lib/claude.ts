import Anthropic from '@anthropic-ai/sdk';
import { Article, Message } from '@/types';
import { db } from './database';
import * as schema from './database/schema';
import { eq, and } from 'drizzle-orm';

export class ClaudeService {
  private client: Anthropic;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  // Load prompt from database by type
  private async getPrompt(type: 'content' | 'qa' | 'report'): Promise<string> {
    try {
      const prompt = await db.select().from(schema.systemPrompts)
        .where(and(
          eq(schema.systemPrompts.type, type),
          eq(schema.systemPrompts.active, true)
        ))
        .limit(1);
      
      if (prompt.length === 0) {
        throw new Error(`No active prompt found for type: ${type}`);
      }
      
      return prompt[0].content;
    } catch (error) {
      console.error(`Failed to load ${type} prompt:`, error);
      // Fallback to basic prompt to prevent system failure
      return `You are a helpful AI assistant specializing in financial advice.`;
    }
  }

  private searchRelevantArticles(query: string, limit = 3): Article[] {
    // Return empty array since we no longer have articles.json
    const articles: Article[] = [];
    const queryLower = query.toLowerCase();
    
    // Simple keyword matching - could be enhanced with vector search
    const scoredArticles = articles.map(article => {
      let score = 0;
      const searchableText = `${article.title} ${article.summary} ${article.content} ${article.tags.join(' ')}`.toLowerCase();
      
      // Boost score for title matches
      if (article.title.toLowerCase().includes(queryLower)) score += 10;
      
      // Boost score for category matches
      if (article.category.toLowerCase().includes(queryLower)) score += 5;
      
      // Boost score for tag matches
      article.tags.forEach(tag => {
        if (queryLower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(queryLower)) {
          score += 3;
        }
      });
      
      // Count keyword matches in content
      const words = queryLower.split(/\s+/).filter(word => word.length > 2);
      words.forEach(word => {
        const matches = (searchableText.match(new RegExp(word, 'g')) || []).length;
        score += matches;
      });
      
      return { article, score };
    });
    
    return scoredArticles
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ article }) => article);
  }

  async cleanupVoiceTranscript(transcript: string): Promise<string> {
    // Technical voice cleanup prompt (kept in code, not admin-controllable)
    const voiceCleanupPrompt = `The user spoke the following text using voice recognition. Clean it up to be coherent and grammatically correct while preserving the original meaning and intent. Remove filler words, fix run-on sentences, and correct obvious speech-to-text errors. Keep the tone conversational but clear:

${transcript}`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: voiceCleanupPrompt
        }]
      });

      return message.content[0].type === 'text' ? message.content[0].text.trim() : transcript;
    } catch (error) {
      console.error('Error cleaning up voice transcript:', error);
      return transcript; // Return original if cleanup fails
    }
  }

  // Simple message sending (for lead-in generation and other utilities)
  async sendMessage(
    messages: Array<{role: 'user' | 'assistant', content: string}>,
    systemPrompt?: string
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        system: systemPrompt || 'You are a helpful AI assistant.',
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      
      throw new Error('Unexpected response format from Claude');
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Failed to get response from Claude: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateResponse(
    messages: Message[],
    userQuery: string
  ): Promise<{ response: string; relevantArticles: Article[] }> {
    try {
      // Search for relevant articles based on the user's query
      const relevantArticles = this.searchRelevantArticles(userQuery);
      
      // Load main prompt from database (use QA prompt for general conversations)
      let contextPrompt = await this.getPrompt('qa');
      
      if (relevantArticles.length > 0) {
        const articlesContext = relevantArticles.map(article => 
          `Title: ${article.title}\nSummary: ${article.summary}\nContent: ${article.content.substring(0, 1000)}...\n`
        ).join('\n---\n');
        
        // Add knowledge context to the prompt
        contextPrompt += `\n\nRELEVANT KNOWLEDGE BASE CONTENT:\n${articlesContext}\n\nUse this context to provide informed, specific advice while maintaining your warm, conversational tone.`;
      }

      // Convert messages to Claude format
      const claudeMessages = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      // Add the current query
      claudeMessages.push({
        role: 'user',
        content: userQuery
      });

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: contextPrompt,
        messages: claudeMessages
      });

      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'I apologize, but I encountered an error generating a response.';

      return {
        response: responseText,
        relevantArticles
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error('Failed to generate response');
    }
  }

  async generateSessionSummary(messages: Message[]): Promise<string> {
    try {
      const messageHistory = messages.map(msg => 
        `${msg.type === 'user' ? 'User' : 'Sanjay'}: ${msg.content}`
      ).join('\n');

      // Use reports prompt from database for session summaries
      const reportPrompt = await this.getPrompt('report');
      const fullPrompt = `${reportPrompt}\n\nConversation:\n${messageHistory}`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: fullPrompt
        }]
      });

      return response.content[0].type === 'text' 
        ? response.content[0].text.trim()
        : 'Session summary unavailable';
    } catch (error) {
      console.error('Error generating session summary:', error);
      return 'Session summary unavailable';
    }
  }

  async extractSessionNotes(userMessage: string, assistantMessage: string): Promise<Array<{ content: string; type: 'insight' | 'action' | 'recommendation' | 'question' }>> {
    // Technical note extraction prompt (kept in code, not admin-controllable)
    const noteExtractionPrompt = `From this message exchange, extract any important insights, recommendations, or action items that should be saved to the user's session notebook. Format as brief, actionable notes. If there are no significant insights worth saving, return an empty array.

Message exchange:
User: ${userMessage}
Assistant: ${assistantMessage}

Return a JSON array of note objects with fields: content, type ('insight', 'action', 'recommendation', or 'question')`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: noteExtractionPrompt
        }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '[]';
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing extracted notes:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error extracting session notes:', error);
      return [];
    }
  }

  async generateAutoTherapistNotes(userMessage: string, assistantMessage: string): Promise<string[]> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `As a financial therapist, analyze this conversation exchange and generate 1-3 concise, professional notes that capture:
          
1. Key insights about the client's financial psychology or behavior
2. Important action items or recommendations given
3. Areas for follow-up or deeper exploration

User said: "${userMessage}"
Therapist responded: "${assistantMessage}"

Return only the notes as a JSON array of strings. Each note should be 1-2 sentences maximum.

Example format: ["Client shows anxiety around market volatility, need to explore risk tolerance", "Recommended starting with low-cost index funds", "Follow up on retirement timeline in next session"]`
        }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '[]';
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing auto therapist notes:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error generating auto therapist notes:', error);
      return [];
    }
  }
}

// Singleton instance
let claudeServiceInstance: ClaudeService | null = null;

export function getClaudeService(): ClaudeService {
  if (!claudeServiceInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    claudeServiceInstance = new ClaudeService(apiKey);
  }
  return claudeServiceInstance;
}