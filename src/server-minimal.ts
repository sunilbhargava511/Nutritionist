import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Starting Minimal TypeScript Server...');

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PWD: ${process.cwd()}`);

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  console.log('✅ Health check requested');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV,
    message: 'Nutritionist Assistant API (TypeScript)',
    uptime: process.uptime()
  });
});

// Basic API endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'API is running',
    version: '1.0.0',
    server: 'TypeScript/Express'
  });
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Nutritionist Assistant Platform',
    status: 'running',
    health: '/health',
    api: '/api/status'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = () => {
  try {
    console.log('🔧 Starting TypeScript server...');
    
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`✅ TypeScript server running on port ${PORT}`);
      console.log(`🌐 Health check: /health`);
      console.log(`📱 API status: /api/status`);
    });
    
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