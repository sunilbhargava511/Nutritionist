import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { setSocketIO } from './socket';

dotenv.config();

console.log('🚀 Starting Fixed Nutritionist Server...');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Railway-specific optimizations
app.set('trust proxy', 1);

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

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Static files
app.use('/uploads', express.static('public/uploads'));
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  console.log('✅ Health check requested');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV,
    message: 'Nutritionist Assistant API (Fixed)',
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Readiness check for Railway
app.get('/ready', (req, res) => {
  if (serverReady) {
    res.status(200).json({ 
      status: 'ready',
      routes: routesLoaded.length,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({ 
      status: 'not ready',
      routes: routesLoaded.length,
      timestamp: new Date().toISOString()
    });
  }
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

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
});

// Initialize socket module
setSocketIO(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-conversation', (conversationId: string) => {
    socket.join(`conversation-${conversationId}`);
    console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
  });

  socket.on('leave-conversation', (conversationId: string) => {
    socket.leave(`conversation-${conversationId}`);
    console.log(`Socket ${socket.id} left conversation ${conversationId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Route loading tracking
let routesLoaded: string[] = [];
let routeErrors: string[] = [];
let serverReady = false;

// Import routes at module level
import authRoutes from './routes/auth.routes';
import conversationRoutes from './routes/conversation.routes';
import lessonRoutes from './routes/lesson.routes';
import profileRoutes from './routes/profile.routes';
import analyticsRoutes from './routes/analytics.routes';

// Apply routes before starting server
console.log('📝 Loading routes...');
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/analytics', analyticsRoutes);
console.log('✅ Routes loaded');

// Route status endpoint
app.get('/api/routes-status', (req, res) => {
  res.json({
    loaded: ['auth', 'conversations', 'lessons', 'profile', 'analytics'],
    errors: routeErrors,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ready: serverReady
  });
});

// Start server
const startServer = async () => {
  try {
    console.log('🔧 Starting server...');
    
    // Start server - Railway expects it to bind to 0.0.0.0
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`✅ Fixed server running on port ${PORT}`);
      console.log(`🌐 Health check: /health`);
      console.log(`📱 Socket.IO ready`);
      console.log(`🚀 Server ready for Railway health checks`);
      serverReady = true;
    });

    // Handle server errors
    httpServer.on('error', (error: any) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      }
    });

    // Try database connection in background
    setTimeout(async () => {
      try {
        console.log('🔌 Connecting to database...');
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
    status: 'Fixed version with all features',
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
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📦 Received SIGINT, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

// Keep process alive
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

export { app, io };