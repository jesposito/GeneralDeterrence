import type { DistrictName, RIDSType } from '../types';

export type OperationId = 'unmarked' | 'holiday-peak' | 'rural-focus' | 'school-run' | 'match-night' | 'roadworks';

export interface OperationModifiers {
  readonly presenceAuraMultiplier: number;
  readonly presenceRateMultiplier: number;
  readonly trafficMultiplier: number;
  readonly maxSimultaneousLifeAtRisk: number;
  readonly ruralDeterrenceMultiplier: number;
  readonly priorityDistrict: DistrictName | null;
  readonly priorityRids: RIDSType | null;
  readonly patrolPostMultiplier: number;
  readonly energyRechargeMultiplier: number;
  readonly standardScoreMultiplier: number;
  readonly investigateScoreMultiplier: number;
}

export interface OperationDefinition {
  readonly id: OperationId;
  readonly name: string;
  readonly briefing: string;
  readonly modifiers: OperationModifiers;
}

export interface DailyOperation extends OperationDefinition {
  readonly seed: number;
  readonly day: string;
}

export const OPERATION_DEFINITIONS: readonly OperationDefinition[] = [
  {
    id: 'unmarked',
    name: 'Operation Unmarked',
    briefing: 'A smaller visible aura makes deliberate high-presence patrol work count twice.',
    modifiers: {
      presenceAuraMultiplier: 0.5,
      presenceRateMultiplier: 2,
      trafficMultiplier: 1,
      maxSimultaneousLifeAtRisk: 1,
      ruralDeterrenceMultiplier: 1,
      priorityDistrict: null,
      priorityRids: null,
      patrolPostMultiplier: 1,
      energyRechargeMultiplier: 1,
      standardScoreMultiplier: 0.9,
      investigateScoreMultiplier: 1.2,
    },
  },
  {
    id: 'holiday-peak',
    name: 'Holiday Peak',
    briefing: 'Heavy holiday traffic can produce two simultaneous life-at-risk incidents.',
    modifiers: {
      presenceAuraMultiplier: 1,
      presenceRateMultiplier: 1,
      trafficMultiplier: 2,
      maxSimultaneousLifeAtRisk: 2,
      ruralDeterrenceMultiplier: 1,
      priorityDistrict: 'Karori East',
      priorityRids: 'Speed',
      patrolPostMultiplier: 1,
      energyRechargeMultiplier: 1.2,
      standardScoreMultiplier: 1,
      investigateScoreMultiplier: 1,
    },
  },
  {
    id: 'rural-focus',
    name: 'Rural Focus',
    briefing: 'Deterrence generated in rural districts is worth three times as much.',
    modifiers: {
      presenceAuraMultiplier: 1,
      presenceRateMultiplier: 1,
      trafficMultiplier: 1,
      maxSimultaneousLifeAtRisk: 1,
      ruralDeterrenceMultiplier: 3,
      priorityDistrict: 'Karori North',
      priorityRids: null,
      patrolPostMultiplier: 1.2,
      energyRechargeMultiplier: 1,
      standardScoreMultiplier: 1.15,
      investigateScoreMultiplier: 1,
    },
  },
  {
    id: 'school-run',
    name: 'School Run',
    briefing: 'Protect suburban routes: restraint and distraction evidence is concentrated around the morning flow.',
    modifiers: {
      presenceAuraMultiplier: 1.15,
      presenceRateMultiplier: 1,
      trafficMultiplier: 1.25,
      maxSimultaneousLifeAtRisk: 1,
      ruralDeterrenceMultiplier: 1,
      priorityDistrict: 'Karori West',
      priorityRids: 'Restraints',
      patrolPostMultiplier: 1.35,
      energyRechargeMultiplier: 1,
      standardScoreMultiplier: 1.2,
      investigateScoreMultiplier: 0.95,
    },
  },
  {
    id: 'match-night',
    name: 'Match Night',
    briefing: 'A late crowd creates impairment risk and overlapping calls near the centre.',
    modifiers: {
      presenceAuraMultiplier: 1,
      presenceRateMultiplier: 1,
      trafficMultiplier: 1.35,
      maxSimultaneousLifeAtRisk: 2,
      ruralDeterrenceMultiplier: 1,
      priorityDistrict: 'Karori Central',
      priorityRids: 'Impairment',
      patrolPostMultiplier: 0.9,
      energyRechargeMultiplier: 1.1,
      standardScoreMultiplier: 0.9,
      investigateScoreMultiplier: 1.2,
    },
  },
  {
    id: 'roadworks',
    name: 'Roadworks',
    briefing: 'Constrained corridors reward staged posts, controlled speed, and deliberate route changes.',
    modifiers: {
      presenceAuraMultiplier: 0.9,
      presenceRateMultiplier: 1.15,
      trafficMultiplier: 0.85,
      maxSimultaneousLifeAtRisk: 1,
      ruralDeterrenceMultiplier: 1,
      priorityDistrict: 'Karori East',
      priorityRids: 'Speed',
      patrolPostMultiplier: 1.6,
      energyRechargeMultiplier: 0.85,
      standardScoreMultiplier: 1.1,
      investigateScoreMultiplier: 1,
    },
  },
];

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayTimestamp(day: string): number {
  const match = DAY_PATTERN.exec(day);
  if (!match) throw new RangeError(`Invalid day key: ${day}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, date);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== date
  ) {
    throw new RangeError(`Invalid day key: ${day}`);
  }

  return timestamp;
}

function mix32(value: number): number {
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

export function offsetDay(day: string, offset: number): string {
  if (!Number.isSafeInteger(offset)) throw new RangeError('Day offset must be an integer');
  return new Date(dayTimestamp(day) + offset * DAY_MS).toISOString().slice(0, 10);
}

export function getDailyOperation(seed: number, day: string): DailyOperation {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Operation seed must be an integer');

  const dayNumber = Math.floor(dayTimestamp(day) / DAY_MS);
  const mixed = mix32((seed >>> 0) ^ Math.imul(dayNumber, 0x9e3779b1));
  const definition = OPERATION_DEFINITIONS[mixed % OPERATION_DEFINITIONS.length];

  return { ...definition, seed: seed >>> 0, day };
}
