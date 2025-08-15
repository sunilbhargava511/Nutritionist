import { Router } from 'express';
import { authenticateToken, checkConversationLimit, AuthRequest } from '../middleware/auth.middleware';
import { ConversationService } from '../services/conversation/conversation.service';
import { Conversation, User } from '../models';
import { io } from '../server';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const conversationService = new ConversationService({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY!,
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID!,
});

router.post('/start', authenticateToken, checkConversationLimit, async (req: AuthRequest, res) => {
  try {
    const { mode, lessonId } = req.body;
    const user = req.user!;

    let nutritionistId = user.role === 'nutritionist' ? user.id : user.nutritionistId;
    
    if (!nutritionistId) {
      return res.status(400).json({ error: 'No nutritionist associated with this account' });
    }

    const conversationId = await conversationService.startConversation(
      user.id,
      nutritionistId,
      mode || 'free-form',
      lessonId
    );

    io.to(`conversation-${conversationId}`).emit('conversation-started', {
      conversationId,
      mode,
      lessonId,
    });

    res.json({ conversationId, mode, lessonId });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

router.post('/:conversationId/message', 
  authenticateToken, 
  upload.single('audio'),
  async (req: AuthRequest, res) => {
    try {
      const { conversationId } = req.params;
      const { message } = req.body;
      const audioInput = req.file?.buffer;

      const response = await conversationService.processMessage(
        conversationId,
        message,
        audioInput
      );

      io.to(`conversation-${conversationId}`).emit('new-message', {
        userMessage: message,
        assistantMessage: response.text,
        metadata: response.metadata,
      });

      res.json(response);
    } catch (error) {
      console.error('Process message error:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  }
);

router.post('/:conversationId/lesson-action', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params;
    const { action } = req.body;

    const response = await conversationService.processStructuredLesson(
      conversationId,
      action
    );

    io.to(`conversation-${conversationId}`).emit('lesson-update', {
      action,
      content: response.text,
      metadata: response.metadata,
    });

    res.json(response);
  } catch (error) {
    console.error('Lesson action error:', error);
    res.status(500).json({ error: 'Failed to process lesson action' });
  }
});

router.post('/:conversationId/end', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params;

    await conversationService.endConversation(conversationId);

    io.to(`conversation-${conversationId}`).emit('conversation-ended', {
      conversationId,
    });

    res.json({ message: 'Conversation ended successfully' });
  } catch (error) {
    console.error('End conversation error:', error);
    res.status(500).json({ error: 'Failed to end conversation' });
  }
});

router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { limit = 10, offset = 0 } = req.query;

    const conversations = await Conversation.findAll({
      where: user.role === 'nutritionist' 
        ? { nutritionistId: user.id }
        : { patientId: user.id },
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset),
      include: [
        { model: User, as: 'patient', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'nutritionist', attributes: ['id', 'name', 'email'] },
      ],
    });

    res.json(conversations);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

router.get('/:conversationId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params;
    const user = req.user!;

    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        { model: User, as: 'patient', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'nutritionist', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.patientId !== user.id && conversation.nutritionistId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.get('/:conversationId/report', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params;
    const user = req.user!;

    const conversation = await Conversation.findByPk(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.patientId !== user.id && conversation.nutritionistId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const report = {
      conversationId: conversation.id,
      date: conversation.startTime,
      duration: conversation.durationMinutes,
      mode: conversation.mode,
      summary: conversation.summary,
      actionItems: conversation.actionItems,
      topics: conversation.topics,
      transcript: conversation.transcript,
    };

    res.json(report);
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;