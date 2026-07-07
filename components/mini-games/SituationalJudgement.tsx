import React, { useMemo, useState } from 'react';
import { MiniGameProps } from '../../types';

// Timeless teaching content: classify a scenario as GENERAL vs SPECIFIC deterrence.
// Deliberately no specific legislation/policy detail — that dates quickly. The concepts do not.
//   General deterrence  = visible, unpredictable enforcement deters the WHOLE population.
//   Specific deterrence = a consequence to an individual deters THAT person from reoffending.
type DeterrenceType = 'General' | 'Specific';
interface Scenario { text: string; answer: DeterrenceType; why: string; }

const SCENARIOS: Scenario[] = [
  { text: "Drivers across a whole suburb ease off because patrol cars turn up at unpredictable times and places.",
    answer: 'General', why: "Visible, unpredictable presence deters the entire driving population — not just those who get stopped." },
  { text: "A driver who copped a heavy fine for speeding now sticks to the limit to avoid another one.",
    answer: 'Specific', why: "The penalty deters that one individual from reoffending." },
  { text: "Publicised, randomly-sited breath testing means fewer people drink-drive region-wide, even where no checkpoint is set up.",
    answer: 'General', why: "The perceived risk of being caught anywhere deters the whole population." },
  { text: "After being disqualified from driving, a repeat offender stops driving dangerously.",
    answer: 'Specific', why: "The sanction changed that specific person's behaviour." },
  { text: "Marked patrol cars parked at known crash hotspots cause every passing driver to slow down.",
    answer: 'General', why: "Visible presence deters everyone who sees it, not one offender." },
  { text: "A driver ticketed for using a phone now always uses hands-free.",
    answer: 'Specific', why: "The consequence deters that one individual." },
  { text: "Because patrols could appear at any moment, drivers can never assume they're unwatched, so offending drops everywhere.",
    answer: 'General', why: "Unpredictability maximises the perceived risk across the whole population." },
  { text: "A young driver caught street racing completes a defensive-driving course and no longer races.",
    answer: 'Specific', why: "The individual intervention deterred that person." },
];

const SituationalJudgement: React.FC<MiniGameProps> = ({ onComplete }) => {
  // One scenario per playthrough, chosen once on mount.
  const scenario = useMemo(() => SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)], []);
  const [picked, setPicked] = useState<DeterrenceType | null>(null);
  const correct = picked !== null && picked === scenario.answer;

  const choose = (choice: DeterrenceType) => {
    if (!picked) setPicked(choice);
  };

  return (
    <div>
      <div className="bg-black/50 p-4 rounded-lg mb-4 border-2 border-cyan-500/50 min-h-[90px]">
        <p className="text-sm text-cyan-300 font-sans mb-1">Is this GENERAL or SPECIFIC deterrence?</p>
        <p className="text-lg text-gray-200 font-sans">{scenario.text}</p>
      </div>

      {/* Two native buttons: Tab + Enter/Space/click all work and each activates itself. */}
      <div className="grid grid-cols-2 gap-3">
        {(['General', 'Specific'] as DeterrenceType[]).map(type => {
          const isPicked = picked === type;
          const isAnswer = scenario.answer === type;
          let cls = 'bg-cyan-700 hover:bg-cyan-600 border-cyan-500';
          if (picked) {
            if (isAnswer) cls = 'bg-green-600 border-green-400';
            else if (isPicked) cls = 'bg-red-600 border-red-400';
            else cls = 'bg-gray-700 border-gray-600 opacity-60';
          }
          return (
            <button
              key={type}
              onClick={() => choose(type)}
              disabled={!!picked}
              className={`text-white font-bold py-4 px-4 rounded-lg text-lg transition border-2 ${cls} font-sans focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none`}
            >
              {type}
              <span className="block text-xs font-normal opacity-80">deterrence</span>
            </button>
          );
        })}
      </div>

      {/* Verdict + explanation announced together, only after choosing (no answer key up front). */}
      <div role="status" aria-live="polite" className="mt-4 min-h-[64px]">
        {picked && (
          <div className={`p-3 rounded-lg font-sans ${correct ? 'text-green-300' : 'text-red-300'}`}>
            <p className="font-bold">{correct ? 'Correct' : 'Not quite'} — {scenario.answer} deterrence</p>
            <p className="text-sm text-gray-300 mt-1">{scenario.why}</p>
          </div>
        )}
      </div>

      {picked ? (
        <button
          autoFocus
          onClick={() => onComplete(correct)}
          className="mt-2 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg font-sans focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none"
        >
          Continue
        </button>
      ) : (
        <p className="mt-4 text-sm text-gray-400 font-sans">Pick General or Specific. Tab to move, Enter or Space to choose.</p>
      )}
    </div>
  );
};

export default SituationalJudgement;
