
import React, { useState, useMemo, useEffect } from 'react';
import { MiniGameProps, DriverProfile, PartnerReferral, REFERRAL_PAIRS } from '../../types';

const shuffle = <T,>(array: T[]): T[] => {
  return array.sort(() => Math.random() - 0.5);
};

const MatchingGame: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [selectedPartner, setSelectedPartner] = useState<PartnerReferral | null>(null);

  const { driverProfile, partnerOptions, correctPartner } = useMemo(() => {
    const profiles = Object.keys(REFERRAL_PAIRS) as DriverProfile[];
    const driverProfile = profiles[Math.floor(Math.random() * profiles.length)];
    const correctPartner = REFERRAL_PAIRS[driverProfile];
    const otherPartners = (Object.values(REFERRAL_PAIRS) as PartnerReferral[]).filter(p => p !== correctPartner);
    const partnerOptions = shuffle([correctPartner, ...shuffle(otherPartners).slice(0, 2)]);
    return { driverProfile, partnerOptions, correctPartner };
  }, []);
  
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);

  const handleSelect = (partner: PartnerReferral) => {
    if (result) return;

    setSelectedPartner(partner);
    if (partner === correctPartner) {
        setResult('correct');
        setTimeout(() => onComplete(true), 1000);
    } else {
        setResult('incorrect');
        setTimeout(() => onComplete(false), 1000);
    }
  };

  return (
    <div>
      <p className="text-lg text-gray-300 mb-4 font-sans">Match the driver profile to the correct partner agency for referral.</p>
      
      <div className="bg-black/50 p-4 rounded-lg mb-6 text-center border-2 border-cyan-500/50">
        <p className="text-gray-400 font-display tracking-wider">Driver Profile</p>
        <p className="text-2xl font-bold text-white font-display">{driverProfile}</p>
      </div>

      <div className="space-y-3">
        {partnerOptions.map(partner => {
          const isSelected = selectedPartner === partner;
          let buttonClass = 'bg-cyan-700 hover:bg-cyan-600 border-cyan-500';
          if (isSelected) {
            buttonClass = result === 'correct' ? 'bg-green-600 border-green-400' : 'bg-red-600 border-red-400';
          }

          return (
            <button
              key={partner}
              onClick={() => handleSelect(partner)}
              disabled={!!result}
              className={`w-full text-white font-bold py-3 px-4 rounded-lg text-xl transition border-2 ${buttonClass}`}
            >
              {partner}
            </button>
          );
        })}
      </div>
       <p className="mt-4 text-sm text-gray-400 font-sans">Principle: Use partners to help change driver behaviour.</p>
    </div>
  );
};

export default MatchingGame;