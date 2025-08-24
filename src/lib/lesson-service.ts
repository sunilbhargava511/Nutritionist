import { getDB } from './database';
import * as schema from './database/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { 
  Lesson,
  UserSession,
  LessonConversation,
  KnowledgeBaseFile
} from '@/types';

export class LessonService {
  
  // Lesson Management
  async createLesson(lessonData: {
    title: string;
    videoUrl?: string;
    videoPath?: string;
    videoType?: string;
    videoMimeType?: string;
    videoSize?: number;
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
    
    const newLesson = await getDB().insert(schema.lessons).values({
      id: lessonId,
      title: lessonData.title,
      videoUrl: lessonData.videoUrl,
      videoPath: lessonData.videoPath,
      videoType: lessonData.videoType || 'url',
      videoMimeType: lessonData.videoMimeType,
      videoSize: lessonData.videoSize,
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
    const lessons = await getDB()
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lessonId))
      .limit(1);

    if (lessons.length === 0) return null;
    return this.convertDatabaseLesson(lessons[0]);
  }

  async getAllLessons(activeOnly: boolean = false): Promise<Lesson[]> {
    let query = getDB().select().from(schema.lessons);
    
    if (activeOnly) {
      query = query.where(eq(schema.lessons.active, true));
    }
    
    const lessons = await query.orderBy(asc(schema.lessons.orderIndex));
    return lessons.map(this.convertDatabaseLesson);
  }

  async updateLesson(lessonId: string, updates: Partial<{
    title: string;
    videoUrl: string;
    videoPath: string;
    videoType: string;
    videoMimeType: string;
    videoSize: number;
    videoSummary: string;
    startMessage: string;
    orderIndex: number;
    prerequisites: string[];
    active: boolean;
  }>): Promise<void> {
    const updateData: any = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Handle prerequisites array
    if (updates.prerequisites) {
      updateData.prerequisites = JSON.stringify(updates.prerequisites);
    }

    await getDB()
      .update(schema.lessons)
      .set(updateData)
      .where(eq(schema.lessons.id, lessonId));
  }

  async deleteLesson(lessonId: string): Promise<void> {
    // Delete related lesson conversations first
    await getDB()
      .delete(schema.lessonConversations)
      .where(eq(schema.lessonConversations.lessonId, lessonId));

    // Delete the lesson
    await getDB()
      .delete(schema.lessons)
      .where(eq(schema.lessons.id, lessonId));
  }

  async reorderLessons(lessonIds: string[]): Promise<void> {
    const db = getDB();
    
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

  // YouTube URL Validation
  validateYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
    return youtubeRegex.test(url);
  }

  // Extract YouTube video ID from URL
  extractYouTubeId(url: string): string | null {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  }

  // User Session Management
  async createUserSession(userId?: string): Promise<UserSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newSession = await getDB().insert(schema.userSessions).values({
      id: sessionId,
      userId,
      completedLessons: JSON.stringify([]),
      currentLessonId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return this.convertDatabaseUserSession(newSession[0]);
  }

  async getUserSession(sessionId: string): Promise<UserSession | null> {
    const sessions = await getDB()
      .select()
      .from(schema.userSessions)
      .where(eq(schema.userSessions.id, sessionId))
      .limit(1);

    if (sessions.length === 0) return null;
    return this.convertDatabaseUserSession(sessions[0]);
  }

  async updateUserSession(sessionId: string, updates: Partial<{
    currentLessonId: string | null;
    completedLessons: string[];
  }>): Promise<void> {
    const updateData: any = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (updates.completedLessons) {
      updateData.completedLessons = JSON.stringify(updates.completedLessons);
    }

    await getDB()
      .update(schema.userSessions)
      .set(updateData)
      .where(eq(schema.userSessions.id, sessionId));
  }

  // Lesson Conversation Management
  async createLessonConversation(data: {
    sessionId: string;
    lessonId: string;
    conversationId?: string;
  }): Promise<LessonConversation> {
    const conversationId = `lesson_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newConversation = await getDB().insert(schema.lessonConversations).values({
      id: conversationId,
      sessionId: data.sessionId,
      lessonId: data.lessonId,
      conversationId: data.conversationId,
      completed: false,
      messagesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return this.convertDatabaseLessonConversation(newConversation[0]);
  }

  async getLessonConversation(conversationId: string): Promise<LessonConversation | null> {
    const conversations = await getDB()
      .select()
      .from(schema.lessonConversations)
      .where(eq(schema.lessonConversations.id, conversationId))
      .limit(1);

    if (conversations.length === 0) return null;
    return this.convertDatabaseLessonConversation(conversations[0]);
  }

  async updateLessonConversation(conversationId: string, updates: Partial<{
    completed: boolean;
    messagesCount: number;
  }>): Promise<void> {
    await getDB()
      .update(schema.lessonConversations)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.lessonConversations.id, conversationId));
  }

  // Knowledge Base Integration
  async syncTranscriptToKnowledgeBase(lessonId: string): Promise<void> {
    const lesson = await this.getLesson(lessonId);
    if (!lesson || !lesson.videoTranscript) {
      return;
    }

    const kbId = `transcript_${lessonId}`;
    const filename = `${lesson.title.replace(/[^a-zA-Z0-9]/g, '_')}_transcript.md`;
    
    // Format transcript as markdown
    const content = `# ${lesson.title} - Video Transcript

## Lesson Summary
${lesson.videoSummary}

## Full Transcript
${lesson.videoTranscript}

## Video Information
- **Video URL**: ${lesson.videoUrl || 'N/A'}
- **Language**: ${lesson.transcriptLanguage || 'en'}
- **Extracted**: ${lesson.transcriptExtractedAt || 'Unknown'}

---
*This transcript was automatically extracted and synced to the knowledge base for search and reference purposes.*
`;

    // Check if transcript already exists in knowledge base
    const existing = await getDB()
      .select()
      .from(schema.knowledgeBaseFiles)
      .where(eq(schema.knowledgeBaseFiles.id, kbId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing transcript
      await getDB()
        .update(schema.knowledgeBaseFiles)
        .set({
          content,
          indexedContent: content,
          filename,
        })
        .where(eq(schema.knowledgeBaseFiles.id, kbId));
    } else {
      // Create new transcript entry
      await getDB().insert(schema.knowledgeBaseFiles).values({
        id: kbId,
        filename,
        content,
        fileType: 'text/markdown',
        indexedContent: content,
        uploadedAt: new Date().toISOString(),
      });
    }
  }

  // Utility Methods
  private convertDatabaseLesson(dbLesson: any): Lesson {
    return {
      id: dbLesson.id,
      title: dbLesson.title,
      videoUrl: dbLesson.videoUrl,
      videoPath: dbLesson.videoPath,
      videoType: dbLesson.videoType || 'url',
      videoMimeType: dbLesson.videoMimeType,
      videoSize: dbLesson.videoSize,
      videoSummary: dbLesson.videoSummary,
      startMessage: dbLesson.startMessage,
      videoTranscript: dbLesson.videoTranscript,
      transcriptExtractedAt: dbLesson.transcriptExtractedAt ? new Date(dbLesson.transcriptExtractedAt) : null,
      transcriptLanguage: dbLesson.transcriptLanguage,
      orderIndex: dbLesson.orderIndex,
      prerequisites: dbLesson.prerequisites ? JSON.parse(dbLesson.prerequisites) : [],
      active: Boolean(dbLesson.active),
      createdAt: new Date(dbLesson.createdAt),
      updatedAt: new Date(dbLesson.updatedAt),
    };
  }

  private convertDatabaseUserSession(dbSession: any): UserSession {
    return {
      id: dbSession.id,
      userId: dbSession.userId,
      completedLessons: dbSession.completedLessons ? JSON.parse(dbSession.completedLessons) : [],
      currentLessonId: dbSession.currentLessonId,
      createdAt: new Date(dbSession.createdAt),
      updatedAt: new Date(dbSession.updatedAt),
    };
  }

  private convertDatabaseLessonConversation(dbConversation: any): LessonConversation {
    return {
      id: dbConversation.id,
      sessionId: dbConversation.sessionId,
      lessonId: dbConversation.lessonId,
      conversationId: dbConversation.conversationId,
      completed: Boolean(dbConversation.completed),
      messagesCount: dbConversation.messagesCount || 0,
      createdAt: new Date(dbConversation.createdAt),
      updatedAt: new Date(dbConversation.updatedAt),
    };
  }
}

// Export singleton instance
export const lessonService = new LessonService();