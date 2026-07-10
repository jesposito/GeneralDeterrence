import { describe, expect, it, vi } from 'vitest';
import { createEditTokenProvider } from './identity';

describe('createEditTokenProvider', () => {
  it('keeps one in-memory identity when storage is blocked', () => {
    const create = vi.fn(() => 'e'.repeat(32));
    const token = createEditTokenProvider(
      () => { throw new Error('blocked'); },
      () => { throw new Error('blocked'); },
      create,
    );
    expect(token()).toBe('e'.repeat(32));
    expect(token()).toBe('e'.repeat(32));
    expect(create).toHaveBeenCalledTimes(1);
  });
});
