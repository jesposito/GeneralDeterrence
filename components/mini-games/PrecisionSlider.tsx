import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MiniGameProps } from '../../types';

// Cache the reduced-motion preference once (not per frame).
const prefersReducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const TARGET_MIN = 0.375;
const TARGET_MAX = 0.625;
const SWEEP_PERIOD_MS = 2500;

const PrecisionSlider: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [stopped, setStopped] = useState(false);
  const [result, setResult] = useState<'success' | 'miss' | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const finish = useCallback((won: boolean) => {
    setStopped((already) => {
      if (already) return already;
      setResult(won ? 'success' : 'miss');
      // brief hold so the result is seen + announced before handing back
      setTimeout(() => onComplete(won), 1200);
      return true;
    });
  }, [onComplete]);

  // Timed sweep driven by requestAnimationFrame writing `left` directly on the node.
  // Decoupled from CSS animation so the global prefers-reduced-motion reset can't freeze
  // it and make the game unwinnable (gd-0wi.27); direct DOM write avoids a per-frame re-render.
  useEffect(() => {
    if (prefersReducedMotion || stopped) return;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const phase = ((t - startRef.current) % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS;
      const p = phase < 0.5 ? phase * 2 : 2 - phase * 2; // triangle 0->1->0
      posRef.current = p;
      if (sliderRef.current) sliderRef.current.style.left = `calc(${(p * 100).toFixed(2)}% - 4px)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [stopped]);

  const handleStop = useCallback(() => {
    const p = posRef.current;
    finish(p >= TARGET_MIN && p <= TARGET_MAX);
  }, [finish]);

  // Timed-mode fail timer (the reduced-motion path is not timed, so it's skipped there).
  useEffect(() => {
    if (prefersReducedMotion || stopped) return;
    const failTimer = setTimeout(() => finish(false), 4000);
    return () => clearTimeout(failTimer);
  }, [stopped, finish]);

  // Space also stops (playable without tabbing to the button). The native button below
  // handles Enter/Space/click when focused.
  useEffect(() => {
    if (prefersReducedMotion) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat) { e.preventDefault(); handleStop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleStop]);

  return (
    <div>
      <div role="status" aria-live="assertive" className="sr-only">
        {result === 'success' ? 'Success — stopped in the target zone.' : result === 'miss' ? 'Missed the target zone.' : ''}
      </div>

      {prefersReducedMotion ? (
        // Non-timed accessible alternative (also the screen-reader path — the moving slider
        // is imperceptible non-visually). No reflex sweep, no fail timer.
        <div>
          <p className="text-lg text-gray-300 mb-4 font-sans">
            Speed enforcement: direct the driver to slow to under 11 km/h over the limit.
          </p>
          <button
            onClick={() => finish(true)}
            disabled={stopped}
            className="w-full bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 text-white font-bold py-4 px-4 rounded text-xl transition disabled:bg-gray-500 font-display tracking-wider focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"
          >
            ENFORCE
          </button>
        </div>
      ) : (
        <div>
          <p className="text-lg text-gray-300 mb-4 font-sans">
            Press <span className="bg-gray-200 text-black font-bold px-2 py-1 rounded">SPACE</span> or STOP to catch the slider in the
            {' '}<span className="font-bold text-green-300">Under&nbsp;11&nbsp;km/h</span> target zone.
          </p>
          <div className="relative w-full h-10 bg-gray-800 rounded-lg overflow-hidden my-4 flex items-center border-2 border-gray-600">
            {/* Target zone — labelled, so it isn't conveyed by colour alone */}
            <div className="absolute left-1/2 -translate-x-1/2 w-[25%] h-full bg-green-500/70 shadow-[0_0_15px_theme('colors.green.400')] flex items-center justify-center">
              <span className="text-[10px] font-bold text-black/80 font-sans tracking-wider">TARGET</span>
            </div>
            {/* Slider — positioned from JS (rAF), not a CSS keyframe */}
            <div ref={sliderRef} className="absolute w-2 h-12 bg-yellow-400" style={{ left: '-4px', boxShadow: '0 0 10px yellow' }}></div>
          </div>
          <button
            onClick={handleStop}
            onContextMenu={(e) => e.preventDefault()}
            disabled={stopped}
            className="w-full bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 text-white font-bold py-3 px-4 rounded text-xl transition disabled:bg-gray-500 disabled:cursor-not-allowed font-display tracking-wider touch-none focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"
            style={{ touchAction: 'none' }}
          >
            STOP
          </button>
        </div>
      )}

      {result && (
        <p className={`mt-4 text-center font-bold font-sans ${result === 'success' ? 'text-green-300' : 'text-red-300'}`} aria-hidden="true">
          {result === 'success' ? 'In the zone!' : 'Missed'}
        </p>
      )}
    </div>
  );
};

export default PrecisionSlider;
