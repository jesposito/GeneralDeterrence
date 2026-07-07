import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LeaderboardEntry, FinalScoreBreakdown } from './types';
import MainMenu from './components/MainMenu';
import Game from './components/Game';
import GameOver from './components/GameOver';
import Tutorial from './components/Tutorial';
import MuteToggle from './components/MuteToggle';
import { regenerateMap } from './utils/mapGen';
import { seedFromToday, randomSeed } from './utils/rng';

declare global {
  interface Window { LEADERBOARD_API?: string }
}
const API_BASE = window.LEADERBOARD_API || '/api';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MainMenu');
  const [finalScoreBreakdown, setFinalScoreBreakdown] = useState<FinalScoreBreakdown | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isOnline, setIsOnline] = useState(true);

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

  // Route-change a11y: per-screen document title + move focus to the new screen's heading on
  // transition (Tutorial + GameOver manage their own focus). Skip the initial paint.
  const isFirstScreen = useRef(true);
  useEffect(() => {
    const titles: Record<string, string> = {
      MainMenu: 'General Deterrence',
      Tutorial: 'Pre-Shift Briefing · General Deterrence',
      Playing: 'On Patrol · General Deterrence',
      GameOver: 'Shift Over · General Deterrence',
    };
    document.title = titles[gameState] || 'General Deterrence';
    if (isFirstScreen.current) { isFirstScreen.current = false; return; }
    if (gameState !== 'Tutorial' && gameState !== 'GameOver') {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#root h1')?.focus?.());
    }
  }, [gameState]);

  // Daily = date-seeded map (same for everyone → fair leaderboard); Free = fresh random map.
  const [mapLabel, setMapLabel] = useState<string>('');
  const handleStartGame = useCallback((mode: 'daily' | 'free') => {
    const seed = mode === 'daily' ? seedFromToday() : randomSeed();
    const meta = regenerateMap(seed);
    setMapLabel(`${mode === 'daily' ? 'Daily Shift' : 'Free Patrol'} · ${meta.layoutName} · ${meta.themeName}`);
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
            mapLabel={mapLabel}
          />
        );
      case 'MainMenu':
      default:
        return <MainMenu onStartGame={handleStartGame} leaderboard={leaderboard} />;
    }
  };

  return (
    <div className="flex items-center justify-center app-min-vh bg-[#0d0221] overflow-hidden">
      <div className="w-full app-vh bg-black relative overflow-hidden">
        {renderContent()}
        <div className="crt-overlay"></div>
        <MuteToggle />
      </div>
    </div>
  );
};

export default App;
