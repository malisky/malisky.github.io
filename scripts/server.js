const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const net = require('net');
require('dotenv').config();

const app = express();

// === Helpers ===
function fileExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

// Find an open port, binding to a specific host to avoid IPv6-only binds
function findAvailablePort(startPort, host = '127.0.0.1') {
  if (startPort > 65535) {
    return Promise.reject(new RangeError('No available ports below 65536'));
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      server.close(() => {
        if (err.code === 'EADDRINUSE') {
          resolve(findAvailablePort(startPort + 1, host));
        } else {
          reject(err);
        }
      });
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
    console.log(`🔐 Allowed CORS origins:`, ALLOW_ORIGINS);
  });
}).catch(err => {
  console.error('Failed to find an available port:', err);
});
