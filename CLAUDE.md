# Nutritionist AI Utilities

This file contains comprehensive implementations of AI utilities for the Nutritionist Learning app, inspired by FTherapy's proven patterns.

## 1. ElevenLabs Interface

### Enhanced ElevenLabs Service with Fallbacks

```typescript
export interface VoiceSettings {
  stability: number;       // 0.0-1.0
  similarityBoost: number; // 0.0-1.0
  style: number;          // 0.0-1.0
  useSpeakerBoost: boolean;
}

export interface VoicePreset {
  name: string;
  voiceId: string;
  settings: VoiceSettings;
  description: string;
}

export class EnhancedElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private audioQueue: HTMLAudioElement[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private isPlaying = false;

  // Voice Presets (FTherapy-inspired)
  static readonly VOICE_PRESETS: Record<string, VoicePreset> = {
    professional: {
      name: 'Professional',
      voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam
      settings: { stability: 0.5, similarityBoost: 0.75, style: 0.3, useSpeakerBoost: true },
      description: 'Clear, professional tone for nutrition guidance'
    },
    casual: {
      name: 'Casual',
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
      settings: { stability: 0.3, similarityBoost: 0.8, style: 0.6, useSpeakerBoost: false },
      description: 'Friendly, conversational tone'
    },
    storyteller: {
      name: 'Storyteller',
      voiceId: '29vD33N1CtxCmqQRPOHJ', // Drew
      settings: { stability: 0.7, similarityBoost: 0.6, style: 0.8, useSpeakerBoost: true },
      description: 'Engaging tone for explaining complex concepts'
    }
  };

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found - will use browser fallback');
    }
  }

  // Core TTS Generation with Error Handling
  async generateSpeech(
    text: string, 
    preset: keyof typeof EnhancedElevenLabsService.VOICE_PRESETS = 'professional'
  ): Promise<ArrayBuffer | null> {
    if (!this.apiKey) {
      console.log('No ElevenLabs API key - using browser TTS fallback');
      return null;
    }

    const voicePreset = EnhancedElevenLabsService.VOICE_PRESETS[preset];
    if (!voicePreset) {
      throw new Error(`Unknown voice preset: ${preset}`);
    }

    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voicePreset.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: voicePreset.settings,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`ElevenLabs TTS error: ${response.status} ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('TTS generation failed:', error);
      return null;
    }
  }

  // Audio Playback with Queue Management
  async playAudio(audioData: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);

        // Add to queue
        this.audioQueue.push(audio);
        this.currentAudio = audio;
        this.isPlaying = true;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.isPlaying = false;
          this.currentAudio = null;
          // Remove from queue
          const index = this.audioQueue.indexOf(audio);
          if (index > -1) {
            this.audioQueue.splice(index, 1);
          }
          resolve();
        };

        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          this.isPlaying = false;
          this.currentAudio = null;
          reject(error);
        };

        audio.play().catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Interrupt Current Audio
  interruptAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.isPlaying = false;
    }
    
    // Clear queue
    this.audioQueue.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.audioQueue = [];
  }

  // Get Available Voices
  async getVoices(): Promise<any[]> {
    if (!this.apiKey) return [];

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: { 'xi-api-key': this.apiKey }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.voices || [];
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error);
    }
    
    return [];
  }

  // Status Checks
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  getQueueLength(): number {
    return this.audioQueue.length;
  }
}

// Browser TTS Fallback Service
export class BrowserTTSService {
  private synth: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  // Speak with Browser TTS
  async speak(text: string, voice: string = 'default'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Browser TTS not supported'));
        return;
      }

      // Cancel any current speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      // Configure voice
      const voices = this.synth.getVoices();
      if (voice !== 'default') {
        const selectedVoice = voices.find(v => v.name.includes(voice));
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      // Configure speech parameters
      utterance.rate = 0.9;  // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (error) => {
        this.currentUtterance = null;
        reject(error);
      };

      this.synth.speak(utterance);
    });
  }

  // Stop current speech
  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
  }

  // Get available voices
  getVoices(): SpeechSynthesisVoice[] {
    return this.synth ? this.synth.getVoices() : [];
  }

  // Check if speaking
  isSpeaking(): boolean {
    return this.synth ? this.synth.speaking : false;
  }
}

// Unified Voice Service (FTherapy Pattern)
export class VoiceService {
  private elevenLabs: EnhancedElevenLabsService;
  private browserTTS: BrowserTTSService;
  private preferElevenLabs: boolean = true;

  constructor(preferElevenLabs: boolean = true) {
    this.elevenLabs = new EnhancedElevenLabsService();
    this.browserTTS = new BrowserTTSService();
    this.preferElevenLabs = preferElevenLabs;
  }

  // Unified speak method with automatic fallback
  async speak(
    text: string, 
    preset: keyof typeof EnhancedElevenLabsService.VOICE_PRESETS = 'professional'
  ): Promise<void> {
    if (this.preferElevenLabs) {
      try {
        const audioData = await this.elevenLabs.generateSpeech(text, preset);
        if (audioData) {
          await this.elevenLabs.playAudio(audioData);
          return;
        }
      } catch (error) {
        console.warn('ElevenLabs failed, falling back to browser TTS:', error);
      }
    }

    // Fallback to browser TTS
    try {
      await this.browserTTS.speak(text);
    } catch (error) {
      console.error('Both TTS services failed:', error);
      throw new Error('All TTS services unavailable');
    }
  }

  // Interrupt all speech
  interruptAll(): void {
    this.elevenLabs.interruptAudio();
    this.browserTTS.stop();
  }

  // Check if any service is speaking
  isSpeaking(): boolean {
    return this.elevenLabs.isCurrentlyPlaying() || this.browserTTS.isSpeaking();
  }

  // Switch preferred service
  setPreferredService(preferElevenLabs: boolean): void {
    this.preferElevenLabs = preferElevenLabs;
  }
}
```

## 3. Anthropic Interface

### Enhanced Claude Service with Session Management

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Message, Session, SessionNote } from '@/types';

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

export class EnhancedClaudeService {
  private client: Anthropic;
  private config: ClaudeConfig;
  private autoNoteConfig: AutoNoteConfig;

  // Financial advisor system prompts
  static readonly SYSTEM_PROMPTS = {
    financial_advisor: `You are Sanjay, a warm, empathetic AI financial advisor who specializes in helping people develop healthy relationships with money. 

Your approach:
- Listen actively and ask thoughtful follow-up questions
- Provide practical, actionable advice
- Help clients identify emotional patterns around money
- Offer personalized strategies for financial wellness
- Maintain a supportive, non-judgmental tone
- Focus on behavioral change and sustainable habits

Keep responses conversational, warm, and focused on the human experience of financial decision-making.`,

    session_analyzer: `You are an expert at analyzing financial counseling sessions. Extract key insights, action items, and recommendations from conversations between a financial advisor and client.

Focus on:
- Client's emotional relationship with money
- Behavioral patterns and triggers
- Specific financial goals or concerns
- Action items and next steps
- Areas requiring follow-up
- Progress indicators

Provide structured, actionable notes that would be valuable for session continuity.`,

    note_extractor: `Extract structured insights from this financial counseling conversation. Return ONLY a JSON array of notes with this format:
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
- question: Follow-up questions for next session`
  };

  // Default configurations
  static readonly DEFAULT_CONFIG: ClaudeConfig = {
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4000,
    temperature: 0.7,
    systemPrompt: EnhancedClaudeService.SYSTEM_PROMPTS.financial_advisor
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
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.client = new Anthropic({ apiKey });
    this.config = { ...EnhancedClaudeService.DEFAULT_CONFIG, ...config };
    this.autoNoteConfig = { ...EnhancedClaudeService.DEFAULT_AUTO_NOTE_CONFIG, ...autoNoteConfig };
  }

  // Core conversation method
  async sendMessage(
    messages: Message[], 
    systemPrompt?: string
  ): Promise<string> {
    try {
      const formattedMessages = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt || this.config.systemPrompt,
        messages: formattedMessages
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
    const extractPrompt = `${EnhancedClaudeService.SYSTEM_PROMPTS.note_extractor}

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
    const analysisPrompt = `${EnhancedClaudeService.SYSTEM_PROMPTS.session_analyzer}

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
      sender: 'user',
      timestamp: new Date()
    }];

    try {
      return await this.sendMessage(introMessages, introPrompt);
    } catch (error) {
      console.error('Error generating introduction:', error);
      return `Hello${userName ? ` ${userName}` : ''}! I'm Sanjay, your AI financial advisor. I'm here to help you build a healthier relationship with money and work toward your financial goals. What would you like to talk about today?`;
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
```

## 4. Session Notebook Manager

### Enhanced Session Storage with Auto-Note Generation

```typescript
import { Session, SessionNote, Message } from '@/types';
import { ClaudeAPIHelper } from './claude';

export interface SessionMetrics {
  totalMessages: number;
  averageResponseTime: number;
  notesGenerated: number;
  sessionsThisWeek: number;
  lastSessionDate: Date | null;
}

export interface SessionExportOptions {
  includeMessages: boolean;
  includeNotes: boolean;
  includeSummary: boolean;
  format: 'txt' | 'json' | 'csv';
}

export class EnhancedSessionStorage {
  private static readonly STORAGE_KEY = 'financial_advisor_sessions';
  private static readonly CURRENT_SESSION_KEY = 'financial_advisor_current_session';
  private static readonly METRICS_KEY = 'financial_advisor_metrics';
  
  // Auto-note generation settings
  private static autoNotesEnabled = true;
  private static autoNotesDelay = 2000; // ms after message

  // Session Management
  static createNewSession(title?: string): Session {
    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || `Session ${new Date().toLocaleDateString()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      notes: [],
      isActive: true
    };
    
    this.saveSession(session);
    this.setCurrentSession(session.id);
    this.updateMetrics();
    
    return session;
  }

  static saveSession(session: Session): void {
    session.updatedAt = new Date();
    const sessions = this.getAllSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    
    // Keep only last 50 sessions to avoid storage bloat
    const sortedSessions = sessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const limitedSessions = sortedSessions.slice(0, 50);
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limitedSessions, this.dateReplacer));
    } catch (error) {
      console.error('Failed to save session:', error);
      // If storage is full, remove oldest sessions and try again
      const reducedSessions = limitedSessions.slice(0, 25);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reducedSessions, this.dateReplacer));
    }
  }

  static getSession(sessionId: string): Session | null {
    const sessions = this.getAllSessions();
    const session = sessions.find(s => s.id === sessionId);
    return session || null;
  }

  static getAllSessions(): Session[] {
    try {
      const sessionsData = localStorage.getItem(this.STORAGE_KEY);
      if (!sessionsData) return [];
      
      const sessions = JSON.parse(sessionsData, this.dateReviver);
      return Array.isArray(sessions) ? sessions : [];
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  static getCurrentSession(): Session | null {
    const currentSessionId = localStorage.getItem(this.CURRENT_SESSION_KEY);
    if (!currentSessionId) return null;
    
    return this.getSession(currentSessionId);
  }

  static setCurrentSession(sessionId: string): void {
    localStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
  }

  static deleteSession(sessionId: string): void {
    const sessions = this.getAllSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions, this.dateReplacer));
    
    // Clear current session if it was deleted
    const currentSessionId = localStorage.getItem(this.CURRENT_SESSION_KEY);
    if (currentSessionId === sessionId) {
      localStorage.removeItem(this.CURRENT_SESSION_KEY);
    }
    
    this.updateMetrics();
  }

  // Message Management
  static addMessage(sessionId: string, message: Message): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    session.messages.push(message);
    this.saveSession(session);
    
    // Trigger auto-note generation if enabled
    if (this.autoNotesEnabled && message.sender === 'assistant') {
      this.scheduleAutoNoteGeneration(sessionId, message);
    }
  }

  static updateMessage(sessionId: string, messageId: string, content: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    const message = session.messages.find(m => m.id === messageId);
    if (message) {
      message.content = content;
      message.timestamp = new Date();
      this.saveSession(session);
    }
  }

  static deleteMessage(sessionId: string, messageId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    session.messages = session.messages.filter(m => m.id !== messageId);
    this.saveSession(session);
  }

  // Note Management
  static addNote(sessionId: string, noteData: Omit<SessionNote, 'id' | 'timestamp' | 'autoGenerated'>): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    const note: SessionNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      autoGenerated: false,
      priority: 'medium',
      ...noteData
    };
    
    session.notes.push(note);
    this.saveSession(session);
    this.updateMetrics();
  }

  static updateNote(sessionId: string, noteId: string, content: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    const note = session.notes.find(n => n.id === noteId);
    if (note) {
      note.content = content;
      note.timestamp = new Date();
      this.saveSession(session);
    }
  }

  static deleteNote(sessionId: string, noteId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    session.notes = session.notes.filter(n => n.id !== noteId);
    this.saveSession(session);
    this.updateMetrics();
  }

  // Auto-Note Generation
  private static autoNoteTimeouts = new Map<string, NodeJS.Timeout>();

  static scheduleAutoNoteGeneration(sessionId: string, assistantMessage: Message): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    // Find the most recent user message before this assistant message
    const messages = session.messages;
    const assistantIndex = messages.findIndex(m => m.id === assistantMessage.id);
    const userMessage = messages.slice(0, assistantIndex).reverse().find(m => m.sender === 'user');
    
    if (!userMessage) return;
    
    // Clear any existing timeout for this session
    const existingTimeout = this.autoNoteTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Schedule auto-note generation
    const timeout = setTimeout(async () => {
      try {
        const autoNotes = await ClaudeAPIHelper.generateAutoNotes(
          userMessage.content,
          assistantMessage.content
        );
        
        if (autoNotes.length > 0) {
          const currentSession = this.getSession(sessionId);
          if (currentSession) {
            currentSession.notes.push(...autoNotes);
            this.saveSession(currentSession);
            this.updateMetrics();
          }
        }
      } catch (error) {
        console.error('Auto-note generation failed:', error);
      } finally {
        this.autoNoteTimeouts.delete(sessionId);
      }
    }, this.autoNotesDelay);
    
    this.autoNoteTimeouts.set(sessionId, timeout);
  }

  static setAutoNotesEnabled(enabled: boolean): void {
    this.autoNotesEnabled = enabled;
    localStorage.setItem('auto_notes_enabled', enabled.toString());
  }

  static isAutoNotesEnabled(): boolean {
    const stored = localStorage.getItem('auto_notes_enabled');
    return stored !== null ? stored === 'true' : this.autoNotesEnabled;
  }

  // Session Summary Management
  static async generateSessionSummary(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session || session.messages.length === 0) return;
    
    try {
      const summary = await ClaudeAPIHelper.generateSessionSummary(session.messages);
      session.summary = summary;
      this.saveSession(session);
    } catch (error) {
      console.error('Failed to generate session summary:', error);
    }
  }

  // Export Functions
  static exportSession(sessionId: string, options: Partial<SessionExportOptions> = {}): string {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    const exportOptions: SessionExportOptions = {
      includeMessages: true,
      includeNotes: true,
      includeSummary: true,
      format: 'txt',
      ...options
    };
    
    switch (exportOptions.format) {
      case 'json':
        return this.exportAsJSON(session, exportOptions);
      case 'csv':
        return this.exportAsCSV(session, exportOptions);
      default:
        return this.exportAsText(session, exportOptions);
    }
  }

  private static exportAsText(session: Session, options: SessionExportOptions): string {
    let content = `Financial Counseling Session Export\n`;
    content += `=====================================\n\n`;
    content += `Session: ${session.title}\n`;
    content += `Date: ${session.createdAt.toLocaleDateString()}\n`;
    content += `Duration: ${this.getSessionDuration(session)}\n\n`;
    
    if (options.includeSummary && session.summary) {
      content += `SESSION SUMMARY\n`;
      content += `---------------\n`;
      content += `${session.summary}\n\n`;
    }
    
    if (options.includeMessages && session.messages.length > 0) {
      content += `CONVERSATION TRANSCRIPT\n`;
      content += `----------------------\n`;
      session.messages.forEach((message, index) => {
        const speaker = message.sender === 'user' ? 'Client' : 'Sanjay (Advisor)';
        const time = message.timestamp.toLocaleTimeString();
        content += `[${time}] ${speaker}: ${message.content}\n\n`;
      });
    }
    
    if (options.includeNotes && session.notes.length > 0) {
      content += `THERAPIST NOTES\n`;
      content += `---------------\n`;
      session.notes.forEach((note, index) => {
        const time = note.timestamp.toLocaleTimeString();
        const type = note.type.toUpperCase();
        const auto = note.autoGenerated ? ' (Auto-generated)' : '';
        content += `[${time}] ${type}${auto}: ${note.content}\n\n`;
      });
    }
    
    content += `\nExport generated on ${new Date().toLocaleString()}\n`;
    return content;
  }

  private static exportAsJSON(session: Session, options: SessionExportOptions): string {
    const exportData: any = {
      sessionInfo: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        duration: this.getSessionDuration(session)
      },
      exportedAt: new Date(),
      options: options
    };
    
    if (options.includeSummary && session.summary) {
      exportData.summary = session.summary;
    }
    
    if (options.includeMessages) {
      exportData.messages = session.messages;
    }
    
    if (options.includeNotes) {
      exportData.notes = session.notes;
    }
    
    return JSON.stringify(exportData, null, 2);
  }

  private static exportAsCSV(session: Session, options: SessionExportOptions): string {
    let csv = 'Timestamp,Type,Speaker/Category,Content,Auto-Generated\n';
    
    const allItems: Array<{
      timestamp: Date;
      type: 'message' | 'note';
      speaker: string;
      content: string;
      autoGenerated: boolean;
    }> = [];
    
    if (options.includeMessages) {
      session.messages.forEach(msg => {
        allItems.push({
          timestamp: msg.timestamp,
          type: 'message',
          speaker: msg.sender === 'user' ? 'Client' : 'Sanjay',
          content: msg.content,
          autoGenerated: false
        });
      });
    }
    
    if (options.includeNotes) {
      session.notes.forEach(note => {
        allItems.push({
          timestamp: note.timestamp,
          type: 'note',
          speaker: note.type,
          content: note.content,
          autoGenerated: note.autoGenerated || false
        });
      });
    }
    
    // Sort by timestamp
    allItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    allItems.forEach(item => {
      const timestamp = item.timestamp.toISOString();
      const content = `"${item.content.replace(/"/g, '""')}"`;
      csv += `${timestamp},${item.type},${item.speaker},${content},${item.autoGenerated}\n`;
    });
    
    return csv;
  }

  // Analytics and Metrics
  static updateMetrics(): void {
    const sessions = this.getAllSessions();
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    
    const metrics: SessionMetrics = {
      totalMessages: sessions.reduce((total, session) => total + session.messages.length, 0),
      averageResponseTime: this.calculateAverageResponseTime(sessions),
      notesGenerated: sessions.reduce((total, session) => total + session.notes.length, 0),
      sessionsThisWeek: sessions.filter(session => 
        new Date(session.createdAt) >= weekStart
      ).length,
      lastSessionDate: sessions.length > 0 
        ? new Date(Math.max(...sessions.map(s => new Date(s.updatedAt).getTime())))
        : null
    };
    
    localStorage.setItem(this.METRICS_KEY, JSON.stringify(metrics, this.dateReplacer));
  }

  static getMetrics(): SessionMetrics {
    try {
      const metricsData = localStorage.getItem(this.METRICS_KEY);
      if (!metricsData) {
        this.updateMetrics();
        return this.getMetrics();
      }
      
      return JSON.parse(metricsData, this.dateReviver);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      return {
        totalMessages: 0,
        averageResponseTime: 0,
        notesGenerated: 0,
        sessionsThisWeek: 0,
        lastSessionDate: null
      };
    }
  }

  private static calculateAverageResponseTime(sessions: Session[]): number {
    let totalTime = 0;
    let pairs = 0;
    
    sessions.forEach(session => {
      for (let i = 1; i < session.messages.length; i++) {
        const current = session.messages[i];
        const previous = session.messages[i - 1];
        
        if (current.sender !== previous.sender) {
          const timeDiff = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
          totalTime += timeDiff;
          pairs++;
        }
      }
    });
    
    return pairs > 0 ? totalTime / pairs : 0;
  }

  private static getSessionDuration(session: Session): string {
    if (session.messages.length < 2) return '0 minutes';
    
    const start = new Date(session.messages[0].timestamp);
    const end = new Date(session.messages[session.messages.length - 1].timestamp);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.round(durationMs / 60000);
    
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  // Utility functions for JSON serialization with Date objects
  private static dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  private static dateReviver(key: string, value: any): any {
    if (typeof value === 'object' && value !== null && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }

  // Cleanup and Maintenance
  static clearAllSessions(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.CURRENT_SESSION_KEY);
    localStorage.removeItem(this.METRICS_KEY);
    
    // Clear any pending timeouts
    this.autoNoteTimeouts.forEach(timeout => clearTimeout(timeout));
    this.autoNoteTimeouts.clear();
  }

  static cleanupOldSessions(olderThanDays: number = 30): number {
    const sessions = this.getAllSessions();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const activeSessions = sessions.filter(session => 
      new Date(session.updatedAt) >= cutoffDate
    );
    
    const removedCount = sessions.length - activeSessions.length;
    
    if (removedCount > 0) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(activeSessions, this.dateReplacer));
      this.updateMetrics();
    }
    
    return removedCount;
  }
}

// Alias for backward compatibility
export const SessionStorage = EnhancedSessionStorage;
```

## 5. Integration Examples and Usage Patterns

### Complete Session Implementation Example

```typescript
// Example: VoiceSessionInterface.tsx implementation using all utilities
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceService, ClaudeAPIHelper, EnhancedSessionStorage } from '@/lib/utilities';
import { VoiceInputService } from '@/lib/utilities';
import { Session, Message } from '@/types';

export default function VoiceSessionInterface() {
  const [session, setSession] = useState<Session | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const voiceService = useRef<VoiceService>();
  const voiceInput = useRef<VoiceInputService>();
  
  // Initialize services (FTherapy pattern)
  useEffect(() => {
    try {
      // Reset first to avoid stale references
      setSession(null);
      
      voiceService.current = new VoiceService(true); // Prefer ElevenLabs
      voiceInput.current = new VoiceInputService({
        language: 'en-US',
        continuous: true,
        interimResults: true
      });
      
      // Load or create session
      let currentSession = EnhancedSessionStorage.getCurrentSession();
      if (!currentSession) {
        currentSession = EnhancedSessionStorage.createNewSession();
      }
      setSession(currentSession);
      
      // Play introduction if new session
      if (currentSession.messages.length === 0) {
        playIntroduction();
      }
    } catch (error) {
      console.error('Error initializing session:', error);
    }
  }, []);

  const playIntroduction = useCallback(async () => {
    if (!voiceService.current) return;
    
    try {
      setIsSpeaking(true);
      const intro = `Hello! I'm Sanjay, your AI financial advisor. I'm here to help you build a healthier relationship with money. What would you like to talk about today?`;
      
      await voiceService.current.speak(intro, 'professional');
    } catch (error) {
      console.error('Introduction failed:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!voiceInput.current || !session) return;
    
    setCurrentTranscript('');
    
    await voiceInput.current.startListening(
      (transcript, isFinal) => {
        setCurrentTranscript(transcript);
        
        if (isFinal && transcript.trim()) {
          handleUserMessage(transcript.trim());
        }
      },
      (error) => {
        console.error('Voice input error:', error);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );
    
    setIsListening(true);
  }, [session]);

  const stopListening = useCallback(() => {
    if (voiceInput.current) {
      voiceInput.current.stopListening();
    }
    setIsListening(false);
  }, []);

  const handleUserMessage = useCallback(async (content: string) => {
    if (!session || !voiceService.current) return;
    
    try {
      // Add user message
      const userMessage: Message = {
        id: `msg_${Date.now()}_user`,
        content,
        sender: 'user',
        timestamp: new Date()
      };
      
      EnhancedSessionStorage.addMessage(session.id, userMessage);
      
      // Get AI response
      const updatedSession = EnhancedSessionStorage.getSession(session.id);
      if (!updatedSession) return;
      
      const response = await ClaudeAPIHelper.generateResponse(updatedSession.messages);
      
      // Add assistant message
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        content: response,
        sender: 'assistant',
        timestamp: new Date()
      };
      
      EnhancedSessionStorage.addMessage(session.id, assistantMessage);
      
      // Update local state
      const finalSession = EnhancedSessionStorage.getSession(session.id);
      if (finalSession) {
        setSession(finalSession);
      }
      
      // Speak the response
      setIsSpeaking(true);
      await voiceService.current.speak(response, 'professional');
      setIsSpeaking(false);
      
      // Auto-notes will be generated automatically by EnhancedSessionStorage
      
    } catch (error) {
      console.error('Error handling user message:', error);
      setIsSpeaking(false);
    }
  }, [session]);

  const interruptSpeech = useCallback(() => {
    if (voiceService.current) {
      voiceService.current.interruptAll();
      setIsSpeaking(false);
    }
  }, []);

  return (
    <div className="voice-session-interface">
      {/* Voice controls */}
      <div className="voice-controls">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isSpeaking}
          className={`voice-button ${isListening ? 'listening' : ''}`}
        >
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </button>
        
        {isSpeaking && (
          <button onClick={interruptSpeech} className="interrupt-button">
            Stop Speaking
          </button>
        )}
      </div>
      
      {/* Live transcript */}
      {currentTranscript && (
        <div className="live-transcript">
          <p>{currentTranscript}</p>
        </div>
      )}
      
      {/* Session display */}
      {session && (
        <SessionDisplay 
          session={session}
          onSessionUpdate={setSession}
        />
      )}
    </div>
  );
}
```

### Advanced Configuration Examples

```typescript
// Example: Custom voice service configuration
const customVoiceService = new VoiceService(false); // Use browser TTS as primary
customVoiceService.setPreferredService(true); // Switch to ElevenLabs

// Example: Custom Claude service for different conversation types
const therapyClaudeService = new EnhancedClaudeService({
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.8, // Higher creativity for therapy sessions
  systemPrompt: EnhancedClaudeService.SYSTEM_PROMPTS.financial_advisor
}, {
  maxNotes: 3,
  extractInsights: true,
  extractActions: false, // Focus on insights over actions
  extractRecommendations: true,
  extractQuestions: true
});

// Example: Session management patterns
class SessionManager {
  private static instance: SessionManager;
  
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async startNewSession(userName?: string): Promise<Session> {
    const session = EnhancedSessionStorage.createNewSession();
    
    // Generate personalized introduction
    const intro = await new EnhancedClaudeService().generateIntroduction(userName);
    
    const introMessage: Message = {
      id: `intro_${Date.now()}`,
      content: intro,
      sender: 'assistant',
      timestamp: new Date()
    };
    
    EnhancedSessionStorage.addMessage(session.id, introMessage);
    
    return EnhancedSessionStorage.getSession(session.id)!;
  }

  async endSession(sessionId: string): Promise<void> {
    const session = EnhancedSessionStorage.getSession(sessionId);
    if (!session) return;
    
    // Generate session summary
    await EnhancedSessionStorage.generateSessionSummary(sessionId);
    
    // Mark session as inactive
    session.isActive = false;
    EnhancedSessionStorage.saveSession(session);
  }

  exportSessionData(sessionId: string, format: 'txt' | 'json' | 'csv' = 'txt'): string {
    return EnhancedSessionStorage.exportSession(sessionId, {
      includeMessages: true,
      includeNotes: true,
      includeSummary: true,
      format
    });
  }
}
```

### Error Handling and Fallback Patterns

```typescript
// Example: Robust voice service with fallbacks
class RobustVoiceManager {
  private voiceService: VoiceService;
  private retryAttempts = 0;
  private maxRetries = 3;
  
  constructor() {
    this.voiceService = new VoiceService(true);
  }
  
  async speak(text: string, preset: 'professional' | 'casual' | 'storyteller' = 'professional'): Promise<void> {
    try {
      await this.voiceService.speak(text, preset);
      this.retryAttempts = 0; // Reset on success
    } catch (error) {
      console.error('Voice service error:', error);
      
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        console.log(`Retrying voice service (attempt ${this.retryAttempts}/${this.maxRetries})`);
        
        // Switch to browser TTS on retry
        this.voiceService.setPreferredService(false);
        await this.speak(text, preset);
      } else {
        throw new Error('Voice service failed after maximum retries');
      }
    }
  }
}

// Example: Session recovery patterns
class SessionRecoveryManager {
  static async recoverSession(): Promise<Session | null> {
    try {
      // Try to get current session
      let session = EnhancedSessionStorage.getCurrentSession();
      
      if (!session) {
        // Try to recover from most recent session
        const sessions = EnhancedSessionStorage.getAllSessions();
        session = sessions.find(s => s.isActive) || sessions[0] || null;
        
        if (session) {
          EnhancedSessionStorage.setCurrentSession(session.id);
          console.log('Recovered session:', session.id);
        }
      }
      
      return session;
    } catch (error) {
      console.error('Session recovery failed:', error);
      
      // Create new session as fallback
      return EnhancedSessionStorage.createNewSession('Recovered Session');
    }
  }
  
  static async cleanupCorruptedData(): Promise<void> {
    try {
      const sessions = EnhancedSessionStorage.getAllSessions();
      
      // Remove sessions with corrupted data
      const validSessions = sessions.filter(session => {
        try {
          return session.id && session.createdAt && Array.isArray(session.messages);
        } catch {
          return false;
        }
      });
      
      if (validSessions.length !== sessions.length) {
        localStorage.setItem(
          'financial_advisor_sessions', 
          JSON.stringify(validSessions)
        );
        console.log(`Cleaned up ${sessions.length - validSessions.length} corrupted sessions`);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      // Complete reset as last resort
      EnhancedSessionStorage.clearAllSessions();
    }
  }
}
```

### Performance Optimization Patterns

```typescript
// Example: Optimized component with memoization
import React, { memo, useMemo, useCallback } from 'react';

const OptimizedSessionDisplay = memo(({ session, onUpdate }: { 
  session: Session; 
  onUpdate: (session: Session) => void; 
}) => {
  // Memoize expensive calculations
  const sessionMetrics = useMemo(() => {
    return {
      messageCount: session.messages.length,
      noteCount: session.notes.length,
      duration: session.messages.length > 1 
        ? new Date(session.messages[session.messages.length - 1].timestamp).getTime() - 
          new Date(session.messages[0].timestamp).getTime()
        : 0
    };
  }, [session.messages, session.notes]);
  
  // Memoize handlers to prevent re-renders
  const handleAddNote = useCallback((noteData: Omit<SessionNote, 'id' | 'timestamp' | 'autoGenerated'>) => {
    EnhancedSessionStorage.addNote(session.id, noteData);
    const updatedSession = EnhancedSessionStorage.getSession(session.id);
    if (updatedSession) {
      onUpdate(updatedSession);
    }
  }, [session.id, onUpdate]);
  
  return (
    <div className="session-display">
      <SessionHeader metrics={sessionMetrics} />
      <MessageList messages={session.messages} />
      <NotesPanel notes={session.notes} onAddNote={handleAddNote} />
    </div>
  );
});
```

### Usage Best Practices

1. **Initialize services once**: Create voice and Claude services in useEffect with empty dependency arrays
2. **Use auto-notes wisely**: Enable for therapy sessions, consider disabling for quick consultations
3. **Handle errors gracefully**: Always provide fallbacks for voice and API failures
4. **Optimize storage**: Regularly cleanup old sessions and limit session history
5. **Memoize expensive operations**: Use React.memo and useMemo for session calculations
6. **Provide user feedback**: Show loading states, transcription status, and error messages
7. **Test voice features**: Voice APIs behave differently across browsers and devices
8. **Secure API keys**: Use environment variables and never expose keys in client code

These utilities provide a complete foundation for building voice-first AI counseling applications with automatic note-taking, session management, and robust error handling.
```

## 2. Voice Input Service (Web Speech API)

```typescript
export interface VoiceInputSettings {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export class VoiceInputService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private settings: VoiceInputSettings;

  constructor(settings: Partial<VoiceInputSettings> = {}) {
    this.settings = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      ...settings
    };
    
    this.initializeRecognition();
  }

  private initializeRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.settings.language;
    this.recognition.continuous = this.settings.continuous;
    this.recognition.interimResults = this.settings.interimResults;
    this.recognition.maxAlternatives = this.settings.maxAlternatives;
  }

  // Start listening with callbacks
  async startListening(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ): Promise<void> {
    if (!this.recognition) {
      onError('Speech recognition not available');
      return;
    }

    if (this.isListening) {
      onError('Already listening');
      return;
    }

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    this.recognition.onerror = (event: any) => {
      onError(`Speech recognition error: ${event.error}`);
      this.isListening = false;
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = finalTranscript || interimTranscript;
      const isFinal = !!finalTranscript;
      
      if (fullTranscript) {
        onTranscript(fullTranscript, isFinal);
      }
    };

    try {
      this.recognition.start();
    } catch (error) {
      onError(`Failed to start recording: ${error}`);
    }
  }

  // Stop listening
  stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Failed to stop recording:', error);
      }
    }
  }

  // Check if currently listening
  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  // Check if supported
  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  // Update settings
  updateSettings(newSettings: Partial<VoiceInputSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    if (this.recognition) {
      this.recognition.lang = this.settings.language;
      this.recognition.continuous = this.settings.continuous;
      this.recognition.interimResults = this.settings.interimResults;
      this.recognition.maxAlternatives = this.settings.maxAlternatives;
    }
  }
}
```