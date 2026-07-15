import { useEffect, useRef } from 'react';

/**
 * Normalize a KeyboardEvent.key for state tracking: single-character keys are
 * lowercased so Shift/CapsLock (which turn 'w' into 'W') don't create a second,
 * separately-tracked key — which otherwise breaks movement/boost and can strand
 * a key in the "down" state when keyup arrives with different casing.
 * Named keys ('ArrowUp', 'Shift', ' ') are left untouched.
 */
export const normalizeKey = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

/**
 * Subscribe to window keydown/keyup exactly once. The latest handlers are read
 * through refs, so passing inline callbacks doesn't re-add/remove the listeners
 * on every render.
 */
const useKeyPress = (
  keyDownHandler: (e: KeyboardEvent) => void,
  keyUpHandler: (e: KeyboardEvent) => void
) => {
  const down = useRef(keyDownHandler);
  const up = useRef(keyUpHandler);
  down.current = keyDownHandler;
  up.current = keyUpHandler;

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => down.current(e);
    const onUp = (e: KeyboardEvent) => up.current(e);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);
};

export default useKeyPress;
