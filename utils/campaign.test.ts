import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_SHIFT_COUNT,
  createOperationsCampaign,
  getCampaignProgress,
  getNextCampaignShift,
  loadOperationsCampaign,
  parseOperationsCampaign,
  recordCampaignShift,
  saveOperationsCampaign,
  serializeOperationsCampaign,
} from './campaign';

describe('Operations campaign', () => {
  it('links each deterministic shift to the previous Presence Grade', () => {
    const campaign = createOperationsCampaign(41, '2026-07-15');
    const first = getNextCampaignShift(campaign);
    const afterS = getNextCampaignShift(recordCampaignShift(campaign, { grade: 'S', score: 1000 }));
    const afterC = getNextCampaignShift(recordCampaignShift(campaign, { grade: 'C', score: 1000 }));

    expect(first?.number).toBe(1);
    expect(first?.day).toBe('2026-07-15');
    expect(afterS?.day).toBe('2026-07-16');
    expect(afterS?.previousGrade).toBe('S');
    expect(afterS?.seed).not.toBe(afterC?.seed);
    expect(['holiday-peak', 'match-night', 'roadworks']).toContain(afterS?.operation.id);
    expect(['unmarked', 'rural-focus', 'school-run']).toContain(afterC?.operation.id);
    expect(getNextCampaignShift(campaign)).toEqual(first);
  });

  it('never repeats an operation on adjacent shifts', () => {
    let campaign = createOperationsCampaign(555, '2026-07-15');
    const operations: string[] = [];
    for (let index = 0; index < CAMPAIGN_SHIFT_COUNT; index += 1) {
      operations.push(getNextCampaignShift(campaign)!.operation.id);
      campaign = recordCampaignShift(campaign, { grade: 'A', score: index });
    }

    expect(operations.slice(1).every((operation, index) => operation !== operations[index])).toBe(true);
  });

  it('ends after exactly five shifts', () => {
    let campaign = createOperationsCampaign(99, '2026-12-29');
    for (let index = 0; index < CAMPAIGN_SHIFT_COUNT; index += 1) {
      campaign = recordCampaignShift(campaign, { grade: 'A', score: 100 + index });
    }

    expect(getNextCampaignShift(campaign)).toBeNull();
    expect(getCampaignProgress(campaign)).toEqual({
      completedShifts: 5,
      totalShifts: 5,
      cumulativeScore: 510,
      complete: true,
    });
    expect(() => recordCampaignShift(campaign, { grade: 'A', score: 1 })).toThrow(RangeError);
  });

  it('round-trips a compact wire format and rejects oversized state', () => {
    const campaign = recordCampaignShift(
      createOperationsCampaign(7, '2026-07-15'),
      { grade: 'B', score: 700 },
    );
    const raw = serializeOperationsCampaign(campaign);

    expect(raw).not.toContain('results');
    expect(parseOperationsCampaign(raw)).toEqual(campaign);
    expect(parseOperationsCampaign('{"v":1,"s":7,"d":"2026-07-15","r":[["S",1],["S",1],["S",1],["S",1],["S",1],["S",1]]}')).toBeNull();
  });

  it('persists through a Storage-like object', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const campaign = createOperationsCampaign(11, '2026-07-15');

    expect(saveOperationsCampaign(storage, campaign)).toBe(true);
    expect(loadOperationsCampaign(storage)).toEqual(campaign);
  });
});
