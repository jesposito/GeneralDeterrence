import { describe, expect, it, vi } from 'vitest';
import { shiftNumber } from './share';

describe('shiftNumber', () => {
  it('uses the server-bound competition day instead of the viewer clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-11T23:00:00.000Z'));
    expect(shiftNumber('2026-07-10')).toBe(191);
    vi.restoreAllMocks();
  });
});
