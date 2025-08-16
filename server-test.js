const http = require('http');

const PORT = process.env.PORT || 3000;

console.log('🚀 Starting test server...');
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'Simple test server'
    }));
    return;
  }
  
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Test server is running!');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server running on port ${PORT}`);
  console.log(`🌐 Health check: /health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📦 Test server received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('✅ Test server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📦 Test server received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('✅ Test server closed');
    process.exit(0);
  });
});