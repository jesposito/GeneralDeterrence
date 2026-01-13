
import React, { useState, useCallback, useEffect } from 'react';
import { GameState, LeaderboardEntry, FinalScoreBreakdown } from './types';
import MainMenu from './components/MainMenu';
import Game from './components/Game';
import GameOver from './components/GameOver';
import Tutorial from './components/Tutorial';

// API base URL - will be set via environment or default to relative path
const API_BASE = (window as any).LEADERBOARD_API || '/api';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MainMenu');
  const [finalScoreBreakdown, setFinalScoreBreakdown] = useState<FinalScoreBreakdown | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // Fetch leaderboard from API on mount
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${API_BASE}/leaderboard`);
        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data);
          setIsOnline(true);
        } else {
          throw new Error('API unavailable');
        }
      } catch (error) {
        console.log('Using local leaderboard (API unavailable)');
        setIsOnline(false);
        // Fallback to localStorage
        try {
          const saved = localStorage.getItem('leaderboard');
          setLeaderboard(saved ? JSON.parse(saved) : []);
        } catch (e) {
          setLeaderboard([]);
        }
      }
    };
    fetchLeaderboard();
  }, []);

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

  const handleAddToLeaderboard = useCallback(async (name: string, email?: string) => {
    if (!finalScoreBreakdown) return;
    
    const newEntry: LeaderboardEntry = { 
      name, 
      score: finalScoreBreakdown.finalScore,
      email,
      timestamp: Date.now()
    };

    if (isOnline) {
      try {
        const response = await fetch(`${API_BASE}/leaderboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEntry),
        });
        
        if (response.ok) {
          const updatedLeaderboard = await response.json();
          setLeaderboard(updatedLeaderboard);
          return;
        }
      } catch (error) {
        console.error('Failed to submit to API, saving locally:', error);
      }
    }
    
    // Fallback to local storage
    const newLeaderboard = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    setLeaderboard(newLeaderboard);
    try {
      localStorage.setItem('leaderboard', JSON.stringify(newLeaderboard));
    } catch (error) {
      console.error('Failed to save leaderboard:', error);
    }
  }, [finalScoreBreakdown, leaderboard, isOnline]);

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
