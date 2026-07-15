// Dependency-free validation for the leaderboard trust boundary.

const {
  getLegacyPresenceGrade,
  getPresenceGrade,
  PRESENCE_GRADE_CONTRACT_VERSION,
} = require('../shared/presenceGrade.js');

const MIN_SCORE = -100000;
const MAX_SCORE = 100000;
const MAX_NAME = 24;
const STATION_RE = /^[A-Z0-9]{2,4}$/;
const RUN_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const EDIT_TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UNSAFE_NAME_RE = /[\p{Cc}\p{Cf}]/u;
// Shift penalties spend simulation time, so a valid run can finish well before 75s wall time.
const MIN_ELAPSED_MS = 20_000;
const MAX_ELAPSED_MS = 30 * 60 * 1000;

const integerInRange = (value, min, max) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function validateRunRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' };
  }
  if (body.mode !== 'daily' && body.mode !== 'free') {
    return { ok: false, error: 'Mode must be daily or free' };
  }
  if (typeof body.editToken !== 'string' || !EDIT_TOKEN_RE.test(body.editToken)) {
    return { ok: false, error: 'Invalid edit token' };
  }
  return { ok: true, value: { mode: body.mode, editToken: body.editToken } };
}

function validateEditTokenRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' };
  }
  if (Object.keys(body).some((key) => key !== 'editToken')) {
    return { ok: false, error: 'Unexpected field' };
  }
  if (typeof body.editToken !== 'string' || !EDIT_TOKEN_RE.test(body.editToken)) {
    return { ok: false, error: 'Invalid edit token' };
  }
  return { ok: true, value: { editToken: body.editToken } };
}

function validateBreakdown(value, allowLegacyGrade = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Score breakdown is required' };
  }

  const fields = {
    enforcementScore: [0, MAX_SCORE],
    deterrenceScore: [0, MAX_SCORE],
    finalDeterrenceBonus: [-10_000, 10_000],
    livesSavedBonus: [0, MAX_SCORE],
    livesLostPenalty: [0, MAX_SCORE],
    finalScore: [MIN_SCORE, MAX_SCORE],
    livesSaved: [0, 100],
    livesLost: [0, 100],
    offencesPrevented: [0, 1000],
  };
  for (const [field, [min, max]] of Object.entries(fields)) {
    if (!integerInRange(value[field], min, max)) {
      return { ok: false, error: `Invalid ${field}` };
    }
  }
  if (typeof value.overtime !== 'boolean') return { ok: false, error: 'Invalid overtime' };
  if (typeof value.challengeAssist !== 'boolean') return { ok: false, error: 'Invalid challengeAssist' };
  if (typeof value.coverageRatio !== 'number' || !Number.isFinite(value.coverageRatio)
      || value.coverageRatio < 0 || value.coverageRatio > 1) {
    return { ok: false, error: 'Invalid coverageRatio' };
  }
  if (!['S', 'A', 'B', 'C'].includes(value.presenceGrade)) {
    return { ok: false, error: 'Invalid presenceGrade' };
  }

  const expectedGrade = getPresenceGrade(value.coverageRatio);
  const legacyGrade = getLegacyPresenceGrade(value.coverageRatio);
  if (value.presenceGrade !== expectedGrade && (!allowLegacyGrade || value.presenceGrade !== legacyGrade)) {
    return { ok: false, error: 'Presence grade does not match coverage' };
  }
  if (value.livesLostPenalty !== value.livesLost * 2500) {
    return { ok: false, error: 'Lives lost penalty does not match breakdown' };
  }
  if (value.livesSavedBonus < value.livesSaved * 1250
      || value.livesSavedBonus > value.livesSaved * 2500
      || value.livesSavedBonus % 1250 !== 0) {
    return { ok: false, error: 'Lives saved bonus does not match breakdown' };
  }
  const expectedScore = value.enforcementScore + value.deterrenceScore
    + value.finalDeterrenceBonus + value.livesSavedBonus - value.livesLostPenalty;
  if (value.finalScore !== expectedScore) return { ok: false, error: 'Final score does not match breakdown' };

  const clean = {};
  for (const field of Object.keys(fields)) clean[field] = value[field];
  clean.overtime = value.overtime;
  clean.challengeAssist = value.challengeAssist;
  clean.coverageRatio = value.coverageRatio;
  clean.presenceGrade = value.presenceGrade;
  return { ok: true, value: clean };
}

function validateSubmission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' };
  }
  if (Object.hasOwn(body, 'email')) return { ok: false, error: 'Email is not accepted' };
  if (body.scoreVersion !== undefined && body.scoreVersion !== PRESENCE_GRADE_CONTRACT_VERSION) {
    return { ok: false, error: 'Unsupported score contract version' };
  }
  if (typeof body.token !== 'string' || !RUN_TOKEN_RE.test(body.token)) {
    return { ok: false, error: 'Valid run token is required' };
  }
  if (typeof body.name !== 'string') return { ok: false, error: 'Name is required' };
  const name = body.name.trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    return { ok: false, error: `Name must be 1-${MAX_NAME} characters` };
  }
  if (UNSAFE_NAME_RE.test(name)) {
    return { ok: false, error: 'Name contains unsupported control characters' };
  }
  if (!integerInRange(body.elapsedMs, MIN_ELAPSED_MS, MAX_ELAPSED_MS)) {
    return { ok: false, error: 'Implausible shift duration' };
  }

  let station = null;
  if (body.station !== undefined && body.station !== null && body.station !== '') {
    if (typeof body.station !== 'string' || !STATION_RE.test(body.station.trim().toUpperCase())) {
      return { ok: false, error: 'Station code must be 2-4 letters/numbers' };
    }
    station = body.station.trim().toUpperCase();
  }

  const breakdown = validateBreakdown(body.breakdown, body.scoreVersion === undefined);
  if (!breakdown.ok) return breakdown;
  return {
    ok: true,
    value: { token: body.token, name, station, elapsedMs: body.elapsedMs, breakdown: breakdown.value },
  };
}

function validateClientError(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' };
  }
  if (Object.keys(body).some((key) => key !== 'message' && key !== 'screen')) {
    return { ok: false, error: 'Unexpected field' };
  }
  if (typeof body.message !== 'string' || body.message.trim().length < 1 || body.message.length > 500) {
    return { ok: false, error: 'Invalid message' };
  }
  if (typeof body.screen !== 'string' || body.screen.trim().length < 1 || body.screen.length > 40) {
    return { ok: false, error: 'Invalid screen' };
  }
  return { ok: true, value: { message: body.message.trim(), screen: body.screen.trim() } };
}

module.exports = {
  validateRunRequest,
  validateEditTokenRequest,
  validateSubmission,
  validateClientError,
  MIN_SCORE,
  MAX_SCORE,
  MAX_NAME,
  STATION_RE,
  DAY_RE,
  MIN_ELAPSED_MS,
  MAX_ELAPSED_MS,
  PRESENCE_GRADE_CONTRACT_VERSION,
};
