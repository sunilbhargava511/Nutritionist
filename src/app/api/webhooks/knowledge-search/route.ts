import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { KnowledgeSearchService } from '@/lib/knowledge-search';

interface KnowledgeSearchRequest {
  query: string;
  category?: string;
  maxResults?: number;
  includeContent?: boolean;
}

function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('elevenlabs-signature');
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function formatSearchResults(results: any[], includeContent: boolean = false) {
  return results.map(result => ({
    title: result.article.title,
    category: result.article.category,
    relevanceScore: Math.round(result.relevanceScore * 100),
    summary: result.article.summary || result.article.description || 'No summary available',
    keyTopics: result.article.keyTopics || [],
    matchedFields: result.matchedFields,
    ...(includeContent && {
      content: result.article.content?.substring(0, 1000) + (result.article.content?.length > 1000 ? '...' : '') || 'Content not available'
    })
  }));
}

function generateSearchSummary(query: string, results: any[]): string {
  if (results.length === 0) {
    return `No relevant information found for "${query}". You may want to ask about general financial planning, investment strategies, or retirement planning topics.`;
  }

  const topResult = results[0];
  const relevantTopics = results.slice(0, 3).flatMap(r => r.article.keyTopics || []);
  const uniqueTopics = [...new Set(relevantTopics)];

  let summary = `Found ${results.length} relevant article${results.length > 1 ? 's' : ''} for "${query}". `;
  summary += `Top match: "${topResult.article.title}" with ${Math.round(topResult.relevanceScore * 100)}% relevance. `;
  
  if (uniqueTopics.length > 0) {
    summary += `Related topics include: ${uniqueTopics.slice(0, 5).join(', ')}.`;
  }

  return summary;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Verify webhook signature for security
    if (process.env.NODE_ENV === 'production' && !verifyWebhookSignature(request, body)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }
    
    const { query, category, maxResults = 5, includeContent = false }: KnowledgeSearchRequest = JSON.parse(body);
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    // Initialize knowledge search service
    const knowledgeSearch = new KnowledgeSearchService();
    
    // Perform search
    const searchResults = await knowledgeSearch.searchArticles(query, {
      maxResults,
      minRelevanceScore: 0.1,
      categoryFilter: category
    });
    
    // Format results for conversational AI
    const formattedResults = formatSearchResults(searchResults, includeContent);
    const searchSummary = generateSearchSummary(query, searchResults);
    
    // Generate contextual advice based on search results
    let contextualAdvice = '';
    if (searchResults.length > 0) {
      const topCategories = searchResults.slice(0, 3).map(r => r.article.category);
      const uniqueCategories = [...new Set(topCategories)];
      
      if (uniqueCategories.includes('retirement')) {
        contextualAdvice = 'Based on retirement planning resources, consider your timeline, risk tolerance, and savings rate.';
      } else if (uniqueCategories.includes('investment')) {
        contextualAdvice = 'From investment guidance, focus on diversification, cost management, and long-term perspective.';
      } else if (uniqueCategories.includes('planning')) {
        contextualAdvice = 'Financial planning principles suggest starting with clear goals and systematic approaches.';
      } else {
        contextualAdvice = 'Consider reviewing the full playbook for comprehensive financial strategies.';
      }
    }
    
    const response = {
      query,
      summary: searchSummary,
      totalResults: searchResults.length,
      results: formattedResults,
      contextualAdvice,
      suggestions: generateSearchSuggestions(query, searchResults),
      availableCategories: ['retirement', 'investment', 'planning', 'risk management', 'tax strategy'],
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Knowledge search webhook error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to search knowledge base',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateSearchSuggestions(originalQuery: string, results: any[]): string[] {
  const suggestions: string[] = [];
  
  // If no results, suggest broader topics
  if (results.length === 0) {
    return [
      'retirement planning strategies',
      'investment portfolio basics',
      'financial goal setting',
      'risk management approaches'
    ];
  }
  
  // Generate suggestions based on search results
  const allTopics = results.flatMap(r => r.article.keyTopics || []);
  const uniqueTopics = [...new Set(allTopics)];
  
  // Add related topic suggestions
  uniqueTopics.slice(0, 3).forEach(topic => {
    if (!originalQuery.toLowerCase().includes(topic.toLowerCase())) {
      suggestions.push(topic);
    }
  });
  
  // Add category-based suggestions
  const categories = [...new Set(results.map(r => r.article.category))];
  categories.forEach(category => {
    if (category !== 'general') {
      suggestions.push(`${category} best practices`);
    }
  });
  
  return suggestions.slice(0, 4);
}

export async function GET() {
  const knowledgeSearch = new KnowledgeSearchService();
  
  // Get sample search to show available content
  const sampleResults = await knowledgeSearch.searchArticles('investment', { maxResults: 3 });
  
  return NextResponse.json(
    { 
      message: 'Knowledge Search Webhook',
      description: 'Search the Senior Investor\'s Playbook and financial knowledge base',
      parameters: [
        'query (required): search terms',
        'category (optional): filter by category',
        'maxResults (optional): limit number of results',
        'includeContent (optional): include article content'
      ],
      availableCategories: ['retirement', 'investment', 'planning', 'risk management', 'tax strategy'],
      sampleSearch: {
        query: 'investment',
        results: sampleResults.length,
        topResult: sampleResults[0]?.article.title || 'No results'
      },
      totalArticles: 3, // Update based on actual article count
      features: [
        'Semantic search across financial knowledge base',
        'Relevance scoring and ranking',
        'Category filtering',
        'Contextual advice generation',
        'Related topic suggestions'
      ]
    },
    { status: 200 }
  );
}