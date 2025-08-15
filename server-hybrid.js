// Hybrid server - Express with minimal dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

console.log('🚀 Starting Hybrid Nutritionist Server...');

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

// Health check - absolutely minimal
app.get('/health', (req, res) => {
  console.log('✅ Health check requested');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV,
    message: 'Nutritionist Assistant API'
  });
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Nutritionist Assistant Platform',
    status: 'running',
    health: '/health'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
console.log('🔧 Starting server...');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Hybrid server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📱 Ready for API requests`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📦 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📦 Received SIGINT, shutting down gracefully');
  process.exit(0);
});