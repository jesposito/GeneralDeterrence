
import React, { useEffect, useRef } from 'react';
import { MiniGameProps, RIDSType } from '../types';
import QuickTimeEvent from './mini-games/QuickTimeEvent';
import PrecisionSlider from './mini-games/PrecisionSlider';
import SituationalJudgement from './mini-games/SituationalJudgement';

type MiniGameModalProps = MiniGameProps & { paused?: boolean; scenarioIndex?: number };

const MiniGameModal: React.FC<MiniGameModalProps> = ({ onComplete, ridsType, difficulty, paused = false, scenarioIndex, challengeAssist = false }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // gd-0wi.23: dialog semantics + focus management. This modal is complete-to-close (no
  // Escape — you committed to the enforcement), so a Tab focus-trap is mandatory to honour
  // aria-modal. Focus the panel on open, cycle Tab within it, restore focus on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      const focusables = panel?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!panel?.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);

  const renderMiniGame = () => {
    switch (ridsType) {
      case 'Impairment':
        return <QuickTimeEvent onComplete={onComplete} ridsType={ridsType} difficulty={difficulty} paused={paused} challengeAssist={challengeAssist} scenarioIndex={scenarioIndex} />;
      case 'Speed':
        return <PrecisionSlider onComplete={onComplete} ridsType={ridsType} difficulty={difficulty} paused={paused} challengeAssist={challengeAssist} scenarioIndex={scenarioIndex} />;
      case 'Restraints':
      case 'Distractions':
        return <SituationalJudgement onComplete={onComplete} ridsType={ridsType} paused={paused} scenarioIndex={scenarioIndex} challengeAssist={challengeAssist} />;
      default:
        return null;
    }
  };

  const titles: Record<RIDSType, string> = {
      Impairment: "Alcohol Breath Screening",
      Speed: "Speed Enforcement",
      Restraints: "Driver Intervention",
      Distractions: "Driver Intervention",
  }

  return (
    <div className="absolute inset-0 bg-black/35 flex items-start justify-center z-20 animate-fadeIn overflow-y-auto p-2 sm:p-4" data-testid="minigame-shell">
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="minigame-title" className="my-auto max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain bg-gray-900/95 p-4 sm:p-6 rounded-lg shadow-2xl w-full max-w-lg text-center border-4 border-pink-500 shadow-lg shadow-pink-500/50 focus:outline-none">
        <h2 id="minigame-title" className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-3 sm:mb-6 font-display text-glow-yellow">{titles[ridsType]}</h2>
        {renderMiniGame()}
      </div>
    </div>
  );
};

export default MiniGameModal;
