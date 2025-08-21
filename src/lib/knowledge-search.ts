import { Article } from '@/types';
import { db } from './database';
import * as schema from './database/schema';

export interface SearchResult {
  article: Article;
  relevanceScore: number;
  matchedFields: string[];
}

export interface KnowledgeSearchOptions {
  maxResults?: number;
  minRelevanceScore?: number;
  categoryFilter?: string;
}

export class KnowledgeSearchService {
  private articlesCache: Article[] | null = null;
  private cacheExpiry: number = 0;
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Articles will be loaded dynamically from database
  }

  /**
   * Load articles from knowledge base database
   */
  private async loadArticles(): Promise<Article[]> {
    // Check cache first
    if (this.articlesCache && Date.now() < this.cacheExpiry) {
      return this.articlesCache;
    }

    try {
      const knowledgeFiles = await db.select().from(schema.knowledgeBaseFiles);
      
      const articles: Article[] = knowledgeFiles.map(file => {
        // Parse the markdown content to extract metadata
        const article = this.parseMarkdownToArticle(file);
        return article;
      });

      // Update cache
      this.articlesCache = articles;
      this.cacheExpiry = Date.now() + this.cacheTimeout;

      return articles;
    } catch (error) {
      console.error('Error loading articles from knowledge base:', error);
      return [];
    }
  }

  /**
   * Parse knowledge base file into Article format
   */
  private parseMarkdownToArticle(file: any): Article {
    const content = file.content;
    const lines = content.split('\n');
    
    // Extract title (first # header)
    const titleLine = lines.find((line: string) => line.startsWith('# '));
    const title = titleLine ? titleLine.replace('# ', '') : file.filename.replace('.md', '');
    
    // Extract metadata
    let summary = '';
    let category = 'Financial Planning';
    let readTime = '5 min read';
    const tags: string[] = [];
    
    // Parse metadata section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('**Category:**')) {
        category = line.replace('**Category:**', '').trim();
      } else if (line.startsWith('**Read Time:**')) {
        readTime = line.replace('**Read Time:**', '').trim();
      } else if (line.startsWith('## Summary')) {
        // Extract summary from next few lines
        for (let j = i + 1; j < lines.length && !lines[j].startsWith('##'); j++) {
          if (lines[j].trim()) {
            summary += lines[j].trim() + ' ';
          }
        }
        summary = summary.trim();
      } else if (line.includes('#') && line.includes('_')) {
        // Extract tags (lines with hashtags)
        const lineTags = line.match(/#\w+(?:_\w+)*/g);
        if (lineTags) {
          tags.push(...lineTags.map((tag: string) => tag.replace('#', '').replace(/_/g, ' ')));
        }
      }
    }

    return {
      id: file.id,
      title,
      summary: summary || 'No summary available',
      content,
      category,
      tags: tags.length > 0 ? tags : ['financial planning'],
      readTime: readTime,
      author: 'Sanjay Bhargava',
      lastUpdated: new Date(file.uploadedAt)
    };
  }

  /**
   * Search articles using keyword matching and scoring
   */
  async searchArticles(query: string, options: KnowledgeSearchOptions = {}): Promise<SearchResult[]> {
    const {
      maxResults = 5,
      minRelevanceScore = 0.1,
      categoryFilter
    } = options;

    if (!query.trim()) return [];

    const articles = await this.loadArticles();
    const searchTerms = this.extractSearchTerms(query);
    const results: SearchResult[] = [];

    for (const article of articles) {
      // Apply category filter if specified
      if (categoryFilter && article.category !== categoryFilter) continue;

      const relevanceScore = this.calculateRelevanceScore(article, searchTerms);
      const matchedFields = this.findMatchedFields(article, searchTerms);

      if (relevanceScore >= minRelevanceScore) {
        results.push({
          article,
          relevanceScore,
          matchedFields
        });
      }
    }

    // Sort by relevance score (highest first)
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return results.slice(0, maxResults);
  }

  /**
   * Get articles by category
   */
  async getArticlesByCategory(category: string): Promise<Article[]> {
    const articles = await this.loadArticles();
    return articles.filter(article => 
      article.category.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: string): Promise<Article | null> {
    const articles = await this.loadArticles();
    return articles.find(article => article.id === id) || null;
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<string[]> {
    const articles = await this.loadArticles();
    return Array.from(new Set(articles.map(article => article.category))).sort();
  }

  /**
   * Find the most relevant articles for financial topics
   */
  async findRelevantArticles(userMessage: string, limit: number = 3): Promise<SearchResult[]> {
    // Enhanced search that looks for financial keywords and concepts
    const financialKeywords = this.extractFinancialKeywords(userMessage);
    
    if (financialKeywords.length === 0) {
      // If no specific keywords, do a general search
      return await this.searchArticles(userMessage, { maxResults: limit });
    }

    // Search with financial context
    return await this.searchArticles(financialKeywords.join(' '), { maxResults: limit });
  }

  /**
   * Clear the articles cache (useful when knowledge base is updated)
   */
  clearCache(): void {
    this.articlesCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Force reload of articles from database
   */
  async refreshArticles(): Promise<Article[]> {
    this.clearCache();
    return await this.loadArticles();
  }

  /**
   * Extract search terms from query
   */
  private extractSearchTerms(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(term => term.length > 2) // Remove very short words
      .filter(term => !this.isStopWord(term)); // Remove common stop words
  }

  /**
   * Extract financial-specific keywords from user message
   */
  private extractFinancialKeywords(message: string): string[] {
    const financialTerms = [
      // Investment terms
      'invest', 'investment', 'investing', 'portfolio', 'stocks', 'bonds', 'index fund', 'mutual fund',
      'etf', 'asset allocation', 'diversification', 'compound interest', 'dollar cost averaging',
      
      // Retirement terms  
      'retirement', 'retire', '401k', 'ira', 'roth', 'pension', 'social security', 'medicare',
      'withdrawal rate', 'nest egg', 'retirement planning',
      
      // Insurance terms
      'insurance', 'life insurance', 'disability', 'health insurance', 'coverage',
      
      // Debt terms
      'debt', 'mortgage', 'loan', 'credit card', 'refinance', 'pay off', 'interest rate',
      
      // Planning terms
      'budget', 'budgeting', 'emergency fund', 'savings', 'financial plan', 'estate planning',
      'will', 'beneficiary', 'nominee', 'heir', 'inheritance',
      
      // Goals and concerns
      'millionaire', 'wealth', 'financial security', 'anxiety', 'stress', 'peace of mind',
      'safe withdrawal', 'financial independence'
    ];

    const messageWords = message.toLowerCase().split(/\s+/);
    const foundTerms: string[] = [];

    for (const term of financialTerms) {
      if (message.toLowerCase().includes(term)) {
        foundTerms.push(term);
      }
    }

    // Also add any numbers (might be ages, amounts, etc.)
    const numbers = messageWords.filter(word => /^\d+$/.test(word));
    foundTerms.push(...numbers);

    return Array.from(new Set(foundTerms)); // Remove duplicates
  }

  /**
   * Calculate relevance score for an article based on search terms
   */
  private calculateRelevanceScore(article: Article, searchTerms: string[]): number {
    let score = 0;
    const weights = {
      title: 3.0,
      summary: 2.0,
      tags: 2.5,
      content: 1.0,
      category: 1.5
    };

    for (const term of searchTerms) {
      // Title matches (highest weight)
      if (article.title.toLowerCase().includes(term)) {
        score += weights.title;
      }

      // Summary matches
      if (article.summary.toLowerCase().includes(term)) {
        score += weights.summary;
      }

      // Tag matches
      for (const tag of article.tags) {
        if (tag.toLowerCase().includes(term)) {
          score += weights.tags;
        }
      }

      // Category match
      if (article.category.toLowerCase().includes(term)) {
        score += weights.category;
      }

      // Content matches (lower weight but multiple matches possible)
      const contentMatches = (article.content.toLowerCase().match(new RegExp(term, 'g')) || []).length;
      score += contentMatches * weights.content;
    }

    // Normalize score by number of search terms and article length
    const normalizedScore = score / (searchTerms.length * Math.log(article.content.length / 100 + 1));
    
    return Math.min(normalizedScore, 1.0); // Cap at 1.0
  }

  /**
   * Find which fields matched the search terms
   */
  private findMatchedFields(article: Article, searchTerms: string[]): string[] {
    const matchedFields: string[] = [];

    for (const term of searchTerms) {
      if (article.title.toLowerCase().includes(term)) {
        matchedFields.push('title');
      }
      if (article.summary.toLowerCase().includes(term)) {
        matchedFields.push('summary');
      }
      if (article.content.toLowerCase().includes(term)) {
        matchedFields.push('content');
      }
      if (article.tags.some(tag => tag.toLowerCase().includes(term))) {
        matchedFields.push('tags');
      }
      if (article.category.toLowerCase().includes(term)) {
        matchedFields.push('category');
      }
    }

    return Array.from(new Set(matchedFields)); // Remove duplicates
  }

  /**
   * Check if a word is a common stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
      'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
    ]);
    return stopWords.has(word);
  }

  /**
   * Generate a summary of search results for AI context
   */
  generateContextSummary(results: SearchResult[]): string {
    if (results.length === 0) return '';

    let summary = `I have access to ${results.length} relevant article(s) from Sanjay's knowledge base:\n\n`;

    for (const result of results) {
      const { article } = result;
      summary += `**${article.title}** (${article.category})\n`;
      summary += `${article.summary}\n`;
      
      // Include key excerpts from content
      const excerpts = this.extractKeyExcerpts(article.content);
      if (excerpts.length > 0) {
        summary += `Key points: ${excerpts.join('; ')}\n`;
      }
      
      summary += `Tags: ${article.tags.join(', ')}\n\n`;
    }

    return summary;
  }

  /**
   * Extract key excerpts from article content
   */
  private extractKeyExcerpts(content: string, maxExcerpts: number = 3): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
    const excerpts: string[] = [];

    // Look for sentences with key indicators
    const keyIndicators = [
      'I recommend', 'The key is', 'Remember:', 'Strategy:', 'Example:', 'Rule:', 'Framework:'
    ];

    for (const indicator of keyIndicators) {
      const foundSentence = sentences.find(s => s.includes(indicator));
      if (foundSentence && excerpts.length < maxExcerpts) {
        excerpts.push(foundSentence.trim());
      }
    }

    // If we don't have enough, add first few sentences
    while (excerpts.length < maxExcerpts && excerpts.length < sentences.length) {
      const sentence = sentences[excerpts.length];
      if (!excerpts.includes(sentence.trim())) {
        excerpts.push(sentence.trim());
      }
    }

    return excerpts;
  }
}

// Singleton instance
export const knowledgeSearch = new KnowledgeSearchService();