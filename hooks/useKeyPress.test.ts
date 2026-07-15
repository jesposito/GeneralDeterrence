import { describe, it, expect } from 'vitest';
import { normalizeKey } from './useKeyPress';

describe('normalizeKey', () => {
  it('lowercases single-character keys (Shift/CapsLock safety)', () => {
    expect(normalizeKey('W')).toBe('w');
    expect(normalizeKey('D')).toBe('d');
    expect(normalizeKey('a')).toBe('a');
  });

  it('leaves named keys and space untouched', () => {
    expect(normalizeKey('ArrowUp')).toBe('ArrowUp');
    expect(normalizeKey('Shift')).toBe('Shift');
    expect(normalizeKey(' ')).toBe(' ');
  });

  it('makes down/up symmetric regardless of modifier casing', () => {
    // press 'w' (no shift) then release 'W' (shift held) must clear the SAME key
    const down = normalizeKey('w');
    const up = normalizeKey('W');
    expect(down).toBe(up);
  });
});
