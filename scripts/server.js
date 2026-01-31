// server.js
const path = require("path");
const fs = require("fs");
const express = require("express");

// Prevent terminal from waiting for stdin (stops the ":" stuck prompt in some terminals)
if (process.stdin.isTTY) process.stdin.unref();

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);

// docs is next to the scripts folder (same repo root)
const docsDir = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.join(path.dirname(__dirname), "docs");

const indexHtml = path.join(docsDir, "index.html");

if (!fs.existsSync(docsDir)) {
  console.error("❌ docs directory not found:", docsDir);
  process.exit(1);
}
if (!fs.existsSync(indexHtml)) {
  console.error("❌ index.html not found:", indexHtml);
  process.exit(1);
}

const app = express();
app.use(express.static(docsDir));

app.get("/", (req, res) => {
  res.sendFile(indexHtml);
});

app.get(/.*/, (req, res) => {
  res.sendFile(indexHtml);
});

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, HOST, () => {
      console.log("3. ✅ Server running at http://localhost:" + port);
      console.log("4. 📁 Serving from:", docsDir);
      resolve(server);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error("EADDRINUSE"));
      } else {
        reject(err);
      }
    });
  });
}

(async () => {
  // Step 1: broadcast IP/host we're binding to
  console.log("1. Binding to host:", HOST);
  console.log("2. Trying port:", PORT);

  for (let p = PORT; p < PORT + 5; p++) {
    try {
      await tryListen(p);
      return;
    } catch (err) {
      if (err.message === "EADDRINUSE") {
        console.warn("   Port " + p + " in use, trying " + (p + 1) + "...");
      } else {
        console.error("❌", err.message || err);
        process.exit(1);
      }
    }
  }
  console.error("❌ Could not bind to any port " + PORT + "-" + (PORT + 4));
  process.exit(1);
})();
