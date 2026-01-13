import React from 'react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
  scores: LeaderboardEntry[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ scores }) => {
  return (
    <div className="w-full flex flex-col">
      <h2 className="text-2xl font-semibold text-yellow-400 mb-4 text-center font-display text-glow-yellow">Top Patrols</h2>
      <ol className="text-left space-y-2 max-h-64 overflow-y-auto pr-1">
        {scores.map((entry, index) => (
          <li key={index} className="flex justify-between items-center text-base bg-black/30 p-2 rounded gap-2">
            <span className="text-gray-400 w-6 flex-shrink-0">{index + 1}.</span>
            <span className="font-semibold text-cyan-400 flex-grow truncate min-w-0" title={entry.name}>{entry.name}</span>
            <span className="font-bold text-white flex-shrink-0 tabular-nums">{entry.score.toLocaleString()}</span>
          </li>
        ))}
        {scores.length === 0 && <p className="text-gray-500 text-center">No scores yet. Be the first!</p>}
      </ol>
    </div>
  );
};

export default Leaderboard;
