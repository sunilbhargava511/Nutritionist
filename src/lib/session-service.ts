import { lessonService } from './lesson-service';
import { getClaudeService } from './claude-enhanced';
import { qaStartService } from './qa-start-service';
import { 
  Lesson,
  UserSession,
  LessonConversation,
  LessonProgress,
  SystemPrompt
} from '@/types';

export interface SessionRecommendation {
  type: 'lesson' | 'completion' | 'review';
  lesson?: Lesson;
  message: string;
  confidence: number;
}

export class SessionService {
  
  // Session Lifecycle Management
  async startSession(userId?: string): Promise<UserSession> {
    return await lessonService.createUserSession(userId);
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    return await lessonService.getUserSession(sessionId);
  }

  async endSession(sessionId: string): Promise<void> {
    // Mark current session as complete by clearing current lesson
    await lessonService.updateUserSession(sessionId, {
      currentLessonId: undefined
    });
  }

  // Lesson Flow Management
  async startLessonConversation(
    sessionId: string, 
    lessonId: string,
    elevenLabsConversationId?: string
  ): Promise<LessonConversation> {
    // Update session to track current lesson
    await lessonService.updateUserSession(sessionId, {
      currentLessonId: lessonId
    });
    
    // Create conversation record
    return await lessonService.createLessonConversation(
      sessionId, 
      lessonId, 
      elevenLabsConversationId
    );
  }

  async completeLessonConversation(
    conversationId: string
  ): Promise<void> {
    const conversation = await lessonService.getLessonConversation(conversationId);
    if (!conversation) return;

    // Mark conversation as completed
    await lessonService.updateLessonConversation(conversationId, {
      completed: true
    });

    // Mark lesson as completed in user session
    await lessonService.markLessonCompleted(conversation.sessionId, conversation.lessonId);
  }

  // Lesson Recommendation Logic
  async getSessionRecommendation(
    sessionId: string,
    currentConversationContext?: string
  ): Promise<SessionRecommendation> {
    const progress = await lessonService.getSessionProgress(sessionId);
    if (!progress) {
      throw new Error('Session not found');
    }

    // If we have a next recommended lesson, suggest it
    if (progress.nextRecommendedLesson) {
      return {
        type: 'lesson',
        lesson: progress.nextRecommendedLesson,
        message: `Would you like to learn about ${progress.nextRecommendedLesson.title}?`,
        confidence: 0.9
      };
    }

    // If all lessons are completed
    if (progress.percentComplete === 100) {
      return {
        type: 'completion',
        message: "Congratulations! You've completed all available lessons. Is there anything specific you'd like to review or discuss?",
        confidence: 1.0
      };
    }

    // Use LLM to analyze conversation and recommend appropriate lesson
    if (currentConversationContext) {
      const intelligentRecommendation = await this.getIntelligentRecommendation(
        progress,
        currentConversationContext
      );
      
      if (intelligentRecommendation) {
        return intelligentRecommendation;
      }
    }

    // Default fallback
    return {
      type: 'review',
      message: "Let's continue our conversation. What financial topics would you like to explore today?",
      confidence: 0.5
    };
  }

  private async getIntelligentRecommendation(
    progress: LessonProgress,
    conversationContext: string
  ): Promise<SessionRecommendation | null> {
    try {
      const claudeService = getClaudeService();
      
      // Get all available lessons that haven't been completed
      const allLessons = await lessonService.getAllLessons(true);
      const availableLessons = allLessons.filter(lesson => 
        !progress.completedLessons.some(completed => completed.id === lesson.id)
      );

      if (availableLessons.length === 0) return null;

      // Create prompt for lesson recommendation
      const recommendationPrompt = `Based on the following conversation context, recommend the most appropriate lesson from the available options.

CONVERSATION CONTEXT:
${conversationContext}

COMPLETED LESSONS:
${progress.completedLessons.map(lesson => `- ${lesson.title}`).join('\n')}

AVAILABLE LESSONS:
${availableLessons.map(lesson => `- ${lesson.id}: ${lesson.title} - ${lesson.videoSummary.substring(0, 100)}...`).join('\n')}

Analyze the conversation and recommend the most relevant lesson. Respond with only the lesson ID if you find a good match, or "NONE" if no lesson seems particularly relevant to the conversation context.`;

      const response = await claudeService.sendMessage([{
        id: 'recommendation_prompt',
        sender: 'user',
        content: recommendationPrompt,
        timestamp: new Date()
      }]);

      const recommendedLessonId = response.trim();
      
      if (recommendedLessonId === 'NONE') return null;

      const recommendedLesson = availableLessons.find(lesson => 
        lesson.id === recommendedLessonId
      );

      if (recommendedLesson) {
        return {
          type: 'lesson',
          lesson: recommendedLesson,
          message: `Based on our conversation, I think you might find "${recommendedLesson.title}" particularly relevant. Would you like to learn about this topic?`,
          confidence: 0.8
        };
      }

    } catch (error) {
      console.error('Error getting intelligent recommendation:', error);
    }

    return null;
  }

  // Progress and Analytics
  async getSessionProgress(sessionId: string): Promise<LessonProgress | null> {
    return await lessonService.getSessionProgress(sessionId);
  }

  async getSessionAnalytics(sessionId: string): Promise<{
    totalLessonsCompleted: number;
    totalTimeSpent: number; // in minutes (estimated)
    averageConversationLength: number;
    topicsExplored: string[];
    completionRate: number;
  }> {
    const progress = await lessonService.getSessionProgress(sessionId);
    if (!progress) {
      throw new Error('Session not found');
    }

    // Basic analytics - can be enhanced with actual conversation data
    const completedCount = progress.completedLessons.length;
    const estimatedTimePerLesson = 10; // minutes
    const totalTimeSpent = completedCount * estimatedTimePerLesson;

    return {
      totalLessonsCompleted: completedCount,
      totalTimeSpent,
      averageConversationLength: 5, // placeholder - would calculate from actual messages
      topicsExplored: progress.completedLessons.map(lesson => lesson.title),
      completionRate: progress.percentComplete
    };
  }

  // System Prompt Generation for Lesson-Aware Q&A
  async generateLessonAwarePrompt(
    lessonId: string,
    generalQAPrompt: string
  ): Promise<string> {
    const lesson = await lessonService.getLesson(lessonId);
    if (!lesson) {
      return generalQAPrompt;
    }

    // Create lesson-specific prompt section
    const lessonSpecificPrompt = `LESSON CONTEXT: ${lesson.title}

You are now discussing "${lesson.title}". Use the following lesson summary to provide informed, contextual responses:

LESSON SUMMARY:
${lesson.videoSummary}

KEY FOCUS AREAS:
- Base your responses on the concepts covered in this lesson
- Reference the video content when relevant
- Help the user apply the lesson concepts to their specific situation
- Encourage questions that deepen understanding of this topic

LESSON CONTENT GUIDELINES:
${lesson.videoSummary}

---

`;

    // Combine lesson-specific prompt with general QA prompt
    return lessonSpecificPrompt + generalQAPrompt;
  }

  // Conversation Context Management
  async shouldRecommendLesson(
    sessionId: string,
    conversationHistory: Array<{role: string, content: string}>
  ): Promise<boolean> {
    // Simple heuristic: recommend lesson after 3-5 conversational exchanges
    const userMessages = conversationHistory.filter(msg => msg.role === 'user');
    
    if (userMessages.length >= 3) {
      const progress = await lessonService.getSessionProgress(sessionId);
      if (progress && progress.nextRecommendedLesson) {
        return true;
      }
    }

    return false;
  }

  async getConversationEndMessage(lessonId: string): Promise<string> {
    const lesson = await lessonService.getLesson(lessonId);
    if (!lesson) {
      return "Let's move on to watch the lesson video. I'll be here when you're ready to discuss what you've learned!";
    }

    return `Great! Let's move on to "${lesson.title}". After you watch the video, we can discuss how to apply these concepts to your specific financial situation. I'll start a new conversation when you're ready!`;
  }

  async getLessonIntroMessage(sessionId: string, lessonId: string): Promise<string> {
    try {
      // Use dynamic Q&A generation from qaStartService
      const dynamicMessage = await qaStartService.generateQAStartMessage(sessionId, lessonId);
      return dynamicMessage;
    } catch (error) {
      console.error('Failed to generate dynamic lesson intro message:', error);
      
      // Fallback to generic message
      const lesson = await lessonService.getLesson(lessonId);
      if (lesson) {
        return `Great job completing "${lesson.title}"! I'd love to discuss what you learned. What questions do you have about the concepts we just covered?`;
      }
      
      return "Welcome back! Let's discuss what you learned from the lesson.";
    }
  }
}

// Export singleton instance
export const sessionService = new SessionService();