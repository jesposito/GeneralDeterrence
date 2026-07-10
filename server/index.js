const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const {
  validateRunRequest,
  validateEditTokenRequest,
  validateSubmission,
  validateClientError,
  DAY_RE,
  STATION_RE,
  MIN_ELAPSED_MS,
  MAX_ELAPSED_MS,
} = require('./validate');

const PORT = process.env.PORT || 3001;
const SCHEMA_VERSION = 5;
const RUN_LIFETIME_MS = MAX_ELAPSED_MS;
const RUN_PRUNE_GRACE_MS = 2 * 86_400_000;
const RETENTION_DAYS = 90;
const DATA_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const nzDay = (epochMs) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(epochMs));
const addCalendarDays = (day, amount) => {
  if (!DAY_RE.test(day) || !Number.isInteger(amount)) throw new Error('Invalid calendar day');
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const seedForDay = (day) => Number(day.replace(/-/g, ''));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function addColumn(db, table, name, definition) {
  const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
  if (!columns.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

const migrations = [
  {
    version: 1,
    run(db) {
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
      db.exec('CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC)');
    },
  },
  {
    version: 2,
    run(db) {
      addColumn(db, 'leaderboard', 'day', 'TEXT');
      addColumn(db, 'leaderboard', 'station', 'TEXT');
      addColumn(db, 'leaderboard', 'kudos', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'leaderboard', 'attempts', 'INTEGER');
      db.exec('CREATE INDEX IF NOT EXISTS idx_day_score ON leaderboard(day, score DESC)');
    },
  },
  {
    version: 3,
    run(db) {
      addColumn(db, 'leaderboard', 'mode', 'TEXT');
      addColumn(db, 'leaderboard', 'seed', 'INTEGER');
      addColumn(db, 'leaderboard', 'elapsed_ms', 'INTEGER');
      addColumn(db, 'leaderboard', 'breakdown', 'TEXT');
      addColumn(db, 'leaderboard', 'edit_token_hash', 'TEXT');
      db.exec(`
        CREATE TABLE IF NOT EXISTS run_grants (
          token_hash TEXT PRIMARY KEY,
          edit_token_hash TEXT NOT NULL,
          mode TEXT NOT NULL CHECK (mode IN ('daily', 'free')),
          day TEXT NOT NULL,
          seed INTEGER NOT NULL,
          issued_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          attempt INTEGER NOT NULL,
          used_at INTEGER,
          leaderboard_id INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_run_identity ON run_grants(edit_token_hash, mode, day);
        CREATE INDEX IF NOT EXISTS idx_run_expiry ON run_grants(expires_at);
        CREATE INDEX IF NOT EXISTS idx_mode_day_score ON leaderboard(mode, day, score DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_edit
          ON leaderboard(day, mode, edit_token_hash)
          WHERE edit_token_hash IS NOT NULL;
        DROP INDEX IF EXISTS idx_email;
        DROP INDEX IF EXISTS idx_email_lower;
        UPDATE leaderboard SET email = NULL WHERE email IS NOT NULL;
      `);
    },
  },
  {
    version: 4,
    run(db) {
      const updateLegacy = db.prepare(`
        UPDATE leaderboard SET mode = COALESCE(mode, 'legacy'), day = ?, seed = COALESCE(seed, ?), email = NULL
        WHERE id = ?
      `);
      for (const row of db.prepare(`
        SELECT id, timestamp, day FROM leaderboard WHERE mode IS NULL OR day IS NULL
      `).all()) {
        let day = row.day;
        if (!day || !DAY_RE.test(day)) {
          try { day = nzDay(Number(row.timestamp)); }
          catch { day = '1970-01-01'; }
        }
        updateLegacy.run(day, seedForDay(day), row.id);
      }
      db.exec('UPDATE leaderboard SET email = NULL WHERE email IS NOT NULL');
    },
  },
  {
    version: 5,
    run(db) {
      // Pre-v3 rows have no run identity, so their mode cannot be reconstructed reliably.
      db.exec(`
        UPDATE leaderboard SET mode = 'legacy', email = NULL
        WHERE edit_token_hash IS NULL AND (mode IS NULL OR mode = 'daily')
      `);
    },
  },
];

function positiveIntegerSetting(name, value, fallback, max) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return parsed;
}

function migrateDatabase(db) {
  const current = db.pragma('user_version', { simple: true });
  if (current > SCHEMA_VERSION) {
    throw new Error(`Database schema ${current} is newer than supported schema ${SCHEMA_VERSION}`);
  }
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    db.transaction(() => {
      migration.run(db);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
}

function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  migrateDatabase(db);
  return db;
}

function createApp(options = {}) {
  const now = options.now || Date.now;
  const logger = options.logger || console;
  const writeRateLimit = positiveIntegerSetting(
    'WRITE_RATE_LIMIT',
    Object.hasOwn(options, 'writeRateLimit') ? options.writeRateLimit : process.env.WRITE_RATE_LIMIT,
    10,
    1000,
  );
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(__dirname, 'data');
  const adminToken = Object.hasOwn(options, 'adminToken') ? options.adminToken : process.env.LEADERBOARD_ADMIN_TOKEN;
  if (adminToken !== undefined && adminToken !== ''
      && (typeof adminToken !== 'string' || adminToken.length < 32 || adminToken.length > 256)) {
    throw new Error('LEADERBOARD_ADMIN_TOKEN must be 32-256 characters when configured');
  }
  const dbPath = options.dbPath || path.join(dataDir, 'leaderboard.db');
  const repoDistPath = path.join(__dirname, '..', 'dist');
  const distPath = options.distPath
    || (process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR)
      : fs.existsSync(repoDistPath) ? repoDistPath : path.join(__dirname, 'dist'));
  const db = openDatabase(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join('; '));
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  // Direct deployments must not trust caller-supplied forwarding headers. Reverse-proxy
  // deployments can opt in with TRUST_PROXY=1 (hop count) or a proxy CIDR/address list.
  const trustProxy = Object.hasOwn(options, 'trustProxy') ? options.trustProxy : process.env.TRUST_PROXY;
  if (trustProxy && trustProxy !== 'false' && trustProxy !== '0') {
    app.set('trust proxy', typeof trustProxy === 'string' && /^\d+$/.test(trustProxy)
      ? Number(trustProxy) : trustProxy);
  }
  app.use(cors({ origin: allowedOrigins }));
  app.use(compression());
  app.use(express.json({ limit: '8kb' }));

  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: writeRateLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }, // Direct deployments intentionally ignore spoofed forwarding headers.
  });
  const kudosLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
  });
  const errorLimiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
  });

  app.use(express.static(distPath, {
    setHeaders(res, filePath) {
      if (['index.html', 'sw.js', 'registerSW.js', 'manifest.json'].includes(path.basename(filePath))) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      } else if ((filePath.includes(`${path.sep}assets${path.sep}`) && /-[A-Za-z0-9_-]{8,}\./.test(path.basename(filePath)))
          || /^workbox-[a-f0-9]{8,}\.js$/.test(path.basename(filePath))) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  const selectFields = 'id, name, score, timestamp, day, seed, station, kudos, attempts';
  const getTopScores = db.prepare(`
    SELECT ${selectFields} FROM leaderboard
    WHERE mode = 'daily'
    ORDER BY score DESC, timestamp ASC LIMIT 10
  `);
  const getTopScoresDaily = db.prepare(`
    SELECT ${selectFields} FROM leaderboard
    WHERE mode = 'daily' AND day = ?
    ORDER BY score DESC, timestamp ASC LIMIT 10
  `);
  const getTopScoresStation = db.prepare(`
    SELECT ${selectFields} FROM leaderboard
    WHERE mode = 'daily' AND station = ?
    ORDER BY score DESC, timestamp ASC LIMIT 10
  `);
  const getEntry = db.prepare(`SELECT ${selectFields} FROM leaderboard WHERE id = ?`);
  const getByIdentity = db.prepare(`
    SELECT id, score FROM leaderboard
    WHERE mode = 'daily' AND day = ? AND edit_token_hash = ?
  `);
  const insertScore = db.prepare(`
    INSERT INTO leaderboard
      (name, score, timestamp, day, mode, seed, station, attempts, elapsed_ms, breakdown, edit_token_hash)
    VALUES (?, ?, ?, ?, 'daily', ?, ?, ?, ?, ?, ?)
  `);
  const updateBest = db.prepare(`
    UPDATE leaderboard SET name = ?, score = ?, timestamp = ?, seed = ?, station = ?, attempts = MAX(COALESCE(attempts, 0), ?),
      elapsed_ms = ?, breakdown = ? WHERE id = ?
  `);
  const updateAttempt = db.prepare(`
    UPDATE leaderboard SET name = ?, station = ?, attempts = MAX(COALESCE(attempts, 0), ?) WHERE id = ?
  `);
  const countAbove = db.prepare(`
    SELECT COUNT(*) AS n FROM leaderboard WHERE mode = 'daily' AND day = ? AND score > ?
  `);
  const countDay = db.prepare(`SELECT COUNT(*) AS n FROM leaderboard WHERE mode = 'daily' AND day = ?`);
  const getChampion = db.prepare(`
    SELECT name, score FROM leaderboard
    WHERE mode = 'daily' AND day = ? ORDER BY score DESC, timestamp ASC LIMIT 1
  `);
  const addKudos = db.prepare(`UPDATE leaderboard SET kudos = kudos + 1 WHERE id = ? AND mode = 'daily'`);
  const getRun = db.prepare('SELECT * FROM run_grants WHERE token_hash = ?');
  const countAttempts = db.prepare(`
    SELECT COUNT(*) AS n FROM run_grants WHERE edit_token_hash = ? AND mode = ? AND day = ?
  `);
  const insertRun = db.prepare(`
    INSERT INTO run_grants
      (token_hash, edit_token_hash, mode, day, seed, issued_at, expires_at, attempt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const completeRun = db.prepare(`
    UPDATE run_grants SET used_at = ?, leaderboard_id = ? WHERE token_hash = ? AND used_at IS NULL
  `);
  const deleteScoresByIdentity = db.prepare('DELETE FROM leaderboard WHERE edit_token_hash = ?');
  const deleteRunsByIdentity = db.prepare('DELETE FROM run_grants WHERE edit_token_hash = ?');
  const deleteScoreById = db.prepare('DELETE FROM leaderboard WHERE id = ?');
  const deleteIdentity = db.transaction((editTokenHash) => {
    deleteScoresByIdentity.run(editTokenHash);
    deleteRunsByIdentity.run(editTokenHash);
  });
  const pruneRuns = db.prepare('DELETE FROM run_grants WHERE expires_at < ?');
  const pruneScores = db.prepare(`
    DELETE FROM leaderboard
    WHERE day IS NULL OR mode IS NULL OR timestamp < ?
  `);

  const cleanupData = () => {
    const timestamp = now();
    // Expired grants remain briefly as attempt/idempotency records, but cannot submit.
    pruneRuns.run(timestamp - RUN_PRUNE_GRACE_MS);
    pruneScores.run(timestamp - RETENTION_DAYS * 86_400_000);
  };
  cleanupData();
  const cleanupIntervalMs = options.cleanupIntervalMs ?? DATA_CLEANUP_INTERVAL_MS;
  const cleanupTimer = cleanupIntervalMs > 0 ? setInterval(() => {
    try { cleanupData(); }
    catch (error) { logger.error('Error pruning expired data:', error); }
  }, cleanupIntervalMs) : null;
  cleanupTimer?.unref();

  const percentileFor = (day, score) => {
    const total = countDay.get(day).n;
    if (total === 0) return { percentile: null, playersToday: 0 };
    const above = countAbove.get(day, score).n;
    const percentile = Math.ceil(((above + 1) / total) * 100);
    return { percentile: Math.max(1, Math.min(100, percentile)), playersToday: total };
  };
  const submissionResponse = (entry, day, extra = {}) => ({
    status: 'uploaded',
    entry,
    attempts: entry.attempts,
    day,
    daily: getTopScoresDaily.all(day),
    all: getTopScores.all(),
    ...percentileFor(day, entry.score),
    ...extra,
  });

  app.get('/api/day', (req, res) => {
    const day = nzDay(now());
    res.json({ day, seed: seedForDay(day) });
  });

  app.use('/api/leaderboard', (req, res, next) => {
    res.setHeader('X-Leaderboard-Verification', 'player-reported-unverified');
    try {
      cleanupData();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/runs', writeLimiter, (req, res) => {
    const result = validateRunRequest(req.body);
    if (!result.ok) return res.status(400).json({ error: result.error });
    try {
      cleanupData();
      const issuedAt = now();
      const day = nzDay(issuedAt);
      const seed = result.value.mode === 'daily' ? seedForDay(day) : crypto.randomInt(1, 2_147_483_647);
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);
      const editTokenHash = sha256(result.value.editToken);
      const attempt = db.transaction(() => {
        const nextAttempt = countAttempts.get(editTokenHash, result.value.mode, day).n + 1;
        insertRun.run(tokenHash, editTokenHash, result.value.mode, day, seed, issuedAt,
          issuedAt + RUN_LIFETIME_MS, nextAttempt);
        return nextAttempt;
      })();
      return res.status(201).json({
        token, mode: result.value.mode, day, seed, attempt,
        issuedAt, expiresAt: issuedAt + RUN_LIFETIME_MS,
      });
    } catch (error) {
      logger.error('Error issuing run:', error);
      return res.status(500).json({ error: 'Failed to start online run' });
    }
  });

  app.get('/api/leaderboard', (req, res) => {
    try {
      const { scope, station } = req.query;
      if (station !== undefined) {
        if (typeof station !== 'string' || !STATION_RE.test(station.trim().toUpperCase())) {
          return res.status(400).json({ error: 'Station code must be 2-4 letters/numbers' });
        }
        return res.json(getTopScoresStation.all(station.trim().toUpperCase()));
      }
      if (scope === 'daily') {
        const requestedDay = typeof req.query.day === 'string' && DAY_RE.test(req.query.day)
          ? req.query.day : nzDay(now());
        res.setHeader('X-Leaderboard-Day', requestedDay);
        return res.json(getTopScoresDaily.all(requestedDay));
      }
      return res.json(getTopScores.all());
    } catch (error) {
      logger.error('Error reading leaderboard:', error);
      return res.status(500).json({ error: 'Failed to read leaderboard' });
    }
  });

  app.get('/api/leaderboard/percentile', (req, res) => {
    try {
      const score = Number(req.query.score);
      if (!Number.isInteger(score)) return res.status(400).json({ error: 'Integer score required' });
      const day = typeof req.query.day === 'string' && DAY_RE.test(req.query.day)
        ? req.query.day : nzDay(now());
      return res.json(percentileFor(day, score));
    } catch (error) {
      logger.error('Error computing percentile:', error);
      return res.status(500).json({ error: 'Failed to compute percentile' });
    }
  });

  app.delete('/api/leaderboard/me', writeLimiter, (req, res) => {
    const result = validateEditTokenRequest(req.body);
    if (!result.ok) return res.status(400).json({ error: result.error });
    try {
      deleteIdentity(sha256(result.value.editToken));
      return res.status(204).end();
    } catch (error) {
      logger.error('Error deleting leaderboard identity:', error);
      return res.status(500).json({ error: 'Failed to delete leaderboard identity' });
    }
  });

  app.delete('/api/leaderboard/:id', writeLimiter, (req, res) => {
    if (!adminToken) return res.status(404).json({ error: 'Not found' });
    const match = /^Bearer (.+)$/i.exec(req.get('authorization') || '');
    const supplied = match ? Buffer.from(match[1]) : Buffer.alloc(0);
    const expected = Buffer.from(adminToken);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
    return deleteScoreById.run(id).changes === 1
      ? res.status(204).end()
      : res.status(404).json({ error: 'Not found' });
  });

  app.post('/api/leaderboard/:id/kudos', kudosLimiter, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
      if (addKudos.run(id).changes === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true });
    } catch (error) {
      logger.error('Error adding kudos:', error);
      return res.status(500).json({ error: 'Failed to add kudos' });
    }
  });

  app.get('/api/leaderboard/champion', (req, res) => {
    try {
      const yesterday = addCalendarDays(nzDay(now()), -1);
      return res.json(getChampion.get(yesterday) || null);
    } catch (error) {
      logger.error('Error reading champion:', error);
      return res.status(500).json({ error: 'Failed to read champion' });
    }
  });

  app.post('/api/leaderboard', writeLimiter, (req, res) => {
    const result = validateSubmission(req.body);
    if (!result.ok) return res.status(400).json({ error: result.error });
    const timestamp = now();
    const tokenHash = sha256(result.value.token);
    try {
      const grant = getRun.get(tokenHash);
      if (!grant) return res.status(401).json({ error: 'Unknown run token' });
      if (grant.used_at) {
        const entry = grant.leaderboard_id && getEntry.get(grant.leaderboard_id);
        if (!entry) return res.status(410).json({ error: 'Run token has already been used' });
        return res.json(submissionResponse(entry, grant.day, { replayed: true }));
      }
      if (grant.expires_at < timestamp) return res.status(410).json({ error: 'Run token has expired' });
      if (grant.mode !== 'daily') {
        return res.status(409).json({ error: 'Free Patrol scores are not published to the Daily board' });
      }
      const serverElapsed = timestamp - grant.issued_at;
      if (serverElapsed < MIN_ELAPSED_MS || serverElapsed > MAX_ELAPSED_MS
          || Math.abs(serverElapsed - result.value.elapsedMs) > 120_000) {
        return res.status(400).json({ error: 'Shift duration does not match the issued run' });
      }

      const breakdownJson = JSON.stringify(result.value.breakdown);
      const saved = db.transaction(() => {
        const existing = getByIdentity.get(grant.day, grant.edit_token_hash);
        let id;
        let inserted = false;
        if (!existing) {
          id = Number(insertScore.run(
            result.value.name, result.value.breakdown.finalScore, timestamp, grant.day, grant.seed,
            result.value.station, grant.attempt, result.value.elapsedMs, breakdownJson, grant.edit_token_hash,
          ).lastInsertRowid);
          inserted = true;
        } else {
          id = existing.id;
          if (result.value.breakdown.finalScore > existing.score) {
            updateBest.run(
              result.value.name, result.value.breakdown.finalScore, timestamp, grant.seed,
              result.value.station, grant.attempt, result.value.elapsedMs, breakdownJson, id,
            );
          } else {
            updateAttempt.run(result.value.name, result.value.station, grant.attempt, id);
          }
        }
        if (completeRun.run(timestamp, id, tokenHash).changes !== 1) throw new Error('Run was submitted concurrently');
        return { id, inserted };
      })();
      const entry = getEntry.get(saved.id);
      cleanupData();
      return res.status(saved.inserted ? 201 : 200).json(submissionResponse(entry, grant.day));
    } catch (error) {
      logger.error('Error updating leaderboard:', error);
      return res.status(500).json({ error: 'Failed to update leaderboard' });
    }
  });

  app.post('/api/client-errors', errorLimiter, (req, res) => {
    const result = validateClientError(req.body);
    if (!result.ok) return res.status(400).json({ error: result.error });
    const redact = (value) => value
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/([?&][^=\s&]{1,40}=)[^&\s]*/g, '$1[redacted]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted-ip]')
      .replace(/\b(?:bearer\s+)?[A-Za-z0-9_-]{32,}\b/gi, '[redacted-token]')
      .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[redacted-phone]');
    const message = redact(result.value.message);
    const screen = redact(result.value.screen);
    logger.error(`[client-error] ${screen}: ${message}`);
    return res.status(204).end();
  });

  app.get('/api/health', (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      return res.json({ status: 'ok', db: 'sqlite', schema: SCHEMA_VERSION });
    } catch {
      return res.status(500).json({ status: 'error', db: 'disconnected' });
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  app.get('*', (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.sendFile(path.join(distPath, 'index.html'), (error) => (error ? next(error) : undefined));
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    logger.error('Unhandled request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return {
    app,
    db,
    dbPath,
    cleanupData,
    close() {
      if (cleanupTimer) clearInterval(cleanupTimer);
      db.close();
    },
  };
}

async function backupDatabase(source, destination) {
  const sourcePath = path.resolve(source);
  const destinationPath = path.resolve(destination);
  if (sourcePath === destinationPath) throw new Error('Backup destination must differ from the live database');
  if (!fs.existsSync(sourcePath)) throw new Error(`Database not found: ${sourcePath}`);
  if (fs.existsSync(destinationPath)) throw new Error(`Refusing to overwrite existing backup: ${destinationPath}`);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const db = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(destinationPath);
  } finally {
    db.close();
  }
  return destinationPath;
}

if (require.main === module) {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  const dbPath = path.join(dataDir, 'leaderboard.db');
  if (process.argv[2] === '--backup') {
    const destination = process.argv[3];
    if (!destination) {
      console.error('Usage: npm run backup -- /path/to/leaderboard-backup.db');
      process.exitCode = 1;
    } else {
      backupDatabase(dbPath, destination)
        .then((savedTo) => console.log(`Backup written to ${savedTo}`))
        .catch((error) => { console.error(error.message); process.exitCode = 1; });
    }
  } else {
    const { app, dbPath: openedPath, close } = createApp({ dataDir, dbPath });
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`General Deterrence server running on port ${PORT}`);
      console.log(`Database: SQLite at ${openedPath}`);
    });
    let shuttingDown = false;
    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`${signal} received; closing server`);
      server.close((error) => {
        try { close(); }
        catch (closeError) { console.error('Error closing database:', closeError); }
        if (error) {
          console.error('Error closing HTTP server:', error);
          process.exitCode = 1;
        }
      });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }
}

module.exports = { createApp, migrateDatabase, openDatabase, backupDatabase, nzDay, addCalendarDays, seedForDay, SCHEMA_VERSION };
