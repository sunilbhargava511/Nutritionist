const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { initializeDatabase } = require('./lib/db-init');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all interfaces for Railway
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize database before starting the app
initializeDatabase();

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log(`Starting server in ${dev ? 'development' : 'production'} mode...`);

app.prepare().then(() => {
  createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});