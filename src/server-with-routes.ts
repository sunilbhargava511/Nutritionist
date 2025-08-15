import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Starting Server with Routes...');

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
    message: 'Nutritionist Assistant API (With Routes)',
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

// Basic auth routes (safe versions)
app.post('/api/auth/test', (req, res) => {
  res.json({ message: 'Auth route working', timestamp: new Date().toISOString() });
});

// Basic conversation routes (safe versions)  
app.get('/api/conversations/test', (req, res) => {
  res.json({ message: 'Conversation route working', timestamp: new Date().toISOString() });
});

// Basic lesson routes (safe versions)
app.get('/api/lessons/test', (req, res) => {
  res.json({ message: 'Lesson route working', timestamp: new Date().toISOString() });
});

// Basic profile routes (safe versions)
app.get('/api/profile/test', (req, res) => {
  res.json({ message: 'Profile route working', timestamp: new Date().toISOString() });
});

// API info
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Nutritionist Assistant API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      dbHealth: '/health/db',
      authTest: '/api/auth/test',
      conversationTest: '/api/conversations/test',
      lessonTest: '/api/lessons/test',
      profileTest: '/api/profile/test'
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

// Start server
const startServer = async () => {
  try {
    console.log('🔧 Starting server with basic routes...');
    
    // Start server immediately
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`✅ Server with routes running on port ${PORT}`);
      console.log(`🌐 API endpoints available at /api`);
    });

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