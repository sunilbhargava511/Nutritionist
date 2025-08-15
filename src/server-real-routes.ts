import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Starting Server with Real Routes...');

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

// Basic middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  console.log('✅ Health check requested');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV,
    message: 'Nutritionist Assistant API (Real Routes)',
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Test database connection endpoint
app.get('/health/db', async (req, res) => {
  try {
    const { sequelize } = await import('./config/database');
    await sequelize.authenticate();
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.warn('Database connection test failed:', error);
    res.status(503).json({ 
      status: 'degraded', 
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Try to import real routes one by one with error handling
let routesLoaded: string[] = [];
let routeErrors: string[] = [];

// Start server first, then load routes
const startServer = async () => {
  try {
    console.log('🔧 Starting server...');
    
    // Start server immediately
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`✅ Server with real routes running on port ${PORT}`);
      console.log(`🔍 Loading routes...`);
    });

    // Load routes after server starts
    setTimeout(async () => {
      // Try loading auth routes
      try {
        console.log('📝 Loading auth routes...');
        const authRoutes = await import('./routes/auth.routes');
        app.use('/api/auth', authRoutes.default);
        routesLoaded.push('auth');
        console.log('✅ Auth routes loaded');
      } catch (error) {
        console.error('❌ Auth routes failed:', error);
        routeErrors.push(`auth: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Try loading profile routes (usually simpler)
      try {
        console.log('📝 Loading profile routes...');
        const profileRoutes = await import('./routes/profile.routes');
        app.use('/api/profile', profileRoutes.default);
        routesLoaded.push('profile');
        console.log('✅ Profile routes loaded');
      } catch (error) {
        console.error('❌ Profile routes failed:', error);
        routeErrors.push(`profile: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Try loading lesson routes
      try {
        console.log('📝 Loading lesson routes...');
        const lessonRoutes = await import('./routes/lesson.routes');
        app.use('/api/lessons', lessonRoutes.default);
        routesLoaded.push('lessons');
        console.log('✅ Lesson routes loaded');
      } catch (error) {
        console.error('❌ Lesson routes failed:', error);
        routeErrors.push(`lessons: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Try loading conversation routes (likely problematic due to Socket.IO)
      try {
        console.log('📝 Loading conversation routes...');
        const conversationRoutes = await import('./routes/conversation.routes');
        app.use('/api/conversations', conversationRoutes.default);
        routesLoaded.push('conversations');
        console.log('✅ Conversation routes loaded');
      } catch (error) {
        console.error('❌ Conversation routes failed:', error);
        routeErrors.push(`conversations: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Try loading analytics routes
      try {
        console.log('📝 Loading analytics routes...');
        const analyticsRoutes = await import('./routes/analytics.routes');
        app.use('/api/analytics', analyticsRoutes.default);
        routesLoaded.push('analytics');
        console.log('✅ Analytics routes loaded');
      } catch (error) {
        console.error('❌ Analytics routes failed:', error);
        routeErrors.push(`analytics: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Add route status endpoint
      app.get('/api/routes-status', (req, res) => {
        res.json({
          loaded: routesLoaded,
          errors: routeErrors,
          timestamp: new Date().toISOString()
        });
      });

      console.log(`🎯 Routes loaded: ${routesLoaded.length}, Errors: ${routeErrors.length}`);
    }, 3000);

    // Try database connection in background
    setTimeout(async () => {
      try {
        console.log('🔌 Testing database connection...');
        const { connectDatabase } = await import('./config/database');
        await connectDatabase();
        console.log('✅ Database connected successfully');
      } catch (dbError) {
        console.warn('⚠️ Database connection failed (server continues):', 
          dbError instanceof Error ? dbError.message : String(dbError));
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// API info
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Nutritionist Assistant API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      dbHealth: '/health/db',
      routesStatus: '/api/routes-status'
    }
  });
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Nutritionist Assistant Platform',
    status: 'running',
    health: '/health',
    api: '/api'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📦 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📦 Received SIGINT, shutting down gracefully');
  process.exit(0);
});

export { app };