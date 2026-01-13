const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Turso/LibSQL connection - use env vars or fall back to local file
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url: dbUrl,
  authToken: authToken,
});

app.use(cors());
app.use(express.json());

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize database
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      email TEXT,
      timestamp INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_email ON leaderboard(email)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC)`);
  
  console.log('Database initialized');
}

// GET /api/leaderboard - Fetch top scores
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT name, score, timestamp 
      FROM leaderboard 
      ORDER BY score DESC 
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error reading leaderboard:', error);
    res.status(500).json({ error: 'Failed to read leaderboard' });
  }
});

// POST /api/leaderboard - Submit a new score
app.post('/api/leaderboard', async (req, res) => {
  const { name, score, email, timestamp } = req.body;
  
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: 'Name and score are required' });
  }

  const ts = timestamp || Date.now();

  try {
    if (email) {
      // Check if user with this email exists
      const existing = await db.execute({
        sql: 'SELECT id, score FROM leaderboard WHERE LOWER(email) = LOWER(?)',
        args: [email]
      });
      
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        // Only update if new score is higher
        if (score > row.score) {
          await db.execute({
            sql: 'UPDATE leaderboard SET name = ?, score = ?, timestamp = ? WHERE id = ?',
            args: [name, score, ts, row.id]
          });
        }
      } else {
        // Insert new entry with email
        await db.execute({
          sql: 'INSERT INTO leaderboard (name, score, email, timestamp) VALUES (?, ?, ?, ?)',
          args: [name, score, email, ts]
        });
      }
    } else {
      // No email - just insert new entry
      await db.execute({
        sql: 'INSERT INTO leaderboard (name, score, timestamp) VALUES (?, ?, ?)',
        args: [name, score, ts]
      });
    }
    
    // Return updated top 10
    const result = await db.execute(`
      SELECT name, score, timestamp 
      FROM leaderboard 
      ORDER BY score DESC 
      LIMIT 10
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await db.execute('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server after DB init
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`General Deterrence server running on port ${PORT}`);
    console.log(`Database: ${dbUrl.startsWith('libsql') ? 'Turso (cloud)' : 'Local SQLite'}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
