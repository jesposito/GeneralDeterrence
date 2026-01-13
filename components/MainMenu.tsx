
import React from 'react';
import { LeaderboardEntry } from '../types';
import Leaderboard from './Leaderboard';

interface MainMenuProps {
  onStartGame: () => void;
  leaderboard: LeaderboardEntry[];
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, leaderboard }) => {
  return (
    <div className="w-full h-full bg-[#0d0221] flex flex-col items-center justify-center p-4 md:p-8 text-center animate-fadeIn relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20 animate-slow-pan"></div>

      <div className="relative z-10">
        <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold text-cyan-400 mb-2 tracking-widest text-glow-cyan uppercase">
          General Deterrence
        </h1>
        <p className="text-lg sm:text-xl lg:text-2xl text-pink-400 font-display mb-8">A Road Policing Tool</p>
        
        <div className="w-full max-w-lg grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start">
          <div className="bg-black/50 p-4 md:p-6 rounded-lg border-2 border-pink-500/50">
            <h2 className="text-xl md:text-2xl font-display font-semibold text-yellow-400 mb-4 text-glow-yellow">Your Mission</h2>
            <p className="text-gray-300 text-left text-sm md:text-base">
              Begin your 90-second patrol shift. Maximize your <span className="text-white font-bold">Deterrence</span> by staying visible and unpredictable. Identify high-risk driving behaviors (RIDS) and intervene to earn <span className="text-white font-bold">Lives Saved</span> points.
            </p>
            <button
              onClick={onStartGame}
              className="mt-6 w-full bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 text-white font-bold py-3 px-4 rounded-lg text-lg md:text-xl transition-transform transform hover:scale-110 font-display tracking-wider animate-button-pulse-glow"
            >
              Start Shift
            </button>
          </div>
          <div className="bg-black/50 p-4 md:p-6 rounded-lg border-2 border-cyan-500/50">
            <Leaderboard scores={leaderboard} />
          </div>
        </div>
      </div>

       <footer className="absolute bottom-4 text-gray-500 text-sm z-10">
         A New Zealand Police Road Policing Training Tool
       </footer>
    </div>
  );
};

export default MainMenu;
