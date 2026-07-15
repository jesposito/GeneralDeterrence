import {
  getDailyOperation,
  offsetDay,
  OPERATION_DEFINITIONS,
  type DailyOperation,
  type OperationDefinition,
  type OperationId,
} from './operations';
import { isPresenceGrade, type PresenceGrade } from './progression';

export const CAMPAIGN_SHIFT_COUNT = 5;
export const CAMPAIGN_STORAGE_KEY = 'gd-operations-campaign-v1';

export interface CampaignShiftResult {
  readonly grade: PresenceGrade;
  readonly score: number;
}

export interface OperationsCampaign {
  readonly version: 1;
  readonly seed: number;
  readonly startDay: string;
  readonly results: readonly CampaignShiftResult[];
}

export interface CampaignShift {
  readonly index: number;
  readonly number: number;
  readonly day: string;
  readonly seed: number;
  readonly previousGrade: PresenceGrade | null;
  readonly operation: DailyOperation;
}

export interface CampaignProgress {
  readonly completedShifts: number;
  readonly totalShifts: number;
  readonly cumulativeScore: number;
  readonly complete: boolean;
}

const GRADE_LINK: Record<PresenceGrade, number> = {
  S: 0x9e3779b9,
  A: 0x85ebca6b,
  B: 0xc2b2ae35,
  C: 0x27d4eb2f,
};

const PRESSURE_OPERATIONS: readonly OperationId[] = ['holiday-peak', 'match-night', 'roadworks'];
const STRATEGY_OPERATIONS: readonly OperationId[] = ['unmarked', 'rural-focus', 'school-run'];

function mix32(value: number): number {
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

function linkedShiftSeed(campaign: OperationsCampaign): number {
  let seed = mix32((campaign.seed >>> 0) ^ Math.imul(campaign.results.length + 1, 0x9e3779b1));
  campaign.results.forEach((result, index) => {
    seed = mix32(seed ^ GRADE_LINK[result.grade] ^ Math.imul(index + 1, 0x85ebca77));
  });
  return seed;
}

function campaignOperation(
  campaign: OperationsCampaign,
  seed: number,
  day: string,
): DailyOperation {
  const previousGrade = campaign.results.at(-1)?.grade;
  if (!previousGrade) return getDailyOperation(seed, day);

  const ids = previousGrade === 'S' || previousGrade === 'A'
    ? PRESSURE_OPERATIONS
    : STRATEGY_OPERATIONS;
  const pool = ids.map((id) => OPERATION_DEFINITIONS.find((operation) => operation.id === id)!) as OperationDefinition[];
  let index = mix32(seed ^ GRADE_LINK[previousGrade]) % pool.length;

  if (campaign.results.length > 0) {
    const previousCampaign = { ...campaign, results: campaign.results.slice(0, -1) };
    const previousOperation = getNextCampaignShift(previousCampaign)?.operation.id;
    if (pool[index].id === previousOperation) index = (index + 1) % pool.length;
  }

  return { ...pool[index], seed, day };
}

export function createOperationsCampaign(seed: number, startDay: string): OperationsCampaign {
  getDailyOperation(seed, startDay);
  return { version: 1, seed: seed >>> 0, startDay, results: [] };
}

export function getNextCampaignShift(campaign: OperationsCampaign): CampaignShift | null {
  const index = campaign.results.length;
  if (index >= CAMPAIGN_SHIFT_COUNT) return null;

  const day = offsetDay(campaign.startDay, index);
  const seed = linkedShiftSeed(campaign);
  return {
    index,
    number: index + 1,
    day,
    seed,
    previousGrade: campaign.results[index - 1]?.grade ?? null,
    operation: campaignOperation(campaign, seed, day),
  };
}

export function recordCampaignShift(
  campaign: OperationsCampaign,
  result: CampaignShiftResult,
): OperationsCampaign {
  if (campaign.results.length >= CAMPAIGN_SHIFT_COUNT) throw new RangeError('Campaign is complete');
  if (!isPresenceGrade(result.grade)) throw new RangeError(`Invalid Presence Grade: ${String(result.grade)}`);
  if (!Number.isSafeInteger(result.score)) throw new RangeError('Campaign score must be an integer');

  return { ...campaign, results: [...campaign.results, { ...result }] };
}

export function getCampaignProgress(campaign: OperationsCampaign): CampaignProgress {
  return {
    completedShifts: campaign.results.length,
    totalShifts: CAMPAIGN_SHIFT_COUNT,
    cumulativeScore: campaign.results.reduce((total, { score }) => total + score, 0),
    complete: campaign.results.length === CAMPAIGN_SHIFT_COUNT,
  };
}

export function serializeOperationsCampaign(campaign: OperationsCampaign): string {
  return JSON.stringify({
    v: 1,
    s: campaign.seed,
    d: campaign.startDay,
    r: campaign.results.map(({ grade, score }) => [grade, score]),
  });
}

export function parseOperationsCampaign(raw: string | null): OperationsCampaign | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as { v?: unknown; s?: unknown; d?: unknown; r?: unknown };
    if (
      value?.v !== 1
      || !Number.isSafeInteger(value.s)
      || typeof value.d !== 'string'
      || !Array.isArray(value.r)
      || value.r.length > CAMPAIGN_SHIFT_COUNT
    ) return null;

    getDailyOperation(value.s as number, value.d);
    const results: CampaignShiftResult[] = [];
    for (const entry of value.r) {
      if (
        !Array.isArray(entry)
        || entry.length !== 2
        || !isPresenceGrade(entry[0])
        || !Number.isSafeInteger(entry[1])
      ) return null;
      results.push({ grade: entry[0], score: entry[1] as number });
    }

    return { version: 1, seed: (value.s as number) >>> 0, startDay: value.d, results };
  } catch {
    return null;
  }
}

export function loadOperationsCampaign(
  storage: { getItem(key: string): string | null },
  key = CAMPAIGN_STORAGE_KEY,
): OperationsCampaign | null {
  try {
    return parseOperationsCampaign(storage.getItem(key));
  } catch {
    return null;
  }
}

export function saveOperationsCampaign(
  storage: { setItem(key: string, value: string): void },
  campaign: OperationsCampaign,
  key = CAMPAIGN_STORAGE_KEY,
): boolean {
  try {
    storage.setItem(key, serializeOperationsCampaign(campaign));
    return true;
  } catch {
    return false;
  }
}
