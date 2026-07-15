import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MiniGameProps } from '../../types';
import { scenarioAt } from '../../utils/interventionScenarios';
import { useGamepadNavigation } from '../useGamepadNavigation';
import { MINI_GAME_RESULT_DURATION_MS, useOnceComplete } from './useOnceComplete';

type PrecisionSliderProps = MiniGameProps & { paused?: boolean };
type Result = 'success' | 'miss' | null;

const SPEED_PATTERNS = [
  { center: 0.50, phase: 0, period: 1, measured: 67, posted: 50, choices: [50, 55, 67] as const, context: 'good conditions in a 50 km/h area' },
  { center: 0.30, phase: 0.18, period: 0.94, measured: 92, posted: 80, choices: [70, 80, 92] as const, context: 'rain in an 80 km/h area' },
  { center: 0.70, phase: 0.42, period: 1.08, measured: 46, posted: 30, choices: [30, 40, 46] as const, context: 'temporary works with a posted 30 km/h limit' },
  { center: 0.40, phase: 0.65, period: 0.9, measured: 108, posted: 100, choices: [90, 100, 108] as const, context: 'a posted 100 km/h limit' },
  { center: 0.62, phase: 0.3, period: 1.04, measured: 58, posted: 50, choices: [45, 50, 58] as const, context: 'a downhill section posted at 50 km/h' },
  { center: 0.24, phase: 0.78, period: 0.96, measured: 73, posted: 60, choices: [60, 65, 73] as const, context: 'a posted 60 km/h transition zone' },
] as const;

const PrecisionSlider: React.FC<PrecisionSliderProps> = ({ onComplete, difficulty = 0, paused = false, challengeAssist = false, scenarioIndex }) => {
  const d = Math.min(1, Math.max(0, difficulty));
  const [fallbackIndex] = useState(() => Math.floor(Math.random() * SPEED_PATTERNS.length));
  const pattern = scenarioAt(SPEED_PATTERNS, scenarioIndex ?? fallbackIndex);
  const targetHalf = 0.125 - d * 0.06;
  const targetMin = pattern.center - targetHalf;
  const targetMax = pattern.center + targetHalf;
  const sweepPeriodMs = (2500 - d * 850) * pattern.period;
  const [result, setResult] = useState<Result>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const elapsedRef = useRef(0);
  const complete = useOnceComplete(onComplete);

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
      const phase = ((elapsedRef.current / sweepPeriodMs) + pattern.phase) % 1;
      const position = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      positionRef.current = position;
      if (sliderRef.current) sliderRef.current.style.left = `calc(${(position * 100).toFixed(2)}% - 4px)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [challengeAssist, finish, pattern.phase, paused, result, sweepPeriodMs]);

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

  useEffect(() => {
    if (!result || paused || challengeAssist) return;
    const timer = window.setTimeout(() => complete(result === 'success'), MINI_GAME_RESULT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [challengeAssist, complete, paused, result]);

  return (
    <div ref={containerRef}>
      {challengeAssist ? (
        <div>
          <p className="text-base sm:text-lg text-gray-300 mb-3 font-sans">
            A driver was measured at {pattern.measured} km/h in {pattern.context}. What is the highest lawful speed shown by the posted limit?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {pattern.choices.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => finish(speed === pattern.posted)}
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
            <div className="absolute -translate-x-1/2 h-full bg-green-500/70 flex items-center justify-center" style={{ left: `${pattern.center * 100}%`, width: `${(targetHalf * 200).toFixed(1)}%` }}>
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
            <p className="text-sm text-gray-300 mt-1">The posted limit is a maximum, not a target speed; conditions may require travelling below it.</p>
          </div>
        )}
      </div>

      {result && (
        <button
          type="button"
          onClick={() => complete(result === 'success')}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg font-sans focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none"
        >
          Return now{challengeAssist ? '' : ' · auto in 5s'}
        </button>
      )}
    </div>
  );
};

export default PrecisionSlider;
