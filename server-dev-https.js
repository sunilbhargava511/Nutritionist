const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3001;

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log('Starting HTTPS development server...');

app.prepare().then(() => {
  try {
    // Load SSL certificates
    const httpsOptions = {
      key: fs.readFileSync(path.join(__dirname, 'certificates/localhost-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'certificates/localhost.pem'))
    };

    console.log('✅ SSL certificates loaded successfully');

    // Create HTTPS server
    createServer(httpsOptions, async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    })
    .listen(port, hostname, (err) => {
      if (err) throw err;
      console.log('');
      console.log('🚀 HTTPS Development Server Ready!');
      console.log('');
      console.log(`🔒 Local:    https://${hostname}:${port}`);
      console.log(`🔒 Network:  https://192.168.7.120:${port} (if accessible)`);
      console.log('');
      console.log('⚠️  You may see a security warning - this is normal for development.');
      console.log('   Click "Advanced" → "Proceed to localhost (unsafe)" in your browser.');
      console.log('');
      console.log('🎤 Microphone permissions should now work properly!');
      console.log('');
    });

  } catch (error) {
    console.error('❌ Failed to start HTTPS server:', error.message);
    console.log('');
    console.log('If certificates are missing, run:');
    console.log('mkdir certificates && openssl req -x509 -out certificates/localhost.pem -keyout certificates/localhost-key.pem -newkey rsa:2048 -nodes -sha256 -subj "/CN=localhost"');
    process.exit(1);
  }
}).catch((err) => {
  console.error('❌ Failed to prepare Next.js app:', err);
  process.exit(1);
});