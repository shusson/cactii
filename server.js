require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const v8 = require("v8");
const ngrok = require("@ngrok/ngrok");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Secret keys from environment variables
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ||
  "your-access-token-secret-key-change-in-production";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET ||
  "your-refresh-token-secret-key-change-in-production";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Register endpoint
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Check if user already exists
    const existing = await db.get("SELECT id FROM users WHERE username = ?", [
      username,
    ]);
    if (existing) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    await db.run(
      "INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)",
      [username, hashedPassword, nickname || null]
    );

    console.log(
      `[REGISTER] ✓ New user registered: ${username}${
        nickname ? ` (nickname: ${nickname})` : ""
      } at ${new Date().toISOString()}`
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Find user
    const user = await db.get("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    if (!user) {
      console.log(
        `[LOGIN] ✗ Failed login attempt: ${username} (user not found) at ${new Date().toISOString()}`
      );
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log(
        `[LOGIN] ✗ Failed login attempt: ${username} (invalid password) at ${new Date().toISOString()}`
      );
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { id: user.id, username: user.username },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "1y" }
    );

    const refreshToken = jwt.sign(
      { id: user.id, username: user.username },
      REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Store refresh token in database
    try {
      await db.run(
        "INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)",
        [refreshToken, user.id]
      );
    } catch (error) {
      // Token might already exist, try to update
      await db.run(
        "INSERT OR REPLACE INTO refresh_tokens (token, user_id) VALUES (?, ?)",
        [refreshToken, user.id]
      );
    }

    console.log(
      `[LOGIN] ✓ User logged in: ${user.username} (ID: ${
        user.id
      }) at ${new Date().toISOString()}`
    );

    res.json({
      accessToken,
      refreshToken,
      username: user.username,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Refresh token endpoint
app.post("/api/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    // Verify refresh token
    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid refresh token" });
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { id: user.id, username: user.username },
        ACCESS_TOKEN_SECRET,
        { expiresIn: "1y" }
      );

      res.json({ accessToken });
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Logout endpoint
app.post("/api/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Get user info from refresh token before deleting
    let username = "unknown";
    if (refreshToken) {
      try {
        const tokenRecord = await db.get(
          "SELECT u.username FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token = ?",
          [refreshToken]
        );
        if (tokenRecord) {
          username = tokenRecord.username;
        }
      } catch (error) {
        // Ignore errors when fetching username
      }
    }

    // Remove refresh token from database
    await db.run("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);

    console.log(
      `[LOGOUT] ✓ User logged out: ${username} at ${new Date().toISOString()}`
    );

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Protected route middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Protected route example
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({
    message: "This is a protected route",
    user: req.user,
  });
});

// Update user description endpoint
app.put("/api/profile/description", authenticateToken, async (req, res) => {
  try {
    const { description } = req.body;
    const userId = req.user.id;

    if (description === undefined) {
      return res.status(400).json({ error: "Description is required" });
    }

    const sql = `UPDATE users SET description = '${description}' WHERE id = ${userId}`;
    await db.run(sql);

    console.log(
      `[PROFILE] ✓ User ${
        req.user.username
      } updated description at ${new Date().toISOString()}`
    );
    console.log(`[PROFILE] Executed SQL: ${sql}`);

    res.json({ message: "Description updated successfully", description });
  } catch (error) {
    console.error("Update description error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user profile endpoint
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await db.get(
      "SELECT id, username, nickname, description FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      username: user.username,
      nickname: user.nickname !== null ? user.nickname : "",
      description: user.description || "",
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Heap dump endpoint
app.get("/heapdump", (req, res) => {
  try {
    const timestamp = Date.now();
    const heapSnapshotPath = path.join(
      __dirname,
      `heap-${timestamp}.heapsnapshot`
    );

    // Generate heap snapshot
    const snapshotPath = v8.writeHeapSnapshot(heapSnapshotPath);

    console.log(
      `[DEBUG] Heap dump generated at ${new Date().toISOString()} - ${snapshotPath}`
    );

    // Read the heap snapshot file as binary buffer
    const heapDumpData = fs.readFileSync(snapshotPath);

    // Clean up the file immediately
    fs.unlinkSync(snapshotPath);

    // Convert to base64
    const base64Data = heapDumpData.toString("base64");

    // Return the heap dump as base64-encoded JSON
    res.setHeader("Content-Type", "application/json");
    res.send(
      JSON.stringify({
        timestamp: timestamp,
        heapdump: base64Data,
        size: heapDumpData.length,
      })
    );
  } catch (error) {
    console.error("Heap dump error:", error);
    res.status(500).json({ error: "Failed to generate heap dump" });
  }
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Setup ngrok if configured
  if (process.env.NGROK_AUTHTOKEN) {
    try {
      const listener = await ngrok.forward({
        addr: PORT,
        authtoken: process.env.NGROK_AUTHTOKEN,
        domain: process.env.NGROK_DOMAIN || undefined,
      });

      console.log(`\n🌐 ngrok tunnel established at: ${listener.url()}`);
      console.log(`   Your app is now accessible from the internet!\n`);
    } catch (error) {
      console.error("Failed to establish ngrok tunnel:", error.message);
      console.log("Server is still running on localhost only.\n");
    }
  } else {
    console.log(
      "\n💡 Tip: Set NGROK_AUTHTOKEN in .env to expose your app via ngrok\n"
    );
  }
});
