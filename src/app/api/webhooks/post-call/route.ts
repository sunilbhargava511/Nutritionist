import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getClaudeService } from '@/lib/claude-enhanced';

interface ElevenLabsPostCallData {
  conversation_id: string;
  agent_id: string;
  user_id?: string;
  call_duration: number;
  transcript: TranscriptEntry[];
  analysis?: {
    summary: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    key_topics: string[];
    action_items: string[];
  };
  metadata?: {
    start_time: string;
    end_time: string;
    call_type: 'inbound' | 'outbound';
    user_phone?: string;
    user_email?: string;
  };
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  duration?: number;
}

interface ConversationSession {
  id: string;
  conversationId: string;
  agentId: string;
  userId?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  transcript: TranscriptEntry[];
  analysis: {
    summary: string;
    sentiment: string;
    keyTopics: string[];
    actionItems: string[];
    insights: string[];
    recommendations: string[];
  };
  metadata: {
    callType: string;
    userPhone?: string;
    userEmail?: string;
    sessionRating?: number;
  };
  createdAt: Date;
}

function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('elevenlabs-signature');
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    console.warn('Missing webhook signature or secret');
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

async function generateEnhancedAnalysis(transcript: TranscriptEntry[]): Promise<any> {
  try {
    const claudeService = getClaudeService();
    
    // Create conversation text for analysis
    const conversationText = transcript
      .map(entry => `${entry.role === 'user' ? 'Client' : 'Sanjay'}: ${entry.content}`)
      .join('\n\n');
    
    // Generate financial advisory insights
    const analysisPrompt = `Analyze this financial advisory conversation and extract key insights:

${conversationText}

Provide a JSON response with:
1. insights: Array of key insights about the client's financial situation
2. recommendations: Specific action items Sanjay provided  
3. follow_up_questions: Important questions for next session
4. financial_topics: Main financial topics discussed
5. client_goals: Any financial goals mentioned
6. risk_assessment: Client's apparent risk tolerance and situation

Focus on actionable financial insights and practical next steps.`;

    const response = await claudeService.sendMessage([{
      id: 'analysis_request',
      content: analysisPrompt,
      sender: 'user',
      timestamp: new Date()
    }]);

    // Try to parse JSON response
    try {
      const analysisData = JSON.parse(response);
      return {
        insights: analysisData.insights || [],
        recommendations: analysisData.recommendations || [],
        followUpQuestions: analysisData.follow_up_questions || [],
        financialTopics: analysisData.financial_topics || [],
        clientGoals: analysisData.client_goals || [],
        riskAssessment: analysisData.risk_assessment || 'Unknown'
      };
    } catch (parseError) {
      console.warn('Failed to parse analysis JSON, using text response');
      return {
        insights: [response.substring(0, 500) + '...'],
        recommendations: [],
        followUpQuestions: [],
        financialTopics: [],
        clientGoals: [],
        riskAssessment: 'Unknown'
      };
    }
  } catch (error) {
    console.error('Enhanced analysis generation failed:', error);
    return {
      insights: ['Analysis generation failed'],
      recommendations: [],
      followUpQuestions: [],
      financialTopics: [],
      clientGoals: [],
      riskAssessment: 'Unknown'
    };
  }
}

function calculateSessionMetrics(session: ConversationSession) {
  const transcript = session.transcript;
  const userMessages = transcript.filter(t => t.role === 'user');
  const assistantMessages = transcript.filter(t => t.role === 'assistant');
  
  // Calculate average response time (mock calculation)
  const avgResponseTime = transcript.length > 1 ? 
    (transcript[transcript.length - 1].timestamp - transcript[0].timestamp) / transcript.length : 0;
  
  // Calculate engagement score based on conversation length and topics
  const engagementScore = Math.min(100, 
    (transcript.length * 5) + 
    (session.analysis.keyTopics.length * 10) + 
    (session.duration > 300 ? 20 : session.duration / 15) // Bonus for longer calls
  );
  
  return {
    totalMessages: transcript.length,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    averageResponseTime: Math.round(avgResponseTime),
    engagementScore: Math.round(engagementScore),
    conversationQuality: engagementScore > 70 ? 'High' : engagementScore > 40 ? 'Medium' : 'Low',
    topicsDiscussed: session.analysis.keyTopics.length,
    actionItemsGenerated: session.analysis.actionItems.length
  };
}

async function saveSessionToStorage(session: ConversationSession): Promise<void> {
  // In a real implementation, this would save to a database
  // For now, we'll use localStorage simulation via file system or database
  
  try {
    // This could be expanded to use a proper database like Supabase, MongoDB, etc.
    console.log('Session saved:', {
      id: session.id,
      duration: session.duration,
      messageCount: session.transcript.length,
      topics: session.analysis.keyTopics
    });
    
    // You could implement actual storage here:
    // await saveToDatabase(session);
    // or
    // await saveToSupabase(session);
    
  } catch (error) {
    console.error('Failed to save session to storage:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log('Received post-call webhook:', body.substring(0, 200) + '...');
    
    // Verify webhook signature for security in production
    if (process.env.NODE_ENV === 'production' && !verifyWebhookSignature(request, body)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }
    
    const postCallData: ElevenLabsPostCallData = JSON.parse(body);
    
    // Validate required fields
    if (!postCallData.conversation_id || !postCallData.transcript || !Array.isArray(postCallData.transcript)) {
      return NextResponse.json(
        { error: 'Missing required fields: conversation_id, transcript' },
        { status: 400 }
      );
    }
    
    // Generate enhanced analysis using Claude
    console.log('Generating enhanced analysis for conversation:', postCallData.conversation_id);
    const enhancedAnalysis = await generateEnhancedAnalysis(postCallData.transcript);
    
    // Create comprehensive session object
    const session: ConversationSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId: postCallData.conversation_id,
      agentId: postCallData.agent_id,
      userId: postCallData.user_id,
      startTime: postCallData.metadata?.start_time ? new Date(postCallData.metadata.start_time) : new Date(),
      endTime: postCallData.metadata?.end_time ? new Date(postCallData.metadata.end_time) : new Date(),
      duration: postCallData.call_duration,
      transcript: postCallData.transcript,
      analysis: {
        summary: postCallData.analysis?.summary || 'No summary available',
        sentiment: postCallData.analysis?.sentiment || 'neutral',
        keyTopics: [
          ...(postCallData.analysis?.key_topics || []),
          ...enhancedAnalysis.financialTopics
        ],
        actionItems: [
          ...(postCallData.analysis?.action_items || []),
          ...enhancedAnalysis.recommendations
        ],
        insights: enhancedAnalysis.insights,
        recommendations: enhancedAnalysis.recommendations
      },
      metadata: {
        callType: postCallData.metadata?.call_type || 'inbound',
        userPhone: postCallData.metadata?.user_phone,
        userEmail: postCallData.metadata?.user_email
      },
      createdAt: new Date()
    };
    
    // Calculate session metrics
    const metrics = calculateSessionMetrics(session);
    
    // Save session to storage
    await saveSessionToStorage(session);
    
    // Prepare response
    const response = {
      success: true,
      sessionId: session.id,
      conversationId: session.conversationId,
      processingTime: Date.now(),
      analysis: {
        ...session.analysis,
        enhancedInsights: enhancedAnalysis,
        metrics
      },
      nextSteps: [
        'Review action items with client',
        'Schedule follow-up if needed',
        'Update client financial profile',
        'Send summary email if requested'
      ],
      webhookProcessed: true
    };
    
    console.log(`Successfully processed conversation ${postCallData.conversation_id}`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Post-call webhook processing error:', error);
    
    const errorResponse = {
      success: false,
      error: 'Failed to process post-call data',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'ElevenLabs Post-Call Webhook Handler',
      description: 'Processes conversation transcripts and generates enhanced financial advisory insights',
      expectedPayload: {
        conversation_id: 'string (required)',
        agent_id: 'string (required)',
        user_id: 'string (optional)',
        call_duration: 'number (seconds)',
        transcript: 'array of transcript entries',
        analysis: 'optional ElevenLabs analysis',
        metadata: 'optional call metadata'
      },
      features: [
        'Enhanced AI analysis of financial conversations',
        'Action item extraction',
        'Financial insight generation',
        'Session metrics calculation',
        'Secure webhook signature verification'
      ]
    },
    { status: 200 }
  );
}