import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MiniGameProps } from '../../types';
import { scenarioAt } from '../../utils/interventionScenarios';
import { useGamepadNavigation } from '../useGamepadNavigation';
import { MINI_GAME_RESULT_DURATION_MS, useOnceComplete } from './useOnceComplete';

type QuickTimeEventProps = MiniGameProps & { paused?: boolean };
type Result = 'success' | 'miss' | null;

const SCREENING_PATTERNS = [
  {
    label: 'SCREEN', baseTaps: 5, duration: 2600,
    instruction: 'Complete the initial screening sequence',
    assistPrompt: 'A checkpoint is screening vehicles consistently rather than waiting for obvious impairment. Why does that support deterrence?',
    assistChoices: ['It makes detection feel likely to every driver passing through.', 'It allows screening to be reserved for drivers who already look impaired.'] as const,
    assistAnswer: 0 as const,
    why: 'Consistent screening raises the perceived chance of detection instead of relying only on visible signs.',
  },
  {
    label: 'REPEAT', baseTaps: 6, duration: 3000,
    instruction: 'Complete a clear repeat sequence',
    assistPrompt: 'The first screening attempt is incomplete. What is the sound next step in this exercise?',
    assistChoices: ['Treat the incomplete attempt as a clear result.', 'Explain the next step and complete a clear repeat screen.'] as const,
    assistAnswer: 1 as const,
    why: 'A clear, consistent process produces a meaningful result and reinforces procedural fairness.',
  },
  {
    label: 'STEADY', baseTaps: 4, duration: 2200,
    instruction: 'Hold a steady screening cadence',
    assistPrompt: 'A driver is cooperative but nervous during screening. Which approach best supports a reliable interaction?',
    assistChoices: ['Give clear instructions and complete the same screening process calmly.', 'Skip the screen because nervousness makes the result less useful.'] as const,
    assistAnswer: 0 as const,
    why: 'Calm, consistent instructions support both reliable screening and a fair roadside interaction.',
  },
  {
    label: 'CONFIRM', baseTaps: 7, duration: 3200,
    instruction: 'Complete the confirmation sequence',
    assistPrompt: 'A driver shows possible impairment signs after an initial interaction. What should guide the response?',
    assistChoices: ['Use the approved screening process rather than relying on appearance alone.', 'Treat the observed signs as sufficient without completing a screen.'] as const,
    assistAnswer: 0 as const,
    why: 'Observed signs can prompt attention, but a consistent screening process is more reliable than assumption alone.',
  },
] as const;

const QuickTimeEvent: React.FC<QuickTimeEventProps> = ({ onComplete, difficulty = 0, paused = false, challengeAssist = false, scenarioIndex }) => {
  const d = Math.min(1, Math.max(0, difficulty));
  const [fallbackIndex] = useState(() => Math.floor(Math.random() * SCREENING_PATTERNS.length));
  const pattern = scenarioAt(SCREENING_PATTERNS, scenarioIndex ?? fallbackIndex);
  const duration = pattern.duration - Math.round(d * 150);
  const [taps, setTaps] = useState(pattern.baseTaps + Math.round(d * 3));
  const [timeLeft, setTimeLeft] = useState(duration);
  const [result, setResult] = useState<Result>(null);
  const remainingRef = useRef(duration);
  const containerRef = useRef<HTMLDivElement>(null);
  const complete = useOnceComplete(onComplete);

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
    if (!result || paused || challengeAssist) return;
    const timer = window.setTimeout(() => complete(result === 'success'), MINI_GAME_RESULT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [challengeAssist, complete, paused, result]);

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
            {pattern.assistPrompt}
          </p>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => chooseAccessibleAnswer(pattern.assistAnswer === 0)}
              disabled={Boolean(result)}
              className="w-full bg-cyan-700 hover:bg-cyan-600 border-2 border-cyan-500 text-white font-bold py-3 px-3 rounded-lg font-sans disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
            >
              {pattern.assistChoices[0]}
            </button>
            <button
              type="button"
              onClick={() => chooseAccessibleAnswer(pattern.assistAnswer === 1)}
              disabled={Boolean(result)}
              className="w-full bg-cyan-700 hover:bg-cyan-600 border-2 border-cyan-500 text-white font-bold py-3 px-3 rounded-lg font-sans disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
            >
              {pattern.assistChoices[1]}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-base sm:text-lg text-gray-300 mb-3 font-sans">
            {pattern.instruction}: tap, press <kbd className="bg-gray-200 text-black font-bold px-2 py-1 rounded">Space</kbd>, or use gamepad A {taps} times.
          </p>
          <div className="w-full bg-gray-600 rounded-full h-4 mb-3" role="progressbar" aria-label="Breath screening time remaining" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(timeLeft)}>
            <div className="bg-red-500 h-4 rounded-full" style={{ width: `${(timeLeft / duration) * 100}%`, transition: 'width 50ms linear' }} />
          </div>
          <button
            type="button"
            onPointerDown={(event) => { event.preventDefault(); handleTap(); }}
            onContextMenu={(event) => event.preventDefault()}
            disabled={Boolean(result)}
            className="mx-auto w-32 h-32 sm:w-48 sm:h-48 bg-pink-600 hover:bg-pink-500 border-4 border-pink-400 text-white font-bold rounded-full text-2xl sm:text-4xl active:scale-95 flex flex-col items-center justify-center font-display touch-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-300"
            style={{ touchAction: 'none' }}
          >
            <span>{pattern.label}</span>
            <span className="text-4xl sm:text-6xl">{taps}</span>
          </button>
        </div>
      )}

      <div role="status" aria-live="polite" className="min-h-[4.5rem] mt-3">
        {result && (
          <div className={`p-2 rounded-lg font-sans ${result === 'success' ? 'text-green-300' : 'text-red-300'}`}>
            <p className="font-bold">{result === 'success' ? 'Screen completed' : 'Screen incomplete'}</p>
            <p className="text-sm text-gray-300 mt-1">
              {pattern.why}
            </p>
          </div>
        )}
      </div>

      {result ? (
        <button
          type="button"
          onClick={() => complete(result === 'success')}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg font-sans focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none"
        >
          Return now{challengeAssist ? '' : ' · auto in 5s'}
        </button>
      ) : (
        <p className="mt-2 text-sm text-gray-400 font-sans">Principle: routine screening makes detection feel likely.</p>
      )}
    </div>
  );
};

export default QuickTimeEvent;
