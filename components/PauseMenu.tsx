import React, { useEffect, useRef, useState } from 'react';
import ControlsSettings from './ControlsSettings';
import { useGamepadNavigation } from './useGamepadNavigation';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onRestart, onMainMenu }) => {
  const [showControls, setShowControls] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);

  useGamepadNavigation(panelRef, { active: !showControls, onBack: onResume });

  useEffect(() => {
    if (showControls) return;
    const previous = document.activeElement as HTMLElement | null;
    resumeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onResume();
      if (event.key !== 'Tab') return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onResume, showControls]);

  if (showControls) return <ControlsSettings onClose={() => setShowControls(false)} />;

  return (
    <div className="absolute inset-0 z-50 bg-black/85 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div ref={panelRef} tabIndex={-1} className="w-full max-w-sm my-auto bg-gray-900 border-4 border-cyan-500 rounded-lg p-5 sm:p-7 text-center shadow-2xl shadow-cyan-500/40 focus:outline-none">
        <h2 id="pause-title" className="text-3xl font-display font-bold text-cyan-300 text-glow-cyan mb-1">Paused</h2>
        <p className="text-sm text-gray-400 font-sans mb-5">The shift clock and decisions are stopped.</p>
        <div className="grid gap-3">
          <button ref={resumeRef} type="button" onClick={onResume} className="bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 text-white font-display font-bold py-3 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300">Resume</button>
          <button type="button" onClick={() => setShowControls(true)} className="bg-cyan-800 hover:bg-cyan-700 border-2 border-cyan-500 text-white font-display font-bold py-3 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300">Controls</button>
          <button type="button" onClick={onRestart} className="bg-gray-700 hover:bg-gray-600 border-2 border-gray-500 text-white font-display font-bold py-3 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300">Restart Shift</button>
          <button type="button" onClick={onMainMenu} className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 text-white font-display font-bold py-3 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300">Main Menu</button>
        </div>
        <p className="mt-4 text-xs text-gray-500 font-sans">Esc or gamepad B resumes. Use the D-pad and A to choose.</p>
      </div>
    </div>
  );
};

export default PauseMenu;
