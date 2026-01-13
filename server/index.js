const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Turso HTTP API configuration
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

// In-memory fallback when Turso is not configured
let inMemoryLeaderboard = [];

// Execute SQL via Turso HTTP API
async function executeSQL(sql, args = []) {
  if (!TURSO_URL || !TURSO_TOKEN) {
    return null; // Use in-memory fallback
  }

  // Convert libsql URL to HTTP URL
  const httpUrl = TURSO_URL.replace('libsql://', 'https://');
  
  console.log(`Executing SQL: ${sql.substring(0, 100)}...`);
  
  const body = {
    requests: [
      { type: 'execute', stmt: { sql, args: args.map(a => ({ type: 'text', value: String(a) })) } },
      { type: 'close' }
    ]
  };
  
  const response = await fetch(`${httpUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  
  if (!response.ok) {
    console.error(`Turso API error: ${response.status} - ${text}`);
    throw new Error(`Turso API error: ${response.status} - ${text}`);
  }

  const data = JSON.parse(text);
  console.log(`Turso response:`, JSON.stringify(data).substring(0, 200));
  
  // Check for errors in the response
  if (data.results && data.results[0] && data.results[0].type === 'error') {
    console.error('Turso query error:', data.results[0].error);
    throw new Error(`Turso query error: ${JSON.stringify(data.results[0].error)}`);
  }
  
  return data.results[0];
}

app.use(cors());
app.use(express.json());

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize database
async function initDb() {
  if (!TURSO_URL || !TURSO_TOKEN) {
    console.log('Turso not configured - using in-memory leaderboard (scores will not persist across restarts)');
    return;
  }

  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        score INTEGER NOT NULL,
        email TEXT,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Turso database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Turso database:', error.message);
    console.log('Falling back to in-memory leaderboard');
  }
}

// GET /api/leaderboard - Fetch top scores
app.get('/api/leaderboard', async (req, res) => {
  try {
    if (!TURSO_URL || !TURSO_TOKEN) {
      const sorted = [...inMemoryLeaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
      return res.json(sorted);
    }

    const result = await executeSQL(`
      SELECT name, score, timestamp 
      FROM leaderboard 
      ORDER BY score DESC 
      LIMIT 10
    `);
    
    // Check if we got a valid response
    if (!result || !result.response || !result.response.result || !result.response.result.rows) {
      console.log('No rows returned from Turso, returning empty array');
      return res.json([]);
    }
    
    const rows = result.response.result.rows.map(row => ({
      name: row[0].value,
      score: parseInt(row[1].value),
      timestamp: parseInt(row[2].value)
    }));
    
    res.json(rows);
  } catch (error) {
    console.error('Error reading leaderboard:', error);
    const sorted = [...inMemoryLeaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
    res.json(sorted);
  }
});

// POST /api/leaderboard - Submit a new score
app.post('/api/leaderboard', async (req, res) => {
  const { name, score, email, timestamp } = req.body;
  
  console.log('Received score submission:', { name, score, email, timestamp });
  
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: 'Name and score are required' });
  }

  const ts = timestamp || Date.now();

  try {
    if (!TURSO_URL || !TURSO_TOKEN) {
      // In-memory storage
      if (email) {
        const existing = inMemoryLeaderboard.find(e => e.email?.toLowerCase() === email.toLowerCase());
        if (existing) {
          if (score > existing.score) {
            existing.name = name;
            existing.score = score;
            existing.timestamp = ts;
          }
        } else {
          inMemoryLeaderboard.push({ name, score, email, timestamp: ts });
        }
      } else {
        inMemoryLeaderboard.push({ name, score, timestamp: ts });
      }
      const sorted = [...inMemoryLeaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
      return res.json(sorted);
    }

    if (email) {
      // Check if user with this email exists
      const existing = await executeSQL(
        'SELECT id, score FROM leaderboard WHERE LOWER(email) = LOWER(?)',
        [email]
      );
      
      const rows = existing?.response?.result?.rows || [];
      if (rows.length > 0) {
        const existingScore = parseInt(rows[0][1].value);
        const existingId = rows[0][0].value;
        if (score > existingScore) {
          await executeSQL(
            'UPDATE leaderboard SET name = ?, score = ?, timestamp = ? WHERE id = ?',
            [name, score, ts, existingId]
          );
          console.log(`Updated existing entry for ${email}`);
        } else {
          console.log(`Score ${score} not higher than existing ${existingScore}`);
        }
      } else {
        await executeSQL(
          'INSERT INTO leaderboard (name, score, email, timestamp) VALUES (?, ?, ?, ?)',
          [name, score, email, ts]
        );
        console.log(`Inserted new entry for ${email}`);
      }
    } else {
      await executeSQL(
        'INSERT INTO leaderboard (name, score, timestamp) VALUES (?, ?, ?)',
        [name, score, ts]
      );
      console.log(`Inserted new entry without email`);
    }
    
    // Return updated top 10
    const result = await executeSQL(`
      SELECT name, score, timestamp 
      FROM leaderboard 
      ORDER BY score DESC 
      LIMIT 10
    `);
    
    const leaderboard = (result?.response?.result?.rows || []).map(row => ({
      name: row[0].value,
      score: parseInt(row[1].value),
      timestamp: parseInt(row[2].value)
    }));
    
    console.log(`Returning ${leaderboard.length} leaderboard entries`);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    res.status(500).json({ error: 'Failed to update leaderboard', details: error.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = TURSO_URL && TURSO_TOKEN ? 'turso' : 'in-memory';
  res.json({ status: 'ok', db: dbStatus });
});

// Debug endpoint to test Turso connection
app.get('/api/debug', async (req, res) => {
  try {
    const result = await executeSQL('SELECT COUNT(*) as count FROM leaderboard');
    res.json({ 
      tursoConfigured: !!(TURSO_URL && TURSO_TOKEN),
      tursoUrl: TURSO_URL ? TURSO_URL.substring(0, 30) + '...' : null,
      result: result
    });
  } catch (error) {
    res.json({ 
      tursoConfigured: !!(TURSO_URL && TURSO_TOKEN),
      tursoUrl: TURSO_URL ? TURSO_URL.substring(0, 30) + '...' : null,
      error: error.message 
    });
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
    console.log(`Database: ${TURSO_URL ? 'Turso (cloud)' : 'In-memory (temporary)'}`);
  });
}).catch(err => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});
