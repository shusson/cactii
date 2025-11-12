const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");
const { promisify } = require("util");

const dbPath = process.env.DB_PATH || path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath);

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbExec = promisify(db.exec.bind(db));

// Initialize database
async function initializeDatabase() {
  // Enable foreign keys
  await dbRun("PRAGMA foreign_keys = ON");

  // Create users table
  await dbExec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add description column if it doesn't exist (for existing databases)
  try {
    await dbRun("ALTER TABLE users ADD COLUMN description TEXT");
  } catch (error) {
    // Column already exists, ignore error
  }

  // Add nickname column if it doesn't exist (for existing databases)
  try {
    await dbRun("ALTER TABLE users ADD COLUMN nickname TEXT");
  } catch (error) {
    // Column already exists, ignore error
  }

  // Create refresh_tokens table
  await dbExec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

// Initialize default users if they don't exist
async function initializeUsers() {
  const defaultUsers = [
    { username: "admin", password: "admin123" },
    { username: "user", password: "password123" },
  ];

  for (const userData of defaultUsers) {
    try {
      const existing = await dbGet("SELECT id FROM users WHERE username = ?", [
        userData.username,
      ]);

      if (!existing) {
        const hashedPassword = bcrypt.hashSync(userData.password, 10);
        await dbRun("INSERT INTO users (username, password) VALUES (?, ?)", [
          userData.username,
          hashedPassword,
        ]);
        console.log(
          `✓ Created default user: ${userData.username} (password: ${userData.password})`
        );
      }
    } catch (error) {
      console.error(`Error initializing user ${userData.username}:`, error);
    }
  }
}

// Initialize database and users on module load
(async () => {
  await initializeDatabase();
  await initializeUsers();
})().catch(console.error);

// Database helper functions
const dbHelpers = {
  run: dbRun,
  get: dbGet,
  all: dbAll,
  exec: dbExec,
  prepare: (sql) => {
    const stmt = db.prepare(sql);
    return {
      run: promisify(stmt.run.bind(stmt)),
      get: promisify(stmt.get.bind(stmt)),
      all: promisify(stmt.all.bind(stmt)),
      finalize: promisify(stmt.finalize.bind(stmt)),
    };
  },
};

module.exports = dbHelpers;
