import React, { useEffect, useRef, useState } from 'react';
import { LeaderboardEntry } from '../types';
import Leaderboard from './Leaderboard';
import ControlsSettings from './ControlsSettings';
import StoryCodex from './StoryCodex';
import { getCodex } from '../utils/codex';
import * as audio from '../utils/audio';
import { useGamepadNavigation } from './useGamepadNavigation';

interface MainMenuProps {
  onStartGame: (mode: 'daily' | 'free') => void;
  leaderboard: LeaderboardEntry[];
  onDeleteMyScores: () => Promise<boolean>;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, leaderboard, onDeleteMyScores }) => {
  const [showControls, setShowControls] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const codexCount = getCodex().length;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useGamepadNavigation(menuRef, { active: !showControls && !showCodex });
  // Route-change focus: the h1 had tabIndex={-1} but nothing ever moved focus to it,
  // so AT never announced the screen.
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    // overflow-y-auto + m-auto child (not justify-center): flex-centering an overflowing
    // column makes the top unreachable; margin-auto centres when short, scrolls when tall.
    <div ref={menuRef} className="w-full h-full bg-[#0d0221] flex flex-col items-center overflow-y-auto p-4 md:p-8 text-center animate-fadeIn relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20 animate-slow-pan pointer-events-none"></div>

      <main className="relative z-10 m-auto">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold text-cyan-400 mb-2 tracking-widest text-glow-cyan uppercase focus:outline-none">
          General Deterrence
        </h1>
        <p className="text-lg sm:text-xl lg:text-2xl text-pink-400 font-display mb-8">The Road Policing Arcade Game</p>
        
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start">
          <div className="bg-black/50 p-4 md:p-6 rounded-lg border-2 border-pink-500/50">
            <h2 className="text-xl md:text-2xl font-display font-semibold text-yellow-400 mb-4 text-glow-yellow">Your Mission</h2>
            <p className="text-gray-300 text-left text-sm md:text-base">
              Begin your 90-second patrol shift. Maximize your <span className="text-white font-bold">Deterrence</span> by staying visible and unpredictable. Identify high-risk driving behaviors (RIDS) and intervene to earn <span className="text-white font-bold">Lives Saved</span> points.
            </p>
            <button
              onClick={() => { audio.unlockAudio(); onStartGame('daily'); }}
              className="mt-6 w-full bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 text-white font-bold py-3 px-4 rounded-lg text-lg md:text-xl transition-transform transform hover:scale-110 font-display tracking-wider animate-button-pulse-glow"
            >
              Daily Shift
            </button>
            <p className="text-xs text-gray-400 mt-1 font-sans">Today's map, same for everyone. New one at midnight.</p>
            <button
              onClick={() => { audio.unlockAudio(); onStartGame('free'); }}
              className="mt-3 w-full bg-transparent hover:bg-pink-900/40 border-2 border-pink-500/50 text-pink-300 font-bold py-2 px-4 rounded-lg text-sm md:text-base transition font-display tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Free Patrol <span className="font-sans font-normal">(random map)</span>
            </button>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setShowControls(true)}
                className="flex-1 bg-transparent hover:bg-cyan-900/50 border-2 border-cyan-500/50 text-cyan-300 font-bold py-2 px-3 rounded-lg text-sm md:text-base transition font-display tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Controls
              </button>
              <button
                onClick={() => setShowCodex(true)}
                className="flex-1 bg-transparent hover:bg-green-900/50 border-2 border-green-500/50 text-green-300 font-bold py-2 px-3 rounded-lg text-sm md:text-base transition font-display tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Stories{codexCount > 0 ? ` (${codexCount})` : ''}
              </button>
            </div>
          </div>
          <div className="bg-black/50 p-4 md:p-6 rounded-lg border-2 border-cyan-500/50 min-w-[280px]">
            <Leaderboard scores={leaderboard} onDeleteMine={onDeleteMyScores} />
          </div>
        </div>
      </main>

       <footer className="relative z-10 mt-4 pb-2 text-gray-400 text-sm">
         An arcade game about road policing. Educational, but a game. Not affiliated with NZ Police.
       </footer>
      {showControls && <ControlsSettings onClose={() => setShowControls(false)} />}
      {showCodex && <StoryCodex onClose={() => setShowCodex(false)} />}
    </div>
  );
};

export default MainMenu;
