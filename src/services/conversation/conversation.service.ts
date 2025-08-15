import Anthropic from '@anthropic-ai/sdk';
import { ElevenLabsService } from './elevenlabs.service';
import { User, Conversation, Lesson, PatientProfile } from '../../models';
import { EventEmitter } from 'events';

export interface ConversationConfig {
  anthropicApiKey: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
}

export interface ConversationContext {
  userId: string;
  nutritionistId: string;
  conversationId?: string;
  mode: 'free-form' | 'structured';
  lessonId?: string;
  currentChunkIndex?: number;
  patientProfile?: PatientProfile;
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
}

export class ConversationService extends EventEmitter {
  private anthropic: Anthropic;
  private elevenLabs: ElevenLabsService;
  private activeConversations: Map<string, ConversationContext>;

  constructor(config: ConversationConfig) {
    super();
    this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    this.elevenLabs = new ElevenLabsService({
      apiKey: config.elevenLabsApiKey,
      voiceId: config.elevenLabsVoiceId,
    });
    this.activeConversations = new Map();
  }

  async startConversation(
    userId: string,
    nutritionistId: string,
    mode: 'free-form' | 'structured' = 'free-form',
    lessonId?: string
  ): Promise<string> {
    const user = await User.findByPk(userId, {
      include: [{ model: PatientProfile, as: 'profile' }],
    });

    if (!user) {
      throw new Error('User not found');
    }

    const nutritionist = await User.findByPk(nutritionistId);
    if (!nutritionist || nutritionist.role !== 'nutritionist') {
      throw new Error('Nutritionist not found');
    }

    const conversation = await Conversation.create({
      patientId: userId,
      nutritionistId,
      mode,
      lessonId,
      startTime: new Date(),
      transcript: [],
      status: 'active',
    });

    const context: ConversationContext = {
      userId,
      nutritionistId,
      conversationId: conversation.id,
      mode,
      lessonId,
      currentChunkIndex: 0,
      patientProfile: user.profile,
      conversationHistory: [],
    };

    if (mode === 'structured' && lessonId) {
      const lesson = await Lesson.findByPk(lessonId);
      if (!lesson) {
        throw new Error('Lesson not found');
      }
      context.conversationHistory.push({
        role: 'system',
        content: await this.generateLessonSystemPrompt(lesson, nutritionist),
        timestamp: new Date(),
      });
    } else {
      context.conversationHistory.push({
        role: 'system',
        content: await this.generateFreeFormSystemPrompt(nutritionist, user.profile),
        timestamp: new Date(),
      });
    }

    this.activeConversations.set(conversation.id, context);
    return conversation.id;
  }

  async processMessage(
    conversationId: string,
    message: string,
    audioInput?: Buffer
  ): Promise<{
    text: string;
    audio: Buffer;
    metadata?: any;
  }> {
    const context = this.activeConversations.get(conversationId);
    if (!context) {
      throw new Error('Conversation not found or expired');
    }

    // Add user message to history
    context.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // Generate AI response using Claude
    const messages = context.conversationHistory
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const systemMessage = context.conversationHistory.find(msg => msg.role === 'system')?.content || 
      `You are a helpful nutritionist assistant. Provide personalized nutrition advice and support.`;

    const completion = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.7,
      system: systemMessage,
      messages: messages,
    });

    const aiResponse = completion.content[0].type === 'text' ? completion.content[0].text : '';

    // Add AI response to history
    context.conversationHistory.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    });

    // Convert response to speech
    const audioResponse = await this.elevenLabs.textToSpeech(aiResponse);

    // Update conversation in database
    await this.updateConversationTranscript(conversationId, message, aiResponse);

    // Extract insights if applicable
    if (context.mode === 'free-form') {
      this.extractPatientInsights(context, message);
    }

    return {
      text: aiResponse,
      audio: audioResponse,
      metadata: {
        mode: context.mode,
        lessonId: context.lessonId,
        currentChunkIndex: context.currentChunkIndex,
      },
    };
  }

  async processStructuredLesson(
    conversationId: string,
    action: 'next' | 'previous' | 'question'
  ): Promise<{
    text: string;
    audio: Buffer;
    metadata?: any;
  }> {
    const context = this.activeConversations.get(conversationId);
    if (!context || context.mode !== 'structured' || !context.lessonId) {
      throw new Error('Invalid structured conversation');
    }

    const lesson = await Lesson.findByPk(context.lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    let responseText = '';
    const chunks = lesson.content as any[];

    switch (action) {
      case 'next':
        if (context.currentChunkIndex! < chunks.length - 1) {
          context.currentChunkIndex!++;
          responseText = chunks[context.currentChunkIndex!].content;
        } else {
          responseText = "You've completed this lesson! Would you like to review any part or ask questions?";
        }
        break;

      case 'previous':
        if (context.currentChunkIndex! > 0) {
          context.currentChunkIndex!--;
          responseText = chunks[context.currentChunkIndex!].content;
        } else {
          responseText = "You're at the beginning of the lesson.";
        }
        break;

      case 'question':
        responseText = "Please ask your question about this lesson content.";
        break;
    }

    const audioResponse = await this.elevenLabs.textToSpeech(responseText);

    return {
      text: responseText,
      audio: audioResponse,
      metadata: {
        currentChunk: context.currentChunkIndex,
        totalChunks: chunks.length,
        lessonProgress: ((context.currentChunkIndex! + 1) / chunks.length) * 100,
      },
    };
  }

  async endConversation(conversationId: string): Promise<void> {
    const context = this.activeConversations.get(conversationId);
    if (!context) {
      return;
    }

    const conversation = await Conversation.findByPk(conversationId);
    if (conversation) {
      const endTime = new Date();
      const durationMinutes = (endTime.getTime() - conversation.startTime.getTime()) / 60000;

      // Generate conversation summary
      const summary = await this.generateConversationSummary(context);

      await conversation.update({
        endTime,
        durationMinutes,
        status: 'completed',
        summary: summary.summary,
        actionItems: summary.actionItems,
        topics: summary.topics,
      });

      // Update user's conversation minutes
      const user = await User.findByPk(context.userId);
      if (user) {
        await user.update({
          conversationMinutesUsed: user.conversationMinutesUsed + durationMinutes,
        });
      }
    }

    this.activeConversations.delete(conversationId);
  }

  private async generateLessonSystemPrompt(lesson: Lesson, nutritionist: User): Promise<string> {
    return `You are ${nutritionist.name}, a professional nutritionist delivering a structured lesson.
    
    Lesson Title: ${lesson.title}
    Lesson Description: ${lesson.description || 'N/A'}
    
    Guidelines:
    1. Deliver the lesson content in a clear, engaging manner
    2. Encourage questions at designated Q&A periods
    3. Stay on topic but be responsive to relevant questions
    4. Use simple, accessible language
    5. Provide practical examples when possible
    6. Maintain a supportive and encouraging tone
    
    Remember to:
    - Pace the content appropriately
    - Check for understanding
    - Offer to repeat or clarify as needed`;
  }

  private async generateFreeFormSystemPrompt(nutritionist: User, profile?: PatientProfile): Promise<string> {
    let prompt = `You are ${nutritionist.name}, a professional nutritionist having a consultation with your patient.
    
    Your approach:
    1. Be warm, supportive, and non-judgmental
    2. Provide evidence-based nutrition advice
    3. Consider the patient's individual needs and preferences
    4. Offer practical, actionable recommendations
    5. Encourage questions and provide clear explanations`;

    if (profile) {
      prompt += `\n\nPatient Profile:
      - Allergies: ${profile.allergies.join(', ') || 'None'}
      - Dietary Restrictions: ${profile.dietaryRestrictions.join(', ') || 'None'}
      - Health Conditions: ${profile.healthConditions.join(', ') || 'None'}
      - Goals: ${profile.goals.join(', ') || 'None'}`;
    }

    return prompt;
  }

  private async updateConversationTranscript(
    conversationId: string,
    userMessage: string,
    aiResponse: string
  ): Promise<void> {
    const conversation = await Conversation.findByPk(conversationId);
    if (conversation) {
      const transcript = conversation.transcript as any[];
      transcript.push({
        timestamp: new Date(),
        speaker: 'user',
        content: userMessage,
      });
      transcript.push({
        timestamp: new Date(),
        speaker: 'assistant',
        content: aiResponse,
      });
      await conversation.update({ transcript });
    }
  }

  private async extractPatientInsights(context: ConversationContext, message: string): Promise<void> {
    // Extract dietary preferences, allergies, etc. from conversation
    const insightPrompt = `Analyze this message for nutrition-related information:
    "${message}"
    
    Extract any mentions of:
    - Food allergies or intolerances
    - Dietary preferences or restrictions
    - Health conditions
    - Lifestyle factors
    - Goals or objectives
    
    Return as JSON with categories: allergies, restrictions, conditions, preferences, goals`;

    try {
      const completion = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.3,
        system: insightPrompt + '\n\nPlease respond with valid JSON only.',
        messages: [{ role: 'user', content: 'Generate insights from the conversation.' }],
      });

      const responseText = completion.content[0].type === 'text' ? completion.content[0].text : '{}';
      const insights = JSON.parse(responseText);
      
      if (context.patientProfile && Object.keys(insights).length > 0) {
        // Update patient profile with new insights
        await this.updatePatientProfile(context.userId, insights);
      }
    } catch (error) {
      console.error('Error extracting insights:', error);
    }
  }

  private async updatePatientProfile(userId: string, insights: any): Promise<void> {
    const profile = await PatientProfile.findOne({ where: { userId } });
    if (profile) {
      const updates: any = {};
      
      if (insights.allergies?.length > 0) {
        updates.allergies = [...new Set([...profile.allergies, ...insights.allergies])];
      }
      
      if (insights.restrictions?.length > 0) {
        updates.dietaryRestrictions = [...new Set([...profile.dietaryRestrictions, ...insights.restrictions])];
      }
      
      if (insights.conditions?.length > 0) {
        updates.healthConditions = [...new Set([...profile.healthConditions, ...insights.conditions])];
      }
      
      if (insights.goals?.length > 0) {
        updates.goals = [...new Set([...profile.goals, ...insights.goals])];
      }
      
      if (Object.keys(updates).length > 0) {
        updates.lastUpdated = new Date();
        await profile.update(updates);
      }
    }
  }

  private async generateConversationSummary(context: ConversationContext): Promise<{
    summary: string;
    actionItems: string[];
    topics: string[];
  }> {
    const summaryPrompt = `Analyze this nutrition consultation conversation and provide:
    1. A concise summary (2-3 sentences)
    2. Key action items for the patient
    3. Main topics discussed
    
    Conversation:
    ${context.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;

    try {
      const completion = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.3,
        system: summaryPrompt + '\n\nPlease respond with valid JSON only.',
        messages: [{ role: 'user', content: 'Generate a summary of the conversation.' }],
      });

      const responseText = completion.content[0].type === 'text' ? completion.content[0].text : '{"summary":"","actionItems":[],"topics":[]}';
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Error generating summary:', error);
      return {
        summary: 'Conversation completed',
        actionItems: [],
        topics: [],
      };
    }
  }

  async checkConversationLimit(userId: string): Promise<boolean> {
    const user = await User.findByPk(userId);
    if (!user) return false;
    
    return user.conversationMinutesUsed < user.maxFreeMinutes;
  }
}

export default ConversationService;