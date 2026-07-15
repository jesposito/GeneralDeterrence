import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MiniGameProps, PartnerReferral } from '../../types';
import { PARTNER_FOCUS, REFERRAL_SCENARIOS, scenarioAt } from '../../utils/interventionScenarios';
import { useGamepadNavigation } from '../useGamepadNavigation';
import { MINI_GAME_RESULT_DURATION_MS, useOnceComplete } from './useOnceComplete';

type MatchingGameProps = MiniGameProps & { paused?: boolean; scenarioIndex?: number };

const MatchingGame: React.FC<MatchingGameProps> = ({ onComplete, paused = false, scenarioIndex, challengeAssist = false }) => {
  const [fallbackIndex] = useState(() => Math.floor(Math.random() * REFERRAL_SCENARIOS.length));
  const { scenario, partnerOptions } = useMemo(() => {
    const seed = scenarioIndex ?? fallbackIndex;
    const selected = scenarioAt(REFERRAL_SCENARIOS, seed);
    const partners = Object.keys(PARTNER_FOCUS) as PartnerReferral[];
    const integer = Number.isFinite(seed) ? Math.trunc(seed) : 0;
    const offset = ((integer % partners.length) + partners.length) % partners.length;
    const ordered = partners.map((_, index) => partners[(index + offset) % partners.length]);
    return { scenario: selected, partnerOptions: ordered };
  }, [fallbackIndex, scenarioIndex]);
  const [selectedPartner, setSelectedPartner] = useState<PartnerReferral | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const correct = selectedPartner === scenario.correctPartner;
  const complete = useOnceComplete(onComplete);

  useGamepadNavigation(containerRef, { active: !paused });

  useEffect(() => {
    if (!selectedPartner || paused || challengeAssist) return;
    const timer = window.setTimeout(() => complete(correct), MINI_GAME_RESULT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [challengeAssist, complete, correct, paused, selectedPartner]);

  return (
    <div ref={containerRef}>
      <p className="text-sm sm:text-base text-gray-300 mb-3 font-sans">Choose the best partner for this exercise follow-up.</p>

      <div className="bg-black/50 p-3 rounded-lg mb-3 text-left border-2 border-cyan-500/50">
        <p className="text-gray-400 font-display tracking-wider text-sm">Driver Profile</p>
        <p className="text-lg sm:text-xl font-bold text-white font-display mb-1">{scenario.profile}</p>
        <p className="text-sm text-gray-200 font-sans">{scenario.prompt}</p>
      </div>

      <div className="space-y-2">
        {partnerOptions.map((partner) => {
          const selected = selectedPartner === partner;
          const answer = partner === scenario.correctPartner;
          let buttonClass = 'bg-cyan-700 hover:bg-cyan-600 border-cyan-500';
          if (selectedPartner) {
            if (answer) buttonClass = 'bg-green-600 border-green-400';
            else if (selected) buttonClass = 'bg-red-600 border-red-400';
            else buttonClass = 'bg-gray-700 border-gray-600 opacity-60';
          }
          return (
            <button
              key={partner}
              type="button"
              onClick={() => { if (!paused && !selectedPartner) setSelectedPartner(partner); }}
              disabled={Boolean(selectedPartner)}
              className={`w-full text-white py-2 px-3 rounded-lg border-2 ${buttonClass} focus-visible:ring-4 focus-visible:ring-yellow-300 focus-visible:outline-none`}
            >
              <span className="block text-base sm:text-lg font-bold">{partner}</span>
              <span className="block text-xs font-normal text-gray-200">{PARTNER_FOCUS[partner]}</span>
            </button>
          );
        })}
      </div>

      <div role="status" aria-live="polite" className="mt-3 min-h-[4.5rem]">
        {selectedPartner && (
          <div className={`p-2 rounded-lg font-sans ${correct ? 'text-green-300' : 'text-red-300'}`}>
            <p className="font-bold">{correct ? 'Strong exercise match' : `Exercise match: ${scenario.correctPartner}`}</p>
            <p className="text-sm text-gray-300 mt-1">{scenario.why}</p>
          </div>
        )}
      </div>

      {selectedPartner ? (
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

export default MatchingGame;
