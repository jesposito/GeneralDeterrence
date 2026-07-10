import React, { useMemo, useRef, useState } from 'react';
import { DriverProfile, MiniGameProps, PartnerReferral, REFERRAL_PAIRS } from '../../types';
import { useGamepadNavigation } from '../useGamepadNavigation';

type MatchingGameProps = MiniGameProps & { paused?: boolean; scenarioIndex?: number };

const MatchingGame: React.FC<MatchingGameProps> = ({ onComplete, paused = false, scenarioIndex }) => {
  const { driverProfile, partnerOptions, correctPartner } = useMemo(() => {
    const profiles = Object.keys(REFERRAL_PAIRS) as DriverProfile[];
    const seed = scenarioIndex === undefined ? Math.floor(Math.random() * 0x100000000) : Math.abs(scenarioIndex);
    const profile = profiles[seed % profiles.length];
    const correct = REFERRAL_PAIRS[profile];
    const partners = Object.values(REFERRAL_PAIRS) as PartnerReferral[];
    const offset = Math.floor(seed / profiles.length) % partners.length;
    const ordered = partners.map((_, index) => partners[(index + offset) % partners.length]);
    return { driverProfile: profile, partnerOptions: ordered, correctPartner: correct };
  }, [scenarioIndex]);
  const [selectedPartner, setSelectedPartner] = useState<PartnerReferral | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const correct = selectedPartner === correctPartner;

  useGamepadNavigation(containerRef, { active: !paused });

  return (
    <div ref={containerRef}>
      <p className="text-base sm:text-lg text-gray-300 mb-3 font-sans">Match the driver profile to the partner used by this exercise.</p>

      <div className="bg-black/50 p-3 rounded-lg mb-3 text-center border-2 border-cyan-500/50">
        <p className="text-gray-400 font-display tracking-wider text-sm">Driver Profile</p>
        <p className="text-xl sm:text-2xl font-bold text-white font-display">{driverProfile}</p>
      </div>

      <div className="space-y-2">
        {partnerOptions.map((partner) => {
          const selected = selectedPartner === partner;
          const answer = partner === correctPartner;
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
              className={`w-full text-white font-bold py-2.5 px-3 rounded-lg text-base sm:text-xl border-2 ${buttonClass} focus-visible:ring-4 focus-visible:ring-yellow-300 focus-visible:outline-none`}
            >
              {partner}
            </button>
          );
        })}
      </div>

      <div role="status" aria-live="polite" className="mt-3 min-h-[4.5rem]">
        {selectedPartner && (
          <div className={`p-2 rounded-lg font-sans ${correct ? 'text-green-300' : 'text-red-300'}`}>
            <p className="font-bold">{correct ? 'Exercise match' : `Exercise match: ${correctPartner}`}</p>
            <p className="text-sm text-gray-300 mt-1">Coordinated follow-up can reinforce the behaviour change started during the stop.</p>
          </div>
        )}
      </div>

      {selectedPartner ? (
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

export default MatchingGame;
