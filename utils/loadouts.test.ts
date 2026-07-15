import { describe, expect, it } from 'vitest';
import { getAvailableLoadouts, getPatrolLoadout, loadPatrolLoadout, savePatrolLoadout } from './loadouts';

describe('patrol loadouts', () => {
  it('unlocks horizontal choices by completed Presence Grades', () => {
    expect(getAvailableLoadouts(0).map(loadout => loadout.id)).toEqual(['balanced']);
    expect(getAvailableLoadouts(5).map(loadout => loadout.id)).toEqual(['balanced', 'community']);
    expect(getAvailableLoadouts(30)).toHaveLength(4);
    expect(getPatrolLoadout('response').modifiers.energyRecharge).toBeGreaterThan(1);
    expect(getPatrolLoadout('response').modifiers.presenceRate).toBeLessThan(1);
  });

  it('falls back when a stored loadout is not unlocked', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(savePatrolLoadout(storage, 'marked')).toBe(true);
    expect(loadPatrolLoadout(storage as Storage, 5)).toBe('balanced');
    expect(loadPatrolLoadout(storage as Storage, 30)).toBe('marked');
  });
});
