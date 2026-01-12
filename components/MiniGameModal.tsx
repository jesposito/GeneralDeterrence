
import React from 'react';
import { MiniGameProps, RIDSType } from '../types';
import QuickTimeEvent from './mini-games/QuickTimeEvent';
import PrecisionSlider from './mini-games/PrecisionSlider';
import SituationalJudgement from './mini-games/SituationalJudgement';

const MiniGameModal: React.FC<MiniGameProps> = ({ onComplete, ridsType }) => {
  const renderMiniGame = () => {
    switch (ridsType) {
      case 'Impairment':
        return <QuickTimeEvent onComplete={onComplete} ridsType={ridsType} />;
      case 'Speed':
        return <PrecisionSlider onComplete={onComplete} ridsType={ridsType} />;
      case 'Restraints':
      case 'Distractions':
        return <SituationalJudgement onComplete={onComplete} ridsType={ridsType} />;
      default:
        return null;
    }
  };

  const titles: Record<RIDSType, string> = {
      Impairment: "Breath Screening Test",
      Speed: "Speed Enforcement",
      Restraints: "Driver Intervention",
      Distractions: "Driver Intervention",
  }

  return (
    <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20 animate-fadeIn">
      <div className="bg-gray-900 p-8 rounded-lg shadow-2xl w-full max-w-md text-center border-4 border-pink-500 shadow-lg shadow-pink-500/50">
        <h2 className="text-3xl font-bold text-yellow-400 mb-6 font-display text-glow-yellow">{titles[ridsType]}</h2>
        {renderMiniGame()}
      </div>
    </div>
  );
};

export default MiniGameModal;