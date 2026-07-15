import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../utils/keybindings';
import { rebind } from './ControlsSettings';

describe('rebind', () => {
  it('does not remove another action\'s only key', () => {
    const result = rebind(DEFAULT_BINDINGS, 'boost', ' ');
    expect(result.blockedOwner).toBe('rids');
    expect(result.bindings).toBe(DEFAULT_BINDINGS);
  });

  it('moves a spare key without leaving duplicates or empty actions', () => {
    const result = rebind(DEFAULT_BINDINGS, 'boost', 'ArrowUp');
    expect(result.blockedOwner).toBeUndefined();
    expect(result.bindings.forward).toEqual(['w']);
    expect(result.bindings.boost).toEqual(['ArrowUp']);
    const keys = Object.values(result.bindings).flat();
    expect(new Set(keys).size).toBe(keys.length);
    expect(Object.values(result.bindings).every((bindings) => bindings.length > 0)).toBe(true);
  });
});
