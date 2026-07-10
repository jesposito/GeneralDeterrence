import { describe, expect, it } from 'vitest';
import { padPressEdges, type PadState } from './useGamepadNavigation';

const state = (primary: boolean): PadState => ({ previous: false, next: false, primary, back: false });

describe('padPressEdges', () => {
  it('ignores a button already held when a new screen mounts', () => {
    expect(padPressEdges(null, state(true)).primary).toBe(false);
    expect(padPressEdges(state(false), state(true)).primary).toBe(true);
  });
});
