const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = path.join(DATA_DIR, 'leaderboard.db');

app.use(cors());
app.use(express.json());

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    email TEXT,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create index on email for faster lookups
db.exec(`CREATE INDEX IF NOT EXISTS idx_email ON leaderboard(email)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC)`);

console.log(`Database initialized at ${DB_PATH}`);

// GET /api/leaderboard - Fetch top scores
app.get('/api/leaderboard', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT name, score, timestamp 
      FROM leaderboard 
      ORDER BY score DESC 
      LIMIT 10
    `).all();
    res.json(rows);
  } catch (error) {
    console.error('Error reading leaderboard:', error);
    res.status(500).json({ error: 'Failed to read leaderboard' });
  }
});

// POST /api/leaderboard - Submit a new score
app.post('/api/leaderboard', (req, res) => {
  const { name, score, email, timestamp } = req.body;
  
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: 'Name and score are required' });
  }

  const ts = timestamp || Date.now();

  try {
    if (email) {
      // Check if user with this email exists
      const existing = db.prepare('SELECT id, score FROM leaderboard WHERE LOWER(email) = LOWER(?)').get(email);
      
      if (existing) {
        // Only update if new score is higher
        if (score > existing.score) {
          db.prepare('UPDATE leaderboard SET name = ?, score = ?, timestamp = ? WHERE id = ?')
            .run(name, score, ts, existing.id);
        }
      } else {
        // Insert new entry with email
        db.prepare('INSERT INTO leaderboard (name, score, email, timestamp) VALUES (?, ?, ?, ?)')
          .run(name, score, email, ts);
      }
    } else {
      // No email - just insert new entry
      db.prepare('INSERT INTO leaderboard (name, score, timestamp) VALUES (?, ?, ?)')
        .run(name, score, ts);
    }
    
    // Return updated top 10
    const rows = db.prepare(`
      SELECT name, score, timestamp 
      FROM leaderboard 
      ORDER BY score DESC 
      LIMIT 10
    `).all();
    
    res.json(rows);
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing database...');
  db.close();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`General Deterrence server running on port ${PORT}`);
});
