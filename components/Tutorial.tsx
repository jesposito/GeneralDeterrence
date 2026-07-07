import React, { useEffect, useMemo, useRef } from 'react';
import * as audio from '../utils/audio';
import { loadBindings, displayKey, type GameAction } from '../utils/keybindings';

interface TutorialProps {
  onComplete: () => void;
  /** e.g. "Daily Shift · Te Aro District · Geothermal" */
  mapLabel?: string;
}

const TutorialInfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-black/60 p-3 sm:p-4 rounded-lg border-2 border-cyan-500/30 w-full sm:w-auto sm:min-w-[300px] sm:flex-1">
        <h2 className="text-lg sm:text-xl font-bold font-display text-yellow-400 text-glow-yellow mb-2 sm:mb-3 tracking-wider">{title}</h2>
        <div className="text-gray-300 space-y-2 font-sans text-sm sm:text-base">{children}</div>
    </div>
);

const KeyDisplay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="bg-gray-200 text-black font-bold px-2 py-1 rounded-md mx-1">{children}</kbd>
);

const Tutorial: React.FC<TutorialProps> = ({ onComplete, mapLabel }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Show the player's ACTUAL bindings (they're rebindable in Controls on the menu).
  const bindings = useMemo(() => loadBindings(), []);
  const keysFor = (a: GameAction) => bindings[a].map(displayKey).join(' / ');

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onComplete();
      // P1: aria-modal without a trap let Tab reach the obscured game. One focusable → pin it.
      else if (e.key === 'Tab') { e.preventDefault(); buttonRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onComplete]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      className="absolute inset-0 bg-black/80 flex flex-col items-center justify-start sm:justify-center z-30 p-4 sm:p-8 overflow-y-auto animate-fadeIn"
    >
        <div className="w-full max-w-6xl">
            <h1 id="tutorial-title" className="text-3xl sm:text-5xl font-bold font-display text-cyan-400 text-glow-cyan mb-1 text-center">PRE-SHIFT BRIEFING</h1>
            {mapLabel && <p className="text-sm sm:text-base text-gray-400 text-center font-display tracking-wider mb-2">TONIGHT'S PATROL — {mapLabel}</p>}

            {/* The one sentence that matters, before any mechanics. */}
            <p className="max-w-3xl mx-auto text-center text-base sm:text-xl text-white font-sans mb-4 sm:mb-6 bg-cyan-950/50 border-2 border-cyan-500/40 rounded-lg px-4 py-3">
                <span className="text-cyan-300 font-bold font-display">THE JOB:</span> keep every district's <span className="text-white font-bold">deterrence</span> high by <em>being seen</em>.
                Stops score points — <span className="text-cyan-300 font-bold">presence saves lives</span>.
            </p>

            <div className="flex flex-wrap gap-4 sm:gap-6 justify-center">
                <TutorialInfoCard title="1 · PATROL">
                    <ul className="space-y-1.5">
                        <li>Be seen → <span className="text-white font-bold">DETERRENCE</span> rises. Leave → it decays.</li>
                        <li>All districts ≥85% = <span className="text-yellow-300 font-bold">FULL COVERAGE ×2</span>.</li>
                        <li>Park briefly = <span className="text-cyan-300 font-bold">PATROL POST</span>. Idle where it's safe = <span className="text-red-400 font-bold">NEGLECT</span>.</li>
                        <li><span className="text-cyan-300 font-bold">PREVENTED</span> counts offences that never happened. <span className="text-cyan-200">That's the real score.</span></li>
                    </ul>
                </TutorialInfoCard>

                <TutorialInfoCard title="2 · SPOT & STOP">
                    <p className="text-base sm:text-lg whitespace-nowrap">
                        <span aria-hidden="true">⚠️</span> Restraints · <span aria-hidden="true">🥴</span> Impaired<br/>
                        <span aria-hidden="true">📱</span> Distracted · <span aria-hidden="true">🔥</span> Speed
                    </p>
                    <ul className="space-y-1.5">
                        <li>Near one? <span className="text-yellow-300 font-bold">RIDS CHECK</span>.</li>
                        <li><span className="text-cyan-300 font-bold">Warn</span>: fast, small. <span className="text-pink-400 font-bold">Enforce</span>: mini-game, big, −6s.</li>
                        <li><span className="text-red-400 font-bold">Pulsing red = LIFE AT RISK.</span> Go — or send <span className="text-yellow-400 font-bold">ASSIST</span>.</li>
                        <li>One car each shift hides something <em>much</em> bigger…</li>
                    </ul>
                </TutorialInfoCard>

                <TutorialInfoCard title="3 · CONTROLS">
                    {/* Keyboard (desktop): live bindings in a no-wrap grid — chips never split lines. */}
                    <div className="[@media(pointer:coarse)]:hidden">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
                            <span className="whitespace-nowrap"><KeyDisplay>{[bindings.forward[0], bindings.left[0], bindings.backward[0], bindings.right[0]].map(displayKey).join(' ')}</KeyDisplay></span><span className="whitespace-nowrap">Drive <span className="text-gray-400">(or arrows)</span></span>
                            <span><KeyDisplay>{keysFor('rids')}</KeyDisplay></span><span className="whitespace-nowrap">RIDS Check</span>
                            <span><KeyDisplay>{keysFor('boost')}</KeyDisplay></span><span className="whitespace-nowrap">Boost</span>
                            <span><KeyDisplay>{keysFor('siren')}</KeyDisplay></span><span className="whitespace-nowrap">Siren</span>
                            <span><KeyDisplay>{keysFor('colleague')}</KeyDisplay></span><span className="whitespace-nowrap">Assist</span>
                            <span><KeyDisplay>{keysFor('minimap')}</KeyDisplay></span><span className="whitespace-nowrap">Minimap</span>
                        </div>
                        <p className="text-gray-400 mt-2 text-xs sm:text-sm">Boost + siren share one energy bar · gamepad works · rebind from the menu.</p>
                    </div>
                    {/* Touch: same grid, on-screen button names. */}
                    <div className="hidden [@media(pointer:coarse)]:block">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
                            <span className="font-bold text-white whitespace-nowrap">Joystick</span><span className="whitespace-nowrap">Drive — harder push = faster</span>
                            <span className="font-bold text-yellow-300">RIDS</span><span className="whitespace-nowrap">Check nearby offender</span>
                            <span className="font-bold text-cyan-400">BOOST</span><span className="whitespace-nowrap">Speed burst</span>
                            <span className="font-bold text-red-400">SIREN</span><span className="whitespace-nowrap">Clear traffic, deter</span>
                            <span className="font-bold text-yellow-400">ASSIST</span><span className="whitespace-nowrap">Send a colleague</span>
                        </div>
                        <p className="text-gray-400 mt-2 text-xs sm:text-sm">Boost + siren share one energy bar · top dots = district deterrence.</p>
                    </div>
                </TutorialInfoCard>
            </div>

            <div className="text-center mt-6 sm:mt-10">
                <button
                    ref={buttonRef}
                    onClick={() => {
                        // Unlock/resume audio on this guaranteed last gesture before gameplay (gd audit).
                        audio.unlockAudio();
                        // Best-effort fullscreen request on user gesture. iOS Safari support is
                        // variable; if unsupported, the .catch() swallows it and the game still
                        // launches normally inside the browser chrome.
                        const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
                        const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
                        if (req) { try { req()?.catch(() => { /* ignore */ }); } catch { /* ignore */ } }
                        // Best-effort lock to landscape (Android); iOS ignores it, harmless if unsupported.
                        try { (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape')?.catch?.(() => {}); } catch { /* ignore */ }
                        onComplete();
                    }}
                    className="bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 text-white font-bold py-4 px-12 rounded-lg text-2xl transition-transform transform hover:scale-110 font-display tracking-wider animate-button-pulse-glow focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
                >
                    Start Patrol
                </button>
                <p className="text-gray-400 text-sm mt-3">Press <KeyDisplay>Esc</KeyDisplay> to skip</p>
            </div>
        </div>
    </div>
  );
};

export default Tutorial;
