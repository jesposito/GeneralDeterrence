import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Player, Civilian, RIDSType, DeterrenceBlob as DeterrenceBlobType, CollectionEffect as CollectionEffectType, District, DistrictName, FinalScoreBreakdown, SparkParticle, SkidMark, MinimapMode, EnforcementAction, ColleagueCallAction, FloatingScoreText as FloatingScoreTextType, TireSmokeParticle, Explosion as ExplosionType, PatrolPost, StationaryCountdown } from '../types';
import * as CONSTANTS from '../constants';
import HUD from './HUD';
import MiniGameModal from './MiniGameModal';
import useKeyPress, { normalizeKey } from '../hooks/useKeyPress';
import { computeScoreBreakdown } from '../utils/scoring';
import { getDistance, getDistanceSq, getRads, findClosestPointOnRoad, findClosestNode, getDistrictForPoint, DISTRICT_DEFINITIONS, generateNewPath, findShortestPath } from '../utils/geometry';
import TouchControls from './TouchControls';
import RotateDevicePrompt from './RotateDevicePrompt';
import { ROAD_NODES, ROAD_SEGMENTS } from '../utils/mapData';
import { drawGame, CameraState, RenderState } from '../utils/gameRenderer';
import * as audio from '../utils/audio';

interface GameProps {
  onGameOver: (scoreBreakdown: FinalScoreBreakdown) => void;
}

type LocalGameState = 'Starting' | 'Playing' | 'RidsChoice' | 'MiniGame';

const PATROL_PATH_SAMPLE_RATE = 30; // Record player position every 30 frames
const PATHFINDING_INTERVAL = 1000; // ms, how often to recalculate GPS path
const COLLISION_CHECK_RADIUS_SQ = (CONSTANTS.CAR_RADIUS * 2) ** 2;
const HUD_UPDATE_INTERVAL_MS = 100;

const nodeMap = new Map(ROAD_NODES.map(node => [node.id, node]));

const RidsChoiceModal: React.FC<{
    onEnforce: () => void;
    onWarn: () => void;
    selection: 'warn' | 'enforce';
    ridsType: RIDSType;
}> = ({ onEnforce, onWarn, selection, ridsType }) => {
    const isAutoResolve = ridsType === 'Restraints' || ridsType === 'Distractions';
    const enforceLabel = isAutoResolve ? 'Instant, Variable Reward' : 'Slow, High Reward';
    return (
    <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20 animate-fadeIn">
        <div className="bg-gray-900 p-8 rounded-lg shadow-2xl w-full max-w-md text-center border-4 border-yellow-500 shadow-lg shadow-yellow-500/50">
            <h2 className="text-3xl font-bold text-yellow-400 mb-2 font-display text-glow-yellow">Driver Interaction</h2>
            <p className="text-lg text-gray-300 mb-6 font-sans">Choose your action.</p>
            <div className="flex space-x-4">
                <button
                    onClick={onWarn}
                    className={`flex-1 bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 text-white font-bold py-3 px-4 rounded text-xl transition font-display tracking-wider focus:outline-none ${selection === 'warn' ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_theme("colors.yellow.400")]' : ''}`}
                >
                    Warn Driver <br/><span className="text-sm font-sans font-normal">(Fast, Low Reward)</span>
                </button>
                <button
                    onClick={onEnforce}
                    className={`flex-1 bg-pink-600 hover:bg-pink-500 border-2 border-pink-400 text-white font-bold py-3 px-4 rounded text-xl transition font-display tracking-wider focus:outline-none ${selection === 'enforce' ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_theme("colors.yellow.400")]' : ''}`}
                >
                    Enforce <br/><span className="text-sm font-sans font-normal">({enforceLabel})</span>
                </button>
            </div>
            <p className="text-sm text-gray-400 mt-6 font-sans">Use <span className="font-bold text-white">←</span> / <span className="font-bold text-white">→</span> or <span className="font-bold text-white">A</span> / <span className="font-bold text-white">D</span> to select, <span className="font-bold text-white">ENTER</span> / <span className="font-bold text-white">SPACE</span> to confirm.</p>
        </div>
    </div>
);};


const Game: React.FC<GameProps> = ({ onGameOver }) => {
  // State for UI and major game phases
  const [gameState, setGameState] = useState<LocalGameState>('Starting');
  const [countdownText, setCountdownText] = useState<string>('3');
  const [activeRids, setActiveRids] = useState<{ car: Civilian; ridsType: RIDSType } | null>(null);
  const [targetedCarId, setTargetedCarId] = useState<number | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [minimapMode, setMinimapMode] = useState<MinimapMode>('Tactical');
  const [gameMessage, setGameMessage] = useState<string | null>(null);
  const [stationaryCountdown, setStationaryCountdown] = useState<StationaryCountdown>(null);
  const lastCountdownSigRef = useRef<string>('null'); // throttles the 60fps countdown re-render (gd-0wi.6)
  const [ridsChoiceSelection, setRidsChoiceSelection] = useState<'warn' | 'enforce'>('warn');
  const [hudTick, setHudTick] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string>('initializing...');
  const isDebugMode = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'), []);

  // Canvas and timing refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef<number>(0);
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
  
  const scoreRef = useRef({ enforcement: 0, deterrence: 0, livesSaved: 0, livesLost: 0 });
  const timeLeftRef = useRef(CONSTANTS.SHIFT_DURATION);
  const avgDeterrenceRef = useRef(50);
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
  const isBrakingRef = useRef(false);
  const colleagueCallsRef = useRef(CONSTANTS.MAX_COLLEAGUE_CALLS);
  const presenceBoostRateRef = useRef(0);
  
  // Refs for tracking game logic timers and state
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const touchStateRef = useRef<{ [key: string]: boolean }>({});
  // Analog joystick magnitude (-1..1 each axis). Boolean direction still flows via
  // touchStateRef + keysPressed for keyboard compat; this ref carries the analog
  // intensity (0..1 magnitude) so the driving code can apply gentle vs sharp turns.
  const analogInputRef = useRef({ x: 0, y: 0 });
  const gameLoopRef = useRef<number>();
  const lastSpawnCheckTime = useRef(Date.now());
  const lastPathfindTime = useRef(0);
  const gameMessageTimerRef = useRef<number | null>(null);
  const sirenStartTimeRef = useRef<number | null>(null);
  
  const patrolPathRef = useRef<{x: number, y: number}[]>([]);
  const enforcementActionsRef = useRef<EnforcementAction[]>([]);
  const colleagueCallActionsRef = useRef<ColleagueCallAction[]>([]);
  const patrolPathFrameCounter = useRef(0);
  
  const isNeglectOfDutyActiveRef = useRef(false);
  const stationaryStartTime = useRef<number | null>(null);
  const stationaryStartPosition = useRef<{ x: number, y: number } | null>(null);
  const wasInHighDeterrenceZoneRef = useRef(false);
  const lastPlayerDistrictRef = useRef<DistrictName | null>(null);

  const highlightedPathRef = useRef<{x: number, y: number}[] | null>(null);
  const pathfindingTargetIdRef = useRef<number | null>(null);

  const segmentLookup = useMemo(() => {
    const map = new Map<string, typeof ROAD_SEGMENTS[0]>();
    for (const segment of ROAD_SEGMENTS) {
        const key = [segment.startNodeId, segment.endNodeId].sort().join('-');
        map.set(key, segment);
    }
    return map;
  }, []);

  function initPlayer(): Player {
    const startNode = ROAD_NODES[Math.floor(Math.random() * ROAD_NODES.length)];
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

  // Touch-primary detection (matches phones/tablets, excludes hybrid laptops with touch)
  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const update = () => setIsTouchDevice(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Pre-shift countdown
  useEffect(() => {
    if (gameState !== 'Starting') return;
    const timeouts = [
      setTimeout(() => setCountdownText('2'), 1000),
      setTimeout(() => setCountdownText('1'), 2000),
      setTimeout(() => setCountdownText('GO!'), 3000),
      setTimeout(() => { setGameState('Playing'); setCountdownText(''); }, 4000),
    ];
    return () => timeouts.forEach(clearTimeout);
  }, [gameState]);

  // Engine drone lifecycle: start when patrol begins, stop on every other state
  // (RidsChoice, MiniGame, GameOver) AND on component unmount. Visibility/blur
  // also stops it via clearHeldInputs above. Also reset the time-pressure tick
  // tracker so a fresh shift gets the full 10-tick + final-zap sequence.
  useEffect(() => {
    if (gameState === 'Playing') {
      audio.engineStart();
      audio.setEngineLevel(0);
      audio.musicStart();
      lastBeepedSecondRef.current = 11;
    } else {
      audio.engineStop();
      audio.musicStop();
    }
    return () => { audio.engineStop(); audio.sirenStop(); audio.musicStop(); };
  }, [gameState]);

  // Clear held inputs on app switch / focus loss / orientation change so
  // the player doesn't return to a stuck-down d-pad or boost button.
  useEffect(() => {
    const clearHeldInputs = () => {
      keysPressed.current = {};
      touchStateRef.current = {};
      analogInputRef.current.x = 0;
      analogInputRef.current.y = 0;
      isBrakingRef.current = false;
      if (playerRef.current.isSirenActive) {
        playerRef.current.isSirenActive = false;
        sirenStartTimeRef.current = null;
      }
      audio.sirenStop();
      audio.engineStop();
      playerRef.current.isBoosting = false;
    };
    const onVisibility = () => { if (document.hidden) clearHeldInputs(); };
    window.addEventListener('blur', clearHeldInputs);
    window.addEventListener('pagehide', clearHeldInputs);
    window.addEventListener('orientationchange', clearHeldInputs);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', clearHeldInputs);
      window.removeEventListener('pagehide', clearHeldInputs);
      window.removeEventListener('orientationchange', clearHeldInputs);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const handleColleagueCall = useCallback(() => {
    if (colleagueCallsRef.current <= 0 || gameState !== 'Playing') return;

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
        setGameMessage('COLLEAGUE DISPATCHED TO HIGH-RISK EVENT');
        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 3000);

        scoreRef.current.livesSaved++;
        const targetDistrict = getDistrictForPoint(targetCar.pos);
        if (targetDistrict) {
            const district = districtsRef.current.find(d => d.id === targetDistrict);
            if (district) district.deterrence = Math.min(100, district.deterrence + CONSTANTS.COLLEAGUE_DETERRENCE_BOOST);
        }

        colleagueCallActionsRef.current.push({ pos: targetCar!.pos, targetVehicleId: targetCar!.id });
        civiliansRef.current = civiliansRef.current.filter(c => c.id !== targetCar!.id);
        
    } else {
        setGameMessage('NO HIGH-PRIORITY TARGETS AVAILABLE');
        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 2000);
    }
  }, [gameState]);

  const handleSirenToggle = useCallback(() => {
    const player = playerRef.current;
    if (!player.isSirenActive && player.boostCharge > 0) {
        sirenStartTimeRef.current = Date.now();
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
        const k = e.key.toLowerCase();
        if (k === 'm') setMinimapMode(prev => prev === 'Tactical' ? 'Strategic' : 'Tactical');
        if (k === 'c') handleColleagueCall();
        if (k === 'e') handleSirenToggle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleColleagueCall, handleSirenToggle]);

  const handleControlChange = useCallback((action: string, active: boolean) => {
    touchStateRef.current[action] = active;
  }, []);

  const handleRidsCheck = useCallback(() => {
    if (gameState !== 'Playing') return;
    
    const player = playerRef.current;
    const currentVigilanceBonus = CONSTANTS.VIGILANCE_AURA_BONUS_MAX * (player.vigilance / 100);
    const baseRadius = player.isSirenActive ? CONSTANTS.PLAYER_SIREN_AURA_RADIUS : CONSTANTS.PLAYER_AURA_RADIUS;
    const checkRadius = baseRadius + currentVigilanceBonus;
    const checkRadiusSq = checkRadius ** 2;

    const nearbyCar = civiliansRef.current.find(c => c.ridsType && getDistanceSq(player.pos, c.pos) < checkRadiusSq);
    if (nearbyCar) {
        setActiveRids({ car: nearbyCar, ridsType: nearbyCar.ridsType! });
        setTargetedCarId(nearbyCar.id);
        setGameMessage('TARGET LOCKED');
        audio.beep();
        setRidsChoiceSelection('warn'); // Reset selection
        setGameState('RidsChoice');
        if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 1200);
    } else {
        const anyCarNearby = civiliansRef.current.some(c => getDistanceSq(player.pos, c.pos) < checkRadiusSq);
        if (anyCarNearby) timeLeftRef.current = Math.max(0, timeLeftRef.current - CONSTANTS.RIDS_TIME_PENALTY_INCORRECT_CHECK);
    }
  }, [gameState]);
  

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat) { e.preventDefault(); handleRidsCheck(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRidsCheck]);

  const createCivilian = useCallback((districtId?: DistrictName): Civilian | null => {
    const path = generateNewPath(districtId);
    if (!path || path.length < 2) return null;
    const spawnPointNode = nodeMap.get(path[0]);
    if (!spawnPointNode) return null;
    const districtName = getDistrictForPoint(spawnPointNode.pos);
    const district = districtsRef.current.find(d => d.id === districtName);
    if (!district) return null;

    const dx = nodeMap.get(path[1])!.pos.x - spawnPointNode.pos.x;
    const dy = nodeMap.get(path[1])!.pos.y - spawnPointNode.pos.y;
    
    return {
      id: Math.random(), pos: { ...spawnPointNode.pos }, angle: Math.atan2(dy, dx) * (180 / Math.PI) + 90, 
      speed: 0, vel: { x: 0, y: 0 }, ridsType: null, zone: district.name.includes('Rural') ? 'Rural' : 'Suburban',
      district: districtName, path, pathIndex: 1, spawnTime: Date.now(), isDeterred: false,
      baseSpeed: CONSTANTS.CIVILIAN_BASE_SPEED[districtName] + (Math.random() - 0.5) * CONSTANTS.CIVILIAN_SPEED_VARIATION, 
      lastBlobSpawnTime: 0, deterrenceBlobsRemaining: 0,
      isLifeAtRisk: false, lifeAtRiskTimer: 0,
      swerveAngle: 0, speedFluctuationTimer: 0, speedFluctuationTarget: 1,
    };
  }, []);

  const spawnCivilian = useCallback((districtId?: DistrictName) => {
    const newCivilian = createCivilian(districtId);
    if (newCivilian) civiliansRef.current.push(newCivilian);
  }, [createCivilian]);

  useEffect(() => {
    const initialCarCount = Math.min(CONSTANTS.MAX_CIVILIAN_CARS, 40);
    for (let i = 0; i < initialCarCount; i++) {
        const newCar = createCivilian();
        if (newCar) civiliansRef.current.push(newCar);
    }
    patrolPathRef.current = [playerRef.current.pos];
    cameraPosRef.current = { ...playerRef.current.pos };
    lastPlayerDistrictRef.current = getDistrictForPoint(playerRef.current.pos);
  }, [createCivilian]);

    const updatePlayerMovement = (now: number, dt: number) => {
        const dtScale = 60 * dt; // Scale from per-frame@60fps to per-dt
        const player = playerRef.current;
        const keys = { ...keysPressed.current, ...touchStateRef.current };
        const moveForward = keys['ArrowUp'] || keys['w'] || keys['forward'];
        const moveBackward = keys['ArrowDown'] || keys['s'] || keys['backward'];
        const turnLeft = keys['ArrowLeft'] || keys['a'] || keys['left'];
        const turnRight = keys['ArrowRight'] || keys['d'] || keys['right'];
        const isTryingToBoost = keys['Shift'] || keys['boost'];
        
        player.isBoosting = isTryingToBoost && player.boostCharge >= CONSTANTS.PLAYER_BOOST_DRAIN_RATE && moveForward && !player.isSirenActive;

        if (player.isBoosting) {
            player.boostCharge = Math.max(0, player.boostCharge - CONSTANTS.DT_BOOST_DRAIN_PER_SEC * dt);
        } else if (player.isSirenActive) {
            // gd-0wi.11: siren now costs energy (shares the boost pool) and auto-disables when
            // drained or past its max duration — previously it was free + unlimited.
            player.boostCharge = Math.max(0, player.boostCharge - CONSTANTS.DT_SIREN_DRAIN_PER_SEC * dt);
            const sirenElapsed = sirenStartTimeRef.current ? now - sirenStartTimeRef.current : 0;
            if (player.boostCharge <= 0 || sirenElapsed > CONSTANTS.PLAYER_SIREN_MAX_DURATION) {
                player.isSirenActive = false;
                sirenStartTimeRef.current = null;
                audio.sirenStop();
            }
        } else {
            player.boostCharge = Math.min(CONSTANTS.PLAYER_BOOST_MAX_CHARGE, player.boostCharge + CONSTANTS.DT_BOOST_RECHARGE_PER_SEC * dt);
        }
        const currentSpeed = Math.sqrt(player.vel.x ** 2 + player.vel.y ** 2);
        player.speed = currentSpeed;
        // Cardinal joystick mode: when the analog joystick magnitude is non-trivial,
        // treat the joystick as a world-direction vector — push north = move north,
        // regardless of car heading. Visual angle smoothly rotates toward velocity
        // direction so the car still 'faces' where it's going. Snaps instantly when
        // prefers-reduced-motion is set.
        const jx = analogInputRef.current.x;
        const jy = analogInputRef.current.y;
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
        const fwdFriction = Math.pow(CONSTANTS.PLAYER_FORWARD_FRICTION, dtScale);
        const latFriction = Math.pow(CONSTANTS.PLAYER_LATERAL_FRICTION, dtScale);
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
        
        // Track patrol path (every ~0.5s)
        patrolPathFrameCounter.current += dtScale;
        if (patrolPathFrameCounter.current >= PATROL_PATH_SAMPLE_RATE) {
            patrolPathRef.current.push({ x: player.pos.x, y: player.pos.y });
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
        let totalDeterrence = 0;
        presenceBoostRateRef.current = 0;

        patrolPostsRef.current.forEach(post => {
            const postDistrictId = getDistrictForPoint(post.pos);
            const district = districtsRef.current.find(d => d.id === postDistrictId);
            if (district) {
                const sizeModifier = Math.min(2.5, 1000000 / (district.bounds.width * district.bounds.height));
                const postBoost = CONSTANTS.DT_PRESENCE_BOOST_PER_SEC * sizeModifier * CONSTANTS.PATROL_POST_PRESENCE_MULTIPLIER * dt;
                district.deterrence = Math.min(100, district.deterrence + postBoost);
            }
            post.remainingTime -= 60 * dt; // Decrement frame counter by scaled amount
        });
        patrolPostsRef.current = patrolPostsRef.current.filter(p => p.remainingTime > 0);
        
        districtsRef.current.forEach(district => {
            let decayMultiplier = 1.0;
            if (isNeglectOfDutyActiveRef.current) decayMultiplier = CONSTANTS.NEGLECT_OF_DUTY_DETERRENCE_DECAY_MULTIPLIER;
            district.deterrence = Math.max(0, district.deterrence - CONSTANTS.DT_DISTRICT_DECAY_PER_SEC * decayMultiplier * dt);
            
            if (district.id === playerDistrictId) {
                const sizeModifier = Math.min(2.5, 1000000 / (district.bounds.width * district.bounds.height)); 
                let boost = CONSTANTS.DT_PRESENCE_BOOST_PER_SEC * sizeModifier * dt;
                if (player.isSirenActive) boost += CONSTANTS.DT_SIREN_BOOST_PER_SEC * dt;
                district.deterrence = Math.min(100, district.deterrence + boost);
                presenceBoostRateRef.current = boost / dt;
            }
            totalDeterrence += district.deterrence;
        });

        avgDeterrenceRef.current = totalDeterrence / districtsRef.current.length;
        isVigilanceBonusActiveRef.current = districtsRef.current.every(d => d.deterrence >= CONSTANTS.DETERRENCE_VIGILANCE_THRESHOLD);

        const deterrenceMultiplier = CONSTANTS.DETERRENCE_MULTIPLIER_MIN + (avgDeterrenceRef.current / 100) * (CONSTANTS.DETERRENCE_MULTIPLIER_MAX - CONSTANTS.DETERRENCE_MULTIPLIER_MIN);
        scoreRef.current.deterrence += (avgDeterrenceRef.current / 100) * CONSTANTS.DETERRENCE_SCORE_RATE * dt * (isVigilanceBonusActiveRef.current ? CONSTANTS.VIGILANCE_BONUS_MULTIPLIER : 1) * deterrenceMultiplier;

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

    const handleCollisionsAndInteractions = (now: number, dt: number) => {
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

    const updateCiviliansAndSpawners = (now: number, dt: number) => {
        const dtScale = 60 * dt;
        const player = playerRef.current;
        const isSirenActive = player.isSirenActive;
        const playerForwardVec = { x: Math.cos(getRads(player.angle - 90)), y: Math.sin(getRads(player.angle - 90)) };
        
        if (now - lastSpawnCheckTime.current > CONSTANTS.RIDS_SPAWN_INTERVAL) {
            lastSpawnCheckTime.current = now;
            if (civiliansRef.current.length < CONSTANTS.MAX_CIVILIAN_CARS) {
                const carsByDistrict = civiliansRef.current.reduce((acc, c) => {
                    acc[c.district] = (acc[c.district] || 0) + 1; return acc;
                }, {} as Record<DistrictName, number>);
                for (const districtName in CONSTANTS.CIVILIAN_TARGET_DENSITY) {
                    const name = districtName as DistrictName;
                    if ((carsByDistrict[name] || 0) < CONSTANTS.CIVILIAN_TARGET_DENSITY[name]) {
                        spawnCivilian(name); break;
                    }
                }
            }
            const currentOffenders = civiliansRef.current.filter(c => c.ridsType).length;
            const avgDeterrenceModifier = 1 - (avgDeterrenceRef.current / 100);
            const dynamicTarget = Math.ceil(CONSTANTS.TARGET_OFFENDER_COUNT * avgDeterrenceModifier);
            const targetOffenders = Math.max(CONSTANTS.MIN_TARGET_OFFENDER_COUNT, dynamicTarget);
            if (currentOffenders < targetOffenders) {
                const weightedDistricts = districtsRef.current.map(d => ({ districtId: d.id, weight: (101 - d.deterrence) * (d.deterrence < CONSTANTS.DETERRENCE_HOTSPOT_THRESHOLD ? 4 : 1) }));
                const totalWeight = weightedDistricts.reduce((sum, wd) => sum + wd.weight, 0);
                if (totalWeight > 0) {
                    let randomWeight = Math.random() * totalWeight;
                    let districtToSpawnIn: DistrictName = weightedDistricts[weightedDistricts.length - 1].districtId;
                    for (const wd of weightedDistricts) {
                        randomWeight -= wd.weight;
                        if (randomWeight <= 0) { districtToSpawnIn = wd.districtId; break; }
                    }
                    const potentialCandidates = civiliansRef.current.filter(c => !c.ridsType && c.roadType && c.district === districtToSpawnIn);
                    if (potentialCandidates.length > 0) {
                        const carToOffend = potentialCandidates[Math.floor(Math.random() * potentialCandidates.length)];
                        const ridsChances = CONSTANTS.RIDS_SPAWN_CHANCE_BY_ROAD_TYPE[carToOffend.roadType!];
                        const rand = Math.random(); let cumulative = 0; let assignedRidsType: RIDSType | null = null;
                        for (const [type, chance] of Object.entries(ridsChances)) {
                            cumulative += chance as number; if (rand < cumulative) { assignedRidsType = type as RIDSType; break; }
                        }
                        if (assignedRidsType) {
                            carToOffend.ridsType = assignedRidsType;
                            carToOffend.deterrenceBlobsRemaining = CONSTANTS.MAX_DETERRENCE_BLOBS_PER_OFFENDER;
                            carToOffend.baseSpeed = assignedRidsType === 'Speed' ? CONSTANTS.CIVILIAN_SPEEDING_SPEED[carToOffend.district] : CONSTANTS.CIVILIAN_BASE_SPEED[carToOffend.district];
                            
                            let lifeAtRiskChance = CONSTANTS.LIFE_AT_RISK_CHANCE * CONSTANTS.LIFE_AT_RISK_DISTRICT_MODIFIER[carToOffend.district];
                            if(isVigilanceBonusActiveRef.current) lifeAtRiskChance *= CONSTANTS.VIGILANCE_BONUS_MULTIPLIER;
                            if (isNeglectOfDutyActiveRef.current) lifeAtRiskChance *= CONSTANTS.NEGLECT_OF_DUTY_LAR_CHANCE_MULTIPLIER;
                            
                            const larExists = civiliansRef.current.some(c => c.isLifeAtRisk);
                            if (!larExists && Math.random() < lifeAtRiskChance) {
                                carToOffend.isLifeAtRisk = true;
                                let timer = CONSTANTS.LIFE_AT_RISK_TIMER_SECONDS * CONSTANTS.FRAMES_PER_SECOND;
                                if (isNeglectOfDutyActiveRef.current) timer *= CONSTANTS.NEGLECT_OF_DUTY_LAR_TIMER_MULTIPLIER;
                                carToOffend.lifeAtRiskTimer = timer;
                            }
                        }
                    }
                }
            }
        }
        
        civiliansRef.current = civiliansRef.current.filter(c => {
            if (c.isLifeAtRisk) {
                c.lifeAtRiskTimer -= dtScale;
                if (c.lifeAtRiskTimer <= 0) {
                    scoreRef.current.livesLost++;
                    explosionsRef.current.push({ id: Math.random(), pos: c.pos, spawnTime: now });
                    audio.thud();
                    cameraRef.current.shake = 10;
                    setGameMessage('LIFE LOST');
                    if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
                    gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 2000);
                    return false;
                }
                if (!c.patrolPostBonusApplied) {
                    const postInRange = patrolPostsRef.current.find(post => getDistanceSq(c.pos, post.pos) < CONSTANTS.PATROL_POST_RADIUS ** 2);
                    if (postInRange) {
                        c.lifeAtRiskTimer += CONSTANTS.PATROL_POST_LAR_TIME_BONUS_SECONDS * CONSTANTS.FRAMES_PER_SECOND;
                        c.patrolPostBonusApplied = true;
                        setGameMessage(`PATROL POST ASSIST: +${CONSTANTS.PATROL_POST_LAR_TIME_BONUS_SECONDS}s`);
                        if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);
                        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 3000);
                    }
                }
            }
            if (c.pathIndex >= c.path.length) {
                const newPath = generateNewPath(undefined, c.path[c.path.length - 1]);
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
            } else if (c.ridsType === 'Distractions') {
                c.speedFluctuationTimer = (c.speedFluctuationTimer || 0) - dtScale;
                if (c.speedFluctuationTimer <= 0) {
                    c.speedFluctuationTimer = Math.random() * 120 + 60;
                    c.speedFluctuationTarget = 0.5 + Math.random();
                }
                targetSpeed *= c.speedFluctuationTarget!;
            }

            c.speed += (targetSpeed - c.speed) * 0.08 * dtScale;
            c.isBraking = c.speed > targetSpeed + 0.1;
            c.pos.x += segmentDir.x * c.speed * dtScale;
            c.pos.y += segmentDir.y * c.speed * dtScale;
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
            const currentVigilanceBonus = CONSTANTS.VIGILANCE_AURA_BONUS_MAX * (playerRef.current.vigilance / 100);
            const auraRadius = CONSTANTS.PLAYER_AURA_RADIUS + currentVigilanceBonus;
            if (c.ridsType && c.deterrenceBlobsRemaining > 0 && now - c.lastBlobSpawnTime > CONSTANTS.DETERRENCE_BLOB_SPAWN_INTERVAL && getDistanceSq(c.pos, playerRef.current.pos) < auraRadius ** 2) {
                deterrenceBlobsRef.current.push({ id: Math.random(), pos: { ...c.pos }, vel: { x: 0, y: 0 }, value: CONSTANTS.DETERRENCE_BLOB_BASE_VALUE, spawnTime: now });
                c.lastBlobSpawnTime = now; c.deterrenceBlobsRemaining -= 1;
            }
            return true;
        });
    };

    const updateParticlesAndEffects = (now: number, dt: number) => {
        const dtScale = 60 * dt;
        const playerPos = playerRef.current.pos;
        const currentVigilanceBonus = CONSTANTS.VIGILANCE_AURA_BONUS_MAX * (playerRef.current.vigilance / 100);
        const auraRadius = CONSTANTS.PLAYER_AURA_RADIUS + currentVigilanceBonus;

        deterrenceBlobsRef.current = deterrenceBlobsRef.current.filter(blob => {
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
                if(district) district.deterrence = Math.min(100, district.deterrence + blob.value * 4);
                collectionEffectsRef.current.push({ id: Math.random(), pos: blob.pos, spawnTime: now });
                audio.pickup();
                return false;
            } return true;
        });
        
        collectionEffectsRef.current = collectionEffectsRef.current.filter(e => now - e.spawnTime < 400);
        floatingScoreTextsRef.current = floatingScoreTextsRef.current.filter(f => now - f.spawnTime < CONSTANTS.FLOATING_SCORE_TEXT_LIFESPAN);
        sparksRef.current = sparksRef.current.map(s => ({ ...s, pos: { x: s.pos.x + s.vel.x * dtScale, y: s.pos.y + s.vel.y * dtScale }})).filter(s => now - s.spawnTime < CONSTANTS.SPARK_LIFESPAN);
        skidMarksRef.current = skidMarksRef.current.filter(skid => now - skid.spawnTime < CONSTANTS.SKID_MARK_LIFESPAN);
        tireSmokeRef.current = tireSmokeRef.current.filter(smoke => now - smoke.spawnTime < CONSTANTS.TIRE_SMOKE_PARTICLE_LIFESPAN);
        explosionsRef.current = explosionsRef.current.filter(exp => now - exp.spawnTime < CONSTANTS.EXPLOSION_LIFESPAN);
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

  const handleEnforce = useCallback(() => {
    // gd-0wi.10: every enforcement runs a mini-game (Impairment=breath test, Speed=slider,
    // Restraints/Distractions=deterrence-concept check) — this is what makes the retooled
    // concept mini-game reachable. Scoring, LAR and dispatch handling all live in
    // onMiniGameComplete. Warn stays the quick, low-reward inline path.
    setGameState('MiniGame');
  }, []);
  
  // Shared resolution for Warn + successful Enforce (gd-0wi.4): awards score (with vigilance
  // bonus), grows vigilance, floats the score/vigilance text, boosts district deterrence,
  // records the action, removes the offender, and credits a life saved.
  const resolveIntervention = useCallback((car: Civilian, baseScore: number, deterrenceBoost: number, actionType: EnforcementAction['actionType'], shake: number) => {
    let scoreToAdd = baseScore;
    if (isVigilanceBonusActiveRef.current) scoreToAdd *= CONSTANTS.VIGILANCE_BONUS_MULTIPLIER;
    scoreRef.current.enforcement += scoreToAdd;
    playerRef.current.vigilance = Math.min(CONSTANTS.VIGILANCE_MAX, playerRef.current.vigilance + CONSTANTS.VIGILANCE_GAIN_ON_INTERVENTION);
    floatingScoreTextsRef.current.push({ id: Math.random(), pos: car.pos, text: `+${scoreToAdd}`, spawnTime: Date.now() });
    floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: playerRef.current.pos.x, y: playerRef.current.pos.y - 60 }, text: `VIGILANCE +${CONSTANTS.VIGILANCE_GAIN_ON_INTERVENTION}`, spawnTime: Date.now() });
    const district = districtsRef.current.find(d => d.id === car.district);
    if (district) district.deterrence = Math.min(100, district.deterrence + deterrenceBoost);
    enforcementActionsRef.current.push({ pos: car.pos, ridsType: car.ridsType!, actionType });
    civiliansRef.current = civiliansRef.current.filter(c => c.id !== car.id);
    if (shake) cameraRef.current.shake = shake;
    if (car.isLifeAtRisk) scoreRef.current.livesSaved++;
  }, []);

  const handleWarn = useCallback(() => {
      if (activeRids) {
        audio.zap();
        resolveIntervention(activeRids.car, CONSTANTS.WARN_SCORE_POINTS, CONSTANTS.WARN_DETERRENCE_BOOST, 'Warn', 0);
      }
      setActiveRids(null); setTargetedCarId(null); setGameState('Playing');
  }, [activeRids, resolveIntervention]);
    
  // Keyboard controls for RIDS Choice modal
  useEffect(() => {
    if (gameState === 'RidsChoice') {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return; // a held SPACE (from the RIDS check) must not auto-confirm the choice
            if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
                setRidsChoiceSelection('warn');
            } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
                setRidsChoiceSelection('enforce');
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (ridsChoiceSelection === 'warn') {
                    handleWarn();
                } else {
                    handleEnforce();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [gameState, ridsChoiceSelection, handleWarn, handleEnforce]);
    
  const gameLoop = useCallback(() => {
    const now = Date.now();
    
    if (timeLeftRef.current <= 0) {
        const finalBreakdown: FinalScoreBreakdown = {
            ...computeScoreBreakdown(scoreRef.current, districtsRef.current),
            patrolPath: patrolPathRef.current,
            enforcementActions: enforcementActionsRef.current,
            colleagueCallActions: colleagueCallActionsRef.current,
        };
        onGameOver(finalBreakdown);
        return;
    }

    // Delta time calculation
    if (lastTimeRef.current === 0) lastTimeRef.current = now;
    const rawDt = (now - lastTimeRef.current) / 1000;
    const dt = Math.min(rawDt, 0.1); // Cap at 100ms to avoid huge jumps
    lastTimeRef.current = now;

    timeLeftRef.current -= dt;
    
    updatePlayerMovement(now, dt);
    updateVigilance(dt);
    updateCiviliansAndSpawners(now, dt);
    updateDeterrenceAndNeglect(now, dt);
    handleCollisionsAndInteractions(now, dt);
    updateParticlesAndEffects(now, dt);
    updatePathfinding(now);
    updateCamera(now, dt);
    
    // Draw to canvas
    const canvas = canvasRef.current;
    let drawOk = false;
    if (canvas && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = Math.max(1, Math.round(rect.width));
        const cssHeight = Math.max(1, Math.round(rect.height));
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
                };
                drawGame(ctx, cssWidth, cssHeight, cameraRef.current, renderState, now);
                drawOk = true;
            } catch (e) {
                console.error('Draw error:', e);
            }
        }
    }

    // Update debug info periodically (only when ?debug is in URL — saves ~2 React re-renders/sec in production)
    if (isDebugMode && now % 500 < 20) {
        setDebugInfo(`loop:${gameState} canvas:${canvas ? 'yes' : 'no'} sz:${canvas?.width}x${canvas?.height} draw:${drawOk} cam:${cameraRef.current.zoom.toFixed(2)} cars:${civiliansRef.current.length}`);
    }

    // Periodic HUD refresh
    if (now - lastHudUpdateRef.current > HUD_UPDATE_INTERVAL_MS) {
        lastHudUpdateRef.current = now;
        setHudTick(t => t + 1);
        // Modulate engine drone with current speed (~10 Hz update rate, lerped over 100ms inside audio.ts)
        audio.setEngineLevel(playerRef.current.speed / CONSTANTS.PLAYER_MAX_SPEED);
    }

    // Time-pressure ticks: one short beep on each integer-second crossing in the
    // final 10 seconds, with rising pitch. Final-zero plays a zap. lastBeepedSecondRef
    // is reset to 11 on game-state → 'Playing' so each shift gets the full sequence.
    if (gameState === 'Playing') {
        const seconds = Math.ceil(timeLeftRef.current);
        if (seconds <= 10 && seconds > 0 && seconds !== lastBeepedSecondRef.current) {
            lastBeepedSecondRef.current = seconds;
            audio.tick(800 + (10 - seconds) * 60);
        } else if (seconds === 0 && lastBeepedSecondRef.current !== 0) {
            lastBeepedSecondRef.current = 0;
            audio.zap();
        }
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [onGameOver, spawnCivilian, segmentLookup, handleColleagueCall, gameState, targetedCarId]);

  const onMiniGameComplete = useCallback((success: boolean) => {
    if (activeRids) {
      if (success) {
        audio.zap();
        const district = districtsRef.current.find(d => d.id === activeRids.car.district);
        const ruralBonus = district?.name.includes('Rural') ? CONSTANTS.RURAL_BONUS : 0;
        resolveIntervention(activeRids.car, CONSTANTS.BASE_ENFORCEMENT_POINTS[activeRids.ridsType] + ruralBonus, CONSTANTS.ENFORCEMENT_DETERRENCE_BOOST, 'Enforce', 10);
      } else {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - CONSTANTS.RIDS_TIME_PENALTY_MINIGAME_FAIL);
      }
      setActiveRids(null);
    }
    setTargetedCarId(null); setGameState('Playing');
  }, [activeRids]);

  // Pause/resume on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (gameLoopRef.current) {
          cancelAnimationFrame(gameLoopRef.current);
          gameLoopRef.current = undefined;
        }
      } else {
        if ((gameState === 'Playing' || gameState === 'Starting') && !gameLoopRef.current) {
          lastTimeRef.current = 0;
          gameLoopRef.current = requestAnimationFrame(gameLoop);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameState, gameLoop]);

  useEffect(() => {
    if (gameState === 'Playing' || gameState === 'Starting') {
      lastTimeRef.current = 0; // Reset delta time on resume
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    return () => { if (gameLoopRef.current) { cancelAnimationFrame(gameLoopRef.current); gameLoopRef.current = undefined; } };
  }, [gameState, gameLoop]);
  
  const player = playerRef.current;
  const camera = cameraRef.current;
  const cameraPos = cameraPosRef.current;
  const playerDistrict = getDistrictForPoint(player.pos);
  const totalScore = Math.round(scoreRef.current.enforcement + scoreRef.current.deterrence) + (scoreRef.current.livesSaved * CONSTANTS.LIVES_SAVED_SCORE_BONUS) - (scoreRef.current.livesLost * CONSTANTS.LIVES_LOST_PENALTY);
  const activeLarCar = civiliansRef.current.find(c => c.isLifeAtRisk);
  const shouldFlashColleagueAssist = activeLarCar 
      ? (activeLarCar.lifeAtRiskTimer / CONSTANTS.FRAMES_PER_SECOND) < CONSTANTS.COLLEAGUE_ASSIST_FLASH_THRESHOLD_SECONDS
      : false;

  return (
    <div ref={containerRef} className="w-full h-full bg-black overflow-hidden relative">
       {gameState === 'Starting' && countdownText && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                <h1 key={countdownText} className="text-9xl font-display text-cyan-400 animate-scale-up-and-fade">
                    {countdownText}
                </h1>
            </div>
        )}
      <canvas 
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full block"
        style={{ touchAction: 'none' }}
      />
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
          dispatchedCall={null}
          camera={{x: cameraPos.x - (viewportRef.current.width/camera.zoom)/2, y: cameraPos.y - (viewportRef.current.height/camera.zoom)/2}}
          viewport={{width: viewportRef.current.width / camera.zoom, height: viewportRef.current.height / camera.zoom}}
          minimapMode={minimapMode} colleagueCalls={colleagueCallsRef.current} gameMessage={gameMessage}
          isVigilanceBonusActive={isVigilanceBonusActiveRef.current} isNeglectOfDutyActive={isNeglectOfDutyActiveRef.current} presenceBoostRate={presenceBoostRateRef.current}
          stationaryCountdown={stationaryCountdown}
          shouldFlashColleagueAssist={shouldFlashColleagueAssist}
          hudTick={hudTick} />
      {gameState === 'RidsChoice' && activeRids && <RidsChoiceModal onEnforce={handleEnforce} onWarn={handleWarn} selection={ridsChoiceSelection} ridsType={activeRids.ridsType} />}
      {gameState === 'MiniGame' && activeRids && (
        <MiniGameModal onComplete={onMiniGameComplete} ridsType={activeRids.ridsType} />
      )}
       {isTouchDevice && gameState === 'Playing' && (
        <TouchControls
            onControlChange={handleControlChange}
            onAnalogChange={(x, y) => { analogInputRef.current.x = x; analogInputRef.current.y = y; }}
            onRidsCheck={handleRidsCheck}
            onSirenToggle={handleSirenToggle}
            onColleagueCall={handleColleagueCall}
            isSirenActive={player.isSirenActive}
        />
      )}
      {isTouchDevice && gameState === 'Playing' && <RotateDevicePrompt />}
    </div>
  );
};

export default Game;
