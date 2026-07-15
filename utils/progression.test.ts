import { describe, expect, it } from 'vitest';
import {
  CAREER_RANKS,
  createCareerState,
  getCareerProgress,
  loadCareerState,
  parseCareerState,
  recordPresenceGrade,
  saveCareerState,
} from './progression';
import { PATROL_LOADOUTS } from './loadouts';

describe('career progression', () => {
  it('counts Presence Grades equally instead of converting them to points', () => {
    let state = createCareerState();
    for (const grade of ['S', 'C', 'A', 'B', 'C'] as const) {
      state = recordPresenceGrade(state, grade);
    }

    const progress = getCareerProgress(state);
    expect(progress.totalPresenceGrades).toBe(5);
    expect(progress.rank.id).toBe('sergeant');
    expect(progress.unlocks.map(({ id }) => id)).toEqual(['highway-livery', 'community-unit']);
  });

  it('derives rank, next threshold, and cumulative horizontal unlocks', () => {
    const state = {
      version: 1 as const,
      grades: { S: 4, A: 4, B: 4, C: 3 },
    };
    const progress = getCareerProgress(state);

    expect(progress.rank.id).toBe('senior-sergeant');
    expect(progress.nextRank?.id).toBe('inspector');
    expect(progress.gradesUntilNextRank).toBe(15);
    expect(progress.unlocks.map(({ kind }) => kind)).toEqual(['livery', 'loadout', 'ghost-style', 'loadout']);
  });

  it('announces each loadout at the same threshold that unlocks it', () => {
    for (const loadout of PATROL_LOADOUTS.filter(({ id }) => id !== 'balanced')) {
      const rank = CAREER_RANKS.find(({ minimumPresenceGrades }) => minimumPresenceGrades === loadout.requiredGrades);
      expect(rank?.unlocks).toContainEqual(expect.objectContaining({
        kind: 'loadout',
        loadoutId: loadout.id,
        label: loadout.name,
      }));
    }
  });

  it('round-trips compact storage and resets malformed data', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const state = recordPresenceGrade(createCareerState(), 'A');

    expect(saveCareerState(storage, state)).toBe(true);
    expect(loadCareerState(storage)).toEqual(state);
    expect(parseCareerState('{"v":1,"g":[1,-1,0,0]}')).toEqual(createCareerState());
  });
});
