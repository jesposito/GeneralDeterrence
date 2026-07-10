import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MiniGameProps } from '../../types';
import { useGamepadNavigation } from '../useGamepadNavigation';

type PrecisionSliderProps = MiniGameProps & { paused?: boolean };
type Result = 'success' | 'miss' | null;

const PrecisionSlider: React.FC<PrecisionSliderProps> = ({ onComplete, difficulty = 0, paused = false, challengeAssist = false }) => {
  const d = Math.min(1, Math.max(0, difficulty));
  const targetHalf = 0.125 - d * 0.065;
  const targetMin = 0.5 - targetHalf;
  const targetMax = 0.5 + targetHalf;
  const sweepPeriodMs = 2500 - d * 900;
  const [result, setResult] = useState<Result>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const elapsedRef = useRef(0);

  const finish = useCallback((won: boolean) => {
    if (!paused) setResult((current) => current ?? (won ? 'success' : 'miss'));
  }, [paused]);

  const handleStop = useCallback(() => {
    finish(positionRef.current >= targetMin && positionRef.current <= targetMax);
  }, [finish, targetMax, targetMin]);

  useGamepadNavigation(containerRef, {
    active: !paused,
    onPrimary: !challengeAssist && !result ? handleStop : undefined,
  });

  useEffect(() => {
    if (challengeAssist || paused || result) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      elapsedRef.current += now - previous;
      previous = now;
      if (elapsedRef.current >= 4000) {
        finish(false);
        return;
      }
      const phase = (elapsedRef.current % sweepPeriodMs) / sweepPeriodMs;
      const position = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      positionRef.current = position;
      if (sliderRef.current) sliderRef.current.style.left = `calc(${(position * 100).toFixed(2)}% - 4px)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [challengeAssist, finish, paused, result, sweepPeriodMs]);

  useEffect(() => {
    if (challengeAssist || paused || result) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' && !event.repeat) {
        event.preventDefault();
        handleStop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [challengeAssist, handleStop, paused, result]);

  return (
    <div ref={containerRef}>
      {challengeAssist ? (
        <div>
          <p className="text-base sm:text-lg text-gray-300 mb-3 font-sans">
            A driver was measured at 67 km/h in a 50 km/h area. What is the highest lawful target speed in good conditions?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[50, 55, 67].map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => finish(speed === 50)}
                disabled={Boolean(result)}
                className="bg-cyan-700 hover:bg-cyan-600 border-2 border-cyan-500 text-white font-bold py-3 px-1 rounded-lg font-sans disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
              >
                {speed} km/h
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-base sm:text-lg text-gray-300 mb-3 font-sans">
            Press <kbd className="bg-gray-200 text-black font-bold px-2 py-1 rounded">Space</kbd>, STOP, or gamepad A in the <span className="font-bold text-green-300">target</span> zone.
          </p>
          <div className="relative w-full h-10 bg-gray-800 rounded-lg overflow-hidden my-3 flex items-center border-2 border-gray-600">
            <div className="absolute left-1/2 -translate-x-1/2 h-full bg-green-500/70 flex items-center justify-center" style={{ width: `${(targetHalf * 200).toFixed(1)}%` }}>
              <span className="text-[10px] font-bold text-black/80 font-sans tracking-wider">TARGET</span>
            </div>
            <div ref={sliderRef} className="absolute w-2 h-12 bg-yellow-400" style={{ left: '-4px', boxShadow: '0 0 10px yellow' }} />
          </div>
          <button
            type="button"
            onClick={handleStop}
            onContextMenu={(event) => event.preventDefault()}
            disabled={Boolean(result)}
            className="w-full bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 text-white font-bold py-3 px-4 rounded text-xl disabled:bg-gray-500 disabled:cursor-not-allowed font-display tracking-wider touch-none focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"
            style={{ touchAction: 'none' }}
          >
            STOP
          </button>
        </div>
      )}

      <div role="status" aria-live="polite" className="min-h-[4.5rem] mt-3">
        {result && (
          <div className={`p-2 rounded-lg font-sans ${result === 'success' ? 'text-green-300' : 'text-red-300'}`}>
            <p className="font-bold">{result === 'success' ? 'Target reached' : 'Target missed'}</p>
            <p className="text-sm text-gray-300 mt-1">The posted limit is a maximum, not a target to exceed; conditions may require a lower speed.</p>
          </div>
        )}
      </div>

      {result && (
        <button
          type="button"
          onClick={() => onComplete(result === 'success')}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg font-sans focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none"
        >
          Continue
        </button>
      )}
    </div>
  );
};

export default PrecisionSlider;
