import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { Player, Civilian, RIDSType, DeterrenceBlob as DeterrenceBlobType, CollectionEffect as CollectionEffectType, District, DistrictName, DispatchedCall, FinalScoreBreakdown, SparkParticle, SkidMark, MinimapMode, EnforcementAction, ColleagueCallAction, FloatingScoreText as FloatingScoreTextType, TireSmokeParticle, Explosion as ExplosionType, PatrolPost, StationaryCountdown } from '../types';
import * as CONSTANTS from '../constants';
import GameMap from './Map';
import PlayerCar from './PlayerCar';
import CivilianCar from './CivilianCar';
import HUD from './HUD';
import MiniGameModal from './MiniGameModal';
import DeterrenceBlob from './DeterrenceBlob';
import CollectionEffect from './CollectionEffect';
import SparksEffect from './SparksEffect';
import SkidMarkComponent from './SkidMark';
import FloatingScoreText from './FloatingScoreText';
import Explosion from './Explosion';
import PatrolPostAura from './PatrolPostAura';
import useKeyPress from '../hooks/useKeyPress';
import { getDistance, getDistanceSq, getRads, findClosestPointOnRoad, findClosestNode, getDistrictForPoint, DISTRICT_DEFINITIONS, generateNewPath, findShortestPath } from '../utils/geometry';
import TouchControls from './TouchControls';
import { ROAD_NODES, ROAD_SEGMENTS } from '../utils/mapData';

interface GameProps {
  onGameOver: (scoreBreakdown: FinalScoreBreakdown) => void;
}

type LocalGameState = 'Starting' | 'Playing' | 'RidsChoice' | 'MiniGame';

const PATROL_PATH_SAMPLE_RATE = 30; // Record player position every 30 frames
const PATHFINDING_INTERVAL = 1000; // ms, how often to recalculate GPS path
const COLLISION_CHECK_RADIUS_SQ = (CONSTANTS.CAR_RADIUS * 2) ** 2;

const nodeMap = new Map(ROAD_NODES.map(node => [node.id, node]));

const RidsChoiceModal: React.FC<{
    onEnforce: () => void;
    onWarn: () => void;
    selection: 'warn' | 'enforce';
}> = ({ onEnforce, onWarn, selection }) => (
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
                    Enforce <br/><span className="text-sm font-sans font-normal">(Slow, High Reward)</span>
                </button>
            </div>
            <p className="text-sm text-gray-400 mt-6 font-sans">Use <span className="font-bold text-white">←</span> / <span className="font-bold text-white">→</span> or <span className="font-bold text-white">A</span> / <span className="font-bold text-white">D</span> to select, <span className="font-bold text-white">ENTER</span> / <span className="font-bold text-white">SPACE</span> to confirm.</p>
        </div>
    </div>
);


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
  const [ridsChoiceSelection, setRidsChoiceSelection] = useState<'warn' | 'enforce'>('warn');
  const [, forceUpdate] = useReducer(x => x + 1, 0);

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
  const dispatchedCallRef = useRef<DispatchedCall | null>(null);
  const timeLeftRef = useRef(CONSTANTS.SHIFT_DURATION);
  const avgDeterrenceRef = useRef(50);
  const isVigilanceBonusActiveRef = useRef(false);
  
  const cameraRef = useRef({ zoom: 1, shake: 0 });
  const cameraPosRef = useRef({ x: playerRef.current.pos.x, y: playerRef.current.pos.y });
  const isBrakingRef = useRef(false);
  const colleagueCallsRef = useRef(CONSTANTS.MAX_COLLEAGUE_CALLS);
  const presenceBoostRateRef = useRef(0);
  
  // Refs for tracking game logic timers and state
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const touchStateRef = useRef<{ [key: string]: boolean }>({});
  const gameLoopRef = useRef<number>();
  const lastSpawnCheckTime = useRef(Date.now());
  const lastDispatchCheckTime = useRef(Date.now());
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

  const speedLines = useMemo(() => {
    return Array.from({ length: 15 }).map(() => ({
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 0.3}s`,
        animationDuration: `${0.2 + Math.random() * 0.2}s`,
    }));
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

  useEffect(() => {
    const touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(touchSupported);
    
    if (gameState === 'Starting') {
      const timeouts = [
          setTimeout(() => setCountdownText('2'), 1000),
          setTimeout(() => setCountdownText('1'), 2000),
          setTimeout(() => setCountdownText('GO!'), 3000),
          setTimeout(() => { setGameState('Playing'); setCountdownText(''); }, 4000)
      ];
      return () => timeouts.forEach(clearTimeout);
    }
  }, [gameState]);

  const handleColleagueCall = useCallback(() => {
    if (colleagueCallsRef.current <= 0 || gameState !== 'Playing') return;

    const lifeAtRiskCars = civiliansRef.current.filter(c => c.isLifeAtRisk);
    const dispatchedCar = dispatchedCallRef.current ? civiliansRef.current.find(c => c.id === dispatchedCallRef.current!.targetVehicleId) : null;

    let targetCar: Civilian | null = null;
    let assistType: 'Life at Risk' | 'Dispatched Call' | null = null;
    
    if (lifeAtRiskCars.length > 0) {
        targetCar = lifeAtRiskCars.reduce((closest, car) => {
            const distToClosest = getDistance(playerRef.current.pos, closest.pos);
            const distToCar = getDistance(playerRef.current.pos, car.pos);
            return distToCar < distToClosest ? car : closest;
        });
        assistType = 'Life at Risk';
    } else if (dispatchedCar) {
        targetCar = dispatchedCar;
        assistType = 'Dispatched Call';
    }

    if (gameMessageTimerRef.current) clearTimeout(gameMessageTimerRef.current);

    if (targetCar && assistType) {
        colleagueCallsRef.current--;
        setGameMessage('COLLEAGUE DISPATCHED TO HIGH-RISK EVENT');
        gameMessageTimerRef.current = window.setTimeout(() => setGameMessage(null), 3000);

        if (assistType === 'Life at Risk') {
            scoreRef.current.livesSaved++;
        } else if (assistType === 'Dispatched Call') {
            scoreRef.current.enforcement += CONSTANTS.DISPATCH_CALL_SCORE_BONUS;
            dispatchedCallRef.current = null;
        }
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
    } else {
        sirenStartTimeRef.current = null;
        player.isSirenActive = false;
    }
  }, []);

  useKeyPress(e => keysPressed.current[e.key] = true, e => keysPressed.current[e.key] = false);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'm' || e.key === 'M') setMinimapMode(prev => prev === 'Tactical' ? 'Strategic' : 'Tactical');
        if (e.key === 'c' || e.key === 'C') handleColleagueCall();
        if (e.key === 'e' || e.key === 'E') handleSirenToggle();
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

    const updatePlayerMovement = (now: number) => {
        const player = playerRef.current;
        const keys = { ...keysPressed.current, ...touchStateRef.current };
        const moveForward = keys['ArrowUp'] || keys['w'] || keys['forward'];
        const moveBackward = keys['ArrowDown'] || keys['s'] || keys['backward'];
        const turnLeft = keys['ArrowLeft'] || keys['a'] || keys['left'];
        const turnRight = keys['ArrowRight'] || keys['d'] || keys['right'];
        const isTryingToBoost = keys['Shift'] || keys['boost'];
        
        player.isBoosting = isTryingToBoost && player.boostCharge >= CONSTANTS.PLAYER_BOOST_DRAIN_RATE && moveForward && !player.isSirenActive;

        if (player.isBoosting) {
            player.boostCharge = Math.max(0, player.boostCharge - CONSTANTS.PLAYER_BOOST_DRAIN_RATE);
        } else if (!player.isSirenActive) {
            player.boostCharge = Math.min(CONSTANTS.PLAYER_BOOST_MAX_CHARGE, player.boostCharge + CONSTANTS.PLAYER_BOOST_RECHARGE_RATE);
        }
        const currentSpeed = Math.sqrt(player.vel.x ** 2 + player.vel.y ** 2);
        player.speed = currentSpeed;
        if (currentSpeed > 0.1) {
            const turnEffectiveness = 1.0 - Math.min(0.5, currentSpeed / (CONSTANTS.PLAYER_MAX_SPEED * 1.5));
            if (turnLeft) player.angle -= CONSTANTS.PLAYER_HANDLING * turnEffectiveness;
            if (turnRight) player.angle += CONSTANTS.PLAYER_HANDLING * turnEffectiveness;
        }
        let thrust = 0;
        if (moveForward) thrust = player.isBoosting ? CONSTANTS.PLAYER_ACCELERATION * CONSTANTS.PLAYER_BOOST_ACCELERATION_MULTIPLIER : CONSTANTS.PLAYER_ACCELERATION;
        if (moveBackward) thrust = -CONSTANTS.PLAYER_ACCELERATION / 2;
        const rads = getRads(player.angle - 90); const forwardVec = { x: Math.cos(rads), y: Math.sin(rads) };
        player.vel.x += forwardVec.x * thrust; player.vel.y += forwardVec.y * thrust;
        const dotForward = player.vel.x * forwardVec.x + player.vel.y * forwardVec.y;
        isBrakingRef.current = moveBackward || (!moveForward && dotForward > 0.1);
        const forwardVelocity = { x: forwardVec.x * dotForward, y: forwardVec.y * dotForward };
        const lateralVelocity = { x: player.vel.x - forwardVelocity.x, y: player.vel.y - forwardVelocity.y };
        forwardVelocity.x *= CONSTANTS.PLAYER_FORWARD_FRICTION; forwardVelocity.y *= CONSTANTS.PLAYER_FORWARD_FRICTION;
        lateralVelocity.x *= CONSTANTS.PLAYER_LATERAL_FRICTION; lateralVelocity.y *= CONSTANTS.PLAYER_LATERAL_FRICTION;
        player.vel.x = forwardVelocity.x + lateralVelocity.x; player.vel.y = forwardVelocity.y + lateralVelocity.y;
        const maxSpeed = player.isBoosting ? CONSTANTS.PLAYER_BOOST_MAX_SPEED : CONSTANTS.PLAYER_MAX_SPEED;
        const finalSpeed = Math.sqrt(player.vel.x ** 2 + player.vel.y ** 2);
        if (finalSpeed > maxSpeed) { const ratio = maxSpeed / finalSpeed; player.vel.x *= ratio; player.vel.y *= ratio; }
        if (finalSpeed < 0.01 && thrust === 0) { player.vel.x = 0; player.vel.y = 0; }
        const lateralSpeed = Math.sqrt(lateralVelocity.x ** 2 + lateralVelocity.y ** 2);
        if (lateralSpeed > CONSTANTS.SKID_LATERAL_VELOCITY_THRESHOLD) skidMarksRef.current.push({ id: now + Math.random(), pos: { ...player.pos }, angle: player.angle, spawnTime: now });
        if (lateralSpeed > CONSTANTS.TIRE_SMOKE_LATERAL_VELOCITY_THRESHOLD) {
            const backOffset = 20; const rads = getRads(player.angle - 90);
            tireSmokeRef.current.push({id: now + Math.random(), pos: {x: player.pos.x - Math.cos(rads) * backOffset, y: player.pos.y - Math.sin(rads) * backOffset}, spawnTime: now});
        }
        player.pos.x += player.vel.x; player.pos.y += player.vel.y;
    };
    
    const updateVigilance = () => {
        const player = playerRef.current;
        const perFrame = 1 / CONSTANTS.FRAMES_PER_SECOND;

        const playerDistrict = getDistrictForPoint(player.pos);
        if (playerDistrict !== lastPlayerDistrictRef.current && lastPlayerDistrictRef.current !== null) {
            player.vigilance += CONSTANTS.VIGILANCE_GAIN_ON_DISTRICT_CHANGE;
        }
        lastPlayerDistrictRef.current = playerDistrict;

        if (player.isBoosting) {
            player.vigilance -= CONSTANTS.VIGILANCE_DECAY_PER_SECOND_BOOSTING * perFrame;
        } else if (player.speed < 1.0) {
            player.vigilance -= CONSTANTS.VIGILANCE_DECAY_PER_SECOND_STATIONARY * perFrame;
        } else if (player.speed < CONSTANTS.PLAYER_MAX_SPEED * 0.9) {
            player.vigilance += CONSTANTS.VIGILANCE_GAIN_PER_SECOND_PATROLLING * perFrame;
        }
        
        player.vigilance = Math.max(0, Math.min(CONSTANTS.VIGILANCE_MAX, player.vigilance));
    };

    const updateDeterrenceAndNeglect = (now: number) => {
        const player = playerRef.current;
        const playerDistrictId = getDistrictForPoint(player.pos);
        let totalDeterrence = 0;
        presenceBoostRateRef.current = 0;

        patrolPostsRef.current.forEach(post => {
            const postDistrictId = getDistrictForPoint(post.pos);
            const district = districtsRef.current.find(d => d.id === postDistrictId);
            if (district) {
                const sizeModifier = Math.min(2.5, 1000000 / (district.bounds.width * district.bounds.height));
                const postBoost = CONSTANTS.DISTRICT_PLAYER_PRESENCE_BASE_BOOST * sizeModifier * CONSTANTS.PATROL_POST_PRESENCE_MULTIPLIER;
                district.deterrence = Math.min(100, district.deterrence + postBoost);
            }
            post.remainingTime--;
        });
        patrolPostsRef.current = patrolPostsRef.current.filter(p => p.remainingTime > 0);
        
        districtsRef.current.forEach(district => {
            let decayMultiplier = 1.0;
            if (isNeglectOfDutyActiveRef.current) decayMultiplier = CONSTANTS.NEGLECT_OF_DUTY_DETERRENCE_DECAY_MULTIPLIER;
            district.deterrence = Math.max(0, district.deterrence - CONSTANTS.DISTRICT_DECAY_RATE * decayMultiplier);
            
            if (district.id === playerDistrictId) {
                // Clamp the size modifier to prevent extreme deterrence gain in very small districts.
                const sizeModifier = Math.min(2.5, 1000000 / (district.bounds.width * district.bounds.height)); 
                let boost = CONSTANTS.DISTRICT_PLAYER_PRESENCE_BASE_BOOST * sizeModifier;
                if (player.isSirenActive) boost += CONSTANTS.DISTRICT_SIREN_BOOST;
                district.deterrence = Math.min(100, district.deterrence + boost);
                presenceBoostRateRef.current = boost;
            }
            totalDeterrence += district.deterrence;
        });

        avgDeterrenceRef.current = totalDeterrence / districtsRef.current.length;
        isVigilanceBonusActiveRef.current = districtsRef.current.every(d => d.deterrence >= CONSTANTS.DETERRENCE_VIGILANCE_THRESHOLD);

        const deterrenceMultiplier = CONSTANTS.DETERRENCE_MULTIPLIER_MIN + (avgDeterrenceRef.current / 100) * (CONSTANTS.DETERRENCE_MULTIPLIER_MAX - CONSTANTS.DETERRENCE_MULTIPLIER_MIN);
        scoreRef.current.deterrence += (avgDeterrenceRef.current / 100) * (CONSTANTS.DETERRENCE_SCORE_RATE / CONSTANTS.FRAMES_PER_SECOND) * (isVigilanceBonusActiveRef.current ? CONSTANTS.VIGILANCE_BONUS_MULTIPLIER : 1) * deterrenceMultiplier;

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

                if (isInHighDeterrenceZone) {
                    const totalTime = CONSTANTS.NEGLECT_OF_DUTY_TIME_THRESHOLD;
                    const timeLeft = totalTime - stationaryDuration;
                    setStationaryCountdown(timeLeft > 0 ? { type: 'neglect', timeLeft, totalTime } : null);
                } else {
                    const totalTime = CONSTANTS.PATROL_POST_SETUP_TIME;
                    const timeLeft = totalTime - stationaryDuration;
                    setStationaryCountdown(timeLeft > 0 ? { type: 'patrolPost', timeLeft, totalTime } : null);
                }

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
            setStationaryCountdown(null);
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

    const handleCollisionsAndInteractions = (now: number) => {
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

    const updateCiviliansAndSpawners = (now: number) => {
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
                c.lifeAtRiskTimer -= 1;
                if (c.lifeAtRiskTimer <= 0) {
                    scoreRef.current.livesLost++;
                    explosionsRef.current.push({ id: Math.random(), pos: c.pos, spawnTime: now });
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
                    if (dot > 0.5) { // In a cone in front of the player
                        c.isYieldingToSiren = true;
                    }
                }
            }

            if (c.isYieldingToSiren) {
                targetSpeed *= CONSTANTS.SIREN_YIELD_SLOWDOWN_FACTOR;
            } else if (c.ridsType === 'Distractions') {
                c.speedFluctuationTimer = (c.speedFluctuationTimer || 0) - 1;
                if (c.speedFluctuationTimer <= 0) {
                    c.speedFluctuationTimer = Math.random() * 120 + 60;
                    c.speedFluctuationTarget = 0.5 + Math.random();
                }
                targetSpeed *= c.speedFluctuationTarget!;
            }

            c.speed += (targetSpeed - c.speed) * 0.08;
            c.isBraking = c.speed > targetSpeed + 0.1;
            c.pos.x += segmentDir.x * c.speed;
            c.pos.y += segmentDir.y * c.speed;
            if (c.ridsType === 'Impairment') {
                c.swerveAngle = ((c.swerveAngle || 0) + 0.04) % (Math.PI * 2);
                const perpVec = { x: -segmentDir.y, y: segmentDir.x };
                c.pos.x += perpVec.x * Math.sin(c.swerveAngle) * 2;
                c.pos.y += perpVec.y * Math.sin(c.swerveAngle) * 2;
            }
            c.angle = Math.atan2(segmentDir.y, segmentDir.x) * (180 / Math.PI) + 90;
            c.vel.x = segmentDir.x * c.speed; c.vel.y = segmentDir.y * c.speed;
            const carVec = { x: c.pos.x - startNode.pos.x, y: c.pos.y - startNode.pos.y };
            const distAlongSegment = carVec.x * segmentDir.x + carVec.y * segmentDir.y;
            if (distAlongSegment >= segmentLen) {
                c.pos = { ...targetPos };
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

    const updateParticlesAndEffects = (now: number) => {
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
            blob.pos.x += blob.vel.x; blob.pos.y += blob.vel.y;
            if (getDistanceSq(playerPos, blob.pos) < 25 ** 2) {
                const playerDistrictId = getDistrictForPoint(playerPos);
                const district = districtsRef.current.find(d => d.id === playerDistrictId);
                if(district) district.deterrence = Math.min(100, district.deterrence + blob.value * 4);
                collectionEffectsRef.current.push({ id: Math.random(), pos: blob.pos, spawnTime: now });
                return false;
            } return true;
        });
        
        collectionEffectsRef.current = collectionEffectsRef.current.filter(e => now - e.spawnTime < 400);
        floatingScoreTextsRef.current = floatingScoreTextsRef.current.filter(f => now - f.spawnTime < CONSTANTS.FLOATING_SCORE_TEXT_LIFESPAN);
        sparksRef.current = sparksRef.current.map(s => ({ ...s, pos: { x: s.pos.x + s.vel.x, y: s.pos.y + s.vel.y }})).filter(s => now - s.spawnTime < CONSTANTS.SPARK_LIFESPAN);
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
            } else if (dispatchedCallRef.current) {
                const dispatchedCar = civiliansRef.current.find(c => c.id === dispatchedCallRef.current!.targetVehicleId);
                if (dispatchedCar) target = dispatchedCar;
                else dispatchedCallRef.current = null;
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
    
    const updateCamera = (now: number) => {
        const player = playerRef.current;
        const targetZoom = player.isBoosting ? 0.85 : (isBrakingRef.current && player.speed > 2 ? 1.02 : 1.0);
        cameraRef.current.zoom += (targetZoom - cameraRef.current.zoom) * 0.04;
        if (player.isBoosting) cameraRef.current.shake = Math.max(cameraRef.current.shake, 4);
        cameraRef.current.shake *= 0.92;

        const lookAheadDist = player.speed * 8;
        const rads = getRads(player.angle - 90);
        const targetPos = { x: player.pos.x + Math.cos(rads) * lookAheadDist, y: player.pos.y + Math.sin(rads) * lookAheadDist };
        cameraPosRef.current.x += (targetPos.x - cameraPosRef.current.x) * 0.05;
        cameraPosRef.current.y += (targetPos.y - cameraPosRef.current.y) * 0.05;
    };

  const handleEnforce = useCallback(() => { setGameState('MiniGame'); }, []);
  
  const handleWarn = useCallback(() => {
      if (activeRids) {
        let scoreToAdd = CONSTANTS.WARN_SCORE_POINTS;
        if (isVigilanceBonusActiveRef.current) scoreToAdd *= CONSTANTS.VIGILANCE_BONUS_MULTIPLIER;
        scoreRef.current.enforcement += scoreToAdd;
        playerRef.current.vigilance = Math.min(CONSTANTS.VIGILANCE_MAX, playerRef.current.vigilance + CONSTANTS.VIGILANCE_GAIN_ON_INTERVENTION);
        floatingScoreTextsRef.current.push({ id: Math.random(), pos: activeRids.car.pos, text: `+${scoreToAdd}`, spawnTime: Date.now() });
        floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: playerRef.current.pos.x, y: playerRef.current.pos.y - 60 }, text: `VIGILANCE +${CONSTANTS.VIGILANCE_GAIN_ON_INTERVENTION}`, spawnTime: Date.now() });
        const district = districtsRef.current.find(d => d.id === activeRids.car.district);
        if(district) district.deterrence = Math.min(100, district.deterrence + CONSTANTS.WARN_DETERRENCE_BOOST);
        enforcementActionsRef.current.push({pos: activeRids.car.pos, ridsType: activeRids.ridsType, actionType: 'Warn'});
        civiliansRef.current = civiliansRef.current.filter(c => c.id !== activeRids.car.id);
        if (activeRids.car.isLifeAtRisk) scoreRef.current.livesSaved++;
        if (dispatchedCallRef.current?.targetVehicleId === activeRids.car.id) {
            scoreRef.current.enforcement += CONSTANTS.DISPATCH_CALL_SCORE_BONUS;
            dispatchedCallRef.current = null;
        }
      }
      setActiveRids(null); setTargetedCarId(null); setGameState('Playing');
  }, [activeRids]);
    
  // Keyboard controls for RIDS Choice modal
  useEffect(() => {
    if (gameState === 'RidsChoice') {
        const handleKeyDown = (e: KeyboardEvent) => {
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
        const finalDeterrenceBonus = districtsRef.current.reduce((total, district) => {
            const districtScore = (district.deterrence - 50) * CONSTANTS.FINAL_DETERRENCE_SCORE_MULTIPLIER;
            return total + districtScore;
        }, 0);

        const finalBreakdown: FinalScoreBreakdown = {
            enforcementScore: scoreRef.current.enforcement,
            deterrenceScore: Math.round(scoreRef.current.deterrence),
            finalDeterrenceBonus: Math.round(finalDeterrenceBonus),
            livesSavedBonus: scoreRef.current.livesSaved * CONSTANTS.LIVES_SAVED_SCORE_BONUS,
            livesLostPenalty: scoreRef.current.livesLost * CONSTANTS.LIVES_LOST_PENALTY,
            finalScore: Math.round(scoreRef.current.enforcement + scoreRef.current.deterrence + finalDeterrenceBonus) + (scoreRef.current.livesSaved * CONSTANTS.LIVES_SAVED_SCORE_BONUS) - (scoreRef.current.livesLost * CONSTANTS.LIVES_LOST_PENALTY),
            patrolPath: patrolPathRef.current,
            enforcementActions: enforcementActionsRef.current,
            colleagueCallActions: colleagueCallActionsRef.current,
        };
        onGameOver(finalBreakdown);
        return;
    }
    timeLeftRef.current -= 1 / CONSTANTS.FRAMES_PER_SECOND;
    
    updatePlayerMovement(now);
    updateVigilance();
    updateCiviliansAndSpawners(now);
    updateDeterrenceAndNeglect(now);
    handleCollisionsAndInteractions(now);
    updateParticlesAndEffects(now);
    updatePathfinding(now);
    updateCamera(now);
    
    forceUpdate();
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [onGameOver, spawnCivilian, segmentLookup, handleColleagueCall, gameState]);

  const onMiniGameComplete = useCallback((success: boolean) => {
    if (activeRids) {
      if (success) {
        const district = districtsRef.current.find(d => d.id === activeRids.car.district);
        const ruralBonus = district?.name.includes('Rural') ? CONSTANTS.RURAL_BONUS : 0;
        let scoreToAdd = CONSTANTS.BASE_ENFORCEMENT_POINTS[activeRids.ridsType] + ruralBonus;
        if (isVigilanceBonusActiveRef.current) scoreToAdd *= CONSTANTS.VIGILANCE_BONUS_MULTIPLIER;
        scoreRef.current.enforcement += scoreToAdd;
        playerRef.current.vigilance = Math.min(CONSTANTS.VIGILANCE_MAX, playerRef.current.vigilance + CONSTANTS.VIGILANCE_GAIN_ON_INTERVENTION);
        floatingScoreTextsRef.current.push({ id: Math.random(), pos: activeRids.car.pos, text: `+${scoreToAdd}`, spawnTime: Date.now() });
        floatingScoreTextsRef.current.push({ id: Math.random(), pos: { x: playerRef.current.pos.x, y: playerRef.current.pos.y - 60 }, text: `VIGILANCE +${CONSTANTS.VIGILANCE_GAIN_ON_INTERVENTION}`, spawnTime: Date.now() });
        if(district) district.deterrence = Math.min(100, district.deterrence + CONSTANTS.ENFORCEMENT_DETERRENCE_BOOST);
        enforcementActionsRef.current.push({pos: activeRids.car.pos, ridsType: activeRids.ridsType, actionType: 'Enforce'});
        civiliansRef.current = civiliansRef.current.filter(c => c.id !== activeRids.car.id);
        cameraRef.current.shake = 10;
        if (activeRids.car.isLifeAtRisk) scoreRef.current.livesSaved++;
        if (dispatchedCallRef.current?.targetVehicleId === activeRids.car.id) {
            scoreRef.current.enforcement += CONSTANTS.DISPATCH_CALL_SCORE_BONUS;
            dispatchedCallRef.current = null;
        }
      } else {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - CONSTANTS.RIDS_TIME_PENALTY_MINIGAME_FAIL);
      }
      setActiveRids(null);
    }
    setTargetedCarId(null); setGameState('Playing');
  }, [activeRids]);

  useEffect(() => {
    if (gameState === 'Playing' || gameState === 'Starting') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [gameState, gameLoop]);
  
  const player = playerRef.current;
  const camera = cameraRef.current;
  const cameraPos = cameraPosRef.current;
  const shakeX = camera.shake > 0 ? Math.random() * camera.shake - camera.shake / 2 : 0;
  const shakeY = camera.shake > 0 ? Math.random() * camera.shake - camera.shake / 2 : 0;
  const playerDistrict = getDistrictForPoint(player.pos);
  const totalScore = Math.round(scoreRef.current.enforcement + scoreRef.current.deterrence) + (scoreRef.current.livesSaved * CONSTANTS.LIVES_SAVED_SCORE_BONUS) - (scoreRef.current.livesLost * CONSTANTS.LIVES_LOST_PENALTY);
  const activeLarCar = civiliansRef.current.find(c => c.isLifeAtRisk);
  const shouldFlashColleagueAssist = activeLarCar 
      ? (activeLarCar.lifeAtRiskTimer / CONSTANTS.FRAMES_PER_SECOND) < CONSTANTS.COLLEAGUE_ASSIST_FLASH_THRESHOLD_SECONDS
      : false;

  return (
    <div className="w-full h-full bg-black overflow-hidden relative">
       {gameState === 'Starting' && countdownText && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                <h1 key={countdownText} className="text-9xl font-display text-cyan-400 animate-scale-up-and-fade">
                    {countdownText}
                </h1>
            </div>
        )}
      <div 
        className="absolute top-0 left-0" 
        style={{ 
            width: `${CONSTANTS.WORLD_WIDTH}px`, 
            height: `${CONSTANTS.WORLD_HEIGHT}px`,
            transformOrigin: `${cameraPos.x}px ${cameraPos.y}px`,
            transform: `translate(${-cameraPos.x + CONSTANTS.VIEWPORT_WIDTH/2 + shakeX}px, ${-cameraPos.y + CONSTANTS.VIEWPORT_HEIGHT/2 + shakeY}px) scale(${camera.zoom})`,
        }}>
        <GameMap />
        {highlightedPathRef.current && (
            <svg width={CONSTANTS.WORLD_WIDTH} height={CONSTANTS.WORLD_HEIGHT} className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 2 }}>
                <polyline
                    points={highlightedPathRef.current.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none" stroke="rgba(253, 224, 71, 0.6)" strokeWidth="30"
                    strokeLinecap="round" strokeLinejoin="round" className="animate-path-flow" />
            </svg>
        )}
        {patrolPostsRef.current.map(post => <PatrolPostAura key={post.id} post={post} />)}
        {skidMarksRef.current.map(skid => <SkidMarkComponent key={skid.id} skid={skid} />)}
        {tireSmokeRef.current.map(smoke => (
            <div key={smoke.id} className="absolute w-8 h-8 bg-white/50 rounded-full animate-fade-out-smoke" style={{ left: smoke.pos.x, top: smoke.pos.y, transform: 'translate(-50%, -50%)', zIndex: 2}}></div>
        ))}
        {civiliansRef.current.map(car => <CivilianCar key={car.id} car={car} isTargeted={car.id === targetedCarId} isPathfindingTarget={car.id === pathfindingTargetIdRef.current} isYielding={!!car.isYieldingToSiren} />)}
        <PlayerCar player={player} isBraking={isBrakingRef.current} />
        {deterrenceBlobsRef.current.map(blob => <DeterrenceBlob key={blob.id} blob={blob} />)}
        {collectionEffectsRef.current.map(effect => <CollectionEffect key={effect.id} effect={effect} />)}
        {sparksRef.current.map(spark => <SparksEffect key={spark.id} spark={spark} />)}
        {floatingScoreTextsRef.current.map(text => <FloatingScoreText key={text.id} data={text} />)}
        {explosionsRef.current.map(exp => <Explosion key={exp.id} explosion={exp} />)}
      </div>
      <div className={`boost-overlay ${player.isBoosting ? 'active' : ''}`}></div>
      {player.isBoosting && (
        <div className="speed-lines-overlay">
            {speedLines.map((style, i) => (
                <div key={i} className="speed-line" style={style} />
            ))}
        </div>
      )}
      <HUD 
          score={totalScore} timeLeft={Math.ceil(timeLeftRef.current)} player={player} civilians={civiliansRef.current}
          districts={districtsRef.current} playerDistrict={playerDistrict} livesLost={scoreRef.current.livesLost}
          dispatchedCall={dispatchedCallRef.current} isTouchDevice={isTouchDevice} camera={{x: cameraPos.x - (CONSTANTS.VIEWPORT_WIDTH/camera.zoom)/2, y: cameraPos.y - (CONSTANTS.VIEWPORT_HEIGHT/camera.zoom)/2}}
          minimapMode={minimapMode} colleagueCalls={colleagueCallsRef.current} gameMessage={gameMessage}
          isVigilanceBonusActive={isVigilanceBonusActiveRef.current} isNeglectOfDutyActive={isNeglectOfDutyActiveRef.current} presenceBoostRate={presenceBoostRateRef.current}
          stationaryCountdown={stationaryCountdown}
          shouldFlashColleagueAssist={shouldFlashColleagueAssist} />
      {gameState === 'RidsChoice' && <RidsChoiceModal onEnforce={handleEnforce} onWarn={handleWarn} selection={ridsChoiceSelection} />}
      {gameState === 'MiniGame' && activeRids && (
        <MiniGameModal onComplete={onMiniGameComplete} ridsType={activeRids.ridsType} />
      )}
       {isTouchDevice && gameState === 'Playing' && (
        <TouchControls 
            onControlChange={handleControlChange} 
            onRidsCheck={handleRidsCheck}
            onSirenToggle={handleSirenToggle}
            onColleagueCall={handleColleagueCall}
        />
      )}
    </div>
  );
};

export default Game;