import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MiniGameProps } from '../../types';
import { INTERVENTION_SCENARIOS, scenarioAt } from '../../utils/interventionScenarios';
import { useGamepadNavigation } from '../useGamepadNavigation';
import { MINI_GAME_RESULT_DURATION_MS, useOnceComplete } from './useOnceComplete';

type SituationalJudgementProps = MiniGameProps & { paused?: boolean; scenarioIndex?: number };

const SituationalJudgement: React.FC<SituationalJudgementProps> = ({
  onComplete,
  ridsType,
  paused = false,
  scenarioIndex,
  challengeAssist = false,
}) => {
  const type: 'Restraints' | 'Distractions' = ridsType === 'Distractions' ? 'Distractions' : 'Restraints';
  const [fallbackIndex] = useState(() => Math.floor(Math.random() * INTERVENTION_SCENARIOS[type].length));
  const scenario = useMemo(() => {
    return scenarioAt(INTERVENTION_SCENARIOS[type], scenarioIndex ?? fallbackIndex);
  }, [fallbackIndex, scenarioIndex, type]);
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const correct = picked !== null && picked === scenario.answer;
  const complete = useOnceComplete(onComplete);

  useGamepadNavigation(containerRef, { active: !paused });

  useEffect(() => {
    if (picked === null || paused || challengeAssist) return;
    const timer = window.setTimeout(() => complete(correct), MINI_GAME_RESULT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [challengeAssist, complete, correct, paused, picked]);

  return (
    <div ref={containerRef}>
      <div className="bg-black/50 p-3 sm:p-4 rounded-lg mb-3 border-2 border-cyan-500/50">
        <p className="text-xs sm:text-sm text-cyan-300 font-sans mb-1">Assess the evidence</p>
        <p className="text-base sm:text-lg text-gray-200 font-sans">{scenario.prompt}</p>
      </div>

      <div className="grid gap-2">
        {scenario.choices.map((choice, index) => {
          const isPicked = picked === index;
          const isAnswer = scenario.answer === index;
          let className = 'bg-cyan-700 hover:bg-cyan-600 border-cyan-500';
          if (picked !== null) {
            if (isAnswer) className = 'bg-green-600 border-green-400';
            else if (isPicked) className = 'bg-red-600 border-red-400';
            else className = 'bg-gray-700 border-gray-600 opacity-60';
          }
          return (
            <button
              key={choice}
              type="button"
              onClick={() => { if (!paused && picked === null) setPicked(index as 0 | 1); }}
              disabled={picked !== null}
              className={`text-white font-bold py-3 px-3 rounded-lg text-sm sm:text-base border-2 ${className} font-sans focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      <div role="status" aria-live="polite" className="mt-3 min-h-[4.5rem]">
        {picked !== null && (
          <div className={`p-2 rounded-lg font-sans ${correct ? 'text-green-300' : 'text-red-300'}`}>
            <p className="font-bold">{correct ? 'Sound intervention' : 'Not the safer choice'}</p>
            <p className="text-sm text-gray-300 mt-1">{scenario.why}</p>
          </div>
        )}
      </div>

      {picked !== null ? (
        <button
          type="button"
          onClick={() => complete(correct)}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg font-sans focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none"
        >
          Return now{challengeAssist ? '' : ' · auto in 5s'}
        </button>
      ) : (
        <p className="mt-2 text-sm text-gray-400 font-sans">Use Tab or the D-pad to move; Enter, Space, or gamepad A selects.</p>
      )}
    </div>
  );
};

export default SituationalJudgement;
