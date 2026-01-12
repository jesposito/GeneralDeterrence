
import React from 'react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
  scores: LeaderboardEntry[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ scores }) => {
  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold text-yellow-400 mb-4 text-center font-display text-glow-yellow">Top Patrols</h2>
      <ol className="list-decimal list-inside text-left space-y-2">
        {scores.map((entry, index) => (
          <li key={index} className="flex justify-between items-center text-lg bg-black/30 p-2 rounded">
            <span className="font-semibold text-cyan-400 w-2/3 truncate">{index + 1}. {entry.name}</span>
            <span className="font-bold text-white">{entry.score.toLocaleString()}</span>
          </li>
        ))}
        {scores.length === 0 && <p className="text-gray-500 text-center">No scores yet. Be the first!</p>}
      </ol>
    </div>
  );
};

export default Leaderboard;