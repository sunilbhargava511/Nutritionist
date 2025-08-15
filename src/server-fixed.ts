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

// Start server
const startServer = async () => {
  try {
    console.log('🔧 Starting server...');
    
    // Start server immediately
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`✅ Fixed server running on port ${PORT}`);
      console.log(`🌐 Health check: /health`);
      console.log(`📱 Socket.IO ready`);
    });

    // Load routes immediately after server starts (faster startup)
    setTimeout(async () => {
      try {
        console.log('📝 Loading all routes...');
        
        // Load routes in parallel for faster startup
        const [authRoutes, conversationRoutes, lessonRoutes, profileRoutes, analyticsRoutes] = await Promise.all([
          import('./routes/auth.routes'),
          import('./routes/conversation.routes'),
          import('./routes/lesson.routes'),
          import('./routes/profile.routes'),
          import('./routes/analytics.routes')
        ]);

        app.use('/api/auth', authRoutes.default);
        routesLoaded.push('auth');
        
        app.use('/api/conversations', conversationRoutes.default);
        routesLoaded.push('conversations');
        
        app.use('/api/lessons', lessonRoutes.default);
        routesLoaded.push('lessons');
        
        app.use('/api/profile', profileRoutes.default);
        routesLoaded.push('profile');
        
        app.use('/api/analytics', analyticsRoutes.default);
        routesLoaded.push('analytics');

        console.log(`✅ All routes loaded: ${routesLoaded.join(', ')}`);
        serverReady = true;
        
        // Add route status endpoint
        app.get('/api/routes-status', (req, res) => {
          res.json({
            loaded: routesLoaded,
            errors: routeErrors,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            ready: serverReady
          });
        });
        
      } catch (error) {
        console.error('❌ Route loading failed:', error);
        routeErrors.push(`routes: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 1000);

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
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📦 Received SIGINT, shutting down gracefully');
  process.exit(0);
});

export { app, io };