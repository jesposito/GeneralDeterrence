import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import server from './index.js';

const { createApp, openDatabase, backupDatabase, addCalendarDays, SCHEMA_VERSION } = server;
const tempDirs = [];
const databases = [];

afterEach(() => {
  while (databases.length) databases.pop().close();
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

const fixture = (clockStart = Date.parse('2026-07-10T08:00:00Z'), appOptions = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'gd-server-test-'));
  tempDirs.push(dir);
  let clock = clockStart;
  const errors = [];
  const created = createApp({
    dbPath: join(dir, 'leaderboard.db'),
    distPath: join(dir, 'dist'),
    now: () => clock,
    trustProxy: false,
    writeRateLimit: 10,
    cleanupIntervalMs: 0,
    logger: { log() {}, error(...args) { errors.push(args); } },
    ...appOptions,
  });
  databases.push(created.db);
  return {
    ...created,
    errors,
    advance(ms) { clock += ms; },
  };
};

const breakdown = (score = 100) => ({
  enforcementScore: score,
  deterrenceScore: 0,
  finalDeterrenceBonus: 0,
  livesSavedBonus: 0,
  livesLostPenalty: 0,
  finalScore: score,
  livesSaved: 0,
  livesLost: 0,
  offencesPrevented: 0,
  overtime: false,
  challengeAssist: false,
  coverageRatio: 0,
  presenceGrade: 'C',
});

const startRun = (app, mode = 'daily', editToken = 'e'.repeat(32)) =>
  request(app).post('/api/runs').send({ mode, editToken });

const submit = (app, token, score = 100, elapsedMs = 90_000) =>
  request(app).post('/api/leaderboard').send({
    token, name: 'Ana', station: 'tawa', elapsedMs, breakdown: breakdown(score),
  });

describe('run-bound leaderboard API', () => {
  it('uses calendar-day arithmetic across NZ daylight-saving boundaries', () => {
    expect(addCalendarDays('2026-04-05', -1)).toBe('2026-04-04');
    expect(addCalendarDays('2026-09-27', 1)).toBe('2026-09-28');
  });

  it('accepts every Daily attempt while retaining the identity best and latest attempt count', async () => {
    const env = fixture();
    const first = await startRun(env.app);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ mode: 'daily', day: '2026-07-10', seed: 20260710, attempt: 1 });
    env.advance(90_000);
    const uploaded = await submit(env.app, first.body.token, 100);
    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toMatchObject({ status: 'uploaded', attempts: 1, percentile: 100 });
    expect(JSON.parse(env.db.prepare('SELECT breakdown FROM leaderboard').get().breakdown).challengeAssist).toBe(false);

    const second = await startRun(env.app);
    expect(second.body.attempt).toBe(2);
    env.advance(90_000);
    const lowerRetry = await submit(env.app, second.body.token, 50);
    expect(lowerRetry.status).toBe(200);
    expect(lowerRetry.body.entry).toMatchObject({ score: 100, attempts: 2, station: 'TAWA' });

    const board = await request(env.app).get('/api/leaderboard?scope=daily');
    expect(board.headers['x-leaderboard-verification']).toBe('player-reported-unverified');
    expect(board.body).toHaveLength(1);
    expect(board.body[0]).toMatchObject({ score: 100, attempts: 2, day: '2026-07-10' });
  });

  it('never publishes a Free Patrol grant to Daily', async () => {
    const env = fixture();
    const run = await startRun(env.app, 'free');
    expect(run.status).toBe(201);
    expect(run.body.mode).toBe('free');
    expect(run.body.seed).not.toBe(20260710);
    env.advance(90_000);
    const rejected = await submit(env.app, run.body.token);
    expect(rejected.status).toBe(409);
    expect((await request(env.app).get('/api/leaderboard?scope=daily')).body).toEqual([]);
  });

  it('keeps the highest attempt count when parallel runs finish out of order', async () => {
    const env = fixture();
    const first = await startRun(env.app);
    const second = await startRun(env.app);
    expect(second.body.attempt).toBe(2);
    env.advance(90_000);
    expect((await submit(env.app, second.body.token, 50)).body.entry.attempts).toBe(2);
    const laterBest = await submit(env.app, first.body.token, 100);
    expect(laterBest.status).toBe(200);
    expect(laterBest.body.entry).toMatchObject({ score: 100, attempts: 2 });
  });

  it('rejects malformed station filters instead of returning the global board', async () => {
    const env = fixture();
    expect((await request(env.app).get('/api/leaderboard?station=X')).status).toBe(400);
    expect((await request(env.app).get('/api/leaderboard?station=TOOLONG')).status).toBe(400);
  });

  it('supports authenticated operator removal of abusive community entries', async () => {
    const adminToken = 'a'.repeat(32);
    const env = fixture(undefined, { adminToken });
    const run = await startRun(env.app);
    env.advance(90_000);
    const uploaded = await submit(env.app, run.body.token);
    const endpoint = `/api/leaderboard/${uploaded.body.entry.id}`;
    expect((await request(env.app).delete(endpoint)).status).toBe(401);
    expect((await request(env.app).delete(endpoint).set('Authorization', `Bearer ${adminToken}`)).status).toBe(204);
    expect((await request(env.app).get('/api/leaderboard')).body).toEqual([]);
  });

  it('returns a generic error for malformed JSON', async () => {
    const env = fixture();
    const response = await request(env.app)
      .post('/api/runs')
      .set('Content-Type', 'application/json')
      .send('{"mode":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Malformed JSON body' });
    expect(response.text).not.toMatch(/SyntaxError|server\/index/i);
  });

  it('accepts an issued Daily run after midnight and makes retries idempotent', async () => {
    const env = fixture(Date.parse('2026-07-10T11:59:00Z'));
    const run = await startRun(env.app);
    expect(run.body.day).toBe('2026-07-10');
    env.advance(90_000);
    const uploaded = await submit(env.app, run.body.token);
    expect(uploaded.body.day).toBe('2026-07-10');
    expect((await request(env.app).get('/api/leaderboard?scope=daily')).body).toEqual([]);
    expect((await request(env.app).get('/api/leaderboard?scope=daily&day=2026-07-10')).body).toHaveLength(1);
    const replay = await submit(env.app, run.body.token);
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
  });

  it('expires an unused run grant after the 30-minute grace window', async () => {
    const env = fixture();
    const run = await startRun(env.app);
    env.advance(30 * 60_000 + 1);
    expect((await submit(env.app, run.body.token, 100, 30 * 60_000)).status).toBe(410);
  });

  it('requires the issued token, plausible server elapsed time, and a coherent breakdown', async () => {
    const env = fixture();
    expect((await submit(env.app, 'x'.repeat(43))).status).toBe(401);
    const run = await startRun(env.app);
    expect((await submit(env.app, run.body.token)).status).toBe(400);
    env.advance(20_000);
    const bad = await request(env.app).post('/api/leaderboard').send({
      token: run.body.token,
      name: 'Ana',
      elapsedMs: 20_000,
      breakdown: { ...breakdown(), finalScore: 999 },
    });
    expect(bad.status).toBe(400);
    expect((await submit(env.app, run.body.token, 100, 20_000)).status).toBe(201);
  });

  it('deletes one authenticated identity and its run grants transactionally', async () => {
    const env = fixture();
    const firstEditToken = 'a'.repeat(32);
    const secondEditToken = 'b'.repeat(32);
    const first = await startRun(env.app, 'daily', firstEditToken);
    const second = await startRun(env.app, 'daily', secondEditToken);
    env.advance(20_000);
    expect((await submit(env.app, first.body.token, 100, 20_000)).status).toBe(201);
    expect((await submit(env.app, second.body.token, 200, 20_000)).status).toBe(201);
    await startRun(env.app, 'daily', firstEditToken);

    const deleted = await request(env.app).delete('/api/leaderboard/me').send({ editToken: firstEditToken });
    expect(deleted.status).toBe(204);
    expect(deleted.headers['x-leaderboard-verification']).toBe('player-reported-unverified');
    expect(env.db.prepare('SELECT name, score FROM leaderboard').all()).toEqual([{ name: 'Ana', score: 200 }]);
    expect(env.db.prepare('SELECT COUNT(*) AS n FROM run_grants').get().n).toBe(1);
    expect((await request(env.app).delete('/api/leaderboard/me').send({ editToken: 'c'.repeat(32) })).status).toBe(204);
    expect(env.db.prepare('SELECT COUNT(*) AS n FROM leaderboard').get().n).toBe(1);
    expect((await request(env.app).delete('/api/leaderboard/me').send({ editToken: 'short' })).status).toBe(400);
  });
});

describe('operational endpoints and storage', () => {
  it('migrates legacy data explicitly and erases stored email values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-migration-test-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'legacy.db');
    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        score INTEGER NOT NULL,
        email TEXT,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO leaderboard (name, score, email, timestamp) VALUES ('Old', 10, 'old@example.test', 1);
    `);
    legacy.close();
    const migrated = openDatabase(dbPath);
    databases.push(migrated);
    expect(migrated.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    expect(migrated.prepare('SELECT email, mode, day, seed FROM leaderboard').get()).toMatchObject({
      email: null, mode: 'legacy', day: '1970-01-01', seed: 19700101,
    });
    const columns = migrated.prepare('PRAGMA table_info(leaderboard)').all().map(column => column.name);
    expect(columns).toEqual(expect.arrayContaining(['mode', 'seed', 'elapsed_ms', 'breakdown', 'edit_token_hash']));
  });

  it('repairs null day and mode values when upgrading an existing v3 database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-v3-migration-test-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'v3.db');
    const v3 = openDatabase(dbPath);
    v3.prepare(`
      INSERT INTO leaderboard (name, score, email, timestamp, day, mode)
      VALUES ('Legacy v3', 20, 'legacy@example.test', ?, NULL, NULL)
    `).run(Date.parse('2026-07-10T08:00:00Z'));
    v3.pragma('user_version = 3');
    v3.close();

    const migrated = openDatabase(dbPath);
    databases.push(migrated);
    expect(migrated.prepare('SELECT email, mode, day, seed FROM leaderboard').get()).toMatchObject({
      email: null, mode: 'legacy', day: '2026-07-10', seed: 20260710,
    });
    expect(migrated.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
  });

  it('quarantines unauthenticated Daily rows when upgrading an existing v4 database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-v4-migration-test-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'v4.db');
    const v4 = openDatabase(dbPath);
    v4.prepare(`
      INSERT INTO leaderboard (name, score, timestamp, day, mode, edit_token_hash)
      VALUES ('Unclassified', 50, ?, '2026-07-10', 'daily', NULL)
    `).run(Date.parse('2026-07-10T08:00:00Z'));
    v4.pragma('user_version = 4');
    v4.close();

    const migrated = openDatabase(dbPath);
    databases.push(migrated);
    expect(migrated.prepare('SELECT mode FROM leaderboard').get().mode).toBe('legacy');
  });

  it('caps client error reports to privacy-safe fields', async () => {
    const env = fixture();
    expect((await request(env.app).post('/api/client-errors').send({ message: 'boom', screen: 'Playing' })).status).toBe(204);
    expect(env.errors[0][0]).toBe('[client-error] Playing: boom');
    const token = 'a'.repeat(43);
    expect((await request(env.app).post('/api/client-errors').send({
      message: `officer@example.test 203.0.113.7 +64 21 123 4567 ${token}`,
      screen: 'Playing',
    })).status).toBe(204);
    expect(env.errors[1][0]).toContain('[redacted-email]');
    expect(env.errors[1][0]).toContain('[redacted-ip]');
    expect(env.errors[1][0]).toContain('[redacted-phone]');
    expect(env.errors[1][0]).toContain('[redacted-token]');
    expect(env.errors[1][0]).not.toContain('officer@example.test');
    expect(env.errors[1][0]).not.toContain(token);
    expect((await request(env.app).post('/api/client-errors').send({ message: 'boom', screen: 'Playing', user: 'Ana' })).status).toBe(400);
  });

  it('ignores forged forwarding headers when proxy trust is not configured', async () => {
    const env = fixture();
    let response;
    for (let i = 0; i < 11; i++) {
      response = await request(env.app).post('/api/runs')
        .set('X-Forwarded-For', `203.0.113.${i + 1}`)
        .send({ mode: 'daily', editToken: 'e'.repeat(32) });
    }
    expect(response.status).toBe(429);
  });

  it('validates and applies a configurable write rate limit', async () => {
    const env = fixture(undefined, { writeRateLimit: 2 });
    expect((await startRun(env.app)).status).toBe(201);
    expect((await startRun(env.app)).status).toBe(201);
    expect((await startRun(env.app)).status).toBe(429);

    const dir = mkdtempSync(join(tmpdir(), 'gd-rate-config-test-'));
    tempDirs.push(dir);
    expect(() => createApp({
      dbPath: join(dir, 'db.sqlite'), distPath: join(dir, 'dist'), writeRateLimit: 1001,
    })).toThrow(/WRITE_RATE_LIMIT/);
  });

  it('compresses large assets and gives only hashed assets immutable caching', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-static-test-'));
    tempDirs.push(dir);
    const dist = join(dir, 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'assets', 'index-ABCDEFGH.js'), 'const value = 1;\n'.repeat(500));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>General Deterrence</title>');
    const created = createApp({ dbPath: join(dir, 'db.sqlite'), distPath: dist, logger: { log() {}, error() {} } });
    databases.push(created.db);
    const asset = await request(created.app).get('/assets/index-ABCDEFGH.js').set('Accept-Encoding', 'gzip');
    expect(asset.headers['cache-control']).toContain('immutable');
    expect(asset.headers['content-encoding']).toBe('gzip');
    const shell = await request(created.app).get('/index.html');
    expect(shell.headers['cache-control']).toContain('must-revalidate');
    expect(shell.headers).not.toHaveProperty('x-powered-by');
    expect(shell.headers['content-security-policy']).toContain("default-src 'self'");
    expect(shell.headers['x-content-type-options']).toBe('nosniff');
  });

  it('prunes expired grants and every score older than 90 days', async () => {
    const env = fixture();
    await startRun(env.app);
    const insert = env.db.prepare(`
      INSERT INTO leaderboard (name, score, timestamp, day, mode, edit_token_hash)
      VALUES (?, ?, ?, '2020-01-01', 'daily', ?)
    `);
    for (let i = 0; i < 105; i++) insert.run(`Old ${i}`, i, i, `hash-${i}`);
    env.db.prepare(`
      INSERT INTO leaderboard (name, score, timestamp, day, mode)
      VALUES ('Null legacy', 10000, 1, NULL, NULL)
    `).run();
    env.advance(100 * 86_400_000);
    expect((await request(env.app).get('/api/leaderboard')).status).toBe(200);
    expect(env.db.prepare('SELECT COUNT(*) AS n FROM run_grants').get().n).toBe(0);
    expect(env.db.prepare('SELECT COUNT(*) AS n FROM leaderboard').get().n).toBe(0);
    expect(env.db.prepare("SELECT COUNT(*) AS n FROM leaderboard WHERE day IS NULL OR mode IS NULL").get().n).toBe(0);
  });

  it('creates a consistent backup and refuses to overwrite it', async () => {
    const env = fixture();
    const destination = join(tempDirs[0], 'backups', 'leaderboard.db');
    await backupDatabase(env.dbPath, destination);
    expect(existsSync(destination)).toBe(true);
    await expect(backupDatabase(env.dbPath, destination)).rejects.toThrow(/overwrite/i);
  });
});
