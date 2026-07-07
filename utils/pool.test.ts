import { describe, it, expect } from 'vitest';
import { retainInPlace } from './pool';

describe('retainInPlace', () => {
  it('keeps matching elements in order and mutates the same array (no realloc)', () => {
    const a = [1, 2, 3, 4, 5, 6];
    const ref = a;
    retainInPlace(a, (x) => x % 2 === 0);
    expect(a).toEqual([2, 4, 6]);
    expect(a).toBe(ref);
  });

  it('handles all-removed and all-kept', () => {
    const a = [1, 2, 3];
    retainInPlace(a, () => false);
    expect(a).toEqual([]);
    const b = [1, 2, 3];
    retainInPlace(b, () => true);
    expect(b).toEqual([1, 2, 3]);
  });

  it('runs the predicate once per element, in order (side-effect parity with filter)', () => {
    const seen: number[] = [];
    const a = [1, 2, 3];
    retainInPlace(a, (x) => {
      seen.push(x);
      return x !== 2;
    });
    expect(seen).toEqual([1, 2, 3]);
    expect(a).toEqual([1, 3]);
  });
});
