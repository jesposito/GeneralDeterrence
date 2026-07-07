import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LeaderboardEntry, FinalScoreBreakdown } from './types';
import MainMenu from './components/MainMenu';
import Game from './components/Game';
import GameOver from './components/GameOver';
import Tutorial from './components/Tutorial';
import MuteToggle from './components/MuteToggle';
import { regenerateMap } from './utils/mapGen';
import { seedFromToday, randomSeed, dateFromDayKey } from './utils/rng';

// PB ghost storage: the patrol path of your best run on a specific daily seed.
const GHOST_KEY = 'gd-ghost';
interface StoredGhost { seed: number; score: number; path: { x: number; y: number }[] }
const loadGhost = (seed: number): StoredGhost | null => {
  try {
    const g = JSON.parse(localStorage.getItem(GHOST_KEY) || 'null') as StoredGhost | null;
    return g && g.seed === seed && Array.isArray(g.path) ? g : null;
  } catch { return null; }
};
const saveGhost = (g: StoredGhost) => {
  try { localStorage.setItem(GHOST_KEY, JSON.stringify(g)); } catch { /* ignore */ }
};

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
  const [shiftMode, setShiftMode] = useState<'daily' | 'free'>('daily');
  const [mapSeed, setMapSeed] = useState<number>(0);
  const [ghostPath, setGhostPath] = useState<{ x: number; y: number }[] | null>(null);
  const [championName, setChampionName] = useState<string | null>(null);

  // Yesterday's daily #1 patrols tonight's map as a named unit.
  useEffect(() => {
    fetch(`${API_BASE}/leaderboard/champion`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.name === 'string') setChampionName(d.name); })
      .catch(() => { /* offline: no champion tonight */ });
  }, []);

  // Fairness: the SERVER owns the competition day + seed (client-local dates put
  // different timezones on different maps under one daily board). Offline: local fallback.
  const serverDayRef = useRef<{ day: string; seed: number } | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/day`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && d.seed) serverDayRef.current = d; })
      .catch(() => { /* offline: seedFromToday fallback */ });
  }, []);

  const bumpAttempts = (day: string): number => {
    try {
      const raw = JSON.parse(localStorage.getItem('gd-attempts') || '{}');
      const n = raw.day === day ? (raw.n || 0) + 1 : 1;
      localStorage.setItem('gd-attempts', JSON.stringify({ day, n }));
      return n;
    } catch { return 1; }
  };
  const attemptsRef = useRef(1);

  const beginShift = useCallback((mode: 'daily' | 'free', to: GameState) => {
    const server = serverDayRef.current;
    const seed = mode === 'daily' ? (server?.seed ?? seedFromToday()) : randomSeed();
    const date = mode === 'daily' && server ? dateFromDayKey(server.day) : new Date();
    const meta = regenerateMap(seed, date);
    setShiftMode(mode);
    setMapSeed(seed);
    if (mode === 'daily') attemptsRef.current = bumpAttempts(server?.day ?? new Date().toDateString());
    // Ghost only makes sense on a map you have played before: daily reruns.
    setGhostPath(mode === 'daily' ? loadGhost(seed)?.path ?? null : null);
    setMapLabel(`${mode === 'daily' ? 'Daily Shift' : 'Free Patrol'} · ${meta.layoutName} · ${meta.themeName}`);
    setGameState(to);
  }, []);

  const handleStartGame = useCallback((mode: 'daily' | 'free') => beginShift(mode, 'Tutorial'), [beginShift]);
  // "Run It Back": straight into another shift, no menu, no tutorial. Daily reuses
  // today's map (retry the same shift); Free rolls a fresh one.
  const handleQuickRestart = useCallback(() => beginShift(shiftMode, 'Playing'), [beginShift, shiftMode]);
  
  const handleTutorialComplete = useCallback(() => {
    setGameState('Playing');
  }, []);

  const handleGameOver = useCallback((breakdown: FinalScoreBreakdown) => {
    // Record the PB ghost for this daily map (best score on this seed wins the slot).
    if (shiftMode === 'daily' && breakdown.patrolPath.length > 1) {
      const existing = loadGhost(mapSeed);
      if (!existing || breakdown.finalScore > existing.score) {
        saveGhost({ seed: mapSeed, score: breakdown.finalScore, path: breakdown.patrolPath });
      }
    }
    setFinalScoreBreakdown(breakdown);
    setGameState('GameOver');
  }, [shiftMode, mapSeed]);

  const handlePlayAgain = useCallback(() => {
    setGameState('MainMenu');
  }, []);

  const handleAddToLeaderboard = useCallback(async (name: string, email?: string, station?: string) => {
    if (!finalScoreBreakdown) return;
    const newEntry: LeaderboardEntry = {
      name,
      score: finalScoreBreakdown.finalScore,
      email,
      station,
      attempts: shiftMode === 'daily' ? attemptsRef.current : undefined, // best-of-N transparency
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
        return <Tutorial onComplete={handleTutorialComplete} mapLabel={mapLabel} />;
      case 'Playing':
        return <Game onGameOver={handleGameOver} ghostPath={ghostPath} championName={championName} mapSeed={mapSeed} />;
      case 'GameOver':
        return finalScoreBreakdown && (
          <GameOver
            scoreBreakdown={finalScoreBreakdown}
            leaderboard={leaderboard}
            onPlayAgain={handlePlayAgain}
            onQuickRestart={handleQuickRestart}
            onAddToLeaderboard={handleAddToLeaderboard}
            mapLabel={mapLabel}
            shiftMode={shiftMode}
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
