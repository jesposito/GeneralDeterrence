const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { validateSubmission } = require('./validate');

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
// Index on LOWER(email) so the case-insensitive dedup lookup can use an index (not a full scan).
db.exec(`CREATE INDEX IF NOT EXISTS idx_email_lower ON leaderboard(LOWER(email))`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC)`);
// Additive migrations (existing DBs): day for daily boards/percentile, station for crew
// cohorts, kudos for commendations. ALTER fails harmlessly if the column already exists.
for (const ddl of [
  `ALTER TABLE leaderboard ADD COLUMN day TEXT`,
  `ALTER TABLE leaderboard ADD COLUMN station TEXT`,
  `ALTER TABLE leaderboard ADD COLUMN kudos INTEGER NOT NULL DEFAULT 0`,
]) {
  try { db.exec(ddl); } catch { /* column already exists */ }
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_day_score ON leaderboard(day, score DESC)`);
console.log('Database initialized');

// The server owns "today" (its local date) so every player shares one daily board.
const todayKey = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const yesterdayKey = () => {
  const d = new Date(Date.now() - 86_400_000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// CORS: production serves the SPA same-origin (no CORS needed); this allowlist only
// covers local dev origins. Override with ALLOWED_ORIGINS (comma-separated) if the API
// is ever hosted cross-origin from the frontend.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '8kb' }));

// Production sits behind a reverse proxy (Cloudflare/Caddy or Fly), so without this every
// req.ip is the proxy's address and the rate limit below becomes ONE shared bucket — a
// classroom of players 429s each other. Trust exactly one hop; prefer the CDN's client-IP
// header when present. ponytail: header-based keying is spoofable when hitting the origin
// directly — acceptable for a leaderboard; move to signed sessions if abuse ever shows up.
app.set('trust proxy', 1);
const clientIp = (req) =>
  req.headers['cf-connecting-ip'] || req.headers['fly-client-ip'] || req.ip;

// Rate-limit the unauthenticated write endpoint to blunt score-spamming and table growth.
const submitLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => clientIp(req),
});

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Prepared statements for better performance
const getTopScores = db.prepare(`
  SELECT id, name, score, timestamp, station, kudos
  FROM leaderboard
  ORDER BY score DESC
  LIMIT 10
`);

const getTopScoresDaily = db.prepare(`
  SELECT id, name, score, timestamp, station, kudos
  FROM leaderboard
  WHERE day = ?
  ORDER BY score DESC
  LIMIT 10
`);

const getTopScoresStation = db.prepare(`
  SELECT id, name, score, timestamp, station, kudos
  FROM leaderboard
  WHERE station = ?
  ORDER BY score DESC
  LIMIT 10
`);

const getByEmail = db.prepare(`
  SELECT id, score FROM leaderboard WHERE LOWER(email) = LOWER(?)
`);

const updateScore = db.prepare(`
  UPDATE leaderboard SET name = ?, score = ?, timestamp = ?, day = ?, station = ? WHERE id = ?
`);

const insertWithEmail = db.prepare(`
  INSERT INTO leaderboard (name, score, email, timestamp, day, station) VALUES (?, ?, ?, ?, ?, ?)
`);

const insertWithoutEmail = db.prepare(`
  INSERT INTO leaderboard (name, score, timestamp, day, station) VALUES (?, ?, ?, ?, ?)
`);

const countTodayAbove = db.prepare(`SELECT COUNT(*) AS n FROM leaderboard WHERE day = ? AND score > ?`);
const countToday = db.prepare(`SELECT COUNT(*) AS n FROM leaderboard WHERE day = ?`);
const addKudos = db.prepare(`UPDATE leaderboard SET kudos = kudos + 1 WHERE id = ?`);
const getChampion = db.prepare(`SELECT name, score FROM leaderboard WHERE day = ? ORDER BY score DESC LIMIT 1`);

// GET /api/leaderboard?scope=all|daily&station=XXXX - Fetch top scores
app.get('/api/leaderboard', (req, res) => {
  try {
    const { scope, station } = req.query;
    let rows;
    if (typeof station === 'string' && /^[A-Z0-9]{2,4}$/i.test(station)) {
      rows = getTopScoresStation.all(station.toUpperCase());
    } else if (scope === 'daily') {
      rows = getTopScoresDaily.all(todayKey());
    } else {
      rows = getTopScores.all();
    }
    res.json(rows);
  } catch (error) {
    console.error('Error reading leaderboard:', error);
    res.status(500).json({ error: 'Failed to read leaderboard' });
  }
});

// GET /api/leaderboard/percentile?score=N — "top X% today". Includes the just-submitted run.
app.get('/api/leaderboard/percentile', (req, res) => {
  try {
    const score = Number(req.query.score);
    if (!Number.isFinite(score)) return res.status(400).json({ error: 'score required' });
    const day = todayKey();
    const total = countToday.get(day).n;
    if (total === 0) return res.json({ percentile: null, playersToday: 0 });
    const above = countTodayAbove.get(day, score).n;
    // Percent of today's runs at-or-below this score, expressed as "top X%".
    const topPct = Math.max(1, Math.round(((above + 1) / (total + 1)) * 100));
    res.json({ percentile: topPct, playersToday: total });
  } catch (error) {
    console.error('Error computing percentile:', error);
    res.status(500).json({ error: 'Failed to compute percentile' });
  }
});

// POST /api/leaderboard/:id/kudos — commendations, Death Stranding rules: no downvotes.
const kudosLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: (req) => clientIp(req) });
app.post('/api/leaderboard/:id/kudos', kudosLimiter, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'invalid id' });
    const result = addKudos.run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error adding kudos:', error);
    res.status(500).json({ error: 'Failed to add kudos' });
  }
});

// GET /api/leaderboard/champion — yesterday's #1, patrols tonight's map as an NPC unit.
app.get('/api/leaderboard/champion', (req, res) => {
  try {
    const row = getChampion.get(yesterdayKey());
    res.json(row || null);
  } catch (error) {
    console.error('Error reading champion:', error);
    res.status(500).json({ error: 'Failed to read champion' });
  }
});

// POST /api/leaderboard - Submit a new score
app.post('/api/leaderboard', submitLimiter, (req, res) => {
  const result = validateSubmission(req.body);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  const { name, score, email, station } = result.value;
  // The server owns the timestamp and the day — never trust the client's.
  const ts = Date.now();
  const day = todayKey();

  try {
    if (email) {
      const existing = getByEmail.get(email);
      if (existing) {
        // Only update if the new score is higher.
        if (score > existing.score) {
          updateScore.run(name, score, ts, day, station, existing.id);
        }
      } else {
        insertWithEmail.run(name, score, email, ts, day, station);
      }
    } else {
      insertWithoutEmail.run(name, score, ts, day, station);
    }

    res.json(getTopScores.all());
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
