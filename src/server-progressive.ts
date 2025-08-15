import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Starting Progressive TypeScript Server...');

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

// Health check - robust version
app.get('/health', (req, res) => {
  console.log('✅ Health check requested');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV,
    message: 'Nutritionist Assistant API (Progressive)',
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Test database connection endpoint (safe)
app.get('/health/db', async (req, res) => {
  try {
    // Try to import and test database connection
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

// API info
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Nutritionist Assistant API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      dbHealth: '/health/db',
      status: '/api'
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
    console.log('🔧 Starting progressive server...');
    
    // Start server immediately
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`✅ Progressive server running on port ${PORT}`);
      console.log(`🌐 Health: /health | DB Health: /health/db`);
    });

    // Try database connection in background (non-blocking)
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