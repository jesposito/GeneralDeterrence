import { describe, expect, it, vi } from 'vitest';
import { buildShareText, shiftNumber } from './share';

describe('shiftNumber', () => {
  it('uses the server-bound competition day instead of the viewer clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-11T23:00:00.000Z'));
    expect(shiftNumber('2026-07-10')).toBe(191);
    vi.restoreAllMocks();
  });
});

describe('buildShareText', () => {
  it('labels prevention stories as ripple effects rather than direct saves', () => {
    const breakdown = {
      presenceGrade: 'A', offencesPrevented: 2, livesSaved: 0, overtime: false, patrolPath: [],
    } as unknown as Parameters<typeof buildShareText>[0];
    expect(buildShareText(breakdown, { mode: 'free', storyLine: 'Aroha made it home for dinner.' }))
      .toContain('Ripple effect: Aroha made it home for dinner.');
  });
});
