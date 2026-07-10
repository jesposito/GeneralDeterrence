import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MiniGameProps } from '../../types';
import { useGamepadNavigation } from '../useGamepadNavigation';

type QuickTimeEventProps = MiniGameProps & { paused?: boolean };
type Result = 'success' | 'miss' | null;

const QuickTimeEvent: React.FC<QuickTimeEventProps> = ({ onComplete, difficulty = 0, paused = false, challengeAssist = false }) => {
  const [taps, setTaps] = useState(5 + Math.round(Math.min(1, Math.max(0, difficulty)) * 3));
  const [timeLeft, setTimeLeft] = useState(2500);
  const [result, setResult] = useState<Result>(null);
  const remainingRef = useRef(2500);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTap = useCallback(() => {
    if (!paused && !result) setTaps((current) => Math.max(0, current - 1));
  }, [paused, result]);

  useGamepadNavigation(containerRef, {
    active: !paused,
    onPrimary: !challengeAssist && !result ? handleTap : undefined,
  });

  useEffect(() => {
    if (challengeAssist || paused || result) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      remainingRef.current = Math.max(0, remainingRef.current - (now - previous));
      previous = now;
      setTimeLeft(remainingRef.current);
      if (remainingRef.current === 0) setResult((current) => current ?? 'miss');
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [challengeAssist, paused, result]);

  useEffect(() => {
    if (taps === 0) setResult((current) => current ?? 'success');
  }, [result, taps]);

  useEffect(() => {
    if (challengeAssist || paused || result) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
        event.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [challengeAssist, handleTap, paused, result]);

  const chooseAccessibleAnswer = (correct: boolean) => {
    if (!paused) setResult((current) => current ?? (correct ? 'success' : 'miss'));
  };

  return (
    <div ref={containerRef}>
      {challengeAssist ? (
        <div>
          <p className="text-base sm:text-lg text-gray-300 mb-3 font-sans">
            This stop involves possible alcohol impairment. Which action makes screening consistent and detection feel likely?
          </p>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => chooseAccessibleAnswer(true)}
              disabled={Boolean(result)}
              className="w-full bg-cyan-700 hover:bg-cyan-600 border-2 border-cyan-500 text-white font-bold py-3 px-3 rounded-lg font-sans disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
            >
              Complete the routine breath screen
            </button>
            <button
              type="button"
              onClick={() => chooseAccessibleAnswer(false)}
              disabled={Boolean(result)}
              className="w-full bg-cyan-700 hover:bg-cyan-600 border-2 border-cyan-500 text-white font-bold py-3 px-3 rounded-lg font-sans disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
            >
              Test only after obvious signs appear
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-base sm:text-lg text-gray-300 mb-3 font-sans">
            Complete this alcohol breath screen: tap, press <kbd className="bg-gray-200 text-black font-bold px-2 py-1 rounded">Space</kbd>, or use gamepad A {taps} times.
          </p>
          <div className="w-full bg-gray-600 rounded-full h-4 mb-3" role="progressbar" aria-label="Breath screening time remaining" aria-valuemin={0} aria-valuemax={2500} aria-valuenow={Math.round(timeLeft)}>
            <div className="bg-red-500 h-4 rounded-full" style={{ width: `${(timeLeft / 2500) * 100}%`, transition: 'width 50ms linear' }} />
          </div>
          <button
            type="button"
            onPointerDown={(event) => { event.preventDefault(); handleTap(); }}
            onContextMenu={(event) => event.preventDefault()}
            disabled={Boolean(result)}
            className="mx-auto w-32 h-32 sm:w-48 sm:h-48 bg-pink-600 hover:bg-pink-500 border-4 border-pink-400 text-white font-bold rounded-full text-2xl sm:text-4xl active:scale-95 flex flex-col items-center justify-center font-display touch-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-300"
            style={{ touchAction: 'none' }}
          >
            <span>SCREEN</span>
            <span className="text-4xl sm:text-6xl">{taps}</span>
          </button>
        </div>
      )}

      <div role="status" aria-live="polite" className="min-h-[4.5rem] mt-3">
        {result && (
          <div className={`p-2 rounded-lg font-sans ${result === 'success' ? 'text-green-300' : 'text-red-300'}`}>
            <p className="font-bold">{result === 'success' ? 'Screen completed' : 'Screen incomplete'}</p>
            <p className="text-sm text-gray-300 mt-1">
              Consistent screening increases the perceived certainty of detection; skipped opportunities weaken that deterrent.
            </p>
          </div>
        )}
      </div>

      {result ? (
        <button
          type="button"
          onClick={() => onComplete(result === 'success')}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg font-sans focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none"
        >
          Continue
        </button>
      ) : (
        <p className="mt-2 text-sm text-gray-400 font-sans">Principle: routine screening makes detection feel likely.</p>
      )}
    </div>
  );
};

export default QuickTimeEvent;
