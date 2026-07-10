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

export type VehicleType = 'car' | 'ute' | 'truck' | 'bus' | 'bike' | 'camper';

export interface Civilian extends Vehicle {
  ridsType: RIDSType | null;
  /** The once-per-shift interdiction car: a full investigation uncovers a major crime. */
  specialCrime?: { crime: string; reveal: string; detail: string; missed: string };
  /** Yesterday's daily #1, patrolling tonight's map as a friendly unit. Never an offender. */
  isChampion?: boolean;
  /** Traffic variety: size/speed/render vary; campers wander a little (tourists, eh). */
  vehicleType?: VehicleType;
  /** Fairness: which offender-schedule slot this car consumed (referral roll lives there). */
  slotIndex?: number;
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
  /** Active response window remaining, in simulation seconds. */
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
  actionType: 'Investigate' | 'Standard';
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
  /** Offenders the spawner never created because deterrence was high — the teaching headline. */
  offencesPrevented: number;
  /** Raw counts (bonuses alone can't recover them — colleague saves pay a different rate). */
  livesSaved: number;
  livesLost: number;
  /** The once-per-shift interdiction car: what it was carrying and whether the stop found it. */
  interdiction: { crime: string; detail: string; outcome: 'busted' | 'missed' } | null;
  /** Earned the +30s by holding FULL COVERAGE at the final whistle. */
  overtime: boolean;
  /** Fraction of the shift with every district ≥50% deterrence. */
  coverageRatio: number;
  /** Grade derived from coverageRatio: S ≥0.9, A ≥0.7, B ≥0.45, else C. */
  presenceGrade: 'S' | 'A' | 'B' | 'C';
  /** Whether the explicit untimed decision-challenge assist was used for this shift. */
  challengeAssist: boolean;
}

export interface LeaderboardEntry {
  id?: number;
  name: string;
  score: number;
  timestamp?: number;
  station?: string | null;
  kudos?: number;
  /** Daily attempts before this score (best-of-N transparency). */
  attempts?: number | null;
}

export interface MiniGameProps {
  onComplete: (success: boolean) => void;
  ridsType: RIDSType;
  difficulty?: number; // 0 (shift start) .. 1 (shift end) — scales enforcement mini-game challenge
  /** Freezes interaction and active-time timers while the game is paused/hidden. */
  paused?: boolean;
  /** Seeded daily scenario selector; random/free shifts may omit it. */
  scenarioIndex?: number;
  /** Explicit player-selected untimed decision alternative. */
  challengeAssist?: boolean;
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
    /** 'speech' renders as a wee kiwi speech bubble instead of rising score text. */
    variant?: 'score' | 'speech';
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
