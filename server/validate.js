// Pure validation for leaderboard submissions. Kept dependency-free so it can be
// unit-tested without spinning up Express or the database.

const MAX_SCORE = 100000; // ponytail: generous 90s-shift ceiling; tighten when the true max score is known
const MAX_NAME = 24;
const MAX_EMAIL = 254;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Station codes: optional 2-4 char crew tag (friend cohorts with zero auth).
const STATION_RE = /^[A-Z0-9]{2,4}$/;

/**
 * Validate + normalize a leaderboard submission body.
 * Returns { ok: true, value: { name, score, email } } or { ok: false, error }.
 * The client-supplied timestamp is intentionally dropped — the server owns time.
 */
function validateSubmission(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body' };
  const { name, score, email, station } = body;

  if (typeof name !== 'string') return { ok: false, error: 'Name is required' };
  const cleanName = name.trim();
  if (cleanName.length < 1 || cleanName.length > MAX_NAME) {
    return { ok: false, error: `Name must be 1-${MAX_NAME} characters` };
  }

  if (typeof score !== 'number' || !Number.isInteger(score)) {
    return { ok: false, error: 'Score must be an integer' };
  }
  if (score < 0 || score > MAX_SCORE) {
    return { ok: false, error: `Score must be between 0 and ${MAX_SCORE}` };
  }

  let cleanEmail = null;
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      return { ok: false, error: 'Invalid email' };
    }
    cleanEmail = email.trim().toLowerCase();
  }

  let cleanStation = null;
  if (station !== undefined && station !== null && station !== '') {
    if (typeof station !== 'string' || !STATION_RE.test(station.trim().toUpperCase())) {
      return { ok: false, error: 'Station code must be 2-4 letters/numbers' };
    }
    cleanStation = station.trim().toUpperCase();
  }

  // Attempts on the daily map (best-of-N transparency). Client-reported; clamp to sanity.
  let cleanAttempts = null;
  const { attempts } = body;
  if (attempts !== undefined && attempts !== null) {
    if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1 || attempts > 999) {
      return { ok: false, error: 'Invalid attempts' };
    }
    cleanAttempts = attempts;
  }

  return { ok: true, value: { name: cleanName, score, email: cleanEmail, station: cleanStation, attempts: cleanAttempts } };
}

module.exports = { validateSubmission, MAX_SCORE, MAX_NAME, MAX_EMAIL, STATION_RE };
