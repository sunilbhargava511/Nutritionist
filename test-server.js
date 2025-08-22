const http = require('http');

const port = parseInt(process.env.PORT || '8080', 10);
const hostname = '0.0.0.0';

console.log('Environment variables:');
console.log('  PORT:', process.env.PORT);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('Parsed port:', port);

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] Received request: ${req.method} ${req.url} from ${req.headers.host}`);
  console.log('Headers:', JSON.stringify(req.headers));
  
  if (req.url === '/api/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      message: 'Test server running',
      port: port,
      hostname: hostname,
      env_port: process.env.PORT,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, hostname, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`Test server successfully listening at http://${hostname}:${port}/`);
  console.log('Waiting for requests...');
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});