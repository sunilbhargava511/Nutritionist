import { Message, Article } from '@/types';
import { debugSessionManager, LLMDebugEntry } from './debug-session-manager';
import { adminService } from './admin-service';

interface LLMRequestData {
  systemPrompt: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  model: string;
  knowledgeContext?: string;
  otherParameters?: Record<string, any>;
}

interface LLMResponseData {
  content: string;
  usage?: { tokens: number };
  citedArticles?: Article[];
  processingTime: number;
}

export class DebugLLMServiceServer {
  private static instance: DebugLLMServiceServer;
  private isEnabled: boolean = false;
  private enabledCache: boolean | null = null;
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds cache

  private constructor() {
    // Initialize and load settings from database
    this.loadDebugSettings();
  }

  static getInstance(): DebugLLMServiceServer {
    if (!DebugLLMServiceServer.instance) {
      DebugLLMServiceServer.instance = new DebugLLMServiceServer();
    }
    return DebugLLMServiceServer.instance;
  }

  // Load debug settings from database (server-side only)
  private async loadDebugSettings(): Promise<void> {
    try {
      const settings = await adminService.getAdminSettings();
      const newIsEnabled = settings?.debugLlmEnabled || false;
      
      if (this.isEnabled !== newIsEnabled) {
        this.isEnabled = newIsEnabled;
        console.log(`[Debug LLM Server] Service ${newIsEnabled ? 'enabled' : 'disabled'} via database setting`);
      }
      
      // Update cache
      this.enabledCache = newIsEnabled;
      this.lastCacheUpdate = Date.now();
    } catch (error) {
      console.error('[Debug LLM Server] Failed to load settings from database:', error);
      // Fall back to development mode
      this.isEnabled = process.env.NODE_ENV === 'development';
    }
  }

  // Check if debug capture is enabled (with caching)
  async isDebugEnabled(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached value if fresh
    if (this.enabledCache !== null && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return this.enabledCache;
    }
    
    // Reload from database
    await this.loadDebugSettings();
    return this.isEnabled;
  }

  // Synchronous version for backward compatibility (uses cached value)
  isDebugEnabledSync(): boolean {
    return this.isEnabled;
  }

  // Enable/disable debug capture
  setDebugEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`[Debug LLM Server] Service ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Start tracking an LLM request
  startRequest(
    type: 'claude' | 'knowledge-search' | 'rag',
    requestData: LLMRequestData
  ): string {
    if (!this.isDebugEnabledSync()) return '';

    const entryId = `debug_entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const debugEntry: LLMDebugEntry = {
      id: entryId,
      timestamp: new Date(),
      sessionId: '', // Will be set by session manager
      type,
      request: { ...requestData },
      response: {
        content: '',
        processingTime: 0
      },
      status: 'pending'
    };

    // Add to current session
    debugSessionManager.addEntryToCurrentSession(debugEntry);
    
    console.log(`[Debug LLM Server] Started tracking ${type} request: ${entryId}`);
    return entryId;
  }

  // Complete tracking an LLM request with success
  completeRequest(
    entryId: string,
    responseData: LLMResponseData
  ): void {
    if (!this.isDebugEnabledSync() || !entryId) return;

    const currentSession = debugSessionManager.getCurrentSession();
    if (!currentSession) return;

    const entry = currentSession.entries.find(e => e.id === entryId);
    if (!entry) {
      console.warn(`[Debug LLM Server] Entry not found: ${entryId}`);
      return;
    }

    // Update entry with response data
    entry.response = { ...responseData };
    entry.status = 'success';
    
    console.log(`[Debug LLM Server] Completed request: ${entryId} (${responseData.processingTime}ms)`);
  }

  // Mark request as failed
  failRequest(
    entryId: string,
    error: string,
    processingTime: number = 0
  ): void {
    if (!this.isDebugEnabledSync() || !entryId) return;

    const currentSession = debugSessionManager.getCurrentSession();
    if (!currentSession) return;

    const entry = currentSession.entries.find(e => e.id === entryId);
    if (!entry) {
      console.warn(`[Debug LLM Server] Entry not found: ${entryId}`);
      return;
    }

    // Update entry with error
    entry.response.processingTime = processingTime;
    entry.status = 'error';
    entry.error = error;
    
    console.log(`[Debug LLM Server] Failed request: ${entryId} - ${error}`);
  }

  // Helper method to capture Claude API calls
  captureClaudeRequest(
    messages: Message[],
    systemPrompt: string,
    model: string = 'claude-3-5-sonnet-20241022',
    temperature?: number,
    maxTokens?: number,
    knowledgeContext?: string,
    otherParameters?: Record<string, any>
  ): string {
    const type = knowledgeContext ? 'rag' : 'claude';
    
    return this.startRequest(type, {
      systemPrompt,
      messages,
      temperature,
      maxTokens,
      model,
      knowledgeContext,
      otherParameters
    });
  }

  // Helper method to capture knowledge search
  captureKnowledgeSearch(
    searchQuery: string,
    foundArticles: Article[],
    processingTime: number
  ): void {
    if (!this.isDebugEnabledSync()) return;

    const entryId = this.startRequest('knowledge-search', {
      systemPrompt: `Knowledge search for: "${searchQuery}"`,
      messages: [],
      model: 'knowledge-base-search',
      knowledgeContext: `Found ${foundArticles.length} articles`
    });

    this.completeRequest(entryId, {
      content: `Found ${foundArticles.length} relevant articles`,
      citedArticles: foundArticles,
      processingTime
    });
  }

  // Get recent debug entries (for real-time display)
  getRecentEntries(limit: number = 20): LLMDebugEntry[] {
    const currentSession = debugSessionManager.getCurrentSession();
    if (!currentSession) return [];

    return currentSession.entries
      .slice(-limit)
      .reverse(); // Most recent first
  }

  // Get all entries for current session
  getCurrentSessionEntries(): LLMDebugEntry[] {
    const currentSession = debugSessionManager.getCurrentSession();
    if (!currentSession) return [];

    return [...currentSession.entries].reverse(); // Most recent first
  }

  // Get debug statistics
  getDebugStats(): {
    isEnabled: boolean;
    currentSessionId: string | null;
    totalSessions: number;
    currentSessionEntries: number;
  } {
    const currentSession = debugSessionManager.getCurrentSession();
    return {
      isEnabled: this.isDebugEnabledSync(),
      currentSessionId: currentSession?.id || null,
      totalSessions: debugSessionManager.getAllSessions().length,
      currentSessionEntries: currentSession?.entries.length || 0
    };
  }

  // Clear debug data
  clearDebugData(): void {
    debugSessionManager.clearAllSessions();
    console.log('[Debug LLM Server] Cleared all debug data');
  }
}

// Singleton instance for server-side use
export const debugLLMServiceServer = DebugLLMServiceServer.getInstance();