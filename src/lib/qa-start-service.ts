import { getClaudeService } from './claude-enhanced';
import { sessionTranscriptService } from './session-transcript-service';
import { lessonService } from './lesson-service';
import { db } from './database';
import * as schema from './database/schema';
import { eq, and } from 'drizzle-orm';

export class QAStartService {
  // Generate Q&A start message for lesson transition
  async generateQAStartMessage(sessionId: string, lessonId: string): Promise<string> {
    try {
      // Get session and lesson details
      const session = await sessionTranscriptService.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const lesson = await lessonService.getLesson(lessonId);
      if (!lesson) {
        throw new Error('Lesson not found');
      }

      // Get complete transcript including lesson intro and video completion
      const completeTranscript = await sessionTranscriptService.getCompleteTranscript(sessionId);

      // Get prompts
      const generalPrompt = await this.getGeneralPrompt();
      const lessonPrompt = await this.getLessonSpecificPrompt(lessonId);

      // Build Q&A start generation prompt
      const qaStartPrompt = this.buildQAStartPrompt(
        generalPrompt,
        lessonPrompt,
        lesson,
        completeTranscript
      );

      // Generate Q&A start message using Claude
      const claudeService = getClaudeService();
      
      // Create temporary message array for LLM call
      const tempMessages = [{
        id: 'qa_start_generation',
        content: 'Generate the Q&A starting message',
        type: 'user' as const,
        timestamp: new Date()
      }];

      const qaStartMessage = await claudeService.sendMessage(tempMessages, qaStartPrompt);

      // Store the generated Q&A start message in transcript
      await sessionTranscriptService.addMessage(sessionId, {
        messageType: 'llm_qa_start',
        content: qaStartMessage,
        speaker: 'assistant',
        lessonContextId: lessonId,
        metadata: {
          messageSource: 'llm_generated',
          lessonId,
          phase: 'qa_start',
          generatedAt: new Date().toISOString()
        }
      });

      return qaStartMessage;

    } catch (error) {
      console.error('Failed to generate Q&A start message:', error);
      
      // Fallback message if generation fails
      const fallbackMessage = `Great job completing the lesson! I'd love to discuss what you learned. What questions do you have about the concepts we just covered?`;
      
      // Store fallback message
      await sessionTranscriptService.addMessage(sessionId, {
        messageType: 'llm_qa_start',
        content: fallbackMessage,
        speaker: 'assistant',
        lessonContextId: lessonId,
        metadata: {
          messageSource: 'fallback',
          lessonId,
          phase: 'qa_start',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      return fallbackMessage;
    }
  }

  // Build comprehensive Q&A start prompt
  private buildQAStartPrompt(
    generalPrompt: string,
    lessonPrompt: string,
    lesson: any,
    transcript: any[]
  ): string {
    const transcriptText = sessionTranscriptService.formatTranscriptForLLM(transcript);

    return `${generalPrompt}

LESSON-SPECIFIC CONTEXT:
${lessonPrompt}

LESSON DETAILS:
- Title: ${lesson.title}
- Video Summary: ${lesson.videoSummary}

TASK: Generate the FIRST Q&A message after the user completed the lesson video.

COMPLETE SESSION TRANSCRIPT:
${transcriptText}

Generate a warm, engaging message (50-100 words) that:
1. Acknowledges video completion with enthusiasm
2. References specific lesson concepts from the video summary
3. Asks an engaging, open-ended question to start discussion
4. Maintains your conversational, supportive tone as Sanjay
5. Creates excitement for the discussion ahead

This message will be spoken via TTS to start the Q&A conversation. Make it sound natural when spoken aloud.

Focus on connecting the video content to practical application and encouraging the user to share their thoughts or questions.`;
  }

  // Get general prompt from database
  private async getGeneralPrompt(): Promise<string> {
    try {
      const generalPrompts = await db
        .select()
        .from(schema.systemPrompts)
        .where(
          and(
            eq(schema.systemPrompts.type, 'qa'),
            eq(schema.systemPrompts.active, true)
          )
        )
        .limit(1);
      
      if (generalPrompts.length > 0) {
        return generalPrompts[0].content;
      }
      
      // Fallback prompt if none found in database
      return `You are Sanjay, a warm, empathetic AI financial advisor who specializes in helping people develop healthy relationships with money. 

Your approach:
- Listen actively and ask thoughtful follow-up questions
- Provide practical, actionable advice
- Help clients identify emotional patterns around money
- Offer personalized strategies for financial wellness
- Maintain a supportive, non-judgmental tone
- Focus on behavioral change and sustainable habits

Keep responses conversational, warm, and focused on the human experience of financial decision-making.`;
      
    } catch (error) {
      console.error('Error fetching general prompt:', error);
      // Hard-coded fallback
      return `You are Sanjay, a friendly AI financial advisor. Help the user with their financial questions and provide practical, actionable advice.`;
    }
  }

  // Get lesson-specific prompt from database
  private async getLessonSpecificPrompt(lessonId: string): Promise<string> {
    try {
      const lessonPrompts = await db
        .select()
        .from(schema.systemPrompts)
        .where(
          and(
            eq(schema.systemPrompts.type, 'lesson_qa'),
            eq(schema.systemPrompts.lessonId, lessonId),
            eq(schema.systemPrompts.active, true)
          )
        )
        .limit(1);
      
      if (lessonPrompts.length > 0) {
        return lessonPrompts[0].content;
      }
      
      // If no lesson-specific prompt, return generic lesson guidance
      return `You are conducting a Q&A session after the user has completed a financial education lesson. Focus on:
- Helping them understand and apply the lesson concepts
- Encouraging questions about the material
- Connecting theory to their personal financial situation
- Reinforcing key takeaways from the lesson
- Maintaining engagement and enthusiasm for learning`;
      
    } catch (error) {
      console.error('Error fetching lesson prompt:', error);
      return `Focus on the lesson content and help the user understand and apply what they learned.`;
    }
  }

  // Handle lesson video completion and transition to Q&A
  async handleLessonVideoCompletion(sessionId: string, lessonId: string): Promise<string> {
    try {
      // Update session phase to Q&A
      await sessionTranscriptService.updateLessonPhase(sessionId, 'qa_conversation');

      // Store video completion system message
      await sessionTranscriptService.addMessage(sessionId, {
        messageType: 'system',
        content: `User completed lesson video: ${lessonId}`,
        speaker: 'system',
        lessonContextId: lessonId,
        metadata: {
          lessonId,
          phase: 'video_completed',
          transitionTo: 'qa_conversation'
        }
      });

      // Generate and return Q&A start message
      const qaStartMessage = await this.generateQAStartMessage(sessionId, lessonId);
      
      return qaStartMessage;

    } catch (error) {
      console.error('Error handling lesson video completion:', error);
      throw new Error(`Failed to transition to Q&A: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Validate that session is ready for Q&A
  validateQAReadiness(session: any): boolean {
    return (
      session &&
      session.sessionType === 'lesson_based' &&
      session.currentLessonId &&
      session.lessonPhase === 'qa_conversation'
    );
  }
}

// Singleton instance
export const qaStartService = new QAStartService();

// Export service instance as default
export default qaStartService;