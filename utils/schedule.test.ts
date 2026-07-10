import { describe, it, expect } from 'vitest';
import { advanceShiftClock, buildOffenderSchedule, computeLifeAtRiskChance, planSimulationSteps, slotAt } from './schedule';

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

  it('advances elapsed time without applying the motion cap', () => {
    expect(advanceShiftClock(10, 20, 0.5)).toEqual({ timeLeft: 9.5, elapsed: 20.5, spent: 0.5 });
    expect(advanceShiftClock(0.2, 20.5, 1)).toEqual({ timeLeft: 0, elapsed: 20.7, spent: 0.2 });
  });

  it('plans bounded substeps and caps all catch-up uniformly', () => {
    expect(planSimulationSteps(0.12, 0.05, 10)).toEqual({ count: 3, step: 0.04, simulated: 0.12 });
    expect(planSimulationSteps(2, 0.05, 10)).toEqual({ count: 10, step: 0.05, simulated: 0.5 });
    expect(planSimulationSteps(-1, 0.05, 10)).toEqual({ count: 0, step: 0, simulated: 0 });
  });

  it('makes full coverage reduce risk and clamps stacked risk', () => {
    const ordinary = computeLifeAtRiskChance(1.8, 1.4, false, false);
    expect(computeLifeAtRiskChance(1.8, 1.4, true, false)).toBeLessThan(ordinary);
    expect(computeLifeAtRiskChance(100, 100, false, true)).toBe(1);
  });
});
