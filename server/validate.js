// Pure validation for leaderboard submissions. Kept dependency-free so it can be
// unit-tested without spinning up Express or the database.

const MAX_SCORE = 100000; // ponytail: generous 90s-shift ceiling; tighten when the true max score is known
const MAX_NAME = 24;
const MAX_EMAIL = 254;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Validate + normalize a leaderboard submission body.
 * Returns { ok: true, value: { name, score, email } } or { ok: false, error }.
 * The client-supplied timestamp is intentionally dropped — the server owns time.
 */
function validateSubmission(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body' };
  const { name, score, email } = body;

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

  return { ok: true, value: { name: cleanName, score, email: cleanEmail } };
}

module.exports = { validateSubmission, MAX_SCORE, MAX_NAME, MAX_EMAIL };
