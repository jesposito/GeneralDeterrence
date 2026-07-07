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
                    <p>Each district has a <span className="text-white font-bold">DETERRENCE</span> meter. Your presence raises it; your absence lets it decay. Watch for <span className="text-green-400 font-bold">SECURED</span> and <span className="text-red-400 font-bold">HOTSPOT</span> calls.</p>
                    <p>Hold all districts above 85% for <span className="text-yellow-300 font-bold">FULL COVERAGE ×2</span> points. Your <span className="text-purple-400 font-bold">VIGILANCE</span> grows as you patrol — a bigger aura spots offenders further away.</p>
                    <p>Park still for a few seconds to drop a <span className="text-cyan-300 font-bold">PATROL POST</span> that keeps deterring after you leave. But don't idle where it's already safe — that's <span className="text-red-400 font-bold">NEGLECT OF DUTY</span>.</p>
                    <p className="text-cyan-200">Your <span className="font-bold">PREVENTED</span> counter ticks up for every offence that never happened because you were visible. That's the real score.</p>
                </TutorialInfoCard>

                <TutorialInfoCard title="2 · SPOT & STOP">
                    <p>Offenders show a <span className="text-white font-bold">RIDS</span> icon:</p>
                    <p className="text-base sm:text-lg leading-relaxed">
                        <span aria-hidden="true">⚠️</span> Restraints · <span aria-hidden="true">🥴</span> Impairment<br/>
                        <span aria-hidden="true">📱</span> Distractions · <span aria-hidden="true">🔥</span> Speed
                    </p>
                    <p>Get close and use <span className="text-yellow-300 font-bold">RIDS CHECK</span>, then choose: <span className="text-cyan-300 font-bold">Warn</span> (fast, small reward) or <span className="text-pink-400 font-bold">Enforce</span> (mini-game, big reward, costs shift time).</p>
                    <p className="text-red-400 font-bold">Pulsing red = LIFE AT RISK. Get there before the timer — or send a colleague.</p>
                    <p>You never know what a stop will find. Once a shift, one of them is carrying something <em>much</em> bigger…</p>
                </TutorialInfoCard>

                <TutorialInfoCard title="3 · CONTROLS">
                    {/* Keyboard (desktop) — shows the player's live bindings; rebind from the menu. */}
                    <ul className="list-inside space-y-1 [@media(pointer:coarse)]:hidden">
                        <li><KeyDisplay>{keysFor('forward')}</KeyDisplay> + <KeyDisplay>{keysFor('left')}</KeyDisplay><KeyDisplay>{keysFor('backward')}</KeyDisplay><KeyDisplay>{keysFor('right')}</KeyDisplay> - Drive</li>
                        <li><KeyDisplay>{keysFor('rids')}</KeyDisplay> - RIDS Check</li>
                        <li><KeyDisplay>{keysFor('boost')}</KeyDisplay> - Boost <span className="text-cyan-400">(uses energy)</span></li>
                        <li><KeyDisplay>{keysFor('siren')}</KeyDisplay> - Siren <span className="text-pink-400">(drains energy, boosts deterrence)</span></li>
                        <li><KeyDisplay>{keysFor('colleague')}</KeyDisplay> - Colleague Assist <span className="text-yellow-400">(high-priority events)</span></li>
                        <li><KeyDisplay>{keysFor('minimap')}</KeyDisplay> - Toggle Minimap</li>
                        <li className="text-gray-400">Gamepad works too: left stick drives, <KeyDisplay>A</KeyDisplay> checks, <KeyDisplay>B</KeyDisplay> siren, <KeyDisplay>X</KeyDisplay> assist. Rebind keys from the menu.</li>
                    </ul>
                    {/* Touch controls (coarse pointer) — names match the on-screen buttons. */}
                    <ul className="list-inside space-y-1 hidden [@media(pointer:coarse)]:block">
                        <li><span className="font-bold text-white">Joystick</span> (bottom-left) - Drive: push where you want to go, harder = faster</li>
                        <li>Tap <span className="font-bold text-yellow-300">RIDS</span> - Intervene with a nearby offender</li>
                        <li>Tap <span className="font-bold text-cyan-400">BOOST</span> - Boost <span className="text-cyan-400">(uses energy)</span></li>
                        <li>Tap <span className="font-bold text-red-400">SIREN</span> - Siren <span className="text-pink-400">(drains energy, boosts deterrence)</span></li>
                        <li>Tap <span className="font-bold text-yellow-400">ASSIST</span> - Colleague Assist <span className="text-yellow-400">(high-priority event)</span></li>
                        <li className="text-gray-400">Watch the dots up top — that's each district's deterrence at a glance.</li>
                    </ul>
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
