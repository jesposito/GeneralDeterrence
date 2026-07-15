import React, { useCallback, useEffect, useState } from 'react';
import * as audio from '../utils/audio';

const STORAGE_KEY = 'gd-muted';

const MuteToggle: React.FC = () => {
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  // Apply initial state to audio module on mount
  useEffect(() => {
    audio.setMuted(muted);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      // masterGain=0 already silences the continuous engine/siren/music; don't stop the nodes
      // (that permanently killed the drone, and start-muted never started it).
      audio.setMuted(next);
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
      data-testid="mute-toggle"
      onClick={toggle}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        top: 'max(0.5rem, env(safe-area-inset-top))',
        right: 'max(0.5rem, env(safe-area-inset-right))',
        touchAction: 'manipulation',
      }}
      className="fixed top-2 right-2 w-11 h-11 z-50 rounded-full bg-black/75 border-2 border-cyan-500/60 text-white text-xl flex items-center justify-center shadow-lg select-none transition-colors hover:bg-cyan-900/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
    >
      <span aria-hidden="true">{muted ? '\u{1F507}' : '\u{1F50A}'}</span>
    </button>
  );
};

export default MuteToggle;
