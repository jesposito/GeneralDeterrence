import { mulberry32 } from './rng';
import * as CONSTANTS from '../constants';

// Fairness (gd-zz7.16): the daily map was "same stage, different dice" — offender luck
// decided scores. This precomputes a per-ordinal stream of uniform rolls from the map
// seed. Live code keeps its player-responsive logic (deterrence-weighted districts,
// state-dependent LAR chance) but consumes THESE rolls instead of Math.random, so two
// players making the same choices meet the same offenders. Cosmetic randomness
// (particles, chatter, traffic bodies) intentionally stays private.

export interface OffenderSlot {
    /** Weighted-district pick. */ uDistrict: number;
    /** Candidate-car pick within the district. */ uCar: number;
    /** RIDS-type pick against the road-type distribution. */ uType: number;
    /** Compared against the live (state-dependent) life-at-risk chance. */ uLar: number;
    /** Compared against REFERRAL_CHANCE on a successful enforce. */ uReferral: number;
    /** Offender speed variation, independent of cosmetic traffic rolls. */ uSpeed: number;
    /** Mini-game/referral scenario selection. */ uScenario: number;
}

export interface OffenderSchedule {
    slots: OffenderSlot[];
    /** The Nth offender (1-based) assigned after the opening grace carries the interdiction. */
    interdictionOrdinal: number;
    /** Which interdiction scenario (index into the stories pool). */
    interdictionCrimeIndex: number;
}

const MAX_SLOTS = 64; // ~an offender every 1.4s for 90s — far past any real shift

export function buildOffenderSchedule(seed: number): OffenderSchedule {
    const rng = mulberry32((seed ^ 0x5bf03635) >>> 0);
    const interdictionOrdinal = 1 + Math.floor(rng() * 4);
    const interdictionCrimeIndex = Math.floor(rng() * 1000); // modded by pool size at use
    const slots: OffenderSlot[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
        slots.push({
            uDistrict: rng(), uCar: rng(), uType: rng(), uLar: rng(), uReferral: rng(),
            uSpeed: rng(), uScenario: rng(),
        });
    }
    return { slots, interdictionOrdinal, interdictionCrimeIndex };
}

/** Clamp-safe slot access (past MAX_SLOTS the shift has gone feral; wrap is fine). */
export const slotAt = (s: OffenderSchedule, ordinal: number): OffenderSlot =>
    s.slots[ordinal % s.slots.length];

export function advanceShiftClock(timeLeft: number, elapsed: number, requestedSeconds: number) {
    const spent = Math.min(Math.max(0, requestedSeconds), Math.max(0, timeLeft));
    return { timeLeft: timeLeft - spent, elapsed: elapsed + spent, spent };
}

export function planSimulationSteps(elapsed: number, maxStep: number, maxSteps: number) {
    if (elapsed <= 0 || maxStep <= 0 || maxSteps <= 0) return { count: 0, step: 0, simulated: 0 };
    const simulated = Math.min(elapsed, maxStep * maxSteps);
    const count = Math.min(maxSteps, Math.ceil(simulated / maxStep));
    return { count, step: simulated / count, simulated };
}

export function computeLifeAtRiskChance(
    districtModifier: number,
    weatherModifier: number,
    fullCoverage: boolean,
    neglect: boolean,
): number {
    let chance = CONSTANTS.LIFE_AT_RISK_CHANCE * districtModifier * weatherModifier;
    if (fullCoverage) chance *= CONSTANTS.FULL_COVERAGE_LAR_CHANCE_MULTIPLIER;
    if (neglect) chance *= CONSTANTS.NEGLECT_OF_DUTY_LAR_CHANCE_MULTIPLIER;
    return Math.min(1, Math.max(0, chance));
}
