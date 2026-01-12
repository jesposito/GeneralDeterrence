
import React, { useState, useCallback } from 'react';
import { GameState, LeaderboardEntry, FinalScoreBreakdown } from './types';
import MainMenu from './components/MainMenu';
import Game from './components/Game';
import GameOver from './components/GameOver';
import Tutorial from './components/Tutorial';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MainMenu');
  const [finalScoreBreakdown, setFinalScoreBreakdown] = useState<FinalScoreBreakdown | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try {
      const saved = localStorage.getItem('leaderboard');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      return [];
    }
  });

  const handleStartGame = useCallback(() => {
    setGameState('Tutorial');
  }, []);
  
  const handleTutorialComplete = useCallback(() => {
    setGameState('Playing');
  }, []);

  const handleGameOver = useCallback((breakdown: FinalScoreBreakdown) => {
    setFinalScoreBreakdown(breakdown);
    setGameState('GameOver');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameState('MainMenu');
  }, []);

  const handleAddToLeaderboard = useCallback((name: string) => {
    if (!finalScoreBreakdown) return;
    const newEntry = { name, score: finalScoreBreakdown.finalScore };
    const newLeaderboard = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    setLeaderboard(newLeaderboard);
    try {
      localStorage.setItem('leaderboard', JSON.stringify(newLeaderboard));
    } catch (error) {
      console.error('Failed to save leaderboard:', error);
    }
  }, [finalScoreBreakdown, leaderboard]);

  const renderContent = () => {
    switch (gameState) {
      case 'Tutorial':
        return <Tutorial onComplete={handleTutorialComplete} />;
      case 'Playing':
        return <Game onGameOver={handleGameOver} />;
      case 'GameOver':
        return finalScoreBreakdown && (
          <GameOver
            scoreBreakdown={finalScoreBreakdown}
            leaderboard={leaderboard}
            onPlayAgain={handlePlayAgain}
            onAddToLeaderboard={handleAddToLeaderboard}
          />
        );
      case 'MainMenu':
      default:
        return <MainMenu onStartGame={handleStartGame} leaderboard={leaderboard} />;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-2 sm:p-4 bg-[#0d0221]">
      <div className="w-full max-w-[1280px] aspect-[16/9] bg-black relative shadow-2xl shadow-cyan-500/20 border-4 border-purple-800/50 overflow-hidden">
        {renderContent()}
        <div className="crt-overlay"></div>
      </div>
    </div>
  );
};

export default App;