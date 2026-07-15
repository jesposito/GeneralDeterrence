import { describe, it, expect } from 'vitest';
import validate from './validate.js';

const {
  validateRunRequest,
  validateEditTokenRequest,
  validateSubmission,
  validateClientError,
  MIN_ELAPSED_MS,
  MAX_ELAPSED_MS,
  PRESENCE_GRADE_CONTRACT_VERSION,
} = validate;

const validBreakdown = {
  enforcementScore: 100,
  deterrenceScore: 200,
  finalDeterrenceBonus: -50,
  livesSavedBonus: 1250,
  livesLostPenalty: 2500,
  finalScore: -1000,
  livesSaved: 1,
  livesLost: 1,
  offencesPrevented: 3,
  overtime: false,
  challengeAssist: false,
  coverageRatio: 0.4,
  presenceGrade: 'C',
};
const validSubmission = {
  scoreVersion: PRESENCE_GRADE_CONTRACT_VERSION,
  token: 't'.repeat(43),
  name: '  Ana  ',
  station: 'tawa',
  elapsedMs: 90_000,
  breakdown: validBreakdown,
};

describe('validateRunRequest', () => {
  it('requires a bound mode and random edit token', () => {
    expect(validateRunRequest({ mode: 'daily', editToken: 'e'.repeat(32) }).value)
      .toEqual({ mode: 'daily', editToken: 'e'.repeat(32) });
    expect(validateRunRequest({ mode: 'ranked', editToken: 'e'.repeat(32) }).ok).toBe(false);
    expect(validateRunRequest({ mode: 'free', editToken: 'short' }).ok).toBe(false);
  });
});

describe('validateEditTokenRequest', () => {
  it('accepts only a valid edit token', () => {
    expect(validateEditTokenRequest({ editToken: 'e'.repeat(32) }).value)
      .toEqual({ editToken: 'e'.repeat(32) });
    expect(validateEditTokenRequest({ editToken: 'short' }).ok).toBe(false);
    expect(validateEditTokenRequest({ editToken: 'e'.repeat(32), email: 'x@example.test' }).ok).toBe(false);
  });
});

describe('validateSubmission', () => {
  it('accepts and normalizes a complete run payload', () => {
    const result = validateSubmission(validSubmission);
    expect(result.ok).toBe(true);
    expect(result.value.name).toBe('Ana');
    expect(result.value.station).toBe('TAWA');
    expect(result.value.breakdown).toEqual(validBreakdown);
  });

  it('rejects missing tokens, names, email, and implausible elapsed time', () => {
    expect(validateSubmission({ ...validSubmission, token: 'short' }).ok).toBe(false);
    expect(validateSubmission({ ...validSubmission, name: ' ' }).ok).toBe(false);
    expect(validateSubmission({ ...validSubmission, name: 'Ana\u202e123' }).error).toMatch(/control/i);
    expect(validateSubmission({ ...validSubmission, email: 'officer@example.test' }).error).toMatch(/email/i);
    expect(validateSubmission({ ...validSubmission, elapsedMs: MIN_ELAPSED_MS - 1 }).ok).toBe(false);
    expect(validateSubmission({ ...validSubmission, elapsedMs: MAX_ELAPSED_MS + 1 }).ok).toBe(false);
  });

  it('rejects inconsistent score, grade, and life totals', () => {
    expect(validateSubmission({ ...validSubmission, breakdown: { ...validBreakdown, finalScore: 99 } }).error).toMatch(/score/i);
    expect(validateSubmission({ ...validSubmission, breakdown: { ...validBreakdown, presenceGrade: 'S' } }).error).toMatch(/grade/i);
    expect(validateSubmission({ ...validSubmission, breakdown: { ...validBreakdown, livesLostPenalty: 0 } }).error).toMatch(/lost/i);
    expect(validateSubmission({ ...validSubmission, breakdown: { ...validBreakdown, livesSavedBonus: 5000 } }).error).toMatch(/saved/i);
    expect(validateSubmission({ ...validSubmission, breakdown: { ...validBreakdown, challengeAssist: 'yes' } }).error).toMatch(/assist/i);
  });

  it.each([
    [0.75, 'S'],
    [0.65, 'A'],
    [0.52, 'B'],
    [0.519, 'C'],
  ])('accepts the shared presence-grade boundary at %s', (coverageRatio, presenceGrade) => {
    expect(validateSubmission({
      ...validSubmission,
      breakdown: { ...validBreakdown, coverageRatio, presenceGrade },
    }).ok).toBe(true);
  });

  it('accepts legacy queued grades only when the score contract version is absent', () => {
    const { scoreVersion: _scoreVersion, ...legacySubmission } = validSubmission;
    for (const [coverageRatio, presenceGrade] of [[0.8, 'A'], [0.68, 'B'], [0.5, 'B']]) {
      const legacy = { ...legacySubmission, breakdown: { ...validBreakdown, coverageRatio, presenceGrade } };
      expect(validateSubmission(legacy).ok).toBe(true);
      expect(validateSubmission({ ...legacy, scoreVersion: 2 }).error).toMatch(/grade/i);
    }
    expect(validateSubmission({ ...validSubmission, scoreVersion: 99 }).error).toMatch(/version/i);
  });

  it('sums the independently rounded score components exactly', () => {
    // Source values such as 200.4 and -49.6 can make a rounded raw total differ by one.
    // The wire contract is the sum of the independently rounded, exposed components.
    expect(validateSubmission(validSubmission).ok).toBe(true);
    expect(validateSubmission({
      ...validSubmission,
      breakdown: { ...validBreakdown, finalScore: validBreakdown.finalScore + 1 },
    }).error).toMatch(/score/i);
  });

  it('drops unneeded breakdown fields and rejects malformed stations', () => {
    const result = validateSubmission({
      ...validSubmission,
      station: '',
      breakdown: { ...validBreakdown, patrolPath: [{ x: 1, y: 2 }] },
    });
    expect(result.value.station).toBe(null);
    expect(result.value.breakdown).not.toHaveProperty('patrolPath');
    expect(validateSubmission({ ...validSubmission, station: 'TOOLONG' }).ok).toBe(false);
  });
});

describe('validateClientError', () => {
  it('accepts only capped message and screen strings', () => {
    expect(validateClientError({ message: 'render failed', screen: 'Playing' }).ok).toBe(true);
    expect(validateClientError({ message: 'x', screen: 'Playing', email: 'x@y.z' }).ok).toBe(false);
    expect(validateClientError({ message: 'x'.repeat(501), screen: 'Playing' }).ok).toBe(false);
    expect(validateClientError({ message: 'x', screen: '' }).ok).toBe(false);
  });
});
