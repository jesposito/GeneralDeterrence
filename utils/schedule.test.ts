import { describe, it, expect } from 'vitest';
import { buildOffenderSchedule, slotAt } from './schedule';

describe('offender schedule (daily fairness)', () => {
  it('is deterministic per seed', () => {
    const a = buildOffenderSchedule(20260708);
    const b = buildOffenderSchedule(20260708);
    expect(a).toEqual(b);
  });

  it('differs across seeds and stays in range', () => {
    const a = buildOffenderSchedule(1);
    const b = buildOffenderSchedule(2);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    for (const s of [a, b]) {
      expect(s.interdictionOrdinal).toBeGreaterThanOrEqual(1);
      expect(s.interdictionOrdinal).toBeLessThanOrEqual(4);
      expect(s.slots.length).toBeGreaterThanOrEqual(48);
      for (const slot of s.slots) {
        for (const v of Object.values(slot)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(1);
        }
      }
    }
  });

  it('slotAt wraps safely past the end', () => {
    const s = buildOffenderSchedule(7);
    expect(slotAt(s, s.slots.length + 3)).toEqual(s.slots[3]);
  });
});
