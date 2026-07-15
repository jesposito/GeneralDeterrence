import { normalizeKey } from '../hooks/useKeyPress';

// Configurable key bindings. Defaults reproduce the historically hard-coded controls exactly, so
// behaviour is unchanged until a player rebinds. Keys are stored in the input layer's normalized
// format (hooks/useKeyPress normalizeKey): single chars lower-cased, named keys (ArrowUp, Shift)
// left verbatim.

export type GameAction =
  | 'forward' | 'backward' | 'left' | 'right'
  | 'boost' | 'siren' | 'colleague' | 'minimap' | 'rids';

export const ACTION_LABELS: Record<GameAction, string> = {
  forward: 'Drive forward',
  backward: 'Reverse',
  left: 'Steer left',
  right: 'Steer right',
  boost: 'Boost',
  siren: 'Siren',
  colleague: 'Colleague assist',
  minimap: 'Toggle minimap',
  rids: 'RIDS check',
};

export type Bindings = Record<GameAction, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  forward: ['w', 'ArrowUp'],
  backward: ['s', 'ArrowDown'],
  left: ['a', 'ArrowLeft'],
  right: ['d', 'ArrowRight'],
  boost: ['Shift'],
  siren: ['e'],
  colleague: ['c'],
  minimap: ['m'],
  rids: [' '],
};

const STORAGE_KEY = 'gd-keybindings';

// Same normalization the input layer applies, so a bound key matches what keysPressed stores.
export const normalizeBindingKey = normalizeKey;

// Human-readable name for a stored key (space -> "Space", single chars upper-cased for display).
export const displayKey = (key: string): string =>
  key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : key;

export function loadBindings(): Bindings {
  const merged: Bindings = { ...DEFAULT_BINDINGS };
  if (typeof window === 'undefined') return merged;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return merged;
    const saved = JSON.parse(raw) as Partial<Bindings>;
    for (const action of Object.keys(DEFAULT_BINDINGS) as GameAction[]) {
      const v = saved[action];
      if (Array.isArray(v) && v.length && v.every((k) => typeof k === 'string')) {
        merged[action] = v.map(normalizeBindingKey);
      }
    }
  } catch { /* fall back to defaults */ }
  return merged;
}

export function saveBindings(b: Bindings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
}

export function resetBindings(): Bindings {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  return { ...DEFAULT_BINDINGS };
}
