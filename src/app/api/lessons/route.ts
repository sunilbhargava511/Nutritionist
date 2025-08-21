import { NextRequest, NextResponse } from 'next/server';
import { lessonService } from '@/lib/lesson-service';
import { initializeDatabase } from '@/lib/database';

// Initialize database on first API call
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('id');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    if (lessonId) {
      const lesson = await lessonService.getLesson(lessonId);
      if (!lesson) {
        return NextResponse.json(
          { success: false, error: 'Lesson not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, lesson });
    }

    const lessons = await lessonService.getAllLessons(activeOnly);
    return NextResponse.json({ success: true, lessons });

  } catch (error) {
    console.error('Error fetching lessons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lessons' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        const { title, videoUrl, videoSummary, prerequisites, orderIndex } = data;
        
        if (!title || !videoUrl || !videoSummary) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: title, videoUrl, videoSummary' },
            { status: 400 }
          );
        }

        // Validate YouTube URL
        if (!lessonService.validateYouTubeUrl(videoUrl)) {
          return NextResponse.json(
            { success: false, error: 'Invalid YouTube URL format' },
            { status: 400 }
          );
        }

        const lesson = await lessonService.createLesson({
          title,
          videoUrl,
          videoSummary,
          prerequisites: prerequisites || [],
          orderIndex
        });

        return NextResponse.json({ 
          success: true, 
          lesson,
          message: 'Lesson created successfully' 
        });
      }

      case 'bulk_create': {
        const { lessons } = data;
        
        if (!Array.isArray(lessons)) {
          return NextResponse.json(
            { success: false, error: 'Lessons must be an array' },
            { status: 400 }
          );
        }

        const createdLessons = [];
        const errors = [];

        for (let i = 0; i < lessons.length; i++) {
          const lessonData = lessons[i];
          
          try {
            // Validate required fields
            if (!lessonData.title || !lessonData.videoUrl || !lessonData.videoSummary) {
              errors.push(`Lesson ${i + 1}: Missing required fields`);
              continue;
            }

            // Validate YouTube URL
            if (!lessonService.validateYouTubeUrl(lessonData.videoUrl)) {
              errors.push(`Lesson ${i + 1}: Invalid YouTube URL`);
              continue;
            }

            const lesson = await lessonService.createLesson({
              title: lessonData.title,
              videoUrl: lessonData.videoUrl,
              videoSummary: lessonData.videoSummary,
              prerequisites: lessonData.prerequisites || [],
              orderIndex: lessonData.orderIndex || i
            });

            createdLessons.push(lesson);
          } catch (error) {
            errors.push(`Lesson ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return NextResponse.json({
          success: true,
          createdLessons,
          errors,
          message: `Created ${createdLessons.length} lessons with ${errors.length} errors`
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in lessons POST:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'update': {
        const { lessonId, ...updates } = data;
        
        if (!lessonId) {
          return NextResponse.json(
            { success: false, error: 'Lesson ID is required' },
            { status: 400 }
          );
        }

        // Validate YouTube URL if provided
        if (updates.videoUrl && !lessonService.validateYouTubeUrl(updates.videoUrl)) {
          return NextResponse.json(
            { success: false, error: 'Invalid YouTube URL format' },
            { status: 400 }
          );
        }

        await lessonService.updateLesson(lessonId, updates);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Lesson updated successfully' 
        });
      }

      case 'reorder': {
        const { lessonIds } = data;
        
        if (!Array.isArray(lessonIds)) {
          return NextResponse.json(
            { success: false, error: 'Lesson IDs must be an array' },
            { status: 400 }
          );
        }

        await lessonService.reorderLessons(lessonIds);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Lessons reordered successfully' 
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in lessons PUT:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabase();
    
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('id');

    if (!lessonId) {
      return NextResponse.json(
        { success: false, error: 'Lesson ID is required' },
        { status: 400 }
      );
    }

    await lessonService.deleteLesson(lessonId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Lesson deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting lesson:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete lesson' },
      { status: 500 }
    );
  }
}