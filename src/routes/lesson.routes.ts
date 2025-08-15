import { Router } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { Lesson, User } from '../models';
import { ContentIngestionService } from '../services/content/ingestion.service';
import { Op } from 'sequelize';
import multer from 'multer';
import path from 'path';

const router = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: 'public/uploads',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const contentService = new ContentIngestionService();

router.post('/create',
  authenticateToken,
  requireRole(['nutritionist']),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { title, description, sourceType, sourceUrl, chunkDurationMinutes, tags } = req.body;

      let content = [];
      let totalDuration = 0;

      if (sourceType === 'text') {
        content = await contentService.processText(req.body.content, Number(chunkDurationMinutes));
      } else if (sourceType === 'url') {
        content = await contentService.processUrl(sourceUrl, Number(chunkDurationMinutes));
      } else if (sourceType === 'youtube') {
        content = await contentService.processYouTube(sourceUrl, Number(chunkDurationMinutes));
      } else if (req.file) {
        if (sourceType === 'pdf') {
          content = await contentService.processPdf(req.file.path, Number(chunkDurationMinutes));
        } else if (sourceType === 'docx') {
          content = await contentService.processDocx(req.file.path, Number(chunkDurationMinutes));
        }
      }

      totalDuration = content.length * Number(chunkDurationMinutes);

      const lesson = await Lesson.create({
        nutritionistId: user.id,
        title,
        description,
        content,
        sourceType,
        sourceUrl: sourceUrl || req.file?.path,
        chunkDurationMinutes: Number(chunkDurationMinutes),
        totalDurationMinutes: totalDuration,
        tags: tags ? JSON.parse(tags) : [],
        isPublished: false,
      });

      res.json(lesson);
    } catch (error) {
      console.error('Create lesson error:', error);
      res.status(500).json({ error: 'Failed to create lesson' });
    }
  }
);

router.put('/:lessonId',
  authenticateToken,
  requireRole(['nutritionist']),
  async (req: AuthRequest, res) => {
    try {
      const { lessonId } = req.params;
      const user = req.user!;
      const updates = req.body;

      const lesson = await Lesson.findOne({
        where: { id: lessonId, nutritionistId: user.id },
      });

      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      if (updates.content) {
        updates.version = lesson.version + 1;
      }

      await lesson.update(updates);

      res.json(lesson);
    } catch (error) {
      console.error('Update lesson error:', error);
      res.status(500).json({ error: 'Failed to update lesson' });
    }
  }
);

router.post('/:lessonId/publish',
  authenticateToken,
  requireRole(['nutritionist']),
  async (req: AuthRequest, res) => {
    try {
      const { lessonId } = req.params;
      const user = req.user!;

      const lesson = await Lesson.findOne({
        where: { id: lessonId, nutritionistId: user.id },
      });

      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      await lesson.update({ isPublished: true });

      res.json({ message: 'Lesson published successfully', lesson });
    } catch (error) {
      console.error('Publish lesson error:', error);
      res.status(500).json({ error: 'Failed to publish lesson' });
    }
  }
);

router.delete('/:lessonId',
  authenticateToken,
  requireRole(['nutritionist']),
  async (req: AuthRequest, res) => {
    try {
      const { lessonId } = req.params;
      const user = req.user!;

      const lesson = await Lesson.findOne({
        where: { id: lessonId, nutritionistId: user.id },
      });

      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      await lesson.destroy();

      res.json({ message: 'Lesson deleted successfully' });
    } catch (error) {
      console.error('Delete lesson error:', error);
      res.status(500).json({ error: 'Failed to delete lesson' });
    }
  }
);

router.get('/my-lessons', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { limit = 20, offset = 0, isPublished } = req.query;

    const where: any = {};
    
    if (user.role === 'nutritionist') {
      where.nutritionistId = user.id;
    } else if (user.nutritionistId) {
      where.nutritionistId = user.nutritionistId;
      where.isPublished = true;
    } else {
      return res.json([]);
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished === 'true';
    }

    const lessons = await Lesson.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset),
      include: [
        { model: User, as: 'nutritionist', attributes: ['id', 'name'] },
      ],
    });

    res.json(lessons);
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

router.get('/:lessonId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { lessonId } = req.params;
    const user = req.user!;

    const lesson = await Lesson.findByPk(lessonId, {
      include: [
        { model: User, as: 'nutritionist', attributes: ['id', 'name'] },
      ],
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (user.role === 'patient' && !lesson.isPublished) {
      if (user.nutritionistId !== lesson.nutritionistId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await lesson.increment('viewCount');

    res.json(lesson);
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { query, tags } = req.query;

    const where: any = {
      isPublished: true,
    };

    if (user.nutritionistId) {
      where.nutritionistId = user.nutritionistId;
    } else if (user.role === 'nutritionist') {
      where.nutritionistId = user.id;
    }

    // Note: SQLite doesn't support iLike, using LIKE instead
    if (query) {
      where[Op.or] = [
        { title: { [Op.like]: `%${query}%` } },
        { description: { [Op.like]: `%${query}%` } },
      ];
    }

    // Note: SQLite JSON handling for tags search - simplified for now
    if (tags) {
      // For SQLite, we'll use a simpler search approach
      const tagArray = Array.isArray(tags) ? tags : [tags];
      // This is a simplified implementation - in production you might want to use raw SQL
    }

    const lessons = await Lesson.findAll({
      where,
      order: [['viewCount', 'DESC']],
      limit: 20,
    });

    res.json(lessons);
  } catch (error) {
    console.error('Search lessons error:', error);
    res.status(500).json({ error: 'Failed to search lessons' });
  }
});

export default router;