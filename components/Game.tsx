import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Player, Civilian, RIDSType, VehicleType, DeterrenceBlob as DeterrenceBlobType, CollectionEffect as CollectionEffectType, District, DistrictName, FinalScoreBreakdown, SparkParticle, SkidMark, MinimapMode, EnforcementAction, ColleagueCallAction, FloatingScoreText as FloatingScoreTextType, TireSmokeParticle, Explosion as ExplosionType, PatrolPost, StationaryCountdown, DispatchedCall, PatrolSample } from '../types';
import { currentWeatherRef, weatherRadioLine } from '../utils/weather';
import { advanceShiftClock, buildOffenderSchedule, computeLifeAtRiskChance, planSimulationSteps, slotAt } from '../utils/schedule';
import { mulberry32, type Rng } from '../utils/rng';
import { interdictionAt } from '../utils/stories';
import * as CONSTANTS from '../constants';
import HUD from './HUD';
import MiniGameModal from './MiniGameModal';
import MatchingGame from './mini-games/MatchingGame';
import useKeyPress, { normalizeKey } from '../hooks/useKeyPress';
import { loadBindings, type Bindings } from '../utils/keybindings';
import { retainInPlace } from '../utils/pool';
import { computeCoverageQuality, computeScoreBreakdown } from '../utils/scoring';
import { getDistance, getDistanceSq, getRads, findClosestPointOnRoad, findClosestNode, getDistrictForPoint, DISTRICT_DEFINITIONS, generateNewPath, findNearestInCone, findShortestPath } from '../utils/geometry';
import TouchControls, { useTouchCapability } from './TouchControls';
import RotateDevicePrompt, { usePortraitBlock } from './RotateDevicePrompt';
import PauseMenu from './PauseMenu';
import { ROAD_NODES, ROAD_SEGMENTS } from '../utils/mapData';
import { drawGame, getCanvasRenderScale, CameraState, RenderState } from '../utils/gameRenderer';
import { pickRadioChatter, pickCarChatter, pickStandardActionReaction, pickInvestigateReaction, pickInterdiction, pickBriefingFact } from '../utils/stories';
import * as audio from '../utils/audio';
import { loadChallengeAssist } from '../utils/preferences';
import {
  createRoadFreshnessState,
  getCoverageTier,
  getEarnedOvertimeSeconds,
  getShiftPhase,
  roadRepeatEntryRatio,
  visitRoadSegment,
  type CoverageTier,
  type ShiftPhaseInfo,
} from '../utils/patrol';
import type { OperationDefinition, OperationModifiers } from '../utils/operations';
import { replayScoreAt, sampleReplayRoute, type PersonalBestReplay } from '../utils/replay';
import { getPatrolLoadout, type PatrolLoadout } from '../utils/loadouts';
import { getPresenceGrade } from '../shared/presenceGrade.js';

interface GameProps {
  onGameOver: (scoreBreakdown: FinalScoreBreakdown) => void;
  onRestart: () => void;
  onMainMenu: () => void;
  /** Yesterday's daily #1: patrols tonight's map as a friendly named unit. */
  championName?: string | null;
  /** The map seed: drives the fairness schedule (offender rolls) + seeded player spawn. */
  mapSeed?: number;
  operation?: OperationDefinition | null;
  pbReplay?: PersonalBestReplay | null;
  loadout?: PatrolLoadout;
}

const NEUTRAL_OPERATION: OperationModifiers = {
  presenceAuraMultiplier: 1,
  presenceRateMultiplier: 1,
  trafficMultiplier: 1,
  maxSimultaneousLifeAtRisk: 1,
  ruralDeterrenceMultiplier: 1,
  priorityDistrict: null,
  priorityRids: null,
  patrolPostMultiplier: 1,
  energyRechargeMultiplier: 1,
  standardScoreMultiplier: 1,
  investigateScoreMultiplier: 1,
};

type LocalGameState = 'Starting' | 'Playing' | 'RidsChoice' | 'MiniGame' | 'Referral';

// Cosmetic-juice gate (zoom punch, GO! shake). Cache the MediaQueryList once but read
// .matches per use so a mid-session OS toggle is honoured (a11y-lead guidance).
const REDUCED_MOTION_MQ = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
const reducedMotion = () => !!REDUCED_MOTION_MQ?.matches;

const PATROL_PATH_SAMPLE_RATE = 30; // Record player position every 30 frames
const PATHFINDING_INTERVAL = 1000; // ms, how often to recalculate GPS path
const HUD_UPDATE_INTERVAL_MS = 100;
const MAX_SIMULATION_STEP_SECONDS = 0.05;
const MAX_SIMULATION_STEPS_PER_FRAME = 10;
const ROAD_FRESHNESS_SAMPLE_MS = 750;

// Haptic vocabulary — one consistent language (gd-ml5): short tap = success,
// heavy triple = failure, long build = the big bust, steady triple = overtime.
// No-op where unsupported (iOS Safari).
const BUZZ = {
    success: 30,
    fail: [60, 40, 60],
    epic: [40, 30, 40, 30, 80],
    overtime: [40, 40, 40],
} as const;
const buzz = (pattern: number | readonly number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern as number | number[]);
};

// Vehicle mix per district archetype (weights) + per-type speed multipliers.
const VEHICLE_SPEED_MULT: Record<VehicleType, number> = {
    car: 1, ute: 1, truck: 0.8, bus: 0.75, bike: 1.25, camper: 0.7,
};
const VEHICLE_WEIGHTS: Record<DistrictName, [VehicleType, number][]> = {
    'Karori North': [['ute', 4], ['car', 3], ['camper', 2], ['bike', 1], ['truck', 1]],
    'Karori West': [['car', 6], ['ute', 2], ['bus', 1], ['bike', 1]],
    'Karori Central': [['car', 6], ['bus', 2], ['bike', 1], ['ute', 1]],
    'Karori East': [['car', 4], ['truck', 3], ['camper', 1], ['ute', 1], ['bus', 1]],
    'Karori': [['camper', 3], ['car', 3], ['ute', 1], ['bike', 1]],
};
function pickVehicleType(district: DistrictName, rng: Rng): VehicleType {
    const weights = VEHICLE_WEIGHTS[district] || VEHICLE_WEIGHTS['Karori West'];
    let total = 0;
    for (const [, w] of weights) total += w;
    let r = rng() * total;
    for (const [t, w] of weights) { r -= w; if (r <= 0) return t; }
    return 'car';
}

function observedEvidence(car: Civilian): string {
    const vehicle = car.vehicleType === 'bike' ? 'motorcycle' : car.vehicleType ?? 'vehicle';
    switch (car.ridsType) {
      case 'Impairment': return `${vehicle} is drifting across its lane and correcting late`;
      case 'Speed': return `${vehicle} is moving substantially faster than surrounding traffic`;
      case 'Distractions': return `${vehicle} shows screen glow, uneven speed, and delayed braking`;
      case 'Restraints': return `${vehicle} has an occupant without a visible restraint line`;
      default: return `${vehicle} has no confirmed safety evidence`;
    }
}

const RidsChoiceModal: React.FC<{
    onInvestigate: () => void;
    onStandard: () => void;
    selection: 'standard' | 'investigate';
    paused?: boolean;
    evidence: string;
    investigationsRemaining: number;
}> = ({ onInvestigate, onStandard, selection, paused = false, evidence, investigationsRemaining }) => {
    // Every investigation runs a mini-game and costs shift time.
    // "Instant, Variable Reward" copy predated the gd-0wi.10 retool).
    const investigateLabel = `Mini-Game, −${CONSTANTS.ENFORCE_TIME_COST_SECONDS}s Shift, High Reward`;
    const dialogRef = useRef<HTMLDivElement>(null);
    const timerBarRef = useRef<HTMLDivElement>(null);
    const elapsedRef = useRef(0);
    const onStandardRef = useRef(onStandard);
    onStandardRef.current = onStandard;
    // gd-0wi.23: move focus into the dialog on open, restore it on close. Focus the container
    // (not a button) so the SPACE that opened the modal doesn't immediately activate a choice.
    // Tab is trapped inside (aria-modal without a trap let focus reach the obscured game).
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button');
            if (!focusables || focusables.length === 0) { e.preventDefault(); return; }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
    }, []);
    // Decision timer: ~5s to choose, else auto-resolve to the standard action. Adds urgency (the shift
    // clock is frozen during this modal). Bar width written directly to avoid a per-frame re-render.
    // Keyed on `selection`: changing your selection restarts the 5s — the WCAG 2.2.1 "extend by
    // user action" mechanism, stated in the visible dialog text below.
    useEffect(() => {
        elapsedRef.current = 0;
    }, [selection]);
    useEffect(() => {
        if (paused) return;
        let raf = 0;
        let previous = performance.now();
        const tick = (now: number) => {
            elapsedRef.current += now - previous;
            previous = now;
            const pct = Math.max(0, 100 - (elapsedRef.current / 5000) * 100);
            if (timerBarRef.current) timerBarRef.current.style.width = pct + '%';
            if (pct <= 0) { onStandardRef.current(); return; }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [paused, selection]);
    return (
    <div className="absolute inset-0 bg-black/35 flex items-end sm:items-center justify-center z-20 animate-fadeIn overflow-y-auto p-2 sm:p-4 pointer-events-none" role="dialog" aria-modal="true" aria-labelledby="rids-choice-title" aria-describedby="rids-choice-desc">
        <div ref={dialogRef} tabIndex={-1} className="bg-gray-900/95 p-4 sm:p-6 rounded-lg shadow-2xl w-full max-w-lg text-center border-4 border-yellow-500 shadow-lg shadow-yellow-500/50 focus:outline-none pointer-events-auto">
            <h2 id="rids-choice-title" className="text-3xl font-bold text-yellow-400 mb-2 font-display text-glow-yellow">Driver Intervention</h2>
            <p className="text-lg text-gray-300 mb-1 font-sans">Choose your action.</p>
            {/* WCAG 2.2.1: the time limit is stated, and changing selection extends it. */}
            <p id="rids-choice-desc" className="text-xs text-gray-400 mb-3 font-sans">No decision in 5 seconds uses standard enforcement. Changing your selection restarts the timer.</p>
            <p className="text-sm text-left text-cyan-100 bg-cyan-950/60 border border-cyan-600 rounded p-2 mb-3 font-sans"><span className="font-bold text-cyan-300">OBSERVED:</span> {evidence}</p>
            {/* Decision timer bar — auto-resolves to the standard action at zero. */}
            <div className="w-full h-1 bg-gray-700 rounded mb-6 overflow-hidden" aria-hidden="true">
                <div ref={timerBarRef} className="h-full bg-yellow-400" style={{ width: '100%' }} />
            </div>
            <div className="flex space-x-4">
                <button
                    onClick={onStandard}
                    className={`flex-1 bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 text-white font-bold py-3 px-4 rounded text-xl transition font-display tracking-wider focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white ${selection === 'standard' ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_theme("colors.yellow.400")]' : ''}`}
                >
                    Standard <br/><span className="text-sm font-sans font-normal">(Enforcement · Fast)</span>
                </button>
                <button
                    onClick={onInvestigate}
                    disabled={investigationsRemaining <= 0}
                    className={`flex-1 bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 text-white font-bold py-3 px-4 rounded text-xl transition font-display tracking-wider focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white disabled:opacity-40 disabled:cursor-not-allowed ${selection === 'investigate' && investigationsRemaining > 0 ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_theme("colors.yellow.400")]' : ''}`}
                >
                    Investigate <br/><span className="text-sm font-sans font-normal">({investigateLabel} · {investigationsRemaining} left)</span>
                </button>
            </div>
            <p className="text-sm text-gray-400 mt-6 font-sans">Use <span className="font-bold text-white">←</span> / <span className="font-bold text-white">→</span> or <span className="font-bold text-white">A</span> / <span className="font-bold text-white">D</span> to select, <span className="font-bold text-white">ENTER</span> / <span className="font-bold text-white">SPACE</span> to confirm.</p>
        </div>
    </div>
);};


// Referral follow-up (the wired-in MatchingGame): same dialog semantics/trap as MiniGameModal.
const ReferralModal: React.FC<{ onComplete: (success: boolean) => void; paused?: boolean; scenarioIndex?: number; challengeAssist?: boolean }> = ({ onComplete, paused, scenarioIndex, challengeAssist }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const panel = panelRef.current;
            const focusables = panel?.querySelectorAll<HTMLElement>('button:not(:disabled)');
            if (!focusables || focusables.length === 0) { e.preventDefault(); return; }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (!panel?.contains(document.activeElement)) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
            } else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
    }, []);
    return (
        <div className="absolute inset-0 bg-black/35 flex items-start justify-center z-20 animate-fadeIn overflow-y-auto p-2 sm:p-4" data-testid="referral-shell">
            <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="referral-title" className="my-auto max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain bg-gray-900/95 p-4 sm:p-6 rounded-lg shadow-2xl w-full max-w-lg text-center border-4 border-green-500 shadow-lg shadow-green-500/50 focus:outline-none">
                <h2 id="referral-title" className="text-3xl font-bold text-green-400 mb-2 font-display">Referral Opportunity</h2>
                <p className="text-sm text-gray-400 mb-4 font-sans">Bonus: +{CONSTANTS.REFERRAL_BONUS} for this exercise's partner match. No penalty for a miss.</p>
                <MatchingGame onComplete={onComplete} ridsType="Restraints" paused={paused} scenarioIndex={scenarioIndex} challengeAssist={challengeAssist} />
            </div>
        </div>
    );
};

const Game: React.FC<GameProps> = ({ onGameOver, onRestart, onMainMenu, championName, mapSeed = 0, operation = null, pbReplay = null, loadout = getPatrolLoadout('balanced') }) => {
  const operationModifiers = operation?.modifiers ?? NEUTRAL_OPERATION;
  // State for UI and major game phases
  const [gameState, setGameState] = useState<LocalGameState>('Starting');
  const [countdownText, setCountdownText] = useState<string>('3');
  const [activeRids, setActiveRids] = useState<{ car: Civilian; ridsType: RIDSType } | null>(null);
  const [targetedCarId, setTargetedCarId] = useState<number | null>(null);
  const isTouchDevice = useTouchCapability();
  const isPortraitBlocked = usePortraitBlock(isTouchDevice);
  const [isPaused, setIsPaused] = useState(false);
  const [isHidden, setIsHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const isGameplayPaused = isPaused || isPortraitBlocked || isHidden;
  const [minimapMode, setMinimapMode] = useState<MinimapMode>('Tactical');
  const [gameMessage, setGameMessage] = useState<string | null>(null);
  const [stationaryCountdown, setStationaryCountdown] = useState<StationaryCountdown>(null);
  const lastCountdownSigRef = useRef<string>('null'); // throttles the 60fps countdown re-render (gd-0wi.6)
  const gameOverFiredRef = useRef(false); // the final score is submitted at most once, even on a stray double-RAF
  const [ridsChoiceSelection, setRidsChoiceSelection] = useState<'standard' | 'investigate'>('standard');
  const [hudTick, setHudTick] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string>('initializing...');
  const isDebugMode = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'), []);
  const briefingFact = useMemo(() => pickBriefingFact(), []);

  // Canvas and timing refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef<number>(0);
  const simulationTimeRef = useRef(0);
  const elapsedShiftSecondsRef = useRef(0);
  const countdownElapsedRef = useRef(0);
  const countdownStageRef = useRef(-1);
  const hitStopUntilRef = useRef(0); // brief sim freeze (hit-stop) on the biggest moments
  const prevPadButtonsRef = useRef<boolean[]>([]); // gamepad button edge detection
  const prevPadStartRef = useRef(false);
  const hasGamepadRef = useRef(false); // skip the per-frame getGamepads() alloc until a pad connects
  // Single ownership of the intervention lifecycle. Guards every resolution path
  // (timer default, keyboard confirm, button click, mini-game completion) so a race
  // can never fire two outcomes for one stop.
  const ridsPhaseRef = useRef<'idle' | 'choice' | 'minigame'>('idle');
  const activeRidsRef = useRef<{ car: Civilian; ridsType: RIDSType } | null>(null);
  const gameStateRef = useRef<LocalGameState>('Starting');
  const bindingsRef = useRef<Bindings>(loadBindings()); // configurable key bindings (defaults = classic controls)
  const lastHudUpdateRef = useRef<number>(0);

  // Refs for all frequently updated game data to avoid re-renders
  const playerRef = useRef<Player>(initPlayer());
  const civiliansRef = useRef<Civilian[]>([]);
  const districtsRef = useRef<District[]>(DISTRICT_DEFINITIONS.map(def => ({ ...def, deterrence: 50 })));
  const sparksRef = useRef<SparkParticle[]>([]);
  const skidMarksRef = useRef<SkidMark[]>([]);
  const tireSmokeRef = useRef<TireSmokeParticle[]>([]);
  const floatingScoreTextsRef = useRef<FloatingScoreTextType[]>([]);
  const deterrenceBlobsRef = useRef<DeterrenceBlobType[]>([]);
  const collectionEffectsRef = useRef<CollectionEffectType[]>([]);
  const explosionsRef = useRef<ExplosionType[]>([]);
  const patrolPostsRef = useRef<PatrolPost[]>([]);
  
  const scoreRef = useRef({ enforcement: 0, deterrence: 0, livesSaved: 0, livesLost: 0, colleagueSaves: 0 });
  const timeLeftRef = useRef(CONSTANTS.SHIFT_DURATION);
  // The invisible win, made countable: offenders the spawner never created because
  // deterrence was high. THE teaching number for a game about general deterrence.
  const offencesPreventedRef = useRef(0);
  const coverageQualityIntegralRef = useRef(0);
  const securedCoverageSecondsRef = useRef(0);
  const coverageTierRef = useRef<CoverageTier>(getCoverageTier(districtsRef.current.map(d => d.deterrence)));
  const districtZoneRef = useRef<Record<string, 'hotspot' | 'mid' | 'secured'>>({});
  const coverageQualityRef = useRef(50);
  const isVigilanceBonusActiveRef = useRef(false);
  
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1, shake: 0 });
  const cameraPosRef = useRef({ x: playerRef.current.pos.x, y: playerRef.current.pos.y });
  // Track the actual on-screen viewport size in CSS pixels. Updated each frame in
  // gameLoop. Used by HUD off-screen indicator math so arrows fire on the actual
  // visible bounds rather than the fixed 1280x720 design viewport.
  const viewportRef = useRef({ width: CONSTANTS.VIEWPORT_WIDTH, height: CONSTANTS.VIEWPORT_HEIGHT });
  // Last integer second on which we played the time-pressure tick. Reset to a
  // value > 10 on game start so the first crossing into the final-10 window fires.
  const lastBeepedSecondRef = useRef<number>(11);
  const patrolStartedRef = useRef(false);
  const isBrakingRef = useRef(false);
  const colleagueCallsRef = useRef(Math.max(0, CONSTANTS.MAX_COLLEAGUE_CALLS + loadout.modifiers.colleagueDelta));
  const investigationsRemainingRef = useRef(Math.max(1, CONSTANTS.MAX_DEEP_INVESTIGATIONS + loadout.modifiers.investigationDelta));
  const dispatchedCallRef = useRef<DispatchedCall | null>(null);
  const presenceBoostRateRef = useRef(0);
  const roadFreshnessRef = useRef(createRoadFreshnessState());
  const roadFreshnessMultiplierRef = useRef(1);
  const lastRoadFreshnessSampleRef = useRef(-Infinity);
  const bestPresenceChainRef = useRef(0);
  const patrolSamplesByDistrictRef = useRef<Record<DistrictName, number>>({
    'Karori North': 0, 'Karori West': 0, 'Karori Central': 0, 'Karori East': 0, Karori: 0,
  });
  const currentPhaseRef = useRef<ShiftPhaseInfo>(getShiftPhase(0, CONSTANTS.SHIFT_DURATION));
  const earnedOvertimeSecondsRef = useRef(0);
  
  // Refs for tracking game logic timers and state
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const touchStateRef = useRef<{ [key: string]: boolean }>({});
  // Analog joystick magnitude (-1..1 each axis). Boolean direction still flows via
  // touchStateRef + keysPressed for keyboard compat; this ref carries the analog
  // intensity (0..1 magnitude) so the driving code can apply gentle vs sharp turns.
  const analogInputRef = useRef({ x: 0, y: 0 });
  const gamepadAnalogInputRef = useRef({ x: 0, y: 0 });
  const gamepadBoostRef = useRef(false);
  const gameLoopRef = useRef<number | undefined>(undefined);
  const lastSpawnCheckTime = useRef(0);
  const nextCarChatterAtRef = useRef(8000); // simulation ms; pauses with the shift
  const lastRidsCheckAtRef = useRef(-Infinity);
  const trafficInitializedRef = useRef(false);
  const [challengeAssist] = useState(loadChallengeAssist);
  const [gameplayRng] = useState<Rng>(() => mapSeed ? mulberry32((mapSeed ^ 0x7f4a7c15) >>> 0) : Math.random);
  const [championRng] = useState<Rng>(() => mapSeed ? mulberry32((mapSeed ^ 0x3c6ef372) >>> 0) : Math.random);
  // The once-per-shift interdiction car + its outcome for the end screen.
  const interdictionAssignedRef = useRef(false);
  const interdictionResultRef = useRef<FinalScoreBreakdown['interdiction']>(null);
  // Overtime is banked once from cumulative time with at least three secured districts.
  const overtimeUsedRef = useRef(false);
  // Fairness schedule (gd-zz7.16): per-ordinal offender rolls from the map seed.
  const [offenderSchedule] = useState(() => buildOffenderSchedule(mapSeed));
  const offenderOrdinalRef = useRef(0);
  const referralScenarioRef = useRef<number | undefined>(undefined);
  // Arcade juice (gd-zz7.14): combo chain, brief slow-mo, end-of-shift slam, near-miss whoosh.
  const comboRef = useRef({ count: 0, mult: 1, expiresAt: 0 });
  const slowmoUntilRef = useRef(0);
  const slamStartedRef = useRef(false);
  const slamAtRef = useRef(0);
  const [showSlam, setShowSlam] = useState(false);
  const lastWhooshAtRef = useRef(0);
  const ghostPosRef = useRef<{ x: number; y: number; angle: number } | null>(null);
  // Queued dispatch lines: weather intro first (if any), then the champion intro.
  const pendingRadioRef = useRef<string[]>([
      ...(operation ? [`${operation.name}: ${operation.briefing}`] : []),
      ...(weatherRadioLine(currentWeatherRef.current) ? [weatherRadioLine(currentWeatherRef.current)!] : []),
      ...(championName ? [`Insp. ${championName} is out with you tonight. Yesterday's top patrol.`] : []),
  ]);
  const [radioLine, setRadioLine] = useState<string | null>(null); // 📻 dispatch banner
  const radioTimerRef = useRef<number | null>(null);
  const nextRadioAtRef = useRef(0);

  // Radio chatter: distinct banner + squelch double-tick so it can't be missed.
  const playRadio = useCallback((line: string) => {
    audio.tick(300);
    window.setTimeout(() => audio.tick(280), 90);
    setRadioLine(line);
    if (radioTimerRef.current) clearTimeout(radioTimerRef.current);
    radioTimerRef.current = window.setTimeout(() => setRadioLine(null), 6000);
  }, []);
  const lastPathfindTime = useRef(0);
  const gameMessageTimerRef = useRef<number | null>(null);
  const sirenStartTimeRef = useRef<number | null>(null);
  
  const patrolPathRef = useRef<{x: number, y: number}[]>([]);
  const patrolTimelineRef = useRef<PatrolSample[]>([]);
  const scoreSplitsRef = useRef<FinalScoreBreakdown['scoreSplits']>([]);
  const nextScoreSplitRef = useRef(30);
  const enforcementActionsRef = useRef<EnforcementAction[]>([]);
  const colleagueCallActionsRef = useRef<ColleagueCallAction[]>([]);
  const patrolPathFrameCounter = useRef(0);
  const interventionStatsRef = useRef({ scans: 0, accurateScans: 0, falseScans: 0, standard: 0, investigate: 0, modalSeconds: 0 });
  const offendersSpawnedRef = useRef(0);
  
  const isNeglectOfDutyActiveRef = useRef(false);
  const stationaryStartTime = useRef<number | null>(null);
  const stationaryStartPosition = useRef<{ x: number, y: number } | null>(null);
  const wasInHighDeterrenceZoneRef = useRef(false);
  const lastPlayerDistrictRef = useRef<DistrictName | null>(null);

  const highlightedPathRef = useRef<{x: number, y: number}[] | null>(null);
  const pathfindingTargetIdRef = useRef<number | null>(null);
  const isGameplayPausedRef = useRef(isGameplayPaused);

  // Per-mount (not module-level): the map can be regenerated between shifts (utils/mapGen),
  // and Game always mounts after regeneration, so a fresh Map here is always current.
  const nodeMap = useMemo(() => new Map(ROAD_NODES.map(node => [node.id, node])), []);

  const segmentLookup = useMemo(() => {
    const map = new Map<string, typeof ROAD_SEGMENTS[0]>();
    for (const segment of ROAD_SEGMENTS) {
        const key = [segment.startNodeId, segment.endNodeId].sort().join('-');
        map.set(key, segment);
    }
    return map;
  }, []);

  function initPlayer(): Player {
    // Fairness: everyone starts the daily from the same kerb (seeded, not rolled).
    const spawnRoll = mapSeed ? mulberry32((mapSeed ^ 0x1b873593) >>> 0)() : Math.random();
    const startNode = ROAD_NODES[Math.floor(spawnRoll * ROAD_NODES.length)];
    const connectedSegment = ROAD_SEGMENTS.find(s => s.startNodeId === startNode.id || s.endNodeId === startNode.id);
    let startAngle = 0;

    if (connectedSegment) {
        const otherNodeId = connectedSegment.startNodeId === startNode.id ? connectedSegment.endNodeId : connectedSegment.startNodeId;
        const otherNode = ROAD_NODES.find(n => n.id === otherNodeId);
        if (otherNode) {
            startAngle = Math.atan2(otherNode.pos.y - startNode.pos.y, otherNode.pos.x - startNode.pos.x) * (180 / Math.PI) + 90;
        }
    }

    return {
      id: 0, pos: { ...startNode.pos }, angle: startAngle, speed: 0,
      vel: { x: 0, y: 0 }, boostCharge: CONSTANTS.PLAYER_BOOST_MAX_CHARGE,
      isBoosting: false, isSirenActive: false, vigilance: 0,
    };
  }

  gameStateRef.current = gameState;
  isGameplayPausedRef.current = isGameplayPaused;

  const spendShiftTime = useCallback((seconds: number) => {
    const clock = advanceShiftClock(timeLeftRef.current, elapsedShiftSecondsRef.current, seconds);
    timeLeftRef.current = clock.timeLeft;
    elapsedShiftSecondsRef.current = clock.elapsed;
  }, []);

  const closeActiveIntervention = useCallback(() => {
    ridsPhaseRef.current = 'idle';
    activeRidsRef.current = null;
    setActiveRids(null);
    setTargetedCarId(null);
    setGameState('Playing');
  }, []);

  const closeInterventionForVehicle = useCallback((vehicleId: number): boolean => {
    if (activeRidsRef.current?.car.id !== vehicleId) return false;
    closeActiveIntervention();
    return true;
  }, [closeActiveIntervention]);

  const recordDispatchOutcome = useCallback((call: DispatchedCall, result: ColleagueCallAction['result'], pos = call.pos) => {
    colleagueCallActionsRef.current.push({
      pos: { ...pos },
      targetVehicleId: call.targetVehicleId,
      atSeconds: elapsedShiftSecondsRef.current,
      result,
    });
    dispatchedCallRef.current = null;
  }, []);

  // Track pad presence so the frame loop doesn't call getGamepads() (which allocates)
  // when no pad has ever connected.
  useEffect(() => {
    const on = () => { hasGamepadRef.current = true; };
    const off = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      hasGamepadRef.current = Array.prototype.some.call(pads, (p: Gamepad | null) => p && p.connected);
      if (!hasGamepadRef.current) {
        gamepadAnalogInputRef.current = { x: 0, y: 0 };
        prevPadButtonsRef.current = [];
        gamepadBoostRef.current = false;
      }
    };
    window.addEventListener('gamepadconnected', on);
    window.addEventListener('gamepaddisconnected', off);
    off();
    return () => {
      window.removeEventListener('gamepadconnected', on);
      window.removeEventListener('gamepaddisconnected', off);
    };
  }, []);

  // Active-time countdown: app switches, portrait blocking, and explicit pause cannot consume it.
  useEffect(() => {
    if (gameState !== 'Starting' || isGameplayPaused) return;
    if (countdownStageRef.current < 0) {
      countdownStageRef.current = 0;
      setCountdownText('3');
      audio.tick(700);
    }
    let raf = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      countdownElapsedRef.current += now - previous;
      previous = now;
      const stage = Math.min(3, Math.floor(countdownElapsedRef.current / 1000));
      if (stage > countdownStageRef.current) {
        countdownStageRef.current = stage;
        setCountdownText(stage === 1 ? '2' : stage === 2 ? '1' : 'GO!');
        audio.tick(stage === 3 ? 1200 : 700);
      }
      if (countdownElapsedRef.current >= 4000) {
        setGameState('Playing');
        setCountdownText('');
        // First dispatch line = the briefing fact: readable for a full 6s + announced to AT
        // (the countdown overlay only showed it ~4s, and never announced it).
        playRadio(briefingFact);
        if (!reducedMotion()) cameraRef.current.shake = 8; // GO! punch
        // Queued intros (weather/champion) arrive sooner than ambient chatter would.
        nextRadioAtRef.current = simulationTimeRef.current + (pendingRadioRef.current.length ? 9000 : 25000 + Math.random() * 15000);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [briefingFact, gameState, isGameplayPaused, playRadio]);

  // Keep the patrol soundscape running through compact intervention overlays. The vehicle
  // coasts and the world slows, but a stop no longer turns the 90-second shift into dead time.
  useEffect(() => {
    const patrolActive = gameState !== 'Starting';
    if (patrolActive && !isGameplayPaused) {
      audio.engineStart();
      audio.setEngineLevel(0);
      audio.musicStart();
      if (playerRef.current.isSirenActive) audio.sirenStart();
    } else {
      audio.engineStop();
      audio.musicStop();
    }
    return () => { audio.engineStop(); audio.sirenStop(); audio.musicStop(); };
  }, [gameState, isGameplayPaused]);

  useEffect(() => {
    if (gameState === 'Playing' && !patrolStartedRef.current) {
      patrolStartedRef.current = true;
      lastBeepedSecondRef.current = 11;
    }
  }, [gameState]);

  useEffect(() => {
    if (!isGameplayPaused) return;
    keysPressed.current = {};
    touchStateRef.current = {};
    analogInputRef.current = { x: 0, y: 0 };
    gamepadAnalogInputRef.current = { x: 0, y: 0 };
    gamepadBoostRef.current = false;
    playerRef.current.isBoosting = false;
  }, [isGameplayPaused]);

  // Clear held inputs on app switch / focus loss / orientation change so
  // the player doesn't return to a stuck-down d-pad or boost button.
  useEffect(() => {
    const clearHeldInputs = () => {
      keysPressed.current = {};
      touchStateRef.current = {};
      analogInputRef.current.x = 0;
      analogInputRef.current.y = 0;
      gamepadAnalogInputRef.current.x = 0;
      gamepadAnalogInputRef.current.y = 0;
      gamepadBoostRef.current = false;
      isBrakingRef.current = false;
      if (playerRef.current.isSirenActive) {
        playerRef.current.isSirenActive = false;
        sirenStartTimeRef.current = null;
      }
      audio.sirenStop();
      audio.engineStop();
      audio.musicStop(); // music otherwise loops forever over a hidden/paused game
      playerRef.current.isBoosting = false;
    };
    const onBlur = () => { setIsHidden(true); clearHeldInputs(); };
    const onFocus = () => setIsHidden(document.hidden);
    const onVisibility = () => { setIsHidden(document.hidden); if (document.hidden) clearHeldInputs(); };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onBlur);
    window.addEventListener('orientationchange', clearHeldInputs);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onBlur);
      window.removeEventListener('orientationchange', clearHeldInputs);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Escape pauses from every active gameplay phase. PauseMenu owns Escape-to-resume.
  useEffect(() => {
    if (isPaused || isPortraitBlocked || showSlam) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.repeat) {
        event.preventDefault();
        setIsPaused(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPaused, isPortraitBlocked, showSlam]);

  // Start toggles pause regardless of the current modal; child gamepad hooks own A/B/D-pad.
  useEffect(() => {
    let raf = 0;
    const poll = () => {
      let start = false;
      if (hasGamepadRef.current && navigator.getGamepads) {
        const pads = navigator.getGamepads();
        for (const pad of pads) {
          if (pad?.connected) { start = !!pad.buttons[9]?.pressed; break; }
        }
      }
      if (start && !prevPadStartRef.current && !isPortraitBlocked && !showSlam) {
        setIsPaused(value => !value);
      }
      prevPadStartRef.current = start;
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [isPortraitBlocked, showSlam]);

  const handleColleagueCall = useCallback(() => {
    if (colleagueCallsRef.current <= 0 || gameStateRef.current !== 'Playing' || isGameplayPausedRef.current) return;
    if (dispatchedCallRef.current?.active) {
        setGameMessage('COLLEAGUE ALREADY EN ROUTE');
        if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 1800);
        return;
    }

    const lifeAtRiskCars = civiliansRef.current.filter(c => c.isLifeAtRisk);

    let targetCar: Civilian | null = null;
    if (lifeAtRiskCars.length > 0) {
        targetCar = lifeAtRiskCars.reduce((closest, car) => {
            const distToClosest = getDistance(playerRef.current.pos, closest.pos);
            const distToCar = getDistance(playerRef.current.pos, car.pos);
            return distToCar < distToClosest ? car : closest;
        });
    }

    if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);

    if (targetCar) {
        colleagueCallsRef.current--;
        const distance = getDistance(playerRef.current.pos, targetCar.pos);
        const stagedFromPost = patrolPostsRef.current.some(post => getDistanceSq(post.pos, targetCar!.pos) < CONSTANTS.PATROL_POST_RADIUS ** 2);
        const eta = Math.max(CONSTANTS.COLLEAGUE_DISPATCH_MIN_SECONDS, distance / CONSTANTS.COLLEAGUE_DISPATCH_SPEED) * (stagedFromPost ? 0.7 : 1);
        dispatchedCallRef.current = {
            id: simulationTimeRef.current + targetCar.id,
            pos: { ...targetCar.pos },
            targetVehicleId: targetCar.id,
            timeLeft: eta,
            active: true,
            targetTimeLeft: targetCar.lifeAtRiskTimer,
        };
        setGameMessage(`COLLEAGUE EN ROUTE · ETA ${Math.ceil(eta)}s`);
        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 3000);
        
    } else {
        setGameMessage('NO HIGH-PRIORITY TARGETS AVAILABLE');
        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 2000);
    }
  }, []);

  const handleSirenToggle = useCallback(() => {
    if (gameStateRef.current !== 'Playing' || isGameplayPausedRef.current) return; // no ability input during countdown/modals/pause
    const player = playerRef.current;
    if (!player.isSirenActive && player.boostCharge > 0) {
        sirenStartTimeRef.current = simulationTimeRef.current;
        player.isSirenActive = true;
        audio.sirenStart();
    } else {
        sirenStartTimeRef.current = null;
        player.isSirenActive = false;
        audio.sirenStop();
    }
  }, []);
  
  // Normalize casing so Shift/CapsLock don't break movement/boost or strand a held key.
  useKeyPress(
    e => { keysPressed.current[normalizeKey(e.key)] = true; },
    e => { keysPressed.current[normalizeKey(e.key)] = false; }
  );
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.repeat) return; // toggles: ignore auto-repeat so a held key doesn't strobe
        if (isGameplayPausedRef.current) return;
        const k = normalizeKey(e.key);
        const b = bindingsRef.current;
        if (b.minimap.includes(k)) setMinimapMode(prev => prev === 'Tactical' ? 'Strategic' : 'Tactical');
        if (b.colleague.includes(k)) handleColleagueCall();
        if (b.siren.includes(k)) handleSirenToggle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleColleagueCall, handleSirenToggle]);

  const handleControlChange = useCallback((action: string, active: boolean) => {
    touchStateRef.current[action] = active;
  }, []);

  const handleRidsCheck = useCallback(() => {
    if (gameStateRef.current !== 'Playing' || isGameplayPausedRef.current) return;
    const now = simulationTimeRef.current;
    if (now - lastRidsCheckAtRef.current < CONSTANTS.RIDS_SCAN_COOLDOWN_SECONDS * 1000) return;
    lastRidsCheckAtRef.current = now;
    
    const player = playerRef.current;
    const currentVigilanceBonus = CONSTANTS.VIGILANCE_AURA_BONUS_MAX * (player.vigilance / 100);
    const baseRadius = player.isSirenActive ? CONSTANTS.PLAYER_SIREN_AURA_RADIUS : CONSTANTS.PLAYER_AURA_RADIUS;
    const checkRadius = (baseRadius + currentVigilanceBonus) * operationModifiers.presenceAuraMultiplier * loadout.modifiers.scanRadius;
    interventionStatsRef.current.scans++;
    const nearbyCar = findNearestInCone(
      player.pos,
      player.angle,
      civiliansRef.current.filter(c => !c.isChampion),
      checkRadius,
      CONSTANTS.RIDS_TARGET_HALF_ANGLE_DEGREES,
    );
    if (nearbyCar?.ridsType) {
        interventionStatsRef.current.accurateScans++;
        ridsPhaseRef.current = 'choice'; // arm the one-shot resolution guard
        setActiveRids({ car: nearbyCar, ridsType: nearbyCar.ridsType! });
        setTargetedCarId(nearbyCar.id);
        setGameMessage('TARGET LOCKED');
        audio.beep();
        setRidsChoiceSelection('standard');
        activeRidsRef.current = { car: nearbyCar, ridsType: nearbyCar.ridsType! };
        setGameState('RidsChoice');
        if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 1200);
    } else if (nearbyCar) {
            interventionStatsRef.current.falseScans++;
            // Feedback for a wasted check (was a silent -3s time penalty).
            spendShiftTime(CONSTANTS.RIDS_TIME_PENALTY_INCORRECT_CHECK);
            audio.thud();
            // A wasted check breaks the combo chain (arcade risk/reward).
            if (comboRef.current.count > 1) { comboRef.current.count = 0; comboRef.current.mult = 1; }
            setGameMessage(`NO VIOLATION  -${CONSTANTS.RIDS_TIME_PENALTY_INCORRECT_CHECK}s`);
            if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
            gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 1500);
    }
  }, [spendShiftTime]);
  

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Only swallow the key mid-patrol. preventDefault() in every gameState cancelled native
      // Space activation of focused buttons (modal choices, mini-game buttons, assist paths).
      if (gameStateRef.current !== 'Playing') return;
      if (bindingsRef.current.rids.includes(normalizeKey(e.key)) && !e.repeat) { e.preventDefault(); handleRidsCheck(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRidsCheck]);

  const createCivilian = useCallback((districtId?: DistrictName, rng: Rng = gameplayRng): Civilian | null => {
    const path = generateNewPath(districtId, undefined, undefined, rng);
    if (!path || path.length < 2) return null;
    const spawnPointNode = nodeMap.get(path[0]);
    if (!spawnPointNode) return null;
    const districtName = getDistrictForPoint(spawnPointNode.pos);
    const district = districtsRef.current.find(d => d.id === districtName);
    if (!district) return null;

    const dx = nodeMap.get(path[1])!.pos.x - spawnPointNode.pos.x;
    const dy = nodeMap.get(path[1])!.pos.y - spawnPointNode.pos.y;

    // Traffic variety: district-flavoured vehicle mix. Trucks haul the motorway,
    // utes run rural, buses work the centre, campers wander the bays (tourists, eh).
    const vehicleType = pickVehicleType(districtName, rng);
    const typeSpeed = VEHICLE_SPEED_MULT[vehicleType];
    // Weather is fixed for the whole shift, so bake its traffic slowdown in at spawn.
    const weatherSpeed = currentWeatherRef.current.civilianSpeed;

    return {
      id: rng(), pos: { ...spawnPointNode.pos }, angle: Math.atan2(dy, dx) * (180 / Math.PI) + 90,
      speed: 0, vel: { x: 0, y: 0 }, ridsType: null, zone: district.name.includes('Rural') ? 'Rural' : 'Suburban',
      district: districtName, path, pathIndex: 1, spawnTime: simulationTimeRef.current, isDeterred: false,
      baseSpeed: (CONSTANTS.CIVILIAN_BASE_SPEED[districtName] + (rng() - 0.5) * CONSTANTS.CIVILIAN_SPEED_VARIATION) * typeSpeed * weatherSpeed,
      vehicleType,
      lastBlobSpawnTime: 0, deterrenceBlobsRemaining: 0,
      isLifeAtRisk: false, lifeAtRiskTimer: 0,
      swerveAngle: 0, speedFluctuationTimer: 0, speedFluctuationTarget: 1,
    };
  }, [gameplayRng, nodeMap]);

  const spawnCivilian = useCallback((districtId?: DistrictName) => {
    const newCivilian = createCivilian(districtId);
    if (newCivilian) civiliansRef.current.push(newCivilian);
  }, [createCivilian]);

  useEffect(() => {
    if (!trafficInitializedRef.current) {
      trafficInitializedRef.current = true;
      const initialCarCount = Math.min(CONSTANTS.MAX_CIVILIAN_CARS, Math.round(40 * operationModifiers.trafficMultiplier));
      for (let i = 0; i < initialCarCount; i++) {
          const newCar = createCivilian();
          if (newCar) civiliansRef.current.push(newCar);
      }
      patrolPathRef.current = [{ ...playerRef.current.pos }];
      patrolTimelineRef.current = [{
        ...playerRef.current.pos,
        atSeconds: 0,
        score: 0,
        district: getDistrictForPoint(playerRef.current.pos),
      }];
      cameraPosRef.current = { ...playerRef.current.pos };
      lastPlayerDistrictRef.current = getDistrictForPoint(playerRef.current.pos);
    }
    // Yesterday's champion rides tonight: a friendly unit using ordinary civilian pathing.
    // Never an offender (excluded from candidate selection by the isChampion flag).
    if (championName && !civiliansRef.current.some(c => c.isChampion)) {
        const unit = createCivilian(undefined, championRng);
        if (unit) {
            unit.isChampion = true;
            unit.baseSpeed = unit.baseSpeed * 1.15;
            civiliansRef.current.push(unit);
        }
    }
  }, [championName, championRng, createCivilian]);

    const updatePlayerMovement = (now: number, dt: number, elapsedDt: number) => {
        const dtScale = 60 * dt; // Scale from per-frame@60fps to per-dt
        const player = playerRef.current;
        const controlsEnabled = gameStateRef.current === 'Playing';

        // Gamepad (Standard mapping) — additive + inert without hardware, so it can't affect the
        // keyboard/touch paths. Left stick -> analog drive; RB/RT -> boost; A/B/X (edge) ->
        // RIDS check / siren / colleague assist.
        const pads = hasGamepadRef.current && typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
        let gp: Gamepad | null = null;
        for (const p of pads) { if (p && p.connected) { gp = p; break; } }
        if (gp) {
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            const gmag = Math.hypot(ax, ay);
            const GP_DZ = 0.18;
            if (gmag > GP_DZ) {
                const scaled = (gmag - GP_DZ) / (1 - GP_DZ);
                gamepadAnalogInputRef.current.x = (ax / gmag) * scaled;
                gamepadAnalogInputRef.current.y = (ay / gmag) * scaled;
            } else {
                gamepadAnalogInputRef.current.x = 0;
                gamepadAnalogInputRef.current.y = 0;
            }
            const pressed = (i: number) => !!gp!.buttons[i]?.pressed;
            gamepadBoostRef.current = pressed(5) || pressed(7);
            const prev = prevPadButtonsRef.current;
            const ridsEdge = pressed(0) && !prev[0];
            const sirenEdge = pressed(1) && !prev[1];
            const colleagueEdge = pressed(2) && !prev[2];
            // Update edge state in place (buttons.map allocated a fresh array per frame).
            for (let i = 0; i < gp.buttons.length; i++) prev[i] = !!gp.buttons[i]?.pressed;
            if (ridsEdge) handleRidsCheck();
            if (sirenEdge) handleSirenToggle();
            if (colleagueEdge) handleColleagueCall();
        } else {
            gamepadAnalogInputRef.current.x = 0;
            gamepadAnalogInputRef.current.y = 0;
            gamepadBoostRef.current = false;
        }

        const kp = keysPressed.current;
        const ts = touchStateRef.current;
        const b = bindingsRef.current;
        // Read both refs directly ({...kp, ...ts} allocated a merged object per frame).
        const bound = (action: keyof Bindings) => controlsEnabled && b[action].some(key => kp[key] || ts[key]);
        const moveForward = bound('forward');
        const moveBackward = bound('backward');
        const turnLeft = bound('left');
        const turnRight = bound('right');
        const isTryingToBoost = bound('boost') || (controlsEnabled && gamepadBoostRef.current);
        
        // Boost works with any movement intent — keyboard forward OR joystick deflection (touch driving
        // is omnidirectional, so gating on 'forward' silently broke boost in most headings).
        const padAnalog = gamepadAnalogInputRef.current;
        const touchAnalog = analogInputRef.current;
        const activeAnalog = controlsEnabled
            ? (Math.hypot(padAnalog.x, padAnalog.y) > 0.05 ? padAnalog : touchAnalog)
            : { x: 0, y: 0 };
        const hasMoveIntent = moveForward || Math.hypot(activeAnalog.x, activeAnalog.y) > 0.05;
        player.isBoosting = isTryingToBoost && player.boostCharge >= CONSTANTS.PLAYER_BOOST_DRAIN_RATE && hasMoveIntent && !player.isSirenActive;

        if (player.isBoosting) {
            player.boostCharge = Math.max(0, player.boostCharge - CONSTANTS.DT_BOOST_DRAIN_PER_SEC * elapsedDt);
        } else if (player.isSirenActive) {
            // gd-0wi.11: siren now costs energy (shares the boost pool) and auto-disables when
            // drained or past its max duration — previously it was free + unlimited.
            player.boostCharge = Math.max(0, player.boostCharge - CONSTANTS.DT_SIREN_DRAIN_PER_SEC * elapsedDt);
            const sirenElapsed = sirenStartTimeRef.current ? now - sirenStartTimeRef.current : 0;
            if (player.boostCharge <= 0 || sirenElapsed > CONSTANTS.PLAYER_SIREN_MAX_DURATION) {
                player.isSirenActive = false;
                sirenStartTimeRef.current = null;
                audio.sirenStop();
            }
        } else {
            player.boostCharge = Math.min(CONSTANTS.PLAYER_BOOST_MAX_CHARGE, player.boostCharge + CONSTANTS.DT_BOOST_RECHARGE_PER_SEC * operationModifiers.energyRechargeMultiplier * loadout.modifiers.energyRecharge * elapsedDt);
        }
        const currentSpeed = Math.sqrt(player.vel.x ** 2 + player.vel.y ** 2);
        player.speed = currentSpeed;
        // Cardinal joystick mode: when the analog joystick magnitude is non-trivial,
        // treat the joystick as a world-direction vector — push north = move north,
        // regardless of car heading. Visual angle smoothly rotates toward velocity
        // direction so the car still 'faces' where it's going. Snaps instantly when
        // prefers-reduced-motion is set.
        const jx = activeAnalog.x;
        const jy = activeAnalog.y;
        const joystickMag = Math.hypot(jx, jy);
        const cardinalActive = joystickMag > 0.05;
        let thrust = 0;

        if (cardinalActive) {
            // Apply velocity directly in joystick direction. Magnitude controls thrust intensity.
            const baseAccel = player.isBoosting
                ? CONSTANTS.DT_ACCEL_PER_SEC * CONSTANTS.PLAYER_BOOST_ACCELERATION_MULTIPLIER * dt
                : CONSTANTS.DT_ACCEL_PER_SEC * dt;
            const thrustForFrame = baseAccel * Math.min(1, joystickMag);
            const ndx = jx / joystickMag;
            const ndy = jy / joystickMag;
            player.vel.x += ndx * thrustForFrame;
            player.vel.y += ndy * thrustForFrame;
            // Visual rotation toward joystick direction.
            // Game angle convention: 0 = facing up (north), +90 = right, etc. (player.angle - 90 → world rads).
            const targetAngleDeg = Math.atan2(ndy, ndx) * (180 / Math.PI) + 90;
            let delta = targetAngleDeg - player.angle;
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduceMotion) {
                player.angle = targetAngleDeg;
            } else {
                player.angle += delta * Math.min(1, dt * 8);
            }
            thrust = thrustForFrame; // expose to downstream isBraking heuristic below
        } else {
            // Tank mode: keyboard (WASD/arrows) or thresholded boolean touch.
            if (currentSpeed > 0.1) {
                const turnEffectiveness = 1.0 - Math.min(0.5, currentSpeed / (CONSTANTS.PLAYER_MAX_SPEED * 1.5));
                if (turnLeft) player.angle -= CONSTANTS.DT_HANDLING_PER_SEC * dt * turnEffectiveness;
                if (turnRight) player.angle += CONSTANTS.DT_HANDLING_PER_SEC * dt * turnEffectiveness;
            }
            if (moveForward) thrust = (player.isBoosting ? CONSTANTS.DT_ACCEL_PER_SEC * CONSTANTS.PLAYER_BOOST_ACCELERATION_MULTIPLIER * dt : CONSTANTS.DT_ACCEL_PER_SEC * dt);
            if (moveBackward) thrust = -CONSTANTS.DT_ACCEL_PER_SEC * dt / 2;
            const tankRads = getRads(player.angle - 90);
            const tankForwardVec = { x: Math.cos(tankRads), y: Math.sin(tankRads) };
            player.vel.x += tankForwardVec.x * thrust;
            player.vel.y += tankForwardVec.y * thrust;
        }
        // forwardVec is the player's facing direction (now possibly steered by either
        // tank or cardinal logic above). Velocity is already applied inside the branches —
        // we only use forwardVec here for the dotForward / lateralVelocity friction split.
        const rads = getRads(player.angle - 90); const forwardVec = { x: Math.cos(rads), y: Math.sin(rads) };
        const dotForward = player.vel.x * forwardVec.x + player.vel.y * forwardVec.y;
        isBrakingRef.current = moveBackward || (!moveForward && dotForward > 0.1);
        const forwardVelocity = { x: forwardVec.x * dotForward, y: forwardVec.y * dotForward };
        const lateralVelocity = { x: player.vel.x - forwardVelocity.x, y: player.vel.y - forwardVelocity.y };
        // Apply friction using power formula for frame-rate independence
        // Weather grip: rain pulls the friction bases toward 1 (holds momentum = slides).
        const grip = currentWeatherRef.current.grip;
        const fwdBase = 1 - (1 - CONSTANTS.PLAYER_FORWARD_FRICTION) * Math.sqrt(grip);
        const latBase = 1 - (1 - CONSTANTS.PLAYER_LATERAL_FRICTION) * grip;
        const fwdFriction = Math.pow(fwdBase, dtScale);
        const latFriction = Math.pow(latBase, dtScale);
        forwardVelocity.x *= fwdFriction; forwardVelocity.y *= fwdFriction;
        lateralVelocity.x *= latFriction; lateralVelocity.y *= latFriction;
        player.vel.x = forwardVelocity.x + lateralVelocity.x; player.vel.y = forwardVelocity.y + lateralVelocity.y;
        const maxSpeed = player.isBoosting ? CONSTANTS.PLAYER_BOOST_MAX_SPEED : CONSTANTS.PLAYER_MAX_SPEED;
        const finalSpeed = Math.sqrt(player.vel.x ** 2 + player.vel.y ** 2);
        if (finalSpeed > maxSpeed) { const ratio = maxSpeed / finalSpeed; player.vel.x *= ratio; player.vel.y *= ratio; }
        if (finalSpeed < 0.01 && thrust === 0) { player.vel.x = 0; player.vel.y = 0; }
        const lateralSpeed = Math.sqrt(lateralVelocity.x ** 2 + lateralVelocity.y ** 2);
        // gd-0wi.5: gate particle spawns by dt so density is frame-rate-independent.
        if (lateralSpeed > CONSTANTS.SKID_LATERAL_VELOCITY_THRESHOLD && Math.random() < dtScale) skidMarksRef.current.push({ id: now + Math.random(), pos: { ...player.pos }, angle: player.angle, spawnTime: now });
        if (lateralSpeed > CONSTANTS.TIRE_SMOKE_LATERAL_VELOCITY_THRESHOLD && Math.random() < dtScale) {
            const backOffset = 20; const rads = getRads(player.angle - 90);
            tireSmokeRef.current.push({id: now + Math.random(), pos: {x: player.pos.x - Math.cos(rads) * backOffset, y: player.pos.y - Math.sin(rads) * backOffset}, spawnTime: now});
        }
        // Position update scaled by dt
        player.pos.x += player.vel.x * dtScale;
        player.pos.y += player.vel.y * dtScale;
        
        // Track a compact, timestamped patrol replay (every ~0.5s).
        patrolPathFrameCounter.current += CONSTANTS.FRAMES_PER_SECOND * elapsedDt;
        if (patrolPathFrameCounter.current >= PATROL_PATH_SAMPLE_RATE) {
            patrolPathRef.current.push({ x: player.pos.x, y: player.pos.y });
            const district = getDistrictForPoint(player.pos);
            const liveScore = Math.round(scoreRef.current.enforcement + scoreRef.current.deterrence)
                + ((scoreRef.current.livesSaved - scoreRef.current.colleagueSaves) * CONSTANTS.LIVES_SAVED_SCORE_BONUS)
                + (scoreRef.current.colleagueSaves * CONSTANTS.COLLEAGUE_SAVE_SCORE_BONUS)
                - (scoreRef.current.livesLost * CONSTANTS.LIVES_LOST_PENALTY);
            patrolTimelineRef.current.push({ x: player.pos.x, y: player.pos.y, atSeconds: elapsedShiftSecondsRef.current, score: liveScore, district });
            patrolSamplesByDistrictRef.current[district]++;
            patrolPathFrameCounter.current = 0;
        }
    };
    
    const updateVigilance = (dt: number) => {
        const player = playerRef.current;

        const playerDistrict = getDistrictForPoint(player.pos);
        if (playerDistrict !== lastPlayerDistrictRef.current && lastPlayerDistrictRef.current !== null) {
            player.vigilance += CONSTANTS.VIGILANCE_GAIN_ON_DISTRICT_CHANGE;
        }
        lastPlayerDistrictRef.current = playerDistrict;

        if (player.isBoosting) {
            player.vigilance -= CONSTANTS.VIGILANCE_DECAY_PER_SECOND_BOOSTING * dt;
        } else if (player.speed < 1.0) {
            player.vigilance -= CONSTANTS.VIGILANCE_DECAY_PER_SECOND_STATIONARY * dt;
        } else if (player.speed < CONSTANTS.PLAYER_MAX_SPEED * 0.9) {
            player.vigilance += CONSTANTS.VIGILANCE_GAIN_PER_SECOND_PATROLLING * dt;
        }
        
        player.vigilance = Math.max(0, Math.min(CONSTANTS.VIGILANCE_MAX, player.vigilance));
    };

    const updateDeterrenceAndNeglect = (now: number, dt: number) => {
        const player = playerRef.current;
        const playerDistrictId = getDistrictForPoint(player.pos);
        presenceBoostRateRef.current = 0;

        if (now - lastRoadFreshnessSampleRef.current >= ROAD_FRESHNESS_SAMPLE_MS) {
            lastRoadFreshnessSampleRef.current = now;
            const road = findClosestPointOnRoad(player.pos);
            if (road && road.dist <= CONSTANTS.ROAD_WIDTH) {
                const visit = visitRoadSegment(roadFreshnessRef.current, road.segmentId, elapsedShiftSecondsRef.current);
                roadFreshnessRef.current = visit.state;
                roadFreshnessMultiplierRef.current = visit.multiplier;
                bestPresenceChainRef.current = Math.max(bestPresenceChainRef.current, visit.state.chain);
            } else {
                roadFreshnessMultiplierRef.current = 0.25;
            }
        }

        // Boost + age + compact in one in-place pass (the trailing .filter() was the last
        // per-frame array realloc in the loop).
        retainInPlace(patrolPostsRef.current, (post: PatrolPost) => {
            const postDistrictId = getDistrictForPoint(post.pos);
            const district = districtsRef.current.find(d => d.id === postDistrictId);
            if (district) {
                // Floor at 1.0: in big districts the area divisor pushed net presence gain to
                // ~+0.01%/s (decay 0.42 vs boost 0.43) — physically patrolling barely moved the
                // meter. Presence must be the #1 meter-mover for the teaching goal to hold.
                const sizeModifier = Math.min(2.5, Math.max(1.0, 1000000 / (district.bounds.width * district.bounds.height)));
                const ruralMultiplier = district.id === 'Karori North' ? operationModifiers.ruralDeterrenceMultiplier : 1;
                const postBoost = CONSTANTS.DT_PRESENCE_BOOST_PER_SEC * sizeModifier * CONSTANTS.PATROL_POST_PRESENCE_MULTIPLIER * operationModifiers.patrolPostMultiplier * loadout.modifiers.patrolPost * operationModifiers.presenceRateMultiplier * loadout.modifiers.presenceRate * ruralMultiplier * dt;
                district.deterrence = Math.min(100, district.deterrence + postBoost);
            }
            post.remainingTime -= 60 * dt; // Decrement frame counter by scaled amount
            return post.remainingTime > 0;
        });
        
        districtsRef.current.forEach(district => {
            let decayMultiplier = 1.0;
            if (isNeglectOfDutyActiveRef.current) decayMultiplier = CONSTANTS.NEGLECT_OF_DUTY_DETERRENCE_DECAY_MULTIPLIER;
            district.deterrence = Math.max(0, district.deterrence - CONSTANTS.DT_DISTRICT_DECAY_PER_SEC * decayMultiplier * dt);
            
            if (district.id === playerDistrictId) {
                const sizeModifier = Math.min(2.5, Math.max(1.0, 1000000 / (district.bounds.width * district.bounds.height))); // floor: see patrol-post note above
                const ruralMultiplier = district.id === 'Karori North' ? operationModifiers.ruralDeterrenceMultiplier : 1;
                let boost = CONSTANTS.DT_PRESENCE_BOOST_PER_SEC * sizeModifier * roadFreshnessMultiplierRef.current;
                if (player.isSirenActive) boost += CONSTANTS.DT_SIREN_BOOST_PER_SEC;
                boost *= operationModifiers.presenceRateMultiplier * loadout.modifiers.presenceRate * ruralMultiplier * dt;
                district.deterrence = Math.min(100, district.deterrence + boost);
                presenceBoostRateRef.current = dt > 0 ? boost / dt : 0; // dt=0 during hit-stop → 0/0 NaN
            }
        });

        coverageQualityRef.current = computeCoverageQuality(districtsRef.current);
        coverageQualityIntegralRef.current += coverageQualityRef.current * dt;
        coverageTierRef.current = getCoverageTier(districtsRef.current.map(d => d.deterrence), CONSTANTS.DETERRENCE_VIGILANCE_THRESHOLD);
        isVigilanceBonusActiveRef.current = coverageTierRef.current.securedDistricts >= districtsRef.current.length;
        if (coverageTierRef.current.securedDistricts >= 3) securedCoverageSecondsRef.current += dt;
        if (!overtimeUsedRef.current) {
            earnedOvertimeSecondsRef.current = getEarnedOvertimeSeconds(securedCoverageSecondsRef.current);
        }

        // Presence Grade input: time with EVERY district ≥50%.

        // District stingers: crossing 85 (secured) / 33 (hotspot) had zero fanfare, hiding the
        // teaching thresholds. Hysteresis (leave secured <80, leave hotspot ≥38) stops flapping.
        // Messages ride gameMessage, so they also reach the aria-live region.
        for (const district of districtsRef.current) {
            const zones = districtZoneRef.current;
            const prevZone = zones[district.id];
            const d = district.deterrence;
            let zone = prevZone ?? (d >= CONSTANTS.DETERRENCE_VIGILANCE_THRESHOLD ? 'secured' : d < CONSTANTS.DETERRENCE_HOTSPOT_THRESHOLD ? 'hotspot' : 'mid');
            if (prevZone) {
                if (prevZone !== 'secured' && d >= CONSTANTS.DETERRENCE_VIGILANCE_THRESHOLD) zone = 'secured';
                else if (prevZone !== 'hotspot' && d < CONSTANTS.DETERRENCE_HOTSPOT_THRESHOLD) zone = 'hotspot';
                else if (prevZone === 'secured' && d < CONSTANTS.DETERRENCE_VIGILANCE_THRESHOLD - 5) zone = 'mid';
                else if (prevZone === 'hotspot' && d >= CONSTANTS.DETERRENCE_HOTSPOT_THRESHOLD + 5) zone = 'mid';
                if (zone !== prevZone && zone !== 'mid') {
                    setGameMessage(zone === 'secured' ? `${district.name.toUpperCase()} SECURED` : `HOTSPOT: ${district.name.toUpperCase()}`);
                    if (zone === 'secured') audio.tick(1000); else audio.thud();
                    if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
                    gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 2500);
                }
            }
            zones[district.id] = zone;
        }

        const deterrenceMultiplier = CONSTANTS.DETERRENCE_MULTIPLIER_MIN + (coverageQualityRef.current / 100) * (CONSTANTS.DETERRENCE_MULTIPLIER_MAX - CONSTANTS.DETERRENCE_MULTIPLIER_MIN);
        scoreRef.current.deterrence += (coverageQualityRef.current / 100) * CONSTANTS.DETERRENCE_SCORE_RATE * dt * coverageTierRef.current.scoreMultiplier * deterrenceMultiplier;

        const phase = getShiftPhase(elapsedShiftSecondsRef.current, CONSTANTS.SHIFT_DURATION, overtimeUsedRef.current);
        if (phase.id !== currentPhaseRef.current.id) {
            currentPhaseRef.current = phase;
            playRadio(`${phase.label}: ${phase.objective}.`);
        }

        if (elapsedShiftSecondsRef.current >= nextScoreSplitRef.current) {
            const liveScore = Math.round(scoreRef.current.enforcement + scoreRef.current.deterrence)
                + ((scoreRef.current.livesSaved - scoreRef.current.colleagueSaves) * CONSTANTS.LIVES_SAVED_SCORE_BONUS)
                + (scoreRef.current.colleagueSaves * CONSTANTS.COLLEAGUE_SAVE_SCORE_BONUS)
                - (scoreRef.current.livesLost * CONSTANTS.LIVES_LOST_PENALTY);
            scoreSplitsRef.current.push({
                atSeconds: nextScoreSplitRef.current,
                score: liveScore,
                coverageQuality: coverageQualityRef.current,
            });
            nextScoreSplitRef.current += 30;
        }

        const isPlayerStationary = player.speed < 0.1;
        const currentDistrict = districtsRef.current.find(d => d.id === playerDistrictId);
        const currentDeterrence = currentDistrict ? currentDistrict.deterrence : 0;
        const isInHighDeterrenceZone = currentDeterrence >= CONSTANTS.NEGLECT_OF_DUTY_DETERRENCE_THRESHOLD;

        if (isInHighDeterrenceZone && !wasInHighDeterrenceZoneRef.current) {
            stationaryStartTime.current = now;
        }
        wasInHighDeterrenceZoneRef.current = isInHighDeterrenceZone;
        
        if (isPlayerStationary) {
            if (stationaryStartTime.current === null) {
                stationaryStartTime.current = now;
                stationaryStartPosition.current = { ...player.pos };
            } else {
                const stationaryDuration = (now - stationaryStartTime.current) / 1000;

                const totalTime = isInHighDeterrenceZone ? CONSTANTS.NEGLECT_OF_DUTY_TIME_THRESHOLD : CONSTANTS.PATROL_POST_SETUP_TIME;
                const timeLeft = totalTime - stationaryDuration;
                const cd: StationaryCountdown = timeLeft > 0 ? { type: isInHighDeterrenceZone ? 'neglect' : 'patrolPost', timeLeft, totalTime } : null;
                // gd-0wi.6: only re-render when the displayed value changes (~10fps), not every frame.
                const cdSig = cd ? `${cd.type}:${Math.ceil(cd.timeLeft * 10)}` : 'null';
                if (cdSig !== lastCountdownSigRef.current) { lastCountdownSigRef.current = cdSig; setStationaryCountdown(cd); }

                if (isInHighDeterrenceZone && stationaryDuration > CONSTANTS.NEGLECT_OF_DUTY_TIME_THRESHOLD) {
                    isNeglectOfDutyActiveRef.current = true;
                }

                if (!isInHighDeterrenceZone && stationaryDuration > CONSTANTS.PATROL_POST_SETUP_TIME) {
                    const isPostNearby = patrolPostsRef.current.some(p => getDistanceSq(p.pos, player.pos) < (CONSTANTS.PATROL_POST_RADIUS * 2) ** 2);
                    if (!isPostNearby) {
                        patrolPostsRef.current.push({
                            id: now,
                            pos: { ...player.pos },
                            remainingTime: CONSTANTS.PATROL_POST_DURATION,
                        });
                        setGameMessage("PATROL POST ESTABLISHED");
                        if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
                        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 3000);
                    }
                    stationaryStartTime.current = null;
                }
            }
        } else {
            stationaryStartTime.current = null;
            if (lastCountdownSigRef.current !== 'null') { lastCountdownSigRef.current = 'null'; setStationaryCountdown(null); }
            if (isNeglectOfDutyActiveRef.current) {
                const movedFarEnough = stationaryStartPosition.current && getDistance(player.pos, stationaryStartPosition.current) > CONSTANTS.NEGLECT_OF_DUTY_RESET_DISTANCE;
                if (movedFarEnough) {
                    isNeglectOfDutyActiveRef.current = false;
                    stationaryStartPosition.current = null;
                }
            } else {
                stationaryStartPosition.current = null;
            }
        }
    };

    const handleRoadBoundaryCollision = (now: number) => {
        const player = playerRef.current;
        const roadInfo = findClosestPointOnRoad(player.pos);
        if (roadInfo && roadInfo.dist > CONSTANTS.ROAD_WIDTH / 2) {
            const roadEdgeBuffer = 2;
            const effectiveRoadWidth = CONSTANTS.ROAD_WIDTH / 2 - roadEdgeBuffer;
            const normalX = (player.pos.x - roadInfo.point.x) / roadInfo.dist;
            const normalY = (player.pos.y - roadInfo.point.y) / roadInfo.dist;
            player.pos.x = roadInfo.point.x + normalX * effectiveRoadWidth;
            player.pos.y = roadInfo.point.y + normalY * effectiveRoadWidth;
            const dot = player.vel.x * normalX + player.vel.y * normalY;
            if (dot < 0) {
                const restitution = 0.1;
                player.vel.x -= (1 + restitution) * dot * normalX;
                player.vel.y -= (1 + restitution) * dot * normalY;
                cameraRef.current.shake = Math.min(10, cameraRef.current.shake + 4);
                const sparkPos = { x: player.pos.x - normalX * (CONSTANTS.CAR_RADIUS - 5), y: player.pos.y - normalY * (CONSTANTS.CAR_RADIUS - 5) };
                sparksRef.current.push(...Array.from({ length: CONSTANTS.SPARK_COUNT }, (_, i) => ({ id: now + i + Math.random(), pos: sparkPos, vel: { x: (Math.random() - 0.5) * 4 - normalX * 2, y: (Math.random() - 0.5) * 4 - normalY * 2 }, spawnTime: now })));
            }
        }
    };

    const updateCiviliansAndSpawners = (now: number, dt: number, elapsedDt: number) => {
        const dtScale = 60 * dt;
        const elapsedScale = 60 * elapsedDt;
        const player = playerRef.current;
        const isSirenActive = player.isSirenActive;
        const playerForwardVec = { x: Math.cos(getRads(player.angle - 90)), y: Math.sin(getRads(player.angle - 90)) };

        const dispatch = dispatchedCallRef.current;
        if (dispatch?.active) {
            const target = civiliansRef.current.find(c => c.id === dispatch.targetVehicleId && c.isLifeAtRisk);
            if (!target) {
                recordDispatchOutcome(dispatch, 'failure');
            } else {
                dispatch.pos.x = target.pos.x;
                dispatch.pos.y = target.pos.y;
                dispatch.timeLeft -= elapsedDt;
                dispatch.targetTimeLeft = target.lifeAtRiskTimer;
                if (dispatch.timeLeft <= 0) {
                    scoreRef.current.livesSaved++;
                    scoreRef.current.colleagueSaves++;
                    const district = districtsRef.current.find(d => d.id === target.district);
                    if (district) {
                        const ruralMultiplier = district.id === 'Karori North' ? operationModifiers.ruralDeterrenceMultiplier : 1;
                        district.deterrence = Math.min(100, district.deterrence + CONSTANTS.COLLEAGUE_DETERRENCE_BOOST * ruralMultiplier);
                    }
                    civiliansRef.current = civiliansRef.current.filter(c => c.id !== target.id);
                    closeInterventionForVehicle(target.id);
                    floatingScoreTextsRef.current.push({ id: Math.random(), pos: { ...target.pos }, text: `COLLEAGUE SAVE +${CONSTANTS.COLLEAGUE_SAVE_SCORE_BONUS}`, spawnTime: now });
                    setGameMessage('COLLEAGUE ARRIVED · LIFE SAVED');
                    if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
                    gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 2200);
                    recordDispatchOutcome(dispatch, 'success', target.pos);
                    audio.zap();
                    buzz(BUZZ.success);
                }
            }
        }
        
        // Mid-shift dispatch chatter every ~25-40s. Queued intros (weather, champion) go first.
        if (nextRadioAtRef.current > 0 && now >= nextRadioAtRef.current) {
            nextRadioAtRef.current = now + 25000 + Math.random() * 15000;
            const queued = pendingRadioRef.current.shift();
            playRadio(queued ?? pickRadioChatter());
        }

        // Ambient car chatter: every ~8-16s a nearby law-abiding car says something very kiwi.
        if (now >= nextCarChatterAtRef.current) {
            nextCarChatterAtRef.current = now + 8000 + Math.random() * 8000;
            const nearby = civiliansRef.current.find(c => !c.ridsType && getDistanceSq(c.pos, player.pos) < 450 ** 2);
            if (nearby) {
                floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: nearby.pos.x, y: nearby.pos.y - 60 }, text: pickCarChatter(), spawnTime: now, variant: 'speech' });
            }
        }

        if (now - lastSpawnCheckTime.current > CONSTANTS.RIDS_SPAWN_INTERVAL) {
            lastSpawnCheckTime.current += CONSTANTS.RIDS_SPAWN_INTERVAL;
            const trafficCap = Math.min(CONSTANTS.MAX_CIVILIAN_CARS, Math.round(40 * operationModifiers.trafficMultiplier));
            if (civiliansRef.current.filter(c => !c.isChampion).length < trafficCap) {
                const carsByDistrict = civiliansRef.current.reduce((acc, c) => {
                    if (c.isChampion) return acc;
                    acc[c.district] = (acc[c.district] || 0) + 1; return acc;
                }, {} as Record<DistrictName, number>);
                for (const districtName in CONSTANTS.CIVILIAN_TARGET_DENSITY) {
                    const name = districtName as DistrictName;
                    const districtTarget = Math.max(1, Math.round(CONSTANTS.CIVILIAN_TARGET_DENSITY[name] * operationModifiers.trafficMultiplier));
                    if ((carsByDistrict[name] || 0) < districtTarget) {
                        spawnCivilian(name); break;
                    }
                }
            }
            const currentOffenders = civiliansRef.current.filter(c => c.ridsType).length;
            const coverageModifier = 1 - (coverageQualityRef.current / 100);
            const phasePressure = currentPhaseRef.current.id === 'establish' ? 0.35 : currentPhaseRef.current.id === 'respond' ? 0.75 : 1;
            const dynamicTarget = Math.ceil(CONSTANTS.TARGET_OFFENDER_COUNT * coverageModifier * phasePressure);
            // The final act guarantees a fair shot at the seeded priority car, but otherwise
            // successful deterrence remains causal and visibly suppresses ordinary offending.
            const priorityFloor = elapsedShiftSecondsRef.current >= 60 && !interdictionAssignedRef.current ? 2 : 0;
            const targetOffenders = Math.max(CONSTANTS.MIN_TARGET_OFFENDER_COUNT, priorityFloor, dynamicTarget);
            // Offences Prevented: the gap between the zero-deterrence offender population and
            // the deterrence-suppressed one, integrated over time (each suppressed "slot" turns
            // over roughly every OFFENCE_PREVENTED_TURNOVER_SECONDS). Float one flag per whole
            // offence so the counter visibly ties to sustained presence.
            const suppressed = Math.max(0, CONSTANTS.TARGET_OFFENDER_COUNT - targetOffenders);
            if (suppressed > 0) {
                const before = Math.floor(offencesPreventedRef.current);
                offencesPreventedRef.current += suppressed * (CONSTANTS.RIDS_SPAWN_INTERVAL / 1000) / CONSTANTS.OFFENCE_PREVENTED_TURNOVER_SECONDS;
                if (Math.floor(offencesPreventedRef.current) > before) {
                    floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: player.pos.x, y: player.pos.y - 90 }, text: 'OFFENCE PREVENTED', spawnTime: now });
                }
            }
            if (currentOffenders < targetOffenders) {
                // FAIRNESS (gd-zz7.16): every roll below comes from the seeded per-ordinal
                // schedule, not Math.random. The logic stays player-responsive (deterrence
                // weights, state-dependent LAR chance) — but two players making the same
                // choices meet the same offenders.
                const slot = slotAt(offenderSchedule, offenderOrdinalRef.current);
                const weightedDistricts = districtsRef.current.map(d => ({
                    districtId: d.id,
                    weight: (101 - d.deterrence)
                        * (d.deterrence < CONSTANTS.DETERRENCE_HOTSPOT_THRESHOLD ? 4 : 1)
                        * (operationModifiers.priorityDistrict === d.id ? 2.5 : 1),
                }));
                const totalWeight = weightedDistricts.reduce((sum, wd) => sum + wd.weight, 0);
                if (totalWeight > 0) {
                    let randomWeight = slot.uDistrict * totalWeight;
                    let districtToSpawnIn: DistrictName = weightedDistricts[weightedDistricts.length - 1].districtId;
                    for (const wd of weightedDistricts) {
                        randomWeight -= wd.weight;
                        if (randomWeight <= 0) { districtToSpawnIn = wd.districtId; break; }
                    }
                    const potentialCandidates = civiliansRef.current.filter(c => !c.ridsType && !c.isChampion && c.roadType && c.district === districtToSpawnIn);
                    if (potentialCandidates.length > 0) {
                        offenderOrdinalRef.current++; // slot consumed only when an offender is actually made
                        const carToOffend = potentialCandidates[Math.floor(slot.uCar * potentialCandidates.length)];
                        carToOffend.slotIndex = offenderOrdinalRef.current - 1;
                        const ridsChances = CONSTANTS.RIDS_SPAWN_CHANCE_BY_ROAD_TYPE[carToOffend.roadType!];
                        const rand = slot.uType; let cumulative = 0; let assignedRidsType: RIDSType | null = null;
                        for (const [type, chance] of Object.entries(ridsChances)) {
                            cumulative += chance as number; if (rand < cumulative) { assignedRidsType = type as RIDSType; break; }
                        }
                        if (operationModifiers.priorityRids && slot.uScenario < 0.45) assignedRidsType = operationModifiers.priorityRids;
                        if (assignedRidsType) {
                            carToOffend.ridsType = assignedRidsType;
                            offendersSpawnedRef.current++;
                            // The interdiction car: the schedule fixes WHICH ordinal carries it and
                            // which crime — same big one for everyone on the daily.
                            if (!interdictionAssignedRef.current
                                && timeLeftRef.current < CONSTANTS.SHIFT_DURATION - 15
                                && offenderOrdinalRef.current >= offenderSchedule.interdictionOrdinal) {
                                interdictionAssignedRef.current = true;
                                carToOffend.specialCrime = mapSeed
                                    ? interdictionAt(offenderSchedule.interdictionCrimeIndex)
                                    : pickInterdiction();
                                interdictionResultRef.current = {
                                    crime: carToOffend.specialCrime.crime,
                                    detail: carToOffend.specialCrime.missed,
                                    outcome: 'missed',
                                };
                                playRadio(`PRIORITY INTEL: ${observedEvidence(carToOffend)} in ${carToOffend.district}. Deep investigation required.`);
                            }
                            carToOffend.deterrenceBlobsRemaining = CONSTANTS.MAX_DETERRENCE_BLOBS_PER_OFFENDER;
                            carToOffend.lastBlobSpawnTime = now;
                            const speedTable = assignedRidsType === 'Speed' ? CONSTANTS.CIVILIAN_SPEEDING_SPEED : CONSTANTS.CIVILIAN_BASE_SPEED;
                            carToOffend.baseSpeed = (
                                speedTable[carToOffend.district] + (slot.uSpeed - 0.5) * CONSTANTS.CIVILIAN_SPEED_VARIATION
                            ) * VEHICLE_SPEED_MULT[carToOffend.vehicleType ?? 'car'] * currentWeatherRef.current.civilianSpeed;

                            const lifeAtRiskChance = computeLifeAtRiskChance(
                                CONSTANTS.LIFE_AT_RISK_DISTRICT_MODIFIER[carToOffend.district],
                                currentWeatherRef.current.larChance,
                                isVigilanceBonusActiveRef.current,
                                isNeglectOfDutyActiveRef.current,
                            );

                            const larCount = civiliansRef.current.filter(c => c.isLifeAtRisk).length;
                            if (elapsedShiftSecondsRef.current >= 25 && larCount < operationModifiers.maxSimultaneousLifeAtRisk && slot.uLar < lifeAtRiskChance) {
                                carToOffend.isLifeAtRisk = true;
                                let timer = CONSTANTS.LIFE_AT_RISK_TIMER_SECONDS;
                                if (isNeglectOfDutyActiveRef.current) timer *= CONSTANTS.NEGLECT_OF_DUTY_LAR_TIMER_MULTIPLIER;
                                carToOffend.lifeAtRiskTimer = timer;
                                // Announce onset (a11y C2): the pulsing red car was visual-only.
                                setGameMessage('LIFE AT RISK: RESPOND NOW');
                                if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
                                gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 2500);
                            }
                        }
                    }
                }
            }
        }
        
        retainInPlace(civiliansRef.current, (c: Civilian) => {
            if (c.isLifeAtRisk) {
                c.lifeAtRiskTimer -= elapsedDt;
                if (c.lifeAtRiskTimer <= 0) {
                    const call = dispatchedCallRef.current;
                    if (call?.targetVehicleId === c.id) recordDispatchOutcome(call, 'failure', c.pos);
                    closeInterventionForVehicle(c.id);
                    scoreRef.current.livesLost++;
                    explosionsRef.current.push({ id: Math.random(), pos: c.pos, spawnTime: now });
                    audio.thud();
                    buzz(BUZZ.fail); // failure state: heavier than an intervention
                    cameraRef.current.shake = 10;
                    hitStopUntilRef.current = performance.now() + 110; // presentation clock; gameplay clock freezes
                    setGameMessage('LIFE LOST');
                    if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
                    gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 2000);
                    return false;
                }
                if (!c.patrolPostBonusApplied) {
                    const postInRange = patrolPostsRef.current.find(post => getDistanceSq(c.pos, post.pos) < CONSTANTS.PATROL_POST_RADIUS ** 2);
                    if (postInRange) {
                        c.lifeAtRiskTimer += CONSTANTS.PATROL_POST_LAR_TIME_BONUS_SECONDS;
                        c.patrolPostBonusApplied = true;
                        setGameMessage(`PATROL POST ASSIST: +${CONSTANTS.PATROL_POST_LAR_TIME_BONUS_SECONDS}s`);
                        if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
                        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 3000);
                    }
                }
            }
            if (c.pathIndex >= c.path.length) {
                const pathRng = c.isChampion ? championRng : gameplayRng;
                const newPath = generateNewPath(undefined, c.path[c.path.length - 1], undefined, pathRng);
                if (newPath && newPath.length > 1) { c.path = newPath; c.pathIndex = 1; } 
                else { return false; }
            }
            const startNode = nodeMap.get(c.path[c.pathIndex - 1]);
            const endNode = nodeMap.get(c.path[c.pathIndex]);
            if (!startNode || !endNode) return false;
            const key = [startNode.id, endNode.id].sort().join('-');
            const segment = segmentLookup.get(key);
            if (segment) c.roadType = segment.type;
            const targetPos = endNode.pos;
            const segmentVec = { x: targetPos.x - startNode.pos.x, y: targetPos.y - startNode.pos.y };
            const segmentLen = Math.sqrt(segmentVec.x ** 2 + segmentVec.y ** 2) || 1;
            const segmentDir = { x: segmentVec.x / segmentLen, y: segmentVec.y / segmentLen };
            let targetSpeed = c.baseSpeed;

            // Boost near-miss: an airy whoosh when threading traffic at speed (rate-limited).
            if (player.isBoosting && now - lastWhooshAtRef.current > 350 && getDistanceSq(player.pos, c.pos) < 90 ** 2) {
                lastWhooshAtRef.current = now;
                audio.whoosh();
            }

            c.isYieldingToSiren = false;
            if (isSirenActive) {
                const distSq = getDistanceSq(player.pos, c.pos);
                if (distSq < CONSTANTS.SIREN_YIELD_RADIUS ** 2) {
                    const toCivilianVec = { x: c.pos.x - player.pos.x, y: c.pos.y - player.pos.y };
                    const toCivilianLen = Math.sqrt(toCivilianVec.x**2 + toCivilianVec.y**2) || 1;
                    const toCivilianDir = { x: toCivilianVec.x / toCivilianLen, y: toCivilianVec.y / toCivilianLen };
                    const dot = playerForwardVec.x * toCivilianDir.x + playerForwardVec.y * toCivilianDir.y;
                    if (dot > 0.5) {
                        c.isYieldingToSiren = true;
                    }
                }
            }

            if (c.isYieldingToSiren) {
                targetSpeed *= CONSTANTS.SIREN_YIELD_SLOWDOWN_FACTOR;
            } else if (c.ridsType === 'Speed') {
                targetSpeed *= CONSTANTS.RIDS_SPEED_BEHAVIOR_MULTIPLIER;
            } else if (c.ridsType === 'Distractions') {
                c.speedFluctuationTimer = (c.speedFluctuationTimer || 0) - elapsedScale;
                if (c.speedFluctuationTimer <= 0) {
                    c.speedFluctuationTimer = gameplayRng() * 120 + 60;
                    c.speedFluctuationTarget = 0.5 + gameplayRng();
                }
                targetSpeed *= c.speedFluctuationTarget!;
            }

            c.speed += (targetSpeed - c.speed) * Math.min(1, 0.08 * dtScale);
            c.isBraking = c.speed > targetSpeed + 0.1;
            c.pos.x += segmentDir.x * c.speed * dtScale;
            c.pos.y += segmentDir.y * c.speed * dtScale;
            if (c.vehicleType === 'camper' && !c.ridsType) {
                // Tourist wander: gentle lane drift, well short of the impaired swerve.
                c.swerveAngle = ((c.swerveAngle || 0) + 0.025 * dtScale) % (Math.PI * 2);
                const drift = Math.sin(c.swerveAngle) * 0.7 * dtScale;
                c.pos.x += -segmentDir.y * drift;
                c.pos.y += segmentDir.x * drift;
            }
            if (c.ridsType === 'Impairment') {
                c.swerveAngle = ((c.swerveAngle || 0) + 0.04 * dtScale) % (Math.PI * 2);
                // gd-0wi.9: inline the perpendicular (no per-car perpVec allocation).
                const swerve = Math.sin(c.swerveAngle) * 2 * dtScale;
                c.pos.x += -segmentDir.y * swerve;
                c.pos.y += segmentDir.x * swerve;
            }
            c.angle = Math.atan2(segmentDir.y, segmentDir.x) * (180 / Math.PI) + 90;
            c.vel.x = segmentDir.x * c.speed; c.vel.y = segmentDir.y * c.speed;
            // gd-0wi.9: inline the dot product (no per-car carVec allocation).
            const distAlongSegment = (c.pos.x - startNode.pos.x) * segmentDir.x + (c.pos.y - startNode.pos.y) * segmentDir.y;
            if (distAlongSegment >= segmentLen) {
                c.pos.x = targetPos.x; c.pos.y = targetPos.y; // mutate in place (no allocation)
                c.pathIndex++;
            }
            const currentDistrict = getDistrictForPoint(c.pos);
            if (currentDistrict !== c.district) {
                c.district = currentDistrict;
                c.zone = currentDistrict === 'Karori North' ? 'Rural' : 'Suburban';
            }
            const currentVigilanceBonus = CONSTANTS.VIGILANCE_AURA_BONUS_MAX * (playerRef.current.vigilance / 100);
            const baseAuraRadius = playerRef.current.isSirenActive ? CONSTANTS.PLAYER_SIREN_AURA_RADIUS : CONSTANTS.PLAYER_AURA_RADIUS;
            const auraRadius = (baseAuraRadius + currentVigilanceBonus) * operationModifiers.presenceAuraMultiplier;
            if (c.ridsType && c.deterrenceBlobsRemaining > 0 && now - c.lastBlobSpawnTime > CONSTANTS.DETERRENCE_BLOB_SPAWN_INTERVAL && getDistanceSq(c.pos, playerRef.current.pos) < auraRadius ** 2) {
                deterrenceBlobsRef.current.push({ id: Math.random(), pos: { ...c.pos }, vel: { x: 0, y: 0 }, value: CONSTANTS.DETERRENCE_BLOB_BASE_VALUE, spawnTime: now });
                c.lastBlobSpawnTime += CONSTANTS.DETERRENCE_BLOB_SPAWN_INTERVAL;
                c.deterrenceBlobsRemaining -= 1;
            }
            return true;
        });
    };

    const updateParticlesAndEffects = (now: number, dt: number) => {
        const dtScale = 60 * dt;
        const playerPos = playerRef.current.pos;
        const currentVigilanceBonus = CONSTANTS.VIGILANCE_AURA_BONUS_MAX * (playerRef.current.vigilance / 100);
        const baseAuraRadius = playerRef.current.isSirenActive ? CONSTANTS.PLAYER_SIREN_AURA_RADIUS : CONSTANTS.PLAYER_AURA_RADIUS;
        const auraRadius = (baseAuraRadius + currentVigilanceBonus) * operationModifiers.presenceAuraMultiplier;

        retainInPlace(deterrenceBlobsRef.current, (blob: DeterrenceBlobType) => {
            if (now - blob.spawnTime > CONSTANTS.DETERRENCE_BLOB_LIFESPAN) return false;
            if (getDistanceSq(playerPos, blob.pos) < auraRadius ** 2) {
                const dist = getDistance(playerPos, blob.pos);
                if (dist > 1) { blob.vel.x += ((playerPos.x - blob.pos.x) / dist) * 0.6; blob.vel.y += ((playerPos.y - blob.pos.y) / dist) * 0.6; }
            }
            blob.vel.x *= 0.92; blob.vel.y *= 0.92;
            const speed = Math.sqrt(blob.vel.x**2 + blob.vel.y**2); if (speed > CONSTANTS.DETERRENCE_BLOB_SPEED) { const r = CONSTANTS.DETERRENCE_BLOB_SPEED / speed; blob.vel.x *= r; blob.vel.y *= r; }
            blob.pos.x += blob.vel.x * dtScale; blob.pos.y += blob.vel.y * dtScale;
            if (getDistanceSq(playerPos, blob.pos) < 25 ** 2) {
                const playerDistrictId = getDistrictForPoint(playerPos);
                const district = districtsRef.current.find(d => d.id === playerDistrictId);
                if (district) {
                    const ruralMultiplier = district.id === 'Karori North' ? operationModifiers.ruralDeterrenceMultiplier : 1;
                    district.deterrence = Math.min(100, district.deterrence + blob.value * 4 * ruralMultiplier);
                }
                collectionEffectsRef.current.push({ id: Math.random(), pos: blob.pos, spawnTime: now });
                audio.pickup();
                return false;
            } return true;
        });
        
        retainInPlace(collectionEffectsRef.current, (e: CollectionEffectType) => now - e.spawnTime < 400);
        // Speech bubbles linger longer than score floats so they can actually be read.
        retainInPlace(floatingScoreTextsRef.current, (f: FloatingScoreTextType) =>
            now - f.spawnTime < (f.variant === 'speech' ? CONSTANTS.SPEECH_BUBBLE_LIFESPAN : CONSTANTS.FLOATING_SCORE_TEXT_LIFESPAN));
        // Sparks: advance position in place (was `.map(s => ({...s, pos:{...}}))` — a fresh object per
        // spark per frame) then compact by age. No per-frame allocation.
        for (const s of sparksRef.current) { s.pos.x += s.vel.x * dtScale; s.pos.y += s.vel.y * dtScale; }
        retainInPlace(sparksRef.current, (s: SparkParticle) => now - s.spawnTime < CONSTANTS.SPARK_LIFESPAN);
        retainInPlace(skidMarksRef.current, (skid: SkidMark) => now - skid.spawnTime < CONSTANTS.SKID_MARK_LIFESPAN);
        retainInPlace(tireSmokeRef.current, (smoke: TireSmokeParticle) => now - smoke.spawnTime < CONSTANTS.TIRE_SMOKE_PARTICLE_LIFESPAN);
        retainInPlace(explosionsRef.current, (exp: ExplosionType) => now - exp.spawnTime < CONSTANTS.EXPLOSION_LIFESPAN);
    };

    const updatePathfinding = (now: number) => {
        if (now - lastPathfindTime.current > PATHFINDING_INTERVAL) {
            lastPathfindTime.current = now;
            let target: Civilian | null = null;
            const lifeAtRiskCars = civiliansRef.current.filter(c => c.isLifeAtRisk);
            
            if (lifeAtRiskCars.length > 0) {
                target = lifeAtRiskCars.reduce((closest, car) => getDistanceSq(playerRef.current.pos, car.pos) < getDistanceSq(playerRef.current.pos, closest.pos) ? car : closest);
            }

            if (target) {
                pathfindingTargetIdRef.current = target.id;
                const playerNode = findClosestNode(playerRef.current.pos);
                let targetNodeId: string | undefined = (target.path && target.pathIndex < target.path.length) ? target.path[target.pathIndex] : findClosestNode(target.pos)?.node.id;
                
                if (playerNode && targetNodeId && playerNode.node.id !== targetNodeId) {
                    const pathNodeIds = findShortestPath(playerNode.node.id, targetNodeId);
                    highlightedPathRef.current = pathNodeIds ? pathNodeIds.map(id => nodeMap.get(id)!.pos) : null;
                } else {
                    highlightedPathRef.current = null;
                }
            } else {
                pathfindingTargetIdRef.current = null;
                highlightedPathRef.current = null;
            }
        }
    };
    
    const updateCamera = (now: number, dt: number) => {
        const player = playerRef.current;
        const container = containerRef.current;
        let baseZoom = 1;
        if (container) {
            const rect = container.getBoundingClientRect();
            baseZoom = Math.min(rect.width / CONSTANTS.VIEWPORT_WIDTH, rect.height / CONSTANTS.VIEWPORT_HEIGHT);
        }
        const dynamicZoom = player.isBoosting ? 0.85 : (isBrakingRef.current && player.speed > 2 ? 1.02 : 1.0);
        const targetZoom = baseZoom * dynamicZoom;
        // Frame-rate-independent exponential smoothing (gd-0wi.5).
        const camLerp = (base: number) => 1 - Math.pow(1 - base, dt * CONSTANTS.FRAMES_PER_SECOND);
        cameraRef.current.zoom += (targetZoom - cameraRef.current.zoom) * camLerp(0.04);
        if (player.isBoosting) cameraRef.current.shake = Math.max(cameraRef.current.shake, 4);
        cameraRef.current.shake *= Math.pow(0.92, dt * CONSTANTS.FRAMES_PER_SECOND);

        const lookAheadDist = player.speed * 8;
        const rads = getRads(player.angle - 90);
        const targetPos = { x: player.pos.x + Math.cos(rads) * lookAheadDist, y: player.pos.y + Math.sin(rads) * lookAheadDist };
        cameraPosRef.current.x += (targetPos.x - cameraPosRef.current.x) * camLerp(0.05);
        cameraPosRef.current.y += (targetPos.y - cameraPosRef.current.y) * camLerp(0.05);
        cameraRef.current.x = cameraPosRef.current.x;
        cameraRef.current.y = cameraPosRef.current.y;
    };

  const handleInvestigate = useCallback(() => {
    // The default timer and a user confirmation can race inside one frame.
    if (ridsPhaseRef.current !== 'choice') return;
    const target = activeRidsRef.current?.car;
    if (slamStartedRef.current || timeLeftRef.current <= 0 || !target || !civiliansRef.current.some(car => car.id === target.id)) {
        closeActiveIntervention();
        return;
    }
    if (investigationsRemainingRef.current <= 0) {
        setRidsChoiceSelection('standard');
        setGameMessage('NO DEEP INVESTIGATIONS REMAINING');
        return;
    }
    ridsPhaseRef.current = 'minigame';
    investigationsRemainingRef.current--;
    interventionStatsRef.current.investigate++;
    // A deeper investigation costs shift time and offers a higher reward.
    spendShiftTime(CONSTANTS.ENFORCE_TIME_COST_SECONDS);
    // Every investigation runs a mini-game (alcohol=breath test, Speed=slider,
    // Restraints/Distractions=deterrence-concept check) — this is what makes the retooled
    // concept mini-game reachable. Scoring, LAR and dispatch handling all live in
    // onMiniGameComplete. The standard enforcement action stays quick and lower reward.
    setGameState('MiniGame');
  }, [closeActiveIntervention, spendShiftTime]);
  
  // Shared resolution for a standard action or successful investigation: awards score
  // bonus), grows vigilance, floats the score/vigilance text, boosts district deterrence,
  // records the action, removes the offender, and credits a life saved.
  const resolveIntervention = useCallback((car: Civilian, baseScore: number, deterrenceBoost: number, actionType: EnforcementAction['actionType'], shake: number): boolean => {
    if (slamStartedRef.current || timeLeftRef.current <= 0 || !civiliansRef.current.some(candidate => candidate.id === car.id)) return false;
    let scoreToAdd = baseScore;
    scoreToAdd = Math.round(scoreToAdd * coverageTierRef.current.scoreMultiplier);
    const nowMs = simulationTimeRef.current;
    const combo = comboRef.current;
    // Reading/teaching time is paused, and standard actions cannot grow the investigation combo.
    if (actionType === 'Investigate') {
        combo.count = nowMs < combo.expiresAt ? combo.count + 1 : 1;
        combo.expiresAt = nowMs + CONSTANTS.COMBO_WINDOW_MS;
        combo.mult = Math.min(CONSTANTS.COMBO_MAX_MULT, 1 + CONSTANTS.COMBO_STEP * (combo.count - 1));
        scoreToAdd = Math.round(scoreToAdd * combo.mult);
        audio.zap(1 + 0.15 * (combo.count - 1));
        if (combo.count >= 2) {
            floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: car.pos.x, y: car.pos.y - 100 }, text: `COMBO ×${combo.mult}`, spawnTime: nowMs });
        }
    } else {
        audio.zap();
    }
    if (!reducedMotion()) cameraRef.current.zoom *= 1.05; // zoom punch; the camera lerp eases it back
    scoreRef.current.enforcement += scoreToAdd;
    playerRef.current.vigilance = Math.min(CONSTANTS.VIGILANCE_MAX, playerRef.current.vigilance + CONSTANTS.VIGILANCE_GAIN_ON_INTERVENTION);
    floatingScoreTextsRef.current.push({ id: Math.random(), pos: { ...car.pos }, text: `+${scoreToAdd}`, spawnTime: nowMs });
    floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: playerRef.current.pos.x, y: playerRef.current.pos.y - 60 }, text: `VIGILANCE +${CONSTANTS.VIGILANCE_GAIN_ON_INTERVENTION}`, spawnTime: nowMs });
    const district = districtsRef.current.find(d => d.id === car.district);
    const effectiveDeterrenceBoost = deterrenceBoost * (district?.id === 'Karori North' ? operationModifiers.ruralDeterrenceMultiplier : 1);
    // Float the TEACHING number too — the deterrence boost was invisible while points weren't.
    floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: car.pos.x, y: car.pos.y - 40 }, text: `+${Math.round(effectiveDeterrenceBoost)} DETERRENCE`, spawnTime: nowMs });
    if (district) district.deterrence = Math.min(100, district.deterrence + effectiveDeterrenceBoost);
    buzz(BUZZ.success);
    enforcementActionsRef.current.push({ pos: { ...car.pos }, ridsType: car.ridsType!, actionType, atSeconds: elapsedShiftSecondsRef.current, scoreDelta: scoreToAdd });
    civiliansRef.current = civiliansRef.current.filter(c => c.id !== car.id);
    const call = dispatchedCallRef.current;
    if (call?.targetVehicleId === car.id) recordDispatchOutcome(call, 'failure', car.pos);
    if (shake) cameraRef.current.shake = shake;
    // The driver has opinions (very kiwi ones).
    floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: car.pos.x, y: car.pos.y - 70 }, text: actionType === 'Standard' ? pickStandardActionReaction() : pickInvestigateReaction(), spawnTime: nowMs, variant: 'speech' });
    // The interdiction car requires the deeper investigation to uncover it.
    if (car.specialCrime) {
        if (actionType === 'Investigate') {
            interdictionResultRef.current = { crime: car.specialCrime.crime, detail: car.specialCrime.detail, outcome: 'busted' };
            scoreRef.current.enforcement += CONSTANTS.INTERDICTION_BONUS;
            hitStopUntilRef.current = performance.now() + 110; // presentation clock; gameplay clock freezes
            buzz(BUZZ.epic);
            audio.zap();
            setGameMessage(`${car.specialCrime.reveal}  +${CONSTANTS.INTERDICTION_BONUS}`);
            if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
            gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 3500);
            floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: car.pos.x, y: car.pos.y - 140 }, text: `${car.specialCrime.reveal} +${CONSTANTS.INTERDICTION_BONUS}`, spawnTime: nowMs });
        } else {
            interdictionResultRef.current = { crime: car.specialCrime.crime, detail: car.specialCrime.missed, outcome: 'missed' };
        }
    }
    if (car.isLifeAtRisk) {
        scoreRef.current.livesSaved++;
        // Clutch save: resolved with under 3s on the LAR clock — small bonus, big feeling.
        if (car.lifeAtRiskTimer < 3) {
            scoreRef.current.enforcement += CONSTANTS.CLUTCH_SAVE_BONUS;
            floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: car.pos.x, y: car.pos.y - 110 }, text: `CLUTCH SAVE +${CONSTANTS.CLUTCH_SAVE_BONUS}`, spawnTime: nowMs });
            audio.zap();
        }
    }
    return true;
  }, [operationModifiers.ruralDeterrenceMultiplier, recordDispatchOutcome]);

  const handleStandard = useCallback(() => {
      if (ridsPhaseRef.current !== 'choice') return;
      const target = activeRidsRef.current?.car;
      if (slamStartedRef.current || timeLeftRef.current <= 0 || !target || !civiliansRef.current.some(car => car.id === target.id)) {
        closeActiveIntervention();
        return;
      }
      ridsPhaseRef.current = 'idle';
      interventionStatsRef.current.standard++;
      // zap now plays inside resolveIntervention with the combo pitch ladder
      resolveIntervention(target, Math.round(CONSTANTS.STANDARD_ACTION_SCORE_POINTS * operationModifiers.standardScoreMultiplier), CONSTANTS.STANDARD_ACTION_DETERRENCE_BOOST, 'Standard', 0);
      closeActiveIntervention();
  }, [closeActiveIntervention, operationModifiers.standardScoreMultiplier, resolveIntervention]);
    
  // Keyboard controls for RIDS Choice modal
  useEffect(() => {
    if (gameState === 'RidsChoice' && !isGameplayPaused) {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return; // a held SPACE (from the RIDS check) must not auto-confirm the choice
            if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
                setRidsChoiceSelection('standard');
            } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
                setRidsChoiceSelection('investigate');
            } else if (e.key === 'Enter' || e.key === ' ') {
                // If a dialog button has keyboard focus, let its native activation fire — don't also
                // fire here as well.
                const active = document.activeElement as HTMLElement | null;
                if (active?.tagName === 'BUTTON' && active.closest('[role="dialog"]')) return;
                e.preventDefault();
                if (ridsChoiceSelection === 'standard') {
                    handleStandard();
                } else {
                    handleInvestigate();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [gameState, isGameplayPaused, ridsChoiceSelection, handleStandard, handleInvestigate]);

  // Gamepad controls for the RIDS Choice modal. Pad polling normally lives in the game loop,
  // which halts outside Playing/Starting — so a pad-only player could OPEN the modal (button A)
  // but never answer it. Poll here while the choice is up:
  // stick/d-pad selects, A confirms. Edge state starts pressed so the A that opened the modal
  // doesn't instantly confirm.
  useEffect(() => {
    if (gameState !== 'RidsChoice' || isGameplayPaused) return;
    let raf = 0;
    let prevA = true, prevLeft = true, prevRight = true;
    const poll = () => {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        let gp: Gamepad | null = null;
        for (const p of pads) { if (p && p.connected) { gp = p; break; } }
        if (gp) {
            const axis = gp.axes[0] || 0;
            const a = !!gp.buttons[0]?.pressed;
            const left = !!gp.buttons[14]?.pressed || axis < -0.5;
            const right = !!gp.buttons[15]?.pressed || axis > 0.5;
            if (left && !prevLeft) setRidsChoiceSelection('standard');
            if (right && !prevRight) setRidsChoiceSelection('investigate');
            if (a && !prevA) { if (ridsChoiceSelection === 'standard') handleStandard(); else handleInvestigate(); }
            prevA = a; prevLeft = left; prevRight = right;
        }
        raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [gameState, isGameplayPaused, ridsChoiceSelection, handleStandard, handleInvestigate]);

  const gameLoop = useCallback((frameNow: number) => {
    const presentationNow = frameNow || performance.now();
    
    if (timeLeftRef.current <= 0) {
        if (gameOverFiredRef.current) return;
        const earnedOvertime = getEarnedOvertimeSeconds(securedCoverageSecondsRef.current);
        // Overtime is earned from cumulative secured coverage, not a final-frame threshold.
        if (!overtimeUsedRef.current && earnedOvertime > 0) {
            overtimeUsedRef.current = true;
            earnedOvertimeSecondsRef.current = earnedOvertime;
            timeLeftRef.current = earnedOvertime;
            lastBeepedSecondRef.current = earnedOvertime + 1;
            playRadio(`OVERTIME APPROVED. Secured coverage earned ${earnedOvertime} more seconds.`);
            audio.zap();
            buzz(BUZZ.overtime);
            hitStopUntilRef.current = presentationNow + 110;
        } else if (!slamStartedRef.current) {
            // SHIFT OVER slam: freeze the world for a beat with the stamp on screen, then
            // the results mount. The live region announces; GameOver's h1 takes focus after.
            slamStartedRef.current = true;
            closeActiveIntervention();
            slamAtRef.current = presentationNow;
            hitStopUntilRef.current = presentationNow + CONSTANTS.SHIFT_END_SLAM_MS;
            setShowSlam(true);
            audio.thud();
            buzz(BUZZ.overtime);
            setGameMessage('SHIFT OVER');
            if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
        } else if (presentationNow - slamAtRef.current >= CONSTANTS.SHIFT_END_SLAM_MS) {
            gameOverFiredRef.current = true;
            const coverageRatio = Math.min(1, coverageQualityIntegralRef.current / Math.max(1, elapsedShiftSecondsRef.current * 100));
            if (!scoreSplitsRef.current.length || scoreSplitsRef.current[scoreSplitsRef.current.length - 1].atSeconds < elapsedShiftSecondsRef.current) {
                scoreSplitsRef.current.push({
                    atSeconds: Math.round(elapsedShiftSecondsRef.current),
                    score: computeScoreBreakdown(scoreRef.current, districtsRef.current).finalScore,
                    coverageQuality: coverageQualityRef.current,
                });
            }
            const finalBreakdown: FinalScoreBreakdown = {
                ...computeScoreBreakdown(scoreRef.current, districtsRef.current),
                patrolPath: patrolPathRef.current,
                patrolTimeline: patrolTimelineRef.current,
                scoreSplits: scoreSplitsRef.current,
                enforcementActions: enforcementActionsRef.current,
                colleagueCallActions: colleagueCallActionsRef.current,
                offencesPrevented: Math.floor(offencesPreventedRef.current),
                livesSaved: scoreRef.current.livesSaved,
                livesLost: scoreRef.current.livesLost,
                interdiction: interdictionResultRef.current,
                overtime: overtimeUsedRef.current,
                coverageRatio,
                presenceGrade: getPresenceGrade(coverageRatio),
                coverageQuality: coverageRatio * 100,
                securedCoverageSeconds: securedCoverageSecondsRef.current,
                earnedOvertimeSeconds: earnedOvertimeSecondsRef.current,
                roadStats: {
                    uniqueSegments: roadFreshnessRef.current.uniqueSegments,
                    repeatRatio: roadRepeatEntryRatio(roadFreshnessRef.current),
                    bestPresenceChain: bestPresenceChainRef.current,
                },
                interventionStats: interventionStatsRef.current,
                potentialOffences: offendersSpawnedRef.current + Math.floor(offencesPreventedRef.current),
                districtReport: districtsRef.current.map(district => ({
                    id: district.id,
                    finalDeterrence: district.deterrence,
                    patrolSamples: patrolSamplesByDistrictRef.current[district.id],
                })),
                challengeAssist,
            };
            onGameOver(finalBreakdown);
            return;
        }
    }

    // Delta time calculation
    if (lastTimeRef.current === 0) lastTimeRef.current = presentationNow;
    const rawDt = Math.max(0, (presentationNow - lastTimeRef.current) / 1000);
    let requestedDt = presentationNow < hitStopUntilRef.current ? 0 : rawDt;
    if (presentationNow < slowmoUntilRef.current) requestedDt *= CONSTANTS.SLOWMO_SCALE;
    if (gameStateRef.current !== 'Playing') requestedDt *= challengeAssist ? 0 : 0.45;
    const stepPlan = planSimulationSteps(requestedDt, MAX_SIMULATION_STEP_SECONDS, MAX_SIMULATION_STEPS_PER_FRAME);
    lastTimeRef.current = presentationNow;

    const slamming = slamStartedRef.current && !gameOverFiredRef.current;
    if (!slamming) {
        for (let i = 0; i < stepPlan.count; i++) {
            const phaseBeforeStep = ridsPhaseRef.current;
            const clock = advanceShiftClock(timeLeftRef.current, elapsedShiftSecondsRef.current, stepPlan.step);
            if (clock.spent <= 0) break;
            timeLeftRef.current = clock.timeLeft;
            elapsedShiftSecondsRef.current = clock.elapsed;
            if (gameStateRef.current !== 'Playing') interventionStatsRef.current.modalSeconds += clock.spent;
            simulationTimeRef.current += clock.spent * 1000;
            const stepNow = simulationTimeRef.current;

            updatePlayerMovement(stepNow, clock.spent, clock.spent);
            updateVigilance(clock.spent);
            updateCiviliansAndSpawners(stepNow, clock.spent, clock.spent);
            updateDeterrenceAndNeglect(stepNow, clock.spent);
            handleRoadBoundaryCollision(stepNow);
            updatePathfinding(stepNow);
            updateParticlesAndEffects(stepNow, clock.spent);
            updateCamera(stepNow, clock.spent);

            if ((phaseBeforeStep === 'idle' && ridsPhaseRef.current !== 'idle') || performance.now() < hitStopUntilRef.current) break;
        }
    }
    const now = simulationTimeRef.current;

    const ghostSample = pbReplay
        ? sampleReplayRoute(pbReplay.route, elapsedShiftSecondsRef.current * 1000)
        : null;
    if (ghostSample && ghostPosRef.current) Object.assign(ghostPosRef.current, ghostSample);
    else ghostPosRef.current = ghostSample;

    // Combo window expiry: soft cue, no live-region spam (a11y-lead guidance).
    if (comboRef.current.count > 1 && now > comboRef.current.expiresAt) {
        comboRef.current.count = 0;
        comboRef.current.mult = 1;
        audio.tick(320);
        buzz(20);
    }
    
    // Draw to canvas
    const canvas = canvasRef.current;
    let drawOk = false;
    if (canvas && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const cssWidth = Math.max(1, Math.round(rect.width));
        const cssHeight = Math.max(1, Math.round(rect.height));
        const dpr = getCanvasRenderScale(
            cssWidth,
            cssHeight,
            window.devicePixelRatio || 1,
            CONSTANTS.MAX_RENDER_DPR,
            CONSTANTS.MAX_CANVAS_PIXELS,
        );
        viewportRef.current.width = cssWidth;
        viewportRef.current.height = cssHeight;
        if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
            canvas.width = Math.round(cssWidth * dpr);
            canvas.height = Math.round(cssHeight * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
            try {
                // Clear full pixel buffer (not just CSS-sized area)
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const renderState: RenderState = {
                    player: playerRef.current,
                    civilians: civiliansRef.current,
                    sparks: sparksRef.current,
                    skidMarks: skidMarksRef.current,
                    tireSmoke: tireSmokeRef.current,
                    floatingScoreTexts: floatingScoreTextsRef.current,
                    deterrenceBlobs: deterrenceBlobsRef.current,
                    collectionEffects: collectionEffectsRef.current,
                    explosions: explosionsRef.current,
                    patrolPosts: patrolPostsRef.current,
                    highlightedPath: highlightedPathRef.current,
                    pathfindingTargetId: pathfindingTargetIdRef.current,
                    targetedCarId: targetedCarId,
                    isBraking: isBrakingRef.current,
                    playerAuraMultiplier: operationModifiers.presenceAuraMultiplier,
                    ghost: ghostPosRef.current,
                    championName: championName ?? null,
                    showRidsMarkers: challengeAssist,
                    ghostActions: pbReplay?.actions,
                    ghostElapsedMs: elapsedShiftSecondsRef.current * 1000,
                };
                drawGame(ctx, cssWidth, cssHeight, cameraRef.current, renderState, now);
                drawOk = true;
            } catch (e) {
                console.error('Draw error:', e);
            }
        }
    }

    // Update debug info periodically (only when ?debug is in URL — saves ~2 React re-renders/sec in production)
    if (isDebugMode && presentationNow % 500 < 20) {
        setDebugInfo(`loop:${gameState} canvas:${canvas ? 'yes' : 'no'} sz:${canvas?.width}x${canvas?.height} draw:${drawOk} cam:${cameraRef.current.zoom.toFixed(2)} cars:${civiliansRef.current.length}`);
    }

    // Periodic HUD refresh
    if (presentationNow - lastHudUpdateRef.current > HUD_UPDATE_INTERVAL_MS) {
        lastHudUpdateRef.current = presentationNow;
        setHudTick(t => t + 1);
        // Modulate engine drone with current speed (~10 Hz update rate, lerped over 100ms inside audio.ts)
        audio.setEngineLevel(playerRef.current.speed / CONSTANTS.PLAYER_MAX_SPEED);
    }

    // Time-pressure ticks: one short beep on each integer-second crossing in the
    // final 10 seconds, with rising pitch. Final-zero plays a zap. lastBeepedSecondRef
    // is reset to 11 on game-state → 'Playing' so each shift gets the full sequence.
    if (gameState !== 'Starting') {
        const seconds = Math.ceil(timeLeftRef.current);
        if (seconds <= 10 && seconds > 0 && seconds !== lastBeepedSecondRef.current) {
            lastBeepedSecondRef.current = seconds;
            audio.tick(800 + (10 - seconds) * 60);
            if (seconds === 10) {
                // One discrete announcement for AT (a11y C2) — the per-second ticks stay audio-only.
                setGameMessage('10 SECONDS REMAINING');
                if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
                gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 2000);
            }
        } else if (seconds === 0 && lastBeepedSecondRef.current !== 0) {
            lastBeepedSecondRef.current = 0;
            audio.zap();
        }
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [closeActiveIntervention, closeInterventionForVehicle, gameState, handleColleagueCall, onGameOver, pbReplay, recordDispatchOutcome, segmentLookup, spawnCivilian, targetedCarId]);

  const onMiniGameComplete = useCallback((success: boolean) => {
    // One completion per mini-game (QTE's StrictMode double-invoke called this twice).
    if (ridsPhaseRef.current !== 'minigame') return;
    const intervention = activeRidsRef.current;
    if (slamStartedRef.current || timeLeftRef.current <= 0 || !intervention || !civiliansRef.current.some(car => car.id === intervention.car.id)) {
      closeActiveIntervention();
      return;
    }
    ridsPhaseRef.current = 'idle';
    let goReferral = false;
    if (success) {
        // zap plays inside resolveIntervention (combo pitch ladder); savour the win in slow-mo
        slowmoUntilRef.current = performance.now() + CONSTANTS.SLOWMO_MS;
        const ruralBonus = intervention.car.zone === 'Rural' ? CONSTANTS.RURAL_BONUS : 0;
        const resolved = resolveIntervention(intervention.car, Math.round((CONSTANTS.BASE_ENFORCEMENT_POINTS[intervention.ridsType] + ruralBonus) * operationModifiers.investigateScoreMultiplier), CONSTANTS.ENFORCEMENT_DETERRENCE_BOOST, 'Investigate', 10);
        // Some alcohol/restraint investigations surface a partner-agency
        // referral follow-up (MatchingGame — built for this, previously unwired).
        // Fairness: the referral roll rides the offender's schedule slot.
        const uReferral = intervention.car.slotIndex !== undefined
            ? slotAt(offenderSchedule, intervention.car.slotIndex).uReferral
            : Math.random();
        referralScenarioRef.current = intervention.car.slotIndex !== undefined
            ? Math.floor(slotAt(offenderSchedule, intervention.car.slotIndex).uScenario * 0x100000000)
            : undefined;
        goReferral = resolved && (intervention.ridsType === 'Impairment' || intervention.ridsType === 'Restraints')
            && uReferral < CONSTANTS.REFERRAL_CHANCE;
    } else {
        spendShiftTime(CONSTANTS.RIDS_TIME_PENALTY_MINIGAME_FAIL);
    }
    activeRidsRef.current = null;
    setActiveRids(null);
    setTargetedCarId(null);
    if (goReferral) {
        setGameMessage('REFERRAL OPPORTUNITY');
        if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 2000);
        setGameState('Referral');
    } else {
        setGameState('Playing');
    }
  }, [closeActiveIntervention, offenderSchedule, operationModifiers.investigateScoreMultiplier, resolveIntervention, spendShiftTime]);

  const onReferralComplete = useCallback((success: boolean) => {
    if (slamStartedRef.current || timeLeftRef.current <= 0) {
      setGameState('Playing');
      return;
    }
    if (success) {
        audio.zap();
        scoreRef.current.enforcement += CONSTANTS.REFERRAL_BONUS;
        floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: playerRef.current.pos.x, y: playerRef.current.pos.y - 60 }, text: `REFERRAL +${CONSTANTS.REFERRAL_BONUS}`, spawnTime: simulationTimeRef.current });
    }
    setGameState('Playing'); // no penalty on a miss — the referral is a bonus opportunity
  }, []);

  useEffect(() => {
    if (gameState !== 'Starting' && !isGameplayPaused) {
      lastTimeRef.current = 0; // Reset delta time on resume
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    return () => { if (gameLoopRef.current) { cancelAnimationFrame(gameLoopRef.current); gameLoopRef.current = undefined; } };
  }, [gameState, gameLoop, isGameplayPaused]);
  
  const player = playerRef.current;
  const camera = cameraRef.current;
  const cameraPos = cameraPosRef.current;
  const playerDistrict = getDistrictForPoint(player.pos);
  const totalScore = Math.round(scoreRef.current.enforcement + scoreRef.current.deterrence)
      + ((scoreRef.current.livesSaved - scoreRef.current.colleagueSaves) * CONSTANTS.LIVES_SAVED_SCORE_BONUS)
      + (scoreRef.current.colleagueSaves * CONSTANTS.COLLEAGUE_SAVE_SCORE_BONUS)
      - (scoreRef.current.livesLost * CONSTANTS.LIVES_LOST_PENALTY);
  const projectedScore = computeScoreBreakdown(scoreRef.current, districtsRef.current).finalScore;
  const activeLarCar = civiliansRef.current.filter(c => c.isLifeAtRisk).reduce<Civilian | null>(
      (nearest, car) => !nearest || getDistanceSq(player.pos, car.pos) < getDistanceSq(player.pos, nearest.pos) ? car : nearest,
      null,
  );
  const shouldFlashColleagueAssist = activeLarCar 
      ? activeLarCar.lifeAtRiskTimer < CONSTANTS.COLLEAGUE_ASSIST_FLASH_THRESHOLD_SECONDS
      : false;
  const elapsedShiftMs = elapsedShiftSecondsRef.current * 1000;
  const pbScoreNow = pbReplay ? replayScoreAt(pbReplay.splits, elapsedShiftMs) : null;
  const nextPbSplit = pbReplay?.splits.find(split => split.timeMs > elapsedShiftMs) ?? null;
  const activeScenarioIndex = activeRids?.car.slotIndex !== undefined
      ? Math.floor(slotAt(offenderSchedule, activeRids.car.slotIndex).uScenario * 0x100000000)
      : undefined;

  return (
    <div ref={containerRef} className="w-full h-full bg-black overflow-hidden relative">
      {/* SHIFT OVER freeze-slam. aria-hidden: the live region announces it; not a heading
          (GameOver's h1 takes focus ~900ms later and says the same thing). */}
      {showSlam && (
        <div aria-hidden="true" className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <p className="text-6xl md:text-8xl font-display font-bold text-yellow-300 text-glow-yellow bg-black/60 border-4 border-yellow-400 rounded-xl px-8 py-4 -rotate-3 animate-scale-up-and-fade">SHIFT OVER</p>
        </div>
      )}
       {gameState === 'Starting' && countdownText && (
            <div data-testid="countdown" className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4">
                <h1 key={countdownText} className="text-9xl font-display text-cyan-400 animate-scale-up-and-fade">
                    {countdownText}
                </h1>
                {/* Passive education: one principle per shift while the countdown runs. */}
                <p className="max-w-xl text-center text-sm md:text-base text-gray-300 font-sans mt-6 border-t border-cyan-500/30 pt-4">
                    <span className="text-cyan-400 font-display tracking-wider">{operation ? `${operation.name.toUpperCase()} · ` : 'BRIEFING · '}</span>{operation?.briefing ?? briefingFact}<span className="block text-yellow-200 mt-1">Unit: {loadout.name} · {loadout.description}</span>
                </p>
            </div>
        )}
      {/* Dispatch radio banner — distinct from game messages, with squelch audio.
          The live-region wrapper is ALWAYS mounted (a region inserted with content
          already in it is often skipped by screen readers); only the box is conditional. */}
      <div role="status" aria-live="polite" className="dispatch-radio-region absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        {radioLine && (
          <div data-testid="dispatch-radio" className="dispatch-radio-banner max-w-[80vw] bg-black/85 border-2 border-yellow-500/60 rounded-lg px-4 py-2 text-yellow-200 font-sans text-sm md:text-base shadow-lg shadow-yellow-500/20 animate-fadeIn">
              <span aria-hidden="true">📻 </span><span className="font-display tracking-wide text-yellow-400">DISPATCH:</span> {radioLine}
          </div>
        )}
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="General Deterrence: a top-down patrol driving game. Drive with the on-screen joystick or the W A S D keys; watch the meters and on-screen messages for game state."
        className="absolute top-0 left-0 w-full h-full block"
        style={{ touchAction: 'none' }}
      />
      {/* Announce discrete game-state messages (target locked, life lost, neglect, patrol post) to AT. */}
      <div role="status" aria-live="assertive" className="sr-only">{gameMessage}</div>
      {isDebugMode && (
        <div className="absolute top-2 left-2 z-50 bg-black/70 text-yellow-400 text-xs font-mono p-2 rounded pointer-events-none">
          {debugInfo}
        </div>
      )}
      <div className={`boost-overlay ${player.isBoosting ? 'active' : ''}`}></div>
      {player.isBoosting && (
        <div className="speed-lines-overlay">
            {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="speed-line" style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 0.3}s`,
                    animationDuration: `${0.2 + Math.random() * 0.2}s`,
                }} />
            ))}
        </div>
      )}
      <HUD 
          score={totalScore} timeLeft={Math.ceil(timeLeftRef.current)} player={player} civilians={civiliansRef.current}
          districts={districtsRef.current} playerDistrict={playerDistrict} livesLost={scoreRef.current.livesLost}
          dispatchedCall={dispatchedCallRef.current}
          viewTransform={{ center: cameraPos, zoom: camera.zoom, viewport: viewportRef.current }}
          minimapMode={minimapMode} colleagueCalls={colleagueCallsRef.current} gameMessage={gameMessage}
          isVigilanceBonusActive={isVigilanceBonusActiveRef.current} isNeglectOfDutyActive={isNeglectOfDutyActiveRef.current} presenceBoostRate={presenceBoostRateRef.current}
          stationaryCountdown={stationaryCountdown}
          shouldFlashColleagueAssist={shouldFlashColleagueAssist}
          offencesPrevented={Math.floor(offencesPreventedRef.current)}
          projectedScore={projectedScore}
          lifeAtRiskSeconds={activeLarCar?.lifeAtRiskTimer ?? null}
          onPause={() => { if (!showSlam) setIsPaused(true); }}
          comboMult={comboRef.current.count > 1 ? comboRef.current.mult : 1}
          comboFrac={comboRef.current.count > 1 ? Math.max(0, (comboRef.current.expiresAt - simulationTimeRef.current) / CONSTANTS.COMBO_WINDOW_MS) : 0}
          showRidsMarkers={challengeAssist}
          roadVisitedAt={roadFreshnessRef.current.visitedAt}
          elapsedSeconds={elapsedShiftSecondsRef.current}
          presenceChain={roadFreshnessRef.current.chain}
          coverageTier={coverageTierRef.current}
          shiftPhase={currentPhaseRef.current}
          earnedOvertimeSeconds={earnedOvertimeSecondsRef.current}
          investigationsRemaining={investigationsRemainingRef.current}
          pbDelta={pbScoreNow === null ? null : Math.round(totalScore - pbScoreNow)}
          pbNextTarget={nextPbSplit ? { atSeconds: Math.round(nextPbSplit.timeMs / 1000), score: nextPbSplit.score } : null}
          radioActive={Boolean(radioLine)}
          hudTick={hudTick} />
      {gameState === 'RidsChoice' && activeRids && <RidsChoiceModal onInvestigate={handleInvestigate} onStandard={handleStandard} selection={ridsChoiceSelection} paused={isGameplayPaused || challengeAssist} evidence={observedEvidence(activeRids.car)} investigationsRemaining={investigationsRemainingRef.current} />}
      {gameState === 'MiniGame' && activeRids && (
        <MiniGameModal onComplete={onMiniGameComplete} ridsType={activeRids.ridsType} difficulty={Math.min(1, elapsedShiftSecondsRef.current / CONSTANTS.SHIFT_DURATION)} paused={isGameplayPaused} scenarioIndex={activeScenarioIndex} challengeAssist={challengeAssist} />
      )}
      {gameState === 'Referral' && <ReferralModal onComplete={onReferralComplete} paused={isGameplayPaused} scenarioIndex={referralScenarioRef.current} challengeAssist={challengeAssist} />}
       {isTouchDevice && gameState === 'Playing' && !isGameplayPaused && (
        <TouchControls
            onControlChange={handleControlChange}
            onAnalogChange={(x, y) => { analogInputRef.current.x = x; analogInputRef.current.y = y; }}
            onRidsCheck={handleRidsCheck}
            onSirenToggle={handleSirenToggle}
            onColleagueCall={handleColleagueCall}
            isSirenActive={player.isSirenActive}
        />
      )}
      {isPaused && !isPortraitBlocked && (
        <PauseMenu
          onResume={() => setIsPaused(false)}
          onRestart={() => { void onRestart(); }}
          onMainMenu={() => { setIsPaused(false); onMainMenu(); }}
        />
      )}
      <RotateDevicePrompt show={isPortraitBlocked} onMainMenu={onMainMenu} />
    </div>
  );
};

export default Game;
