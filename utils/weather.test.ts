import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng';
import { rollWeather, seasonForDate } from './weather';

describe('weather', () => {
  it('is deterministic per seed (Daily Shift fairness)', () => {
    const date = new Date(2026, 6, 7);
    const a = rollWeather(mulberry32(42), date);
    const b = rollWeather(mulberry32(42), date);
    expect(a).toEqual(b);
  });

  it('maps NZ seasons correctly', () => {
    expect(seasonForDate(new Date(2026, 0, 15))).toBe('summer');   // Jan
    expect(seasonForDate(new Date(2026, 3, 15))).toBe('autumn');   // Apr
    expect(seasonForDate(new Date(2026, 6, 15))).toBe('winter');   // Jul
    expect(seasonForDate(new Date(2026, 9, 15))).toBe('spring');   // Oct
    expect(seasonForDate(new Date(2026, 11, 15))).toBe('summer');  // Dec
  });

  it('keeps modifiers in sane gameplay ranges across many seeds', () => {
    const date = new Date(2026, 6, 7);
    for (let seed = 0; seed < 200; seed++) {
      const w = rollWeather(mulberry32(seed), date);
      expect(w.grip).toBeGreaterThanOrEqual(0.6);
      expect(w.grip).toBeLessThanOrEqual(1);
      expect(w.civilianSpeed).toBeGreaterThanOrEqual(0.8);
      expect(w.civilianSpeed).toBeLessThanOrEqual(1);
      expect(w.larChance).toBeGreaterThanOrEqual(1);
      expect(w.larChance).toBeLessThanOrEqual(1.35);
      expect(w.vision).toBeGreaterThanOrEqual(0.5);
      expect(w.vision).toBeLessThanOrEqual(1);
      expect(w.label).toContain(',');
    }
  });
});
