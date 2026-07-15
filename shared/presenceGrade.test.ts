import { describe, expect, it } from 'vitest';
import { getPresenceGrade, PRESENCE_GRADE_THRESHOLDS } from './presenceGrade.js';

describe('getPresenceGrade', () => {
  it.each([
    [1, 'S'],
    [PRESENCE_GRADE_THRESHOLDS.S, 'S'],
    [PRESENCE_GRADE_THRESHOLDS.S - 0.001, 'A'],
    [PRESENCE_GRADE_THRESHOLDS.A, 'A'],
    [PRESENCE_GRADE_THRESHOLDS.A - 0.001, 'B'],
    [PRESENCE_GRADE_THRESHOLDS.B, 'B'],
    [PRESENCE_GRADE_THRESHOLDS.B - 0.001, 'C'],
    [0, 'C'],
  ])('maps coverage %s to %s', (coverage, grade) => {
    expect(getPresenceGrade(coverage)).toBe(grade);
  });
});
