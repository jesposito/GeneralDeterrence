import { describe, expect, it } from 'vitest';
import { getDailyOperation, offsetDay, OPERATION_DEFINITIONS } from './operations';

describe('daily operations', () => {
  it('is deterministic for a seed and day', () => {
    expect(getDailyOperation(20260715, '2026-07-15')).toEqual(
      getDailyOperation(20260715, '2026-07-15'),
    );
  });

  it('rotates through the documented modifier definitions', () => {
    const ids = new Set(
      Array.from({ length: 64 }, (_, index) => (
        getDailyOperation(7000 + index, offsetDay('2026-07-01', index)).id
      )),
    );

    expect(ids).toEqual(new Set(OPERATION_DEFINITIONS.map((operation) => operation.id)));
    expect(OPERATION_DEFINITIONS.find(({ id }) => id === 'unmarked')?.modifiers).toMatchObject({
      presenceAuraMultiplier: 0.5,
      presenceRateMultiplier: 2,
    });
    expect(OPERATION_DEFINITIONS.find(({ id }) => id === 'holiday-peak')?.modifiers).toMatchObject({
      trafficMultiplier: 2,
      maxSimultaneousLifeAtRisk: 2,
    });
    expect(OPERATION_DEFINITIONS.find(({ id }) => id === 'rural-focus')?.modifiers).toMatchObject({
      ruralDeterrenceMultiplier: 3,
    });
    expect(ids.size).toBe(6);
    expect(OPERATION_DEFINITIONS.find(({ id }) => id === 'school-run')?.modifiers).toMatchObject({
      priorityDistrict: 'Karori West', priorityRids: 'Restraints',
    });
  });

  it('offsets calendar days without local-time drift', () => {
    expect(offsetDay('2028-02-28', 1)).toBe('2028-02-29');
    expect(offsetDay('2028-02-28', 2)).toBe('2028-03-01');
    expect(() => getDailyOperation(1, '2026-02-30')).toThrow(RangeError);
  });
});
