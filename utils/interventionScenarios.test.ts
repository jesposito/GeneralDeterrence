import { describe, expect, it } from 'vitest';
import {
  INTERVENTION_SCENARIOS,
  REFERRAL_SCENARIOS,
  scenarioAt,
} from './interventionScenarios';

describe('intervention scenario decks', () => {
  it('provide varied, non-trivial judgement content', () => {
    for (const scenarios of Object.values(INTERVENTION_SCENARIOS)) {
      expect(scenarios.length).toBeGreaterThanOrEqual(12);
      expect(new Set(scenarios.map(scenario => scenario.prompt)).size).toBe(scenarios.length);
      expect(new Set(scenarios.map(scenario => scenario.answer))).toEqual(new Set([0, 1]));
      for (const scenario of scenarios) {
        expect(scenario.choices[0].length).toBeGreaterThan(30);
        expect(scenario.choices[1].length).toBeGreaterThan(30);
        expect(scenario.choices.join(' ')).not.toMatch(/ignore it|wait until .* crash/i);
      }
    }
  });

  it('covers every referral profile with several contexts', () => {
    expect(REFERRAL_SCENARIOS.length).toBeGreaterThanOrEqual(12);
    const counts = new Map<string, number>();
    for (const scenario of REFERRAL_SCENARIOS) {
      counts.set(scenario.profile, (counts.get(scenario.profile) ?? 0) + 1);
    }
    expect([...counts.values()].sort()).toEqual([4, 4, 4]);
  });

  it('selects deterministically for any integer sign', () => {
    const items = ['a', 'b', 'c'];
    expect(scenarioAt(items, 4)).toBe('b');
    expect(scenarioAt(items, -1)).toBe('c');
    expect(scenarioAt(items, Number.NaN)).toBe('a');
  });
});
