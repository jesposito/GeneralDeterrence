import React, { useMemo, useRef, useState } from 'react';
import { MiniGameProps, RIDSType } from '../../types';
import { useGamepadNavigation } from '../useGamepadNavigation';

interface Scenario {
  prompt: string;
  choices: [string, string];
  answer: 0 | 1;
  why: string;
}

const SCENARIOS: Record<'Restraints' | 'Distractions', Scenario[]> = {
  Restraints: [
    {
      prompt: 'A stopped vehicle has an unrestrained occupant. Which response best supports safer behaviour after the stop?',
      choices: ['Address the restraint issue, explain the safety risk, and require it to be corrected before travel resumes.', 'Ignore it because the trip is short.'],
      answer: 0,
      why: 'A clear intervention links the unsafe behaviour to an immediate correction and makes future enforcement feel credible.',
    },
    {
      prompt: 'The driver says restraints are unnecessary at low speed. What is the strongest deterrence response?',
      choices: ['Treat low speed as an exemption.', 'Correct the behaviour consistently and explain that crash risk still exists on short, low-speed trips.'],
      answer: 1,
      why: 'Consistency prevents drivers from inventing situations where they expect the safety rule will not be enforced.',
    },
  ],
  Distractions: [
    {
      prompt: 'A driver was handling a phone while the vehicle was moving. Which intervention best supports safer future behaviour?',
      choices: ['Address the distraction, explain the crash risk, and have the phone put away before travel resumes.', 'Wait until the behaviour causes a crash.'],
      answer: 0,
      why: 'Intervening before harm occurs reinforces that distracted driving is detectable and preventable.',
    },
    {
      prompt: 'A driver says checking one message was harmless. What response best reinforces deterrence?',
      choices: ['Ignore brief phone use.', 'Make the unsafe choice explicit and require a non-distracting way to continue the journey.'],
      answer: 1,
      why: 'A consistent consequence removes the expectation that short distractions will be overlooked.',
    },
  ],
};

type SituationalJudgementProps = MiniGameProps & { paused?: boolean; scenarioIndex?: number };

const SituationalJudgement: React.FC<SituationalJudgementProps> = ({
  onComplete,
  ridsType,
  paused = false,
  scenarioIndex,
}) => {
  const type: 'Restraints' | 'Distractions' = ridsType === 'Distractions' ? 'Distractions' : 'Restraints';
  const scenario = useMemo(() => {
    const options = SCENARIOS[type];
    const index = scenarioIndex === undefined ? Math.floor(Math.random() * options.length) : Math.abs(scenarioIndex) % options.length;
    return options[index];
  }, [scenarioIndex, type]);
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const correct = picked !== null && picked === scenario.answer;

  useGamepadNavigation(containerRef, { active: !paused });

  return (
    <div ref={containerRef}>
      <div className="bg-black/50 p-3 sm:p-4 rounded-lg mb-3 border-2 border-cyan-500/50">
        <p className="text-xs sm:text-sm text-cyan-300 font-sans mb-1">Choose the safer intervention</p>
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
          onClick={() => onComplete(correct)}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg font-sans focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none"
        >
          Continue
        </button>
      ) : (
        <p className="mt-2 text-sm text-gray-400 font-sans">Use Tab or the D-pad to move; Enter, Space, or gamepad A selects.</p>
      )}
    </div>
  );
};

export default SituationalJudgement;
