import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { getDailyOperation, type OperationDefinition } from './utils/operations';
import { getCareerProgress, loadCareerState, recordPresenceGrade, saveCareerState, type CareerState } from './utils/progression';
import {
  createOperationsCampaign,
  getCampaignProgress,
  getNextCampaignShift,
  loadOperationsCampaign,
  recordCampaignShift,
  saveOperationsCampaign,
  type OperationsCampaign,
} from './utils/campaign';
import {
  getPersonalBestReplay,
  loadPersonalBestReplays,
  migrateLegacyPersonalBestReplay,
  storePersonalBestReplay,
  type PersonalBestReplay,
  type TimedReplayAction,
} from './utils/replay';
import {
  getAvailableLoadouts,
  getPatrolLoadout,
  loadPatrolLoadout,
  savePatrolLoadout,
  type PatrolLoadoutId,
} from './utils/loadouts';
import { PRESENCE_GRADE_CONTRACT_VERSION } from './shared/presenceGrade.js';

export type ShiftMode = 'daily' | 'free' | 'operations';

const localDayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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
  scoreVersion: number;
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
  // Keep retry, submit, and delete operations ordered around their shared pending-score storage.
  const leaderboardMutationRef = useRef<Promise<void>>(Promise.resolve());
  const serializeLeaderboardMutation = useCallback(
    function serializeLeaderboardMutation<T>(mutation: () => Promise<T>): Promise<T> {
      const result = leaderboardMutationRef.current.then(mutation, mutation);
      leaderboardMutationRef.current = result.then(() => undefined, () => undefined);
      return result;
    },
    [],
  );

  useEffect(() => {
    migrateLegacyPersonalBestReplay(localStorage);
  }, []);

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
      try {
        const uploaded = await serializeLeaderboardMutation(async () => {
          const pending = loadPending();
          if (!pending.length) return false;
          const remaining: PendingSubmission[] = [];
          let didUpload = false;
          for (const submission of pending) {
            try {
              const response = await fetchWithTimeout(`${API_BASE}/leaderboard`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submissionBody(submission)),
              });
              if (response.ok) didUpload = true;
              else if (isRetryableStatus(response.status)) remaining.push(submission);
            } catch { remaining.push(submission); }
          }
          savePending(remaining);
          return didUpload;
        });
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
  }, [serializeLeaderboardMutation]);

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
  const [shiftMode, setShiftMode] = useState<ShiftMode>('daily');
  const [mapSeed, setMapSeed] = useState<number>(0);
  const [ghostReplay, setGhostReplay] = useState<PersonalBestReplay | null>(null);
  const [championName, setChampionName] = useState<string | null>(null);
  const [operation, setOperation] = useState<OperationDefinition | null>(null);
  const [careerState, setCareerState] = useState<CareerState>(() => loadCareerState(localStorage));
  const [campaign, setCampaign] = useState<OperationsCampaign | null>(() => loadOperationsCampaign(localStorage));
  const [loadoutId, setLoadoutId] = useState<PatrolLoadoutId>(() => loadPatrolLoadout(localStorage, getCareerProgress(careerState).totalPresenceGrades));
  const careerProgress = useMemo(() => getCareerProgress(careerState), [careerState]);
  const availableLoadouts = useMemo(() => getAvailableLoadouts(careerProgress.totalPresenceGrades), [careerProgress.totalPresenceGrades]);
  const selectedLoadout = useMemo(() => getPatrolLoadout(loadoutId), [loadoutId]);
  const campaignProgress = useMemo(() => campaign ? getCampaignProgress(campaign) : null, [campaign]);
  const [todayOperation, setTodayOperation] = useState(() => getDailyOperation(seedFromToday(), localDayKey()));

  useEffect(() => {
    const refreshDaily = () => setTodayOperation(getDailyOperation(seedFromToday(), localDayKey()));
    const timer = window.setInterval(refreshDaily, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLoadoutChange = useCallback((id: PatrolLoadoutId) => {
    if (!availableLoadouts.some(loadout => loadout.id === id)) return;
    savePatrolLoadout(localStorage, id);
    setLoadoutId(id);
  }, [availableLoadouts]);

  // Yesterday's daily #1 patrols tonight's map as a named unit.
  useEffect(() => {
    fetch(`${API_BASE}/leaderboard/champion`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.name === 'string') setChampionName(d.name); })
      .catch(() => { /* offline: no champion tonight */ });
  }, []);

  const beginShift = useCallback(async (mode: ShiftMode, to: GameState) => {
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
      let seed: number;
      let date: Date;
      let selectedOperation: OperationDefinition | null = null;
      if (mode === 'operations') {
        let activeCampaign = campaign && !getCampaignProgress(campaign).complete
          ? campaign
          : loadOperationsCampaign(localStorage);
        if (!activeCampaign || getCampaignProgress(activeCampaign).complete) {
          activeCampaign = createOperationsCampaign(randomSeed(), localDayKey());
          saveOperationsCampaign(localStorage, activeCampaign);
        }
        const next = getNextCampaignShift(activeCampaign);
        if (!next) throw new Error('Unable to create the next Operation shift');
        seed = next.seed;
        date = dateFromDayKey(next.day);
        selectedOperation = next.operation;
        setCampaign(activeCampaign);
      } else {
        seed = grant?.seed ?? (mode === 'daily' ? seedFromToday() : randomSeed());
        const day = grant?.day ?? localDayKey();
        date = mode === 'daily' ? dateFromDayKey(day) : new Date();
        if (mode === 'daily') selectedOperation = getDailyOperation(seed, day);
      }
      const meta = regenerateMap(seed, date);
      setShiftMode(mode);
      setMapSeed(seed);
      setOperation(selectedOperation);
      setRunInstance(instance => instance + 1);
      setGhostReplay(mode === 'daily' ? getPersonalBestReplay(loadPersonalBestReplays(localStorage), seed) : null);
      const modeLabel = mode === 'daily' ? 'Daily Shift' : mode === 'operations' ? 'Operations Campaign' : 'Free Patrol';
      setMapLabel(`${modeLabel} · ${selectedOperation?.name ?? meta.topologyName} · ${meta.layoutName} · ${meta.themeName}${mode === 'daily' && !grant ? ' · Offline' : ''}`);
      setGameState(to);
    } finally {
      beginShiftInFlightRef.current = false;
    }
  }, [campaign]);

  const handleStartGame = useCallback((mode: ShiftMode) => beginShift(mode, 'Tutorial'), [beginShift]);
  // "Run It Back": straight into another shift, no menu, no tutorial. Daily reuses
  // today's map (retry the same shift); Free rolls a fresh one.
  const handleQuickRestart = useCallback(() => beginShift(shiftMode, 'Playing'), [beginShift, shiftMode]);
  
  const handleTutorialComplete = useCallback(() => {
    setGameState('Playing');
  }, []);

  const handleGameOver = useCallback((breakdown: FinalScoreBreakdown) => {
    if (shiftMode === 'daily' && breakdown.patrolTimeline.length > 0) {
      const actions: TimedReplayAction[] = [
        ...breakdown.enforcementActions.map(action => ({
          timeMs: Math.round(action.atSeconds * 1000), x: action.pos.x, y: action.pos.y,
          kind: action.actionType === 'Standard' ? 'standard' as const : 'investigate' as const,
          result: 'success' as const,
        })),
        ...breakdown.colleagueCallActions.map(action => ({
          timeMs: Math.round(action.atSeconds * 1000), x: action.pos.x, y: action.pos.y,
          kind: 'colleague' as const, result: action.result,
        })),
      ].sort((a, b) => a.timeMs - b.timeMs);
      const durationSeconds = Math.max(
        breakdown.patrolTimeline.at(-1)?.atSeconds ?? 0,
        breakdown.scoreSplits.at(-1)?.atSeconds ?? 0,
        ...breakdown.enforcementActions.map(action => action.atSeconds),
        ...breakdown.colleagueCallActions.map(action => action.atSeconds),
      );
      const durationMs = Math.round(durationSeconds * 1000);
      storePersonalBestReplay(localStorage, {
        seed: mapSeed,
        score: breakdown.finalScore,
        durationMs,
        recordedAt: Date.now(),
        route: breakdown.patrolTimeline.map(point => ({ timeMs: Math.round(point.atSeconds * 1000), x: point.x, y: point.y })),
        actions,
        splits: breakdown.scoreSplits.map(split => ({ timeMs: Math.round(split.atSeconds * 1000), district: 'All districts', score: split.score })),
      });
    }

    const nextCareer = recordPresenceGrade(careerState, breakdown.presenceGrade);
    saveCareerState(localStorage, nextCareer);
    setCareerState(nextCareer);

    if (shiftMode === 'operations' && campaign && !getCampaignProgress(campaign).complete) {
      const updatedCampaign = recordCampaignShift(campaign, { grade: breakdown.presenceGrade, score: breakdown.finalScore });
      saveOperationsCampaign(localStorage, updatedCampaign);
      setCampaign(updatedCampaign);
    }
    setFinalScoreBreakdown(breakdown);
    setGameState('GameOver');
  }, [campaign, careerState, shiftMode, mapSeed]);

  const handlePlayAgain = useCallback(() => {
    setGameState('MainMenu');
  }, []);

  const handleDeleteMyScores = useCallback((): Promise<boolean> => (
    serializeLeaderboardMutation(async () => {
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
    })
  ), [serializeLeaderboardMutation]);

  const handleAddToLeaderboard = useCallback(async (name: string, station?: string): Promise<SubmissionResult> => {
    const run = runRef.current;
    if (!finalScoreBreakdown || !run || run.mode !== 'daily') {
      return { status: 'rejected', message: 'This shift was not issued by the Daily server.' };
    }
    const { enforcementScore, deterrenceScore, finalDeterrenceBonus, livesSavedBonus,
      livesLostPenalty, finalScore, livesSaved, livesLost, offencesPrevented, overtime,
      coverageRatio, presenceGrade, challengeAssist } = finalScoreBreakdown;
    const submission: PendingSubmission = {
      scoreVersion: PRESENCE_GRADE_CONTRACT_VERSION,
      token: run.token,
      name,
      station,
      startedAt: run.startedAt,
      elapsedMs: Date.now() - run.startedAt,
      breakdown: { enforcementScore, deterrenceScore, finalDeterrenceBonus, livesSavedBonus,
        livesLostPenalty, finalScore, livesSaved, livesLost, offencesPrevented, overtime,
        coverageRatio, presenceGrade, challengeAssist },
    };
    return serializeLeaderboardMutation(async () => {
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
    });
  }, [finalScoreBreakdown, serializeLeaderboardMutation]);

  const renderContent = () => {
    switch (gameState) {
      case 'Tutorial':
        return <Tutorial onComplete={handleTutorialComplete} mapLabel={mapLabel} />;
      case 'Playing':
        return <Game key={runInstance} onGameOver={handleGameOver} pbReplay={ghostReplay} championName={championName} mapSeed={mapSeed} operation={operation} loadout={shiftMode === 'daily' ? getPatrolLoadout('balanced') : selectedLoadout} onRestart={handleQuickRestart} onMainMenu={handlePlayAgain} />;
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
            competitionKey={shiftMode === 'daily' ? String(mapSeed) : 'lifetime'}
            submissionEligible={shiftMode === 'daily' && runRef.current?.mode === 'daily'}
            leaderboardRefreshKey={leaderboardRefreshKey}
            onDeleteMyScores={handleDeleteMyScores}
            operation={operation}
            careerProgress={careerProgress}
            campaignProgress={campaignProgress}
            loadout={shiftMode === 'daily' ? getPatrolLoadout('balanced') : selectedLoadout}
          />
        );
      case 'MainMenu':
      default:
        return <MainMenu onStartGame={handleStartGame} leaderboard={leaderboard} onDeleteMyScores={handleDeleteMyScores} dailyOperation={todayOperation} careerProgress={careerProgress} campaignProgress={campaignProgress} availableLoadouts={availableLoadouts} selectedLoadoutId={loadoutId} onLoadoutChange={handleLoadoutChange} />;
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
