// scripts/server.js
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const express = require("express");

// Prevent terminal from waiting for stdin (stops the ":" stuck prompt in some terminals)
if (process.stdin.isTTY) process.stdin.unref();

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);
const PORT_TRIES = Number(process.env.PORT_TRIES || 5);

// docs is next to the scripts folder (same repo root)
const docsDir = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.join(path.dirname(__dirname), "docs");

const indexHtml = path.join(docsDir, "index.html");

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return Array.from(new Set(ips));
}

function requirePathExists(p, label) {
  if (!fs.existsSync(p)) {
    console.error(`❌ ${label} not found:`, p);
    process.exit(1);
  }
}

requirePathExists(docsDir, "Static directory (docs)");
requirePathExists(indexHtml, "index.html");

const app = express();

// Reduce “stale asset” confusion while iterating locally.
// Remove if you want caching.
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Health endpoint for CLI checks
app.get("/healthz", (req, res) => {
  res.status(200).json({
    ok: true,
    host: HOST,
    pid: process.pid,
    docsDir,
    time: new Date().toISOString(),
  });
});

// Serve static assets
app.use(
  express.static(docsDir, {
    extensions: ["html"],
  })
);

// Root => index.html
app.get("/", (req, res) => {
  res.sendFile(indexHtml);
});

// SPA fallback, but don't hijack real files (e.g., /bundle.js, /favicon.ico)
app.get("*", (req, res, next) => {
  if (path.extname(req.path)) return next();
  return res.sendFile(indexHtml);
});

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, HOST, () => resolve(server));
    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE") return reject(new Error("EADDRINUSE"));
      if (err && err.code === "EACCES") return reject(new Error("EACCES"));
      return reject(err);
    });
  });
}

(async () => {
  console.log("1) Binding to host:", HOST);
  console.log("2) Preferred port:", PORT);
  console.log("   Static dir:", docsDir);

  for (let i = 0; i < PORT_TRIES; i++) {
    const p = PORT + i;
    try {
      await tryListen(p);

      console.log("\n✅ Server running");
      console.log("   - http://localhost:" + p);

      for (const ip of getLocalIPs()) {
        console.log("   - http://" + ip + ":" + p);
      }

      console.log("\n✅ Health check:");
      console.log("   - http://localhost:" + p + "/healthz\n");

      if (p !== PORT) {
        console.warn(`⚠️  Note: ${PORT} was unavailable, using ${p} instead.`);
      }

      return;
    } catch (err) {
      if (err && err.message === "EADDRINUSE") {
        console.warn(`⚠️  Port ${p} in use, trying ${p + 1}...`);
        continue;
      }
      if (err && err.message === "EACCES") {
        console.error(
          `❌ Permission denied binding to port ${p}. Try a higher port or run with proper permissions.`
        );
        process.exit(1);
      }
      console.error("❌ Server failed to start:", err && err.message ? err.message : err);
      process.exit(1);
    }
  }

  console.error(`❌ Could not bind to any port ${PORT}-${PORT + (PORT_TRIES - 1)}`);
  process.exit(1);
})();
