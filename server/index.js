const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Database location - use DATA_DIR env var or default to ./data
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'leaderboard.db');

console.log(`Database path: ${dbPath}`);
const db = new Database(dbPath);

// Initialize database
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
db.exec(`CREATE INDEX IF NOT EXISTS idx_email ON leaderboard(email)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC)`);
console.log('Database initialized');

app.use(cors());
app.use(express.json());

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Prepared statements for better performance
const getTopScores = db.prepare(`
  SELECT name, score, timestamp 
  FROM leaderboard 
  ORDER BY score DESC 
  LIMIT 10
`);

const getByEmail = db.prepare(`
  SELECT id, score FROM leaderboard WHERE LOWER(email) = LOWER(?)
`);

const updateScore = db.prepare(`
  UPDATE leaderboard SET name = ?, score = ?, timestamp = ? WHERE id = ?
`);

const insertWithEmail = db.prepare(`
  INSERT INTO leaderboard (name, score, email, timestamp) VALUES (?, ?, ?, ?)
`);

const insertWithoutEmail = db.prepare(`
  INSERT INTO leaderboard (name, score, timestamp) VALUES (?, ?, ?)
`);

// GET /api/leaderboard - Fetch top scores
app.get('/api/leaderboard', (req, res) => {
  try {
    const rows = getTopScores.all();
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
      const existing = getByEmail.get(email);
      
      if (existing) {
        // Only update if new score is higher
        if (score > existing.score) {
          updateScore.run(name, score, ts, existing.id);
        }
      } else {
        insertWithEmail.run(name, score, email, ts);
      }
    } else {
      insertWithoutEmail.run(name, score, ts);
    }
    
    // Return updated top 10
    const rows = getTopScores.all();
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
    res.json({ status: 'ok', db: 'sqlite' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`General Deterrence server running on port ${PORT}`);
  console.log(`Database: SQLite at ${dbPath}`);
});
