// FIX: Import RIDSType to resolve type errors.
import { RIDSType, District, DistrictName, RoadType } from './types';

export const VIEWPORT_WIDTH = 1280;
export const VIEWPORT_HEIGHT = 720;
export const WORLD_WIDTH = VIEWPORT_WIDTH * 3;
export const WORLD_HEIGHT = VIEWPORT_HEIGHT * 3;
export const ROAD_WIDTH = 90; // Approx 3 lanes wide
export const CAR_RADIUS = 25;


// Game Timer
export const SHIFT_DURATION = 90; // 1.5 minutes in seconds
export const FRAMES_PER_SECOND = 60;

// Player Car (New Arcade-Style Controls)
export const PLAYER_ACCELERATION = 0.2;
export const PLAYER_MAX_SPEED = 7;
export const PLAYER_HANDLING = 5.4; // How fast the car turns - INCREASED for responsiveness
export const PLAYER_FORWARD_FRICTION = 0.98; // Grip in the direction of travel
export const PLAYER_LATERAL_FRICTION = 0.90; // Grip for sideways movement (lower = less drift / more grip) - INCREASED GRIP
export const PLAYER_AURA_RADIUS = 60; // pixels - Base radius, REBALANCED from 125
export const PLAYER_SIREN_AURA_RADIUS = 100; // Larger aura for active siren - Base radius, REBALANCED from 200
export const PLAYER_BOOST_MAX_SPEED = 15;
export const PLAYER_BOOST_ACCELERATION_MULTIPLIER = 2.5;
export const PLAYER_BOOST_MAX_CHARGE = 100;
export const PLAYER_BOOST_DRAIN_RATE = 1.2; // per frame
export const PLAYER_SIREN_DRAIN_RATE = 0.35; // per frame - Increased from 0.2
export const PLAYER_SIREN_MAX_DURATION = 5000; // 5 seconds in ms
export const PLAYER_BOOST_RECHARGE_RATE = 0.3; // per frame
export const MAX_COLLEAGUE_CALLS = 3;
export const SIREN_YIELD_RADIUS = 350;
export const SIREN_YIELD_SLOWDOWN_FACTOR = 0.2;


// Vigilance System (New)
export const VIGILANCE_MAX = 100;
export const VIGILANCE_GAIN_PER_SECOND_PATROLLING = 1.5;
export const VIGILANCE_GAIN_ON_DISTRICT_CHANGE = 0; // REBALANCED: No longer gained from crossing borders.
export const VIGILANCE_GAIN_ON_INTERVENTION = 25; // REBALANCED: Major source of Vigilance is now enforcement.
export const VIGILANCE_DECAY_PER_SECOND_STATIONARY = 3.0;
export const VIGILANCE_DECAY_PER_SECOND_BOOSTING = 4.0;
export const VIGILANCE_AURA_BONUS_MAX = 125; // Max additional pixels to aura radius

// Patrol Post System (New)
// ponytail:tune — fable-audit B10: 10s stationary (−30 vigilance) for a ~1.3x boost was a trap
// (one Warn beat it). Halved setup, posts now meaningfully outperform driving presence.
export const PATROL_POST_SETUP_TIME = 5; // seconds player must be stationary (was 10)
export const PATROL_POST_DURATION = 30 * FRAMES_PER_SECOND; // 30 seconds in frames

export const PATROL_POST_PRESENCE_MULTIPLIER = 3.0; // was 1.30 — posts must beat a drive-by to be worth the vigilance cost
export const PATROL_POST_RADIUS = 150; // Visual radius of the post's aura
export const PATROL_POST_LAR_TIME_BONUS_SECONDS = 5; // Time bonus in seconds

// Arcade Effects & Abilities
export const SPARK_COUNT = 7;
export const SPARK_LIFESPAN = 400; // ms
export const SKID_LATERAL_VELOCITY_THRESHOLD = 1.8; // Speed of sideways slide to trigger skids
export const SKID_MARK_LIFESPAN = 8000; // ms
export const TIRE_SMOKE_LATERAL_VELOCITY_THRESHOLD = 2.2;
export const TIRE_SMOKE_PARTICLE_LIFESPAN = 1000; // ms
export const EXPLOSION_LIFESPAN = 1000; // ms
export const EXPLOSION_MAX_RADIUS = 150; // pixels

// "Lives at Risk" System
export const LIFE_AT_RISK_CHANCE = 0.25; // Chance for a high-risk RIDS to be "Life at Risk"
export const LIFE_AT_RISK_TIMER_SECONDS = 15; // How long player has to intervene
// Rebalanced (gd-0wi.12): a single LAR save was 5000 (~10-16 enforcements) and dominated
// scoring, rewarding reactive LAR-chasing over the general-deterrence patrol the game teaches.
// Halved so saves matter but sustained deterrence + enforcement stay the main economy.
export const LIVES_SAVED_SCORE_BONUS = 2500;
export const LIVES_LOST_PENALTY = 2500;
export const LIFE_AT_RISK_DISTRICT_MODIFIER: Record<DistrictName, number> = {
    'Karori North': 1.5,   // Rural: 50% higher chance
    'Karori West': 1.0,    // Suburban: Baseline
    'Karori Central': 0.8, // Town Centre: 20% lower chance
    'Karori East': 1.8,    // Motorway: 80% higher chance
    'Karori': 1.2,
};


// Dispatched Call System
export const DISPATCH_CALL_INTERVAL_SECONDS = 20; // How often a call can occur
export const DISPATCH_CALL_CHANCE = 0.7; // Chance of a call happening at the interval
export const DISPATCH_CALL_DURATION_SECONDS = 20;
export const DISPATCH_CALL_SCORE_BONUS = 5000;

// Districts & Regional Deterrence
// Boundaries are now defined in mapData.ts and imported by geometry.ts
export const DISTRICT_DECAY_RATE = 0.007; // Slower decay per frame
export const DISTRICT_PLAYER_PRESENCE_BASE_BOOST = 0.022; // Base boost per frame, REBALANCED from 0.09
export const DISTRICT_SIREN_BOOST = 0.025; // Slow, constant boost from siren presence
// ponytail:tune — fable-audit B2: at 32, one Enforce equalled ~53 minutes of rural presence,
// making punishment (not presence) the #1 deterrence-meter mover — the opposite of the lesson.
export const ENFORCEMENT_DETERRENCE_BOOST = 20; // was 32
export const WARN_DETERRENCE_BOOST = 12; // Smaller boost for a warning, increased from 5
export const COLLEAGUE_DETERRENCE_BOOST = 18; // Boost for using colleague assist
export const DETERRENCE_HOTSPOT_THRESHOLD = 33; // Below this, a district is a hotspot

// Deterrence Blobs
export const DETERRENCE_BLOB_BASE_VALUE = 0.5;
export const DETERRENCE_BLOB_SPEED = 3;
export const DETERRENCE_BLOB_LIFESPAN = 3000; // 3 seconds in ms
export const DETERRENCE_BLOB_SPAWN_INTERVAL = 500; // 0.5 seconds in ms
export const MAX_DETERRENCE_BLOBS_PER_OFFENDER = 5;

// RIDS
export const RIDS_SPAWN_INTERVAL = 500; // Faster spawn interval
export const RIDS_TIME_PENALTY_INCORRECT_CHECK = 3; // seconds
export const RIDS_TIME_PENALTY_MINIGAME_FAIL = 3; // was 7 (per audit: a 7s fail skewed choice toward the safe Warn). ponytail: tune to taste after playtest

export const RIDS_SPAWN_CHANCE_BY_ROAD_TYPE: Record<RoadType, Record<RIDSType, number>> = {
    Motorway:   { Speed: 0.8, Distractions: 0.2, Impairment: 0, Restraints: 0 },
    Primary:    { Speed: 0.3, Distractions: 0.4, Impairment: 0.2, Restraints: 0.1 },
    Suburban:   { Speed: 0.1, Distractions: 0.3, Restraints: 0.5, Impairment: 0.1 },
    Rural:      { Speed: 0.5, Impairment: 0.4, Restraints: 0.1, Distractions: 0 },
    Industrial: { Restraints: 0.4, Impairment: 0.3, Speed: 0.2, Distractions: 0.1 },
};

// Scoring
export const WARN_SCORE_POINTS = 150; // was 100 — ponytail:tune, narrows the Warn/Enforce gap (fable-audit C)
export const BASE_ENFORCEMENT_POINTS: { [key in RIDSType]: number } = {
  Impairment: 500,
  Speed: 400,
  Restraints: 300,
  Distractions: 300,
};
export const RURAL_BONUS = 100;
export const REFERRAL_BONUS = 200;
// Chance a successful Impairment/Restraints enforcement opens a follow-up referral
// mini-game (the fourth pillar — MatchingGame was built but never wired). ponytail:tune
export const REFERRAL_CHANCE = 0.25;
export const ENFORCEMENT_BONUS_POINTS = 150;
// ponytail:tune — fable-audit B6: reward SUSTAINED coverage over an end-of-shift snapshot.
// The ±12,500-swing final bonus invited a last-20s blitz that ignored 70s of neglect.
export const DETERRENCE_SCORE_RATE = 40; // was 25 (and 10 before that) — continuous accrual is the main deterrence income
export const FINAL_DETERRENCE_SCORE_MULTIPLIER = 25; // was 50 — points per percentage point over/under 50 at shift end
// The advertised Warn/Enforce tradeoff: Enforce pays more but costs real shift time
// (the shift clock freezes during modals, so without this the "slow" option was free).
export const ENFORCE_TIME_COST_SECONDS = 6;
// Colleague saves pay half a personal save — attending yourself must stay the best play
// (fable-audit B9: 3 free auto-targeted +2500 saves strictly dominated driving there).
export const COLLEAGUE_SAVE_SCORE_BONUS = 1250;
export const DETERRENCE_MULTIPLIER_MIN = 1.0;
export const DETERRENCE_MULTIPLIER_MAX = 1.5;
export const FLOATING_SCORE_TEXT_LIFESPAN = 2000; // ms

// Vigilance Bonus System
export const DETERRENCE_VIGILANCE_THRESHOLD = 85; // % deterrence needed in all districts
export const VIGILANCE_BONUS_MULTIPLIER = 2.0;

// Neglect of Duty System
export const NEGLECT_OF_DUTY_TIME_THRESHOLD = 10; // seconds before penalty
export const NEGLECT_OF_DUTY_DETERRENCE_THRESHOLD = 66; // Deterrence level above which idling is penalized
export const NEGLECT_OF_DUTY_RESET_DISTANCE = 150; // pixels player must travel to reset
export const NEGLECT_OF_DUTY_DETERRENCE_DECAY_MULTIPLIER = 2.0;
export const NEGLECT_OF_DUTY_LAR_CHANCE_MULTIPLIER = 2.5; // 150% increase
export const NEGLECT_OF_DUTY_LAR_TIMER_MULTIPLIER = 0.75; // 25% reduction
export const COLLEAGUE_ASSIST_FLASH_THRESHOLD_SECONDS = 5; // When to start flashing UI

// Offences Prevented: each deterrence-suppressed offender "slot" counts as one prevented
// offence per this many seconds (a suppressed slot ~= one offence that never happened).
export const OFFENCE_PREVENTED_TURNOVER_SECONDS = 20; // ponytail:tune

// Civilian Cars & Traffic Density
export const MAX_CIVILIAN_CARS = 80; // More cars overall
export const TARGET_OFFENDER_COUNT = 7; // Target number of RIDS offenders on the map, scaled by deterrence
export const MIN_TARGET_OFFENDER_COUNT = 3; // Always have at least this many offenders
export const CIVILIAN_TARGET_DENSITY: Record<DistrictName, number> = {
    'Karori North': 10,  // Sparse
    'Karori West': 20,   // Moderate
    'Karori Central': 35, // Dense
    'Karori East': 15,  // Motorway
    'Karori': 4,
};

export const CIVILIAN_SPEED_VARIATION = 0.4;
export const CIVILIAN_BASE_SPEED: Record<DistrictName, number> = {
    'Karori North': 2.5, // Faster rural
    'Karori West': 1.5,
    'Karori Central': 1.2,
    'Karori East': 3.0, // Motorway speed
    'Karori': 1.0,
};
export const CIVILIAN_SPEEDING_SPEED: Record<DistrictName, number> = {
    'Karori North': 3.8, // Faster rural speeding
    'Karori West': 2.5,
    'Karori Central': 2.0,
    'Karori East': 4.2, // Motorway speeding
    'Karori': 1.8,
};


// UI
export const MINIMAP_WIDTH = 200;
export const MINIMAP_HEIGHT = 200;
export const MINIMAP_VIEW_RANGE = 1200; // World units visible from the center of the minimap

// Per-second rates for delta-time based game loop.
// Must come AFTER all base constants — TDZ at module evaluation otherwise.
export const DT_BOOST_DRAIN_PER_SEC = PLAYER_BOOST_DRAIN_RATE * FRAMES_PER_SECOND;
export const DT_SIREN_DRAIN_PER_SEC = PLAYER_SIREN_DRAIN_RATE * FRAMES_PER_SECOND;
export const DT_BOOST_RECHARGE_PER_SEC = PLAYER_BOOST_RECHARGE_RATE * FRAMES_PER_SECOND;
export const DT_HANDLING_PER_SEC = PLAYER_HANDLING * FRAMES_PER_SECOND;
export const DT_ACCEL_PER_SEC = PLAYER_ACCELERATION * FRAMES_PER_SECOND;
export const DT_DISTRICT_DECAY_PER_SEC = DISTRICT_DECAY_RATE * FRAMES_PER_SECOND;
export const DT_PRESENCE_BOOST_PER_SEC = DISTRICT_PLAYER_PRESENCE_BASE_BOOST * FRAMES_PER_SECOND;
export const DT_SIREN_BOOST_PER_SEC = DISTRICT_SIREN_BOOST * FRAMES_PER_SECOND;
