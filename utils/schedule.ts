import { mulberry32 } from './rng';

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
        slots.push({ uDistrict: rng(), uCar: rng(), uType: rng(), uLar: rng(), uReferral: rng() });
    }
    return { slots, interdictionOrdinal, interdictionCrimeIndex };
}

/** Clamp-safe slot access (past MAX_SLOTS the shift has gone feral; wrap is fine). */
export const slotAt = (s: OffenderSchedule, ordinal: number): OffenderSlot =>
    s.slots[ordinal % s.slots.length];
