import { describe, it, expect } from 'vitest';
import validate from './validate.js';

const { validateSubmission, MAX_SCORE } = validate;

describe('validateSubmission', () => {
  it('accepts and normalizes a valid submission', () => {
    const r = validateSubmission({ name: '  Ana  ', score: 1200 });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ name: 'Ana', score: 1200, email: null, station: null });
  });

  it('rejects missing / non-string / empty / overlong names', () => {
    expect(validateSubmission({ score: 1 }).ok).toBe(false);
    expect(validateSubmission({ name: 42, score: 1 }).ok).toBe(false);
    expect(validateSubmission({ name: '   ', score: 1 }).ok).toBe(false);
    expect(validateSubmission({ name: 'x'.repeat(25), score: 1 }).ok).toBe(false);
  });

  it('rejects NaN / Infinity / float / negative / over-cap / non-number scores', () => {
    for (const s of [NaN, Infinity, -Infinity, 1.5, -1, MAX_SCORE + 1, '5', {}, null, undefined]) {
      expect(validateSubmission({ name: 'A', score: s }).ok).toBe(false);
    }
  });

  it('accepts boundary scores 0 and MAX_SCORE', () => {
    expect(validateSubmission({ name: 'A', score: 0 }).ok).toBe(true);
    expect(validateSubmission({ name: 'A', score: MAX_SCORE }).ok).toBe(true);
  });

  it('rejects malformed email, accepts and lowercases a valid one', () => {
    expect(validateSubmission({ name: 'A', score: 1, email: 'nope' }).ok).toBe(false);
    expect(validateSubmission({ name: 'A', score: 1, email: 'x'.repeat(250) + '@a.com' }).ok).toBe(false);
    const r = validateSubmission({ name: 'A', score: 1, email: 'Officer@Police.NZ' });
    expect(r.ok).toBe(true);
    expect(r.value.email).toBe('officer@police.nz');
  });

  it('never returns a client-supplied timestamp', () => {
    const r = validateSubmission({ name: 'A', score: 1, timestamp: 0, extra: 'ignored' });
    expect(r.value).not.toHaveProperty('timestamp');
    expect(r.value).not.toHaveProperty('extra');
  });
});

describe('station codes', () => {
  it('accepts and uppercases a valid station code', () => {
    const r = validateSubmission({ name: 'Ana', score: 1, station: 'tawa' });
    expect(r.ok).toBe(true);
    expect(r.value.station).toBe('TAWA');
  });

  it('treats empty station as null and rejects bad codes', () => {
    expect(validateSubmission({ name: 'Ana', score: 1, station: '' }).value.station).toBe(null);
    expect(validateSubmission({ name: 'Ana', score: 1, station: 'X' }).ok).toBe(false);
    expect(validateSubmission({ name: 'Ana', score: 1, station: 'TOOLONG' }).ok).toBe(false);
    expect(validateSubmission({ name: 'Ana', score: 1, station: 'a b' }).ok).toBe(false);
  });
});
