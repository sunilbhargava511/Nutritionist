import { NextResponse } from 'next/server';
import { sqlite } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get cached audio files with metadata
    const audioFiles = sqlite.prepare(`
      SELECT 
        id,
        message_id,
        file_path,
        size_bytes,
        mime_type,
        voice_id,
        voice_settings,
        duration_seconds,
        generated_at,
        accessed_at,
        access_count
      FROM audio_cache 
      ORDER BY generated_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    // Get total count
    const totalCount = sqlite.prepare(`
      SELECT COUNT(*) as count FROM audio_cache
    `).get() as { count: number };

    // Calculate total size
    const totalSize = sqlite.prepare(`
      SELECT SUM(size_bytes) as total_size FROM audio_cache
    `).get() as { total_size: number | null };

    // Get recent hit statistics
    const recentHits = sqlite.prepare(`
      SELECT AVG(access_count) as avg_hits FROM audio_cache
    `).get() as { avg_hits: number | null };

    // Try to get actual content for display (from opening_messages if available)
    const filesWithContent = audioFiles.map((file: any) => {
      try {
        // Try to get content from opening_messages table
        const content = sqlite.prepare(`
          SELECT message_content 
          FROM opening_messages 
          WHERE id = ?
        `).get(file.message_id) as { message_content: string } | undefined;

        return {
          ...file,
          content: content?.message_content || null,
          voice_settings: file.voice_settings ? JSON.parse(file.voice_settings) : null
        };
      } catch (error) {
        return {
          ...file,
          content: null,
          voice_settings: null
        };
      }
    });

    const statistics = {
      totalFiles: totalCount.count,
      totalSize: totalSize.total_size || 0,
      averageHits: Math.round((recentHits.avg_hits || 0) * 10) / 10,
      cacheHitRate: Math.round((recentHits.avg_hits || 0) * 10), // Simplified calculation
    };

    return NextResponse.json({
      success: true,
      files: filesWithContent,
      statistics,
      pagination: {
        total: totalCount.count,
        limit,
        offset,
        hasMore: (offset + limit) < totalCount.count
      }
    });

  } catch (error) {
    console.error('[Audio Cache API] Error fetching audio cache:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch audio cache'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'fileId parameter required' },
        { status: 400 }
      );
    }

    // Get file info before deletion
    const fileInfo = sqlite.prepare(`
      SELECT file_path FROM audio_cache WHERE id = ?
    `).get(fileId) as { file_path: string } | undefined;

    if (!fileInfo) {
      return NextResponse.json(
        { success: false, error: 'Audio file not found' },
        { status: 404 }
      );
    }

    // Delete from database
    const result = sqlite.prepare(`
      DELETE FROM audio_cache WHERE id = ?
    `).run(fileId);

    // TODO: Also delete the actual file from filesystem if needed
    // This would require implementing file system cleanup

    return NextResponse.json({
      success: true,
      message: `Audio cache entry deleted`,
      deletedId: fileId,
      changesCount: result.changes
    });

  } catch (error) {
    console.error('[Audio Cache API] Error deleting audio cache:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete audio cache'
      },
      { status: 500 }
    );
  }
}