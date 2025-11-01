const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const net = require('net');
require('dotenv').config();

const app = express();

// Make client IPs reliable behind VPN/proxies (Heroku/NGINX/etc.)
app.set('trust proxy', 1);

// === Helpers ===
function fileExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

// Find an open port, binding to a specific host to avoid IPv6-only binds
function findAvailablePort(startPort, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      // Try next port
      resolve(findAvailablePort(startPort + 1, host));
    });
    server.listen({ port: startPort, host }, () => {
      const { port } = server.address();
      server.close(() => resolve({ port, host }));
    });
  });
}

// CORS: allow a small, explicit allowlist and echo matches
const ALLOW_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:8081')
  .split(',') // support comma-separated list
  .map(s => s.trim());

const corsOptions = {
  origin(origin, cb) {
    // Allow same-origin/non-browser tools (no Origin header)
    if (!origin) return cb(null, true);
    const allowed = ALLOW_ORIGINS.includes(origin);
    return cb(null, allowed);
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// === Bootstrap ===
findAvailablePort(8080, process.env.BIND_HOST || '127.0.0.1').then(({ port, host }) => {
  const PORT = port;

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cors(corsOptions));

  const staticDir = path.join(__dirname, '..', 'docs');
  const indexHtml = path.join(staticDir, 'index.html');

  if (!fileExists(indexHtml)) {
    console.error('❌ index.html not found at:', indexHtml);
  } else {
    console.log('✅ index.html found at:', indexHtml);
  }

  app.use(express.static(staticDir, {
    setHeaders: (res, filePath) => {
      // Let Express set most types; only tweak if you must.
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'text/javascript');
      }
    }
  }));

  const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');

  // Rate limit for newsletter signup
  const signupAttempts = new Map();
  const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
  const MAX_ATTEMPTS = 3;

  function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = signupAttempts.get(ip) || [];
    const recent = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (recent.length >= MAX_ATTEMPTS) return false;
    recent.push(now);
    signupAttempts.set(ip, recent);
    return true;
  }

  function readSubscribers() {
    try {
      const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch {
      return { subscribers: [], lastUpdated: new Date().toISOString() };
    }
  }

  function writeSubscribers(data) {
    try {
      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Error writing subscribers file at', SUBSCRIBERS_FILE, error);
      return false;
    }
  }

  function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254;
  }
  function validateName(name) {
    return name && typeof name === 'string' && name.trim().length > 0 && name.length <= 100;
  }

  app.post('/api/newsletter-signup', (req, res) => {
    const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';

    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ success: false, message: 'Too many signup attempts. Please try again later.' });
    }

    const { email, name } = req.body || {};
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }
    if (name && !validateName(name)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid name (max 100 characters)' });
    }

    try {
      const data = readSubscribers();
      const exists = data.subscribers.find(sub => sub.email.toLowerCase() === email.toLowerCase());
      if (exists) {
        return res.status(409).json({ success: false, message: 'This email is already subscribed to the newsletter' });
      }
      const newSubscriber = {
        email: email.toLowerCase().trim(),
        name: name ? name.trim() : email.split('@')[0]
      };
      data.subscribers.push(newSubscriber);

      if (writeSubscribers(data)) {
        console.log(`New newsletter subscriber: ${newSubscriber.email} (${newSubscriber.name})`);
        return res.json({ success: true, message: 'Successfully subscribed to the newsletter!' });
      } else {
        return res.status(500).json({ success: false, message: 'Failed to save subscription. Please try again.' });
      }
    } catch (err) {
      console.error('Error processing newsletter signup:', err);
      return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
  });

  app.get('/', (req, res) => {
    res.sendFile(indexHtml, (err) => {
      if (err) {
        console.error('sendFile error for /:', err);
        res.status(err.statusCode || 500).end();
      }
    });
  });

  // SPA fallback AFTER API routes
  app.get('*', (req, res) => res.sendFile(indexHtml));

  app.listen(PORT, host, () => {
    console.log(`🚀 Server running at http://${host}:${PORT}`);
    console.log(`📁 Serving files from: ${staticDir}`);
    console.log(`🌐 Open: http://${host}:${PORT}`);
    console.log(`📧 Newsletter API: http://${host}:${PORT}/api/newsletter-signup`);
    console.log(`🔒 Rate limiting: ${MAX_ATTEMPTS} attempts per ${RATE_LIMIT_WINDOW/60000} minutes`);
    console.log(`🔐 Allowed CORS origins:`, ALLOW_ORIGINS);
  });
}).catch(err => {
  console.error('Failed to find an available port:', err);
});
