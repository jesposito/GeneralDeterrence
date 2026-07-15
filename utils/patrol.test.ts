import { describe, expect, it } from 'vitest';
import {
  createRoadFreshnessState,
  getCoverageTier,
  getEarnedOvertimeSeconds,
  getShiftPhase,
  roadRepeatEntryRatio,
  visitRoadSegment,
} from './patrol';

describe('patrol mastery', () => {
  it('moves through three readable phases and overtime', () => {
    expect(getShiftPhase(0, 90).id).toBe('establish');
    expect(getShiftPhase(30, 90).id).toBe('respond');
    expect(getShiftPhase(60, 90).id).toBe('resolve');
    expect(getShiftPhase(120, 90, true).id).toBe('overtime');
  });

  it('rewards fresh road coverage and discounts repeated loops', () => {
    const first = visitRoadSegment(createRoadFreshnessState(), 'a', 0);
    const repeat = visitRoadSegment(first.state, 'a', 2);
    const newBeat = visitRoadSegment(repeat.state, 'b', 4);
    const returnedSoon = visitRoadSegment(newBeat.state, 'a', 10);
    const returnedFresh = visitRoadSegment(returnedSoon.state, 'b', 40);

    expect(first.multiplier).toBe(1.6);
    expect(repeat.multiplier).toBe(1.35);
    expect(newBeat.multiplier).toBeGreaterThan(repeat.multiplier);
    expect(returnedSoon.fresh).toBe(false);
    expect(returnedSoon.state.chain).toBe(0);
    expect(roadRepeatEntryRatio(returnedSoon.state)).toBeCloseTo(1 / 3);
    expect(returnedFresh.fresh).toBe(true);
    expect(newBeat.state.chain).toBe(2);
    expect(returnedFresh.state.uniqueSegments).toBe(2);
  });

  it('stages secured-district rewards and earned overtime', () => {
    expect(getCoverageTier([90, 90, 90, 40, 40])).toMatchObject({ label: '3/5 SECURE', scoreMultiplier: 1.15 });
    expect(getCoverageTier([90, 90, 90, 90, 90]).scoreMultiplier).toBe(1.6);
    expect(getEarnedOvertimeSeconds(14.9)).toBe(0);
    expect(getEarnedOvertimeSeconds(15)).toBe(10);
    expect(getEarnedOvertimeSeconds(31)).toBe(20);
    expect(getEarnedOvertimeSeconds(50)).toBe(30);
  });
});
