import { describe, expect, it } from 'vitest';
import { challengeAssistFromStorage } from './preferences';

describe('challengeAssistFromStorage', () => {
  it('requires an explicit enabled value', () => {
    expect(challengeAssistFromStorage('1')).toBe(true);
    expect(challengeAssistFromStorage(null)).toBe(false);
    expect(challengeAssistFromStorage('0')).toBe(false);
  });
});
