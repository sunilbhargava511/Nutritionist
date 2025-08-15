// Simple test server for Railway debugging
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting simple server...');
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PWD: ${process.cwd()}`);

app.get('/health', (req, res) => {
  console.log('✅ Health check requested');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Simple server running!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('📦 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📦 Received SIGINT, shutting down gracefully');
  process.exit(0);
});