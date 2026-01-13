export type GameState = 'MainMenu' | 'Tutorial' | 'Playing' | 'RidsChoice' | 'MiniGame' | 'GameOver';
export type RIDSType = 'Restraints' | 'Impairment' | 'Distractions' | 'Speed';
export type RoadZone = 'Rural' | 'Suburban';
export type RoadType = 'Motorway' | 'Primary' | 'Suburban' | 'Rural' | 'Industrial';
export type MinimapMode = 'Tactical' | 'Strategic';

export interface Vehicle {
  id: number;
  pos: { x: number; y: number };
  vel: { x: number; y: number };
  angle: number;
  speed: number;
}

export interface Player extends Vehicle {
    boostCharge: number;
    isBoosting: boolean;
    isSirenActive: boolean;
    vigilance: number;
}

export type DistrictName = 'Karori North' | 'Karori West' | 'Karori Central' | 'Karori East' | 'Karori';

export interface District {
  id: DistrictName;
  name: string;
  bounds: { x: number; y: number; width: number; height: number; };
  deterrence: number;
}

export interface Civilian extends Vehicle {
  ridsType: RIDSType | null;
  zone: RoadZone;
  district: DistrictName;
  path: string[];
  pathIndex: number;
  spawnTime: number;
  isDeterred: boolean;
  baseSpeed: number;
  lastBlobSpawnTime: number;
  deterrenceBlobsRemaining: number;
  isLifeAtRisk: boolean;
  lifeAtRiskTimer: number;
  roadType?: RoadType;
  isBraking?: boolean;
  swerveAngle?: number;
  speedFluctuationTimer?: number;
  speedFluctuationTarget?: number;
  isYieldingToSiren?: boolean;
  patrolPostBonusApplied?: boolean;
}

export interface EnforcementAction {
  pos: { x: number; y: number };
  ridsType: RIDSType;
  actionType: 'Enforce' | 'Warn';
}

export interface ColleagueCallAction {
  pos: { x: number; y: number };
  targetVehicleId: number;
}

export interface FinalScoreBreakdown {
  enforcementScore: number;
  deterrenceScore: number;
  finalDeterrenceBonus: number;
  livesSavedBonus: number;
  livesLostPenalty: number;
  finalScore: number;
  patrolPath: { x: number; y: number }[];
  enforcementActions: EnforcementAction[];
  colleagueCallActions: ColleagueCallAction[];
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  email?: string;
  timestamp?: number;
}

export interface MiniGameProps {
  onComplete: (success: boolean) => void;
  ridsType: RIDSType;
}

export type DriverProfile = 'Repeat Offender' | 'Young Driver' | 'Tired Driver';
export type PartnerReferral = 'ACC' | 'Waka Kotahi' | 'Community Patrols';

export const REFERRAL_PAIRS: Record<DriverProfile, PartnerReferral> = {
  'Repeat Offender': 'Waka Kotahi',
  'Young Driver': 'ACC',
  'Tired Driver': 'Community Patrols',
};

export interface DeterrenceBlob {
  id: number;
  pos: { x: number; y: number };
  vel: { x: number; y: number };
  value: number;
  spawnTime: number;
}

export interface CollectionEffect {
  id: number;
  pos: { x: number; y: number };
  spawnTime: number;
}

export interface DispatchedCall {
    id: number;
    pos: { x: number; y: number };
    targetVehicleId: number;
    timeLeft: number;
    active: boolean;
}

export interface SparkParticle {
    id: number;
    pos: { x: number; y: number };
    vel: { x: number; y: number };
    spawnTime: number;
}

export interface TireSmokeParticle {
    id: number;
    pos: { x: number; y: number };
    spawnTime: number;
}

export interface SkidMark {
    id: number;
    pos: { x: number; y: number };
    angle: number;
    spawnTime: number;
}

export interface FloatingScoreText {
    id: number;
    pos: { x: number; y: number };
    text: string;
    spawnTime: number;
}

export interface Explosion {
    id: number;
    pos: { x: number; y: number };
    spawnTime: number;
}

export interface PatrolPost {
  id: number;
  pos: { x: number; y: number };
  remainingTime: number;
}

export type StationaryCountdown = {
  type: 'patrolPost' | 'neglect';
  timeLeft: number;
  totalTime: number;
} | null;
