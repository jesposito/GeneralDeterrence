import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LeaderboardEntry, FinalScoreBreakdown } from './types';
import MainMenu from './components/MainMenu';
import Game from './components/Game';
import GameOver, { SubmissionResult } from './components/GameOver';
import Tutorial from './components/Tutorial';
import MuteToggle from './components/MuteToggle';
import { regenerateMap } from './utils/mapGen';
import { seedFromToday, randomSeed, dateFromDayKey } from './utils/rng';
import { isRetryableStatus, submissionBody } from './utils/submission';
import { createEditTokenProvider } from './utils/identity';

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
const EDIT_TOKEN_KEY = 'gd-leaderboard-edit-token';
const PENDING_KEY = 'gd-pending-submissions';

interface RunGrant {
  token: string;
  mode: 'daily' | 'free';
  day: string;
  seed: number;
  attempt: number;
  startedAt: number;
}

interface PendingSubmission {
  token: string;
  name: string;
  station?: string;
  startedAt: number;
  elapsedMs: number;
  breakdown: Pick<FinalScoreBreakdown,
    'enforcementScore' | 'deterrenceScore' | 'finalDeterrenceBonus' | 'livesSavedBonus' |
    'livesLostPenalty' | 'finalScore' | 'livesSaved' | 'livesLost' | 'offencesPrevented' |
    'overtime' | 'coverageRatio' | 'presenceGrade' | 'challengeAssist'>;
}

const fetchWithTimeout = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { window.clearTimeout(timeout); }
};

const getEditToken = createEditTokenProvider(
  () => localStorage.getItem(EDIT_TOKEN_KEY),
  token => localStorage.setItem(EDIT_TOKEN_KEY, token),
  () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  },
);

const loadPending = (): PendingSubmission[] => {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    return Array.isArray(value) ? value.slice(0, 5) : [];
  } catch { return []; }
};

const savePending = (items: PendingSubmission[]): boolean => {
  try {
    if (items.length) localStorage.setItem(PENDING_KEY, JSON.stringify(items));
    else localStorage.removeItem(PENDING_KEY);
    return true;
  } catch { return false; }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MainMenu');
  const [finalScoreBreakdown, setFinalScoreBreakdown] = useState<FinalScoreBreakdown | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  const [runInstance, setRunInstance] = useState(0);
  const runRef = useRef<RunGrant | null>(null);
  const beginShiftInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const refreshLeaderboard = async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE}/leaderboard`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data)) setLeaderboard(data);
      } catch { /* the board renders its own retryable unavailable state */ }
    };
    const flushPending = async () => {
      if (flushing) return;
      flushing = true;
      const pending = loadPending();
      try {
        if (!pending.length) return;
        const remaining: PendingSubmission[] = [];
        let uploaded = false;
        for (const submission of pending) {
          try {
            const response = await fetchWithTimeout(`${API_BASE}/leaderboard`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submissionBody(submission)),
            });
            if (response.ok) uploaded = true;
            else if (isRetryableStatus(response.status)) remaining.push(submission);
          } catch { remaining.push(submission); }
        }
        savePending(remaining);
        if (uploaded && !cancelled) {
          setLeaderboardRefreshKey(key => key + 1);
          await refreshLeaderboard();
        }
      } finally {
        flushing = false;
      }
    };
    let flushing = false;
    const sync = () => { void refreshLeaderboard(); void flushPending(); };
    sync();
    const retryTimer = window.setInterval(() => { void flushPending(); }, 30_000);
    window.addEventListener('online', sync);
    return () => {
      cancelled = true;
      window.clearInterval(retryTimer);
      window.removeEventListener('online', sync);
    };
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

  const beginShift = useCallback(async (mode: 'daily' | 'free', to: GameState) => {
    if (beginShiftInFlightRef.current) return;
    beginShiftInFlightRef.current = true;
    try {
      let grant: RunGrant | null = null;
      if (mode === 'daily' && navigator.onLine) {
        try {
          const response = await fetchWithTimeout(`${API_BASE}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, editToken: getEditToken() }),
          });
          if (response.ok) {
            const value = await response.json();
            if (value.mode === mode && typeof value.token === 'string' && typeof value.day === 'string'
                && Number.isInteger(value.seed) && Number.isInteger(value.attempt)) {
              grant = { ...value, startedAt: Date.now() };
            }
          }
        } catch { /* offline patrol remains playable but is not published */ }
      }

      runRef.current = grant;
      const seed = grant?.seed ?? (mode === 'daily' ? seedFromToday() : randomSeed());
      const date = mode === 'daily' && grant ? dateFromDayKey(grant.day) : new Date();
      const meta = regenerateMap(seed, date);
      setShiftMode(mode);
      setMapSeed(seed);
      setRunInstance(instance => instance + 1);
      // Ghost only makes sense on a map you have played before: daily reruns.
      setGhostPath(mode === 'daily' ? loadGhost(seed)?.path ?? null : null);
      setMapLabel(`${mode === 'daily' ? 'Daily Shift' : 'Free Patrol'} · ${meta.layoutName} · ${meta.themeName}${mode === 'daily' && !grant ? ' · Offline' : ''}`);
      setGameState(to);
    } finally {
      beginShiftInFlightRef.current = false;
    }
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

  const handleDeleteMyScores = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/leaderboard/me`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editToken: getEditToken() }),
      });
      if (!response.ok) return false;
      savePending([]);
      runRef.current = null;
      setLeaderboardRefreshKey(key => key + 1);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleAddToLeaderboard = useCallback(async (name: string, station?: string): Promise<SubmissionResult> => {
    const run = runRef.current;
    if (!finalScoreBreakdown || !run || run.mode !== 'daily') {
      return { status: 'rejected', message: 'This shift was not issued by the Daily server.' };
    }
    const { enforcementScore, deterrenceScore, finalDeterrenceBonus, livesSavedBonus,
      livesLostPenalty, finalScore, livesSaved, livesLost, offencesPrevented, overtime,
      coverageRatio, presenceGrade, challengeAssist } = finalScoreBreakdown;
    const submission: PendingSubmission = {
      token: run.token,
      name,
      station,
      startedAt: run.startedAt,
      elapsedMs: Date.now() - run.startedAt,
      breakdown: { enforcementScore, deterrenceScore, finalDeterrenceBonus, livesSavedBonus,
        livesLostPenalty, finalScore, livesSaved, livesLost, offencesPrevented, overtime,
        coverageRatio, presenceGrade, challengeAssist },
    };
    try {
      const response = await fetchWithTimeout(`${API_BASE}/leaderboard`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submissionBody(submission)),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        if (Array.isArray(data.all)) setLeaderboard(data.all);
        setLeaderboardRefreshKey(key => key + 1);
        return { status: 'uploaded', message: 'Score uploaded to the community board.', percentile: data.percentile ?? null };
      }
      if (!isRetryableStatus(response.status)) {
        return { status: 'rejected', message: typeof data.error === 'string' ? data.error : 'The server rejected this score.' };
      }
      throw new Error('Leaderboard unavailable');
    } catch {
      const pending = loadPending();
      if (!pending.some(item => item.token === submission.token)) {
        if (pending.length >= 5 || !savePending([...pending, submission])) {
          return { status: 'rejected', message: 'Server unavailable and this device could not queue the score.' };
        }
      }
      return { status: 'queued-offline', message: 'Server unavailable. This score is queued on this device.' };
    }
  }, [finalScoreBreakdown]);

  const renderContent = () => {
    switch (gameState) {
      case 'Tutorial':
        return <Tutorial onComplete={handleTutorialComplete} mapLabel={mapLabel} />;
      case 'Playing':
        return <Game key={runInstance} onGameOver={handleGameOver} ghostPath={ghostPath} championName={championName} mapSeed={mapSeed} onRestart={handleQuickRestart} onMainMenu={handlePlayAgain} />;
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
            competitionDay={runRef.current?.day}
            submissionEligible={shiftMode === 'daily' && runRef.current?.mode === 'daily'}
            leaderboardRefreshKey={leaderboardRefreshKey}
            onDeleteMyScores={handleDeleteMyScores}
          />
        );
      case 'MainMenu':
      default:
        return <MainMenu onStartGame={handleStartGame} leaderboard={leaderboard} onDeleteMyScores={handleDeleteMyScores} />;
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
