import { Router } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { Conversation, Lesson, User, PatientProfile } from '../models';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';

const router = Router();

router.get('/dashboard', 
  authenticateToken, 
  requireRole(['nutritionist']), 
  async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { timeframe = '30' } = req.query;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(timeframe));

      // Get patient count
      const patientCount = await User.count({
        where: { nutritionistId: user.id, role: 'patient' },
      });

      // Get conversation stats
      const conversationStats = await Conversation.findAll({
        where: {
          nutritionistId: user.id,
          createdAt: { [Op.gte]: startDate },
        },
        attributes: [
          ['status', 'status'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('AVG', sequelize.col('duration_minutes')), 'avgDuration'],
        ],
        group: ['status'],
        raw: true,
      });

      // Get lesson stats
      const lessonStats = await Lesson.findAll({
        where: { nutritionistId: user.id },
        include: [{
          model: Conversation,
          as: 'conversations',
          where: { createdAt: { [Op.gte]: startDate } },
          required: false,
        }],
      });

      // Calculate lesson popularity
      const lessonPopularity = lessonStats.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        viewCount: lesson.viewCount,
        completionCount: lesson.completionCount,
        conversationCount: lesson.conversations?.length || 0,
      }));

      // Get top topics from recent conversations
      const recentConversations = await Conversation.findAll({
        where: {
          nutritionistId: user.id,
          createdAt: { [Op.gte]: startDate },
        },
        attributes: ['topics'],
      });

      const allTopics = recentConversations
        .flatMap(conv => conv.topics || [])
        .reduce((acc: any, topic: string) => {
          acc[topic] = (acc[topic] || 0) + 1;
          return acc;
        }, {});

      const topTopics = Object.entries(allTopics)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));

      res.json({
        patientCount,
        conversationStats,
        lessonPopularity,
        topTopics,
        timeframe: Number(timeframe),
      });
    } catch (error) {
      console.error('Dashboard analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
);

router.get('/conversations', 
  authenticateToken, 
  requireRole(['nutritionist']), 
  async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { timeframe = '30', limit = 50 } = req.query;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(timeframe));

      const conversations = await Conversation.findAll({
        where: {
          nutritionistId: user.id,
          createdAt: { [Op.gte]: startDate },
        },
        include: [
          {
            model: User,
            as: 'patient',
            attributes: ['id', 'name', 'email'],
          },
          {
            model: Lesson,
            as: 'lesson',
            attributes: ['id', 'title'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: Number(limit),
      });

      res.json(conversations);
    } catch (error) {
      console.error('Conversation analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch conversation analytics' });
    }
  }
);

router.get('/patient-insights/:patientId', 
  authenticateToken, 
  requireRole(['nutritionist']), 
  async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { patientId } = req.params;

      // Verify patient belongs to nutritionist
      const patient = await User.findOne({
        where: { id: patientId, nutritionistId: user.id },
        include: [{ model: PatientProfile, as: 'profile' }],
      });

      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Get conversation history
      const conversations = await Conversation.findAll({
        where: { patientId, nutritionistId: user.id },
        order: [['createdAt', 'DESC']],
        limit: 20,
      });

      // Calculate engagement metrics
      const totalConversations = conversations.length;
      const totalMinutes = conversations.reduce((sum, conv) => sum + conv.durationMinutes, 0);
      const avgDuration = totalMinutes / totalConversations || 0;
      
      // Get most discussed topics
      const allTopics = conversations
        .flatMap(conv => conv.topics || [])
        .reduce((acc: any, topic: string) => {
          acc[topic] = (acc[topic] || 0) + 1;
          return acc;
        }, {});

      const topTopics = Object.entries(allTopics)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));

      // Get recent action items
      const recentActionItems = conversations
        .slice(0, 5)
        .flatMap(conv => conv.actionItems || [])
        .slice(0, 10);

      res.json({
        patient: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          profile: patient.profile,
        },
        metrics: {
          totalConversations,
          totalMinutes,
          avgDuration,
        },
        topTopics,
        recentActionItems,
        conversationHistory: conversations.slice(0, 10),
      });
    } catch (error) {
      console.error('Patient insights error:', error);
      res.status(500).json({ error: 'Failed to fetch patient insights' });
    }
  }
);

router.get('/engagement', 
  authenticateToken, 
  requireRole(['nutritionist']), 
  async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { timeframe = '30' } = req.query;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(timeframe));

      // Get daily conversation counts
      const dailyStats = await Conversation.findAll({
        where: {
          nutritionistId: user.id,
          createdAt: { [Op.gte]: startDate },
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'conversations'],
          [sequelize.fn('SUM', sequelize.col('duration_minutes')), 'totalMinutes'],
        ],
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true,
      });

      // Get lesson completion rates
      const lessonCompletions = await Lesson.findAll({
        where: { nutritionistId: user.id },
        include: [{
          model: Conversation,
          as: 'conversations',
          where: { 
            status: 'completed',
            createdAt: { [Op.gte]: startDate },
          },
          required: false,
        }],
      });

      const completionRates = lessonCompletions.map(lesson => ({
        lessonId: lesson.id,
        title: lesson.title,
        views: lesson.viewCount,
        completions: lesson.completionCount,
        completionRate: lesson.viewCount > 0 ? (lesson.completionCount / lesson.viewCount) * 100 : 0,
      }));

      res.json({
        dailyStats,
        completionRates,
        timeframe: Number(timeframe),
      });
    } catch (error) {
      console.error('Engagement analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch engagement analytics' });
    }
  }
);

export default router;