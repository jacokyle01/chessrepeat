// backend/server.js
// Auth server for chess training app with Google OAuth and CouchDB user management

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import nano from "nano";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3002;

// Configuration
const config = {
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  couchdbUrl: process.env.COUCHDB_URL || "http://admin:password@localhost:5984",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  cookieSecret: process.env.COOKIE_SECRET || "cookie-secret-change-me",
};

// Initialize Google OAuth
const googleClient = new OAuth2Client(
  config.googleClientId,
  config.googleClientSecret,
  // Redirect URI - adjust based on your frontend port
  // Use environment variable or default to common ports
  process.env.OAUTH_REDIRECT_URI ||
    `${config.frontendUrl}/auth/google/callback`,
);

// Initialize CouchDB admin connection
const couchAdmin = nano(config.couchdbUrl);

// Middleware
// Allow multiple origins for local development (Vite uses 5173, CRA uses 3000)
const allowedOrigins = [
  config.frontendUrl,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174", // Vite alternative port
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser(config.cookieSecret));

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a deterministic user ID from Google sub
 */
function generateUserId(googleSub) {
  return crypto
    .createHash("sha256")
    .update(googleSub)
    .digest("hex")
    .substring(0, 32);
}

/**
 * Generate database name for user
 */
function getUserDbName(userId) {
  return `userdb-${userId}`;
}

/**
 * Create or ensure user database exists
 */
async function ensureUserDatabase(userId, userEmail) {
  const dbName = getUserDbName(userId);
  const userName = `user_${userId}`;

  try {
    // Check if database exists
    await couchAdmin.db.get(dbName);
    console.log(`Database ${dbName} already exists`);
  } catch (err) {
    if (err.statusCode === 404) {
      // Create database
      console.log(`Creating database ${dbName}`);
      await couchAdmin.db.create(dbName);

      // Set up security document
      const db = couchAdmin.use(dbName);
      await db.insert(
        {
          admins: {
            names: [],
            roles: ["_admin"],
          },
          members: {
            names: [userName],
            roles: [],
          },
        },
        "_security",
      );

      console.log(`Database ${dbName} created with security`);
    } else {
      throw err;
    }
  }

  return dbName;
}

/**
 * Ensure CouchDB system databases exist
 */
async function ensureSystemDatabases() {
  try {
    // Check if _users database exists
    try {
      await nano.db.get("_users");
      console.log("✓ _users database exists");
    } catch (err) {
      if (err.statusCode === 404) {
        console.log("Creating _users database...");
        await nano.db.create("_users");
        console.log("✓ _users database created");
      } else {
        throw err;
      }
    }

    // Check if _replicator database exists
    try {
      await nano.db.get("_replicator");
      console.log("✓ _replicator database exists");
    } catch (err) {
      if (err.statusCode === 404) {
        console.log("Creating _replicator database...");
        await nano.db.create("_replicator");
        console.log("✓ _replicator database created");
      } else {
        throw err;
      }
    }

    return true;
  } catch (err) {
    console.error("Failed to ensure system databases:", err.message);
    return false;
  }
}

/**
 * Generate deterministic CouchDB password for a user
 * This allows us to regenerate the same password when needed
 */
function generateCouchPassword(userId) {
  const hmac = crypto.createHmac("sha256", config.jwtSecret);
  hmac.update(`couchdb-password-${userId}`);
  return hmac.digest("hex");
}

/**
 * Create or get CouchDB user credentials
 */
async function ensureCouchUser(userId, userEmail) {
  const userName = `user_${userId}`;
  const password = generateCouchPassword(userId); // Deterministic password

  try {
    // Check if user exists
    await couchAdmin.request({
      path: `_users/org.couchdb.user:${userName}`,
    });
    console.log(`CouchDB user ${userName} already exists`);
    // Return the same password (deterministic generation)
    return { userName, password };
  } catch (err) {
    if (err.statusCode === 404) {
      // Create user
      console.log(`Creating CouchDB user ${userName}`);
      await couchAdmin.request({
        db: "_users",
        method: "POST",
        body: {
          _id: `org.couchdb.user:${userName}`,
          name: userName,
          type: "user",
          roles: [],
          password: password,
          email: userEmail,
        },
      });
      return { userName, password };
    } else {
      throw err;
    }
  }
}

/**
 * Generate JWT token
 */
function generateJWT(userId, email) {
  return jwt.sign({ userId, email }, config.jwtSecret, { expiresIn: "7d" });
}

/**
 * Verify JWT token middleware
 */
function verifyToken(req, res, next) {
  const token =
    req.cookies.authToken || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ============================================================================
// Auth Routes
// ============================================================================

/**
 * Get Google OAuth URL
 */
app.get("/auth/google/url", (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    prompt: "consent",
  });

  res.json({ url });
});

/**
 * Handle Google OAuth callback
 */
app.post("/auth/google/callback", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No authorization code provided" });
  }

  try {
    console.log("Processing OAuth callback...");

    // Exchange code for tokens
    console.log("Exchanging code for tokens...");
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    console.log("Verifying ID token...");
    // Verify ID token and get user info
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.googleClientId,
    });

    const payload = ticket.getPayload();
    const { sub: googleSub, email, name, picture } = payload;

    console.log(`User authenticated: ${email}`);

    // Generate our internal user ID
    const userId = generateUserId(googleSub);

    console.log("Ensuring user database exists...");
    // Ensure user database exists
    const dbName = await ensureUserDatabase(userId, email);

    console.log("Ensuring CouchDB user exists...");
    // Ensure CouchDB user exists and get credentials
    const { userName, password } = await ensureCouchUser(userId, email);

    console.log("Generating JWT...");
    // Generate JWT
    const jwtToken = generateJWT(userId, email);

    // Set HTTP-only cookie
    res.cookie("authToken", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    console.log("Authentication successful!");

    // Return user info and database details
    res.json({
      user: {
        id: userId,
        email,
        name,
        picture,
      },
      database: {
        name: dbName,
        url: `${config.couchdbUrl.replace(/\/\/.*@/, "//")}/${dbName}`,
        userName,
        password, // Always include password (deterministically generated)
      },
      token: jwtToken,
    });
  } catch (err) {
    console.error("Google OAuth error:", err);

    // Send detailed error for debugging
    res.status(500).json({
      error: "Authentication failed",
      details: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

/**
 * Get current user info
 */
app.get("/auth/me", verifyToken, async (req, res) => {
  const { userId, email } = req.user;
  const dbName = getUserDbName(userId);
  const userName = `user_${userId}`;

  res.json({
    user: {
      id: userId,
      email,
    },
    database: {
      name: dbName,
      url: `${config.couchdbUrl.replace(/\/\/.*@/, "//")}/${dbName}`,
      userName,
    },
  });
});

/**
 * Get CouchDB credentials
 * Uses deterministic password generation so credentials can be retrieved at any time
 */
app.get("/auth/couch-credentials", verifyToken, (req, res) => {
  const { userId } = req.user;
  const userName = `user_${userId}`;
  const password = generateCouchPassword(userId); // Regenerate deterministically

  res.json({
    userName,
    password,
    dbName: getUserDbName(userId),
  });
});

/**
 * Logout
 */
app.post("/auth/logout", (req, res) => {
  res.clearCookie("authToken");
  res.clearCookie("couchPassword");
  res.json({ success: true });
});

/**
 * Refresh token
 */
app.post("/auth/refresh", verifyToken, (req, res) => {
  const { userId, email } = req.user;
  const newToken = generateJWT(userId, email);

  res.cookie("authToken", newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ token: newToken });
});

// ============================================================================
// Database Management Routes (Protected)
// ============================================================================

/**
 * Get user's database info
 */
app.get("/api/database/info", verifyToken, async (req, res) => {
  const { userId } = req.user;
  const dbName = getUserDbName(userId);

  try {
    const db = couchAdmin.use(dbName);
    const info = await db.info();
    res.json(info);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to get database info", details: err.message });
  }
});

/**
 * Compact user's database
 */
app.post("/api/database/compact", verifyToken, async (req, res) => {
  const { userId } = req.user;
  const dbName = getUserDbName(userId);

  try {
    const db = couchAdmin.use(dbName);
    await db.compact();
    res.json({ success: true, message: "Database compaction started" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to compact database", details: err.message });
  }
});

// ============================================================================
// Health Check
// ============================================================================

app.get("/health", async (req, res) => {
  try {
    // Check CouchDB connection
    await couchAdmin.db.list();
    res.json({
      status: "healthy",
      couchdb: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: "unhealthy",
      couchdb: "disconnected",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// Start Server
// ============================================================================

/**
 * Initialize server - ensure CouchDB is ready
 */
async function initializeServer() {
  console.log("Initializing server...");

  // Ensure CouchDB system databases exist
  const systemDbsReady = await ensureSystemDatabases();

  if (!systemDbsReady) {
    console.error("⚠️  Warning: System databases might not be ready");
    console.error("   You may encounter issues creating users");
  }

  console.log("✓ Server initialization complete");
}

app.listen(PORT, async () => {
  console.log(`Auth server running on port ${PORT}`);
  console.log(`Frontend URL: ${config.frontendUrl}`);
  console.log(
    `CouchDB URL: ${config.couchdbUrl.replace(/\/\/.*@/, "//***:***@")}`,
  );

  // Initialize async
  await initializeServer();
});

export default app;
