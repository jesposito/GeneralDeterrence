import { describe, expect, it } from 'vitest';
import { isRetryableStatus, submissionBody } from './submission';

describe('queued submissions', () => {
  it('refreshes elapsed time and keeps local timing metadata off the wire', () => {
    expect(submissionBody({ token: 'run', startedAt: 1_000, elapsedMs: 90_000 }, 181_000))
      .toEqual({ token: 'run', elapsedMs: 180_000 });
  });

  it('retains transient responses but drops terminal client errors', () => {
    for (const status of [408, 425, 429, 500, 503]) expect(isRetryableStatus(status)).toBe(true);
    for (const status of [400, 401, 409, 410, 422]) expect(isRetryableStatus(status)).toBe(false);
  });
});
