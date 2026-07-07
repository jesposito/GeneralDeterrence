
import React, { useEffect, useRef } from 'react';
import { MiniGameProps, RIDSType } from '../types';
import QuickTimeEvent from './mini-games/QuickTimeEvent';
import PrecisionSlider from './mini-games/PrecisionSlider';
import SituationalJudgement from './mini-games/SituationalJudgement';

const MiniGameModal: React.FC<MiniGameProps> = ({ onComplete, ridsType }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // gd-0wi.23: dialog semantics + focus management. This modal is complete-to-close (no
  // Escape — you committed to the enforcement), so a Tab focus-trap is mandatory to honour
  // aria-modal. Focus the panel on open, cycle Tab within it, restore focus on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);

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
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="minigame-title" className="bg-gray-900 p-8 rounded-lg shadow-2xl w-full max-w-md text-center border-4 border-pink-500 shadow-lg shadow-pink-500/50 focus:outline-none">
        <h2 id="minigame-title" className="text-3xl font-bold text-yellow-400 mb-6 font-display text-glow-yellow">{titles[ridsType]}</h2>
        {renderMiniGame()}
      </div>
    </div>
  );
};

export default MiniGameModal;
