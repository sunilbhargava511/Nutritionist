import { db } from './database';
import * as schema from './database/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { 
  Lesson,
  UserSession,
  LessonConversation,
  LessonProgress
} from '@/types';

export class LessonService {
  
  // Lesson Management
  async createLesson(lessonData: {
    title: string;
    videoUrl: string;
    videoSummary: string;
    startMessage?: string;
    orderIndex?: number;
    prerequisites?: string[];
  }): Promise<Lesson> {
    const lessonId = `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get the highest order index if not provided
    let orderIndex = lessonData.orderIndex;
    if (orderIndex === undefined) {
      const existingLessons = await this.getAllLessons();
      orderIndex = existingLessons.length;
    }
    
    const newLesson = await db.insert(schema.lessons).values({
      id: lessonId,
      title: lessonData.title,
      videoUrl: lessonData.videoUrl,
      videoSummary: lessonData.videoSummary,
      startMessage: lessonData.startMessage,
      orderIndex,
      prerequisites: JSON.stringify(lessonData.prerequisites || []),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return this.convertDatabaseLesson(newLesson[0]);
  }

  async getLesson(lessonId: string): Promise<Lesson | null> {
    const lessons = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lessonId))
      .limit(1);

    if (lessons.length === 0) return null;
    return this.convertDatabaseLesson(lessons[0]);
  }

  async getAllLessons(activeOnly: boolean = false): Promise<Lesson[]> {
    const lessons = activeOnly 
      ? await db.select().from(schema.lessons)
          .where(eq(schema.lessons.active, true))
          .orderBy(asc(schema.lessons.orderIndex))
      : await db.select().from(schema.lessons)
          .orderBy(asc(schema.lessons.orderIndex));
    
    return lessons.map(this.convertDatabaseLesson);
  }

  async updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<void> {
    const dbUpdates: any = { ...updates };
    
    // Convert prerequisites array to JSON string
    if (dbUpdates.prerequisites) {
      dbUpdates.prerequisites = JSON.stringify(dbUpdates.prerequisites);
    }
    
    // Convert Date objects to strings
    if (dbUpdates.createdAt instanceof Date) {
      dbUpdates.createdAt = dbUpdates.createdAt.toISOString();
    }
    if (dbUpdates.updatedAt instanceof Date) {
      dbUpdates.updatedAt = dbUpdates.updatedAt.toISOString();
    }
    
    await db
      .update(schema.lessons)
      .set({
        ...dbUpdates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.lessons.id, lessonId));
  }

  async deleteLesson(lessonId: string): Promise<void> {
    await db
      .delete(schema.lessons)
      .where(eq(schema.lessons.id, lessonId));
  }

  async reorderLessons(lessonIds: string[]): Promise<void> {
    // Update order index for each lesson
    for (let i = 0; i < lessonIds.length; i++) {
      await db
        .update(schema.lessons)
        .set({ 
          orderIndex: i,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.lessons.id, lessonIds[i]));
    }
  }

  // Session Management
  async createUserSession(userId?: string): Promise<UserSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newSession = await db.insert(schema.userSessions).values({
      id: sessionId,
      userId,
      completedLessons: JSON.stringify([]),
      currentLessonId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return this.convertDatabaseSession(newSession[0]);
  }

  async getUserSession(sessionId: string): Promise<UserSession | null> {
    const sessions = await db
      .select()
      .from(schema.userSessions)
      .where(eq(schema.userSessions.id, sessionId))
      .limit(1);

    if (sessions.length === 0) return null;
    return this.convertDatabaseSession(sessions[0]);
  }

  async updateUserSession(sessionId: string, updates: Partial<UserSession>): Promise<void> {
    const dbUpdates: any = { ...updates };
    
    // Convert completedLessons array to JSON string
    if (dbUpdates.completedLessons) {
      dbUpdates.completedLessons = JSON.stringify(dbUpdates.completedLessons);
    }
    
    // Convert Date objects to strings
    if (dbUpdates.createdAt instanceof Date) {
      dbUpdates.createdAt = dbUpdates.createdAt.toISOString();
    }
    if (dbUpdates.updatedAt instanceof Date) {
      dbUpdates.updatedAt = dbUpdates.updatedAt.toISOString();
    }
    
    await db
      .update(schema.userSessions)
      .set({
        ...dbUpdates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.userSessions.id, sessionId));
  }

  async markLessonCompleted(sessionId: string, lessonId: string): Promise<void> {
    const session = await this.getUserSession(sessionId);
    if (!session) return;

    const completedLessons = session.completedLessons || [];
    if (!completedLessons.includes(lessonId)) {
      completedLessons.push(lessonId);
      await this.updateUserSession(sessionId, { completedLessons });
    }
  }

  // Conversation Management
  async createLessonConversation(
    sessionId: string,
    lessonId: string,
    conversationId?: string
  ): Promise<LessonConversation> {
    const convId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newConversation = await db.insert(schema.lessonConversations).values({
      id: convId,
      sessionId,
      lessonId,
      conversationId,
      completed: false,
      messagesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return this.convertDatabaseConversation(newConversation[0]);
  }

  async getLessonConversation(conversationId: string): Promise<LessonConversation | null> {
    const conversations = await db
      .select()
      .from(schema.lessonConversations)
      .where(eq(schema.lessonConversations.id, conversationId))
      .limit(1);

    if (conversations.length === 0) return null;
    return this.convertDatabaseConversation(conversations[0]);
  }

  async updateLessonConversation(
    conversationId: string, 
    updates: Partial<LessonConversation>
  ): Promise<void> {
    const dbUpdates: any = { ...updates };
    
    // Convert Date objects to strings
    if (dbUpdates.createdAt instanceof Date) {
      dbUpdates.createdAt = dbUpdates.createdAt.toISOString();
    }
    if (dbUpdates.updatedAt instanceof Date) {
      dbUpdates.updatedAt = dbUpdates.updatedAt.toISOString();
    }
    
    await db
      .update(schema.lessonConversations)
      .set({
        ...dbUpdates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.lessonConversations.id, conversationId));
  }

  // Progress Tracking
  async getSessionProgress(sessionId: string): Promise<LessonProgress | null> {
    const session = await this.getUserSession(sessionId);
    if (!session) return null;

    const allLessons = await this.getAllLessons(true);
    const completedLessonIds = session.completedLessons || [];
    
    // Get completed lesson objects
    const completedLessons = allLessons.filter(lesson => 
      completedLessonIds.includes(lesson.id)
    );
    
    // Get current lesson
    const currentLesson = session.currentLessonId 
      ? await this.getLesson(session.currentLessonId)
      : null;
    
    // Find next recommended lesson (first uncompleted lesson with satisfied prerequisites)
    const nextRecommendedLesson = await this.getNextRecommendedLesson(
      sessionId, 
      completedLessonIds, 
      allLessons
    );
    
    return {
      sessionId,
      completedLessons,
      currentLesson: currentLesson || undefined,
      nextRecommendedLesson,
      totalLessons: allLessons.length,
      percentComplete: allLessons.length > 0 
        ? Math.round((completedLessons.length / allLessons.length) * 100)
        : 0
    };
  }

  async getNextRecommendedLesson(
    sessionId: string,
    completedLessonIds: string[],
    allLessons?: Lesson[]
  ): Promise<Lesson | undefined> {
    if (!allLessons) {
      allLessons = await this.getAllLessons(true);
    }
    
    // Find first uncompleted lesson with satisfied prerequisites
    for (const lesson of allLessons) {
      if (!completedLessonIds.includes(lesson.id)) {
        // Check if all prerequisites are completed
        const prerequisitesSatisfied = lesson.prerequisites.every(prereqId => 
          completedLessonIds.includes(prereqId)
        );
        
        if (prerequisitesSatisfied) {
          return lesson;
        }
      }
    }
    
    return undefined;
  }

  // YouTube URL Validation
  validateYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
  }

  extractYouTubeVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  }

  // Utility Methods
  private convertDatabaseLesson(dbLesson: any): Lesson {
    return {
      id: dbLesson.id,
      title: dbLesson.title,
      videoUrl: dbLesson.videoUrl,
      videoSummary: dbLesson.videoSummary,
      startMessage: dbLesson.startMessage,
      orderIndex: dbLesson.orderIndex,
      prerequisites: dbLesson.prerequisites ? JSON.parse(dbLesson.prerequisites) : [],
      active: Boolean(dbLesson.active),
      createdAt: new Date(dbLesson.createdAt),
      updatedAt: new Date(dbLesson.updatedAt),
    };
  }

  private convertDatabaseSession(dbSession: any): UserSession {
    return {
      id: dbSession.id,
      userId: dbSession.userId,
      completedLessons: dbSession.completedLessons ? JSON.parse(dbSession.completedLessons) : [],
      currentLessonId: dbSession.currentLessonId,
      createdAt: new Date(dbSession.createdAt),
      updatedAt: new Date(dbSession.updatedAt),
    };
  }

  private convertDatabaseConversation(dbConversation: any): LessonConversation {
    return {
      id: dbConversation.id,
      sessionId: dbConversation.sessionId,
      lessonId: dbConversation.lessonId,
      conversationId: dbConversation.conversationId,
      completed: Boolean(dbConversation.completed),
      messagesCount: dbConversation.messagesCount,
      createdAt: new Date(dbConversation.createdAt),
      updatedAt: new Date(dbConversation.updatedAt),
    };
  }
}

// Export singleton instance
export const lessonService = new LessonService();