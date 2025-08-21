import Anthropic from '@anthropic-ai/sdk';
import { Message, SessionNote, Article } from '@/types';
import { knowledgeSearch, SearchResult } from './knowledge-search';
import { ERROR_MESSAGES } from './system-prompts';
import { db } from './database';
import * as schema from './database/schema';
import { eq, and } from 'drizzle-orm';
import { debugDatabaseService } from './debug-database-service';

export interface ClaudeConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export interface AutoNoteConfig {
  maxNotes: number;
  extractInsights: boolean;
  extractActions: boolean;
  extractQuestions: boolean;
  extractRecommendations: boolean;
}

export interface RAGResponse {
  response: string;
  citedArticles: Article[];
  searchResults: SearchResult[];
}

export class EnhancedClaudeService {
  private client: Anthropic;
  private config: ClaudeConfig;
  private autoNoteConfig: AutoNoteConfig;

  // Default configurations
  static readonly DEFAULT_CONFIG: ClaudeConfig = {
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4000,
    temperature: 0.7,
    systemPrompt: 'You are a helpful AI assistant specializing in financial advice.' // Fallback
  };

  static readonly DEFAULT_AUTO_NOTE_CONFIG: AutoNoteConfig = {
    maxNotes: 5,
    extractInsights: true,
    extractActions: true,
    extractQuestions: true,
    extractRecommendations: true
  };

  constructor(
    config: Partial<ClaudeConfig> = {},
    autoNoteConfig: Partial<AutoNoteConfig> = {}
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(ERROR_MESSAGES.ANTHROPIC_API_KEY_MISSING);
    }

    this.client = new Anthropic({ apiKey });
    this.config = { ...EnhancedClaudeService.DEFAULT_CONFIG, ...config };
    this.autoNoteConfig = { ...EnhancedClaudeService.DEFAULT_AUTO_NOTE_CONFIG, ...autoNoteConfig };
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
        throw new Error(`${ERROR_MESSAGES.PROMPT_NOT_FOUND}: ${type}`);
      }
      
      return prompt[0].content;
    } catch (error) {
      console.error(`Failed to load ${type} prompt:`, error);
      // Fallback to basic prompt to prevent system failure
      return 'You are a helpful AI assistant specializing in financial advice.';
    }
  }

  // RAG-enhanced conversation method
  async sendMessageWithContext(
    messages: Message[],
    userMessage: string
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    let debugEntryId = '';

    try {
      // Search for relevant articles
      const searchStart = Date.now();
      const searchResults = await knowledgeSearch.findRelevantArticles(userMessage, 3);
      const searchTime = Date.now() - searchStart;
      
      // Capture knowledge search debug info
      if (debugDatabaseService.isDebugEnabledSync()) {
        await debugDatabaseService.captureKnowledgeSearch(
          userMessage,
          searchResults.map(r => r.article),
          searchTime
        );
      }
      
      // Generate context from search results
      const contextSummary = knowledgeSearch.generateContextSummary(searchResults);
      
      // Load appropriate prompt from database
      const basePrompt = await this.getPrompt('qa'); // Use QA prompt for conversations with knowledge base
      
      // Create enhanced system prompt with context
      const enhancedPrompt = contextSummary 
        ? `${basePrompt}

RELEVANT KNOWLEDGE BASE CONTENT:
${contextSummary}

Use this context to provide informed, specific advice while maintaining your warm, conversational tone.`
        : basePrompt;

      // Start debug tracking for RAG request
      if (debugDatabaseService.isDebugEnabledSync()) {
        debugEntryId = await debugDatabaseService.captureClaudeRequest(
          messages,
          enhancedPrompt,
          this.config.model,
          this.config.temperature,
          this.config.maxTokens,
          contextSummary,
          { ragMode: true, articlesFound: searchResults.length }
        );
      }

      // Get Claude's response
      const response = await this.sendMessage(messages, enhancedPrompt);
      const processingTime = Date.now() - startTime;

      // Complete debug tracking
      if (debugDatabaseService.isDebugEnabledSync() && debugEntryId) {
        await debugDatabaseService.completeRequest(debugEntryId, {
          content: response,
          citedArticles: searchResults.map(r => r.article),
          processingTime
        });
      }

      return {
        response,
        citedArticles: searchResults.map(r => r.article),
        searchResults
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Mark debug request as failed
      if (debugDatabaseService.isDebugEnabledSync() && debugEntryId) {
        await debugDatabaseService.failRequest(
          debugEntryId,
          error instanceof Error ? error.message : 'Unknown error',
          processingTime
        );
      }
      
      console.error('Error in RAG-enhanced conversation:', error);
      throw new Error(`RAG-enhanced conversation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Core conversation method
  async sendMessage(
    messages: Message[], 
    systemPrompt?: string
  ): Promise<string> {
    const startTime = Date.now();
    let debugEntryId = '';

    try {
      // Start debug tracking for standard Claude request
      if (debugDatabaseService.isDebugEnabledSync()) {
        debugEntryId = await debugDatabaseService.captureClaudeRequest(
          messages,
          systemPrompt || this.config.systemPrompt,
          this.config.model,
          this.config.temperature,
          this.config.maxTokens,
          undefined, // No knowledge context for standard requests
          { ragMode: false }
        );
      }

      const formattedMessages = messages.map(msg => ({
        role: (msg.type || msg.sender) === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt || this.config.systemPrompt,
        messages: formattedMessages
      });

      if (!response.content || response.content.length === 0) {
        console.error('Empty response from Claude:', response);
        throw new Error('No content in Claude response');
      }

      const content = response.content[0];
      if (content && content.type === 'text') {
        const processingTime = Date.now() - startTime;

        // Complete debug tracking
        if (debugDatabaseService.isDebugEnabledSync() && debugEntryId) {
          await debugDatabaseService.completeRequest(debugEntryId, {
            content: content.text,
            usage: { tokens: response.usage?.output_tokens || 0 },
            processingTime
          });
        }
        
        return content.text;
      }
      
      console.error('Unexpected response format:', content);
      throw new Error('Unexpected response format from Claude');
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Mark debug request as failed
      if (debugDatabaseService.isDebugEnabledSync() && debugEntryId) {
        await debugDatabaseService.failRequest(
          debugEntryId,
          error instanceof Error ? error.message : 'Unknown error',
          processingTime
        );
      }
      
      console.error('Claude API error:', error);
      throw new Error(`Failed to get response from Claude: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate session summary
  async generateSessionSummary(messages: Message[]): Promise<string> {
    if (messages.length === 0) {
      return 'No conversation recorded in this session.';
    }

    const summaryPrompt = `Analyze this financial counseling conversation and provide a concise session summary (2-3 sentences) focusing on:
- Key topics discussed
- Client's main concerns or goals
- Overall session outcome

Keep it professional and suitable for session records.`;

    try {
      return await this.sendMessage(messages, summaryPrompt);
    } catch (error) {
      console.error('Error generating session summary:', error);
      return `Session on ${new Date().toLocaleDateString()} - Summary generation failed`;
    }
  }

  // Extract structured session notes
  async extractSessionNotes(userMessage: string, assistantMessage: string): Promise<SessionNote[]> {
    // Technical note extraction prompt (kept in code, not admin-controllable)
    const extractPrompt = `Extract structured insights from this financial counseling conversation. Return ONLY a JSON array of notes with this format:
[
  {
    "type": "insight|action|recommendation|question",
    "content": "specific note content",
    "priority": "high|medium|low"
  }
]

Types:
- insight: Understanding about client's relationship with money
- action: Specific steps client should take
- recommendation: Advisor suggestions or strategies  
- question: Follow-up questions for next session

User: ${userMessage}
Assistant: ${assistantMessage}`;

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent JSON
        system: extractPrompt,
        messages: [{ role: 'user', content: 'Extract notes from the conversation above.' }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format');
      }

      // Parse JSON response
      const notesData = JSON.parse(content.text);
      if (!Array.isArray(notesData)) {
        throw new Error('Response is not an array');
      }

      // Convert to SessionNote format
      const notes: SessionNote[] = notesData
        .filter(note => note.content && note.type)
        .slice(0, this.autoNoteConfig.maxNotes)
        .map(note => ({
          id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: note.content,
          type: note.type,
          timestamp: new Date(),
          autoGenerated: true,
          priority: note.priority || 'medium'
        }));

      return notes;
    } catch (error) {
      console.error('Error extracting session notes:', error);
      return [];
    }
  }

  // Generate auto therapist notes (enhanced version)
  async generateAutoTherapistNotes(userMessage: string, assistantMessage: string): Promise<SessionNote[]> {
    // Technical session analysis prompt (kept in code, not admin-controllable)
    const analysisPrompt = `You are an expert at analyzing retirement planning sessions. Extract key insights, action items, and recommendations from conversations between a retirement specialist and client.

Focus on:
- Client's emotional relationship with money
- Behavioral patterns and triggers
- Specific financial goals or concerns
- Action items and next steps
- Areas requiring follow-up
- Progress indicators

Analyze this exchange and generate up to ${this.autoNoteConfig.maxNotes} structured notes:

User: ${userMessage}
Assistant: ${assistantMessage}

Return notes as JSON array with format:
[{"type": "insight|action|recommendation|question", "content": "note text", "priority": "high|medium|low"}]`;

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 1500,
        temperature: 0.4,
        system: analysisPrompt,
        messages: [{ role: 'user', content: 'Generate therapist notes.' }]
      });

      const content = response.content[0];
      if (content.type !== 'text') return [];

      const notesData = JSON.parse(content.text);
      if (!Array.isArray(notesData)) return [];

      // Filter based on auto-note configuration
      const filteredNotes = notesData.filter(note => {
        switch (note.type) {
          case 'insight': return this.autoNoteConfig.extractInsights;
          case 'action': return this.autoNoteConfig.extractActions;
          case 'recommendation': return this.autoNoteConfig.extractRecommendations;
          case 'question': return this.autoNoteConfig.extractQuestions;
          default: return true;
        }
      });

      return filteredNotes
        .slice(0, this.autoNoteConfig.maxNotes)
        .map(note => ({
          id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: note.content,
          type: note.type,
          timestamp: new Date(),
          autoGenerated: true,
          priority: note.priority || 'medium'
        }));

    } catch (error) {
      console.error('Error generating auto notes:', error);
      return [];
    }
  }

  // Generate introduction message
  async generateIntroduction(userName?: string): Promise<string> {
    const introPrompt = `Generate a warm, welcoming introduction from Sanjay to start a financial counseling session. ${userName ? `The client's name is ${userName}.` : 'The client name is unknown.'} 

Keep it:
- Under 100 words
- Warm and professional
- Focused on creating a safe space
- Encouraging about the financial journey ahead`;

    const introMessages: Message[] = [{
      id: 'intro_prompt',
      content: 'Please introduce yourself and welcome me to start our financial counseling session.',
      type: 'user',
      timestamp: new Date()
    }];

    try {
      return await this.sendMessage(introMessages, introPrompt);
    } catch (error) {
      console.error('Error generating introduction:', error);
      throw error; // Don't provide fallback - let caller handle the error
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<ClaudeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  updateAutoNoteConfig(newConfig: Partial<AutoNoteConfig>): void {
    this.autoNoteConfig = { ...this.autoNoteConfig, ...newConfig };
  }

  // Get current configuration
  getConfig(): ClaudeConfig {
    return { ...this.config };
  }

  getAutoNoteConfig(): AutoNoteConfig {
    return { ...this.autoNoteConfig };
  }
}

// Service factory function (matches existing pattern)
export function getClaudeService(): EnhancedClaudeService {
  return new EnhancedClaudeService();
}

// Utility functions for API integration
export class ClaudeAPIHelper {
  // Client-side API calls (for use in components)
  static async generateSessionSummary(messages: Message[]): Promise<string> {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSummary',
          messages
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API call failed');
      }

      return data.summary;
    } catch (error) {
      console.error('Error calling session summary API:', error);
      throw error;
    }
  }

  static async generateAutoNotes(userMessage: string, assistantMessage: string): Promise<SessionNote[]> {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateAutoNotes',
          userMessage,
          assistantMessage
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API call failed');
      }

      return data.notes || [];
    } catch (error) {
      console.error('Error calling auto notes API:', error);
      return [];
    }
  }

  static async extractSessionNotes(userMessage: string, assistantMessage: string): Promise<SessionNote[]> {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extractNotes',
          userMessage,
          assistantMessage
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API call failed');
      }

      return data.notes || [];
    } catch (error) {
      console.error('Error calling extract notes API:', error);
      return [];
    }
  }
}