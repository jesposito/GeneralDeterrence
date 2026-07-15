export const PB_REPLAY_STORAGE_KEY = 'gd-pb-replays-v1';
export const LEGACY_PB_REPLAY_STORAGE_KEY = 'gd-ghost';
export const LEGACY_PB_REPLAY_DURATION_MS = 90_000;
export const MAX_PB_REPLAYS = 12;
export const MAX_REPLAY_ROUTE_POINTS = 360;
export const MAX_REPLAY_ACTIONS = 96;
export const MAX_REPLAY_SPLITS = 16;
export const MAX_REPLAY_DURATION_MS = 600_000;

export type ReplayActionKind =
  | 'standard'
  | 'investigate'
  | 'colleague'
  | 'patrol-post'
  | 'life-at-risk';
export type ReplayActionResult = 'success' | 'failure';

export interface TimedRoutePoint {
  readonly timeMs: number;
  readonly x: number;
  readonly y: number;
}

export interface TimedReplayAction extends TimedRoutePoint {
  readonly kind: ReplayActionKind;
  readonly result?: ReplayActionResult;
}

export interface ReplaySplit {
  readonly timeMs: number;
  readonly district: string;
  readonly score: number;
}

export interface PersonalBestReplay {
  readonly seed: number;
  readonly score: number;
  readonly durationMs: number;
  readonly recordedAt: number;
  readonly route: readonly TimedRoutePoint[];
  readonly actions: readonly TimedReplayAction[];
  readonly splits: readonly ReplaySplit[];
}

export interface PersonalBestUpdate {
  readonly improved: boolean;
  readonly records: readonly PersonalBestReplay[];
}

export interface SampledReplayPosition {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

const ACTION_KINDS: readonly ReplayActionKind[] = [
  'standard',
  'investigate',
  'colleague',
  'patrol-post',
  'life-at-risk',
];
const ACTION_RESULTS: readonly ReplayActionResult[] = ['success', 'failure'];
const COORDINATE_LIMIT = 100_000;
const SCORE_LIMIT = 1_000_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function boundedCoordinate(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(Math.min(COORDINATE_LIMIT, Math.max(-COORDINATE_LIMIT, value)) * 100) / 100;
}

function timedPoint(value: unknown, durationMs: number): TimedRoutePoint | null {
  if (!isRecord(value)) return null;
  const timeMs = boundedInteger(value.timeMs, 0, durationMs);
  const x = boundedCoordinate(value.x);
  const y = boundedCoordinate(value.y);
  return timeMs === null || x === null || y === null ? null : { timeMs, x, y };
}

function replayAction(value: unknown, durationMs: number): TimedReplayAction | null {
  if (!isRecord(value) || !ACTION_KINDS.includes(value.kind as ReplayActionKind)) return null;
  if (value.result !== undefined && !ACTION_RESULTS.includes(value.result as ReplayActionResult)) return null;
  const point = timedPoint(value, durationMs);
  if (!point) return null;
  return {
    ...point,
    kind: value.kind as ReplayActionKind,
    ...(value.result === undefined ? {} : { result: value.result as ReplayActionResult }),
  };
}

function replaySplit(value: unknown, durationMs: number): ReplaySplit | null {
  if (!isRecord(value) || typeof value.district !== 'string') return null;
  const district = value.district.trim().slice(0, 64);
  const timeMs = boundedInteger(value.timeMs, 0, durationMs);
  const score = boundedInteger(value.score, -SCORE_LIMIT, SCORE_LIMIT);
  return !district || timeMs === null || score === null ? null : { timeMs, district, score };
}

function evenlyBound<T>(values: readonly T[], maximum: number): T[] {
  if (values.length <= maximum) return [...values];
  return Array.from({ length: maximum }, (_, index) => (
    values[Math.round(index * (values.length - 1) / (maximum - 1))]
  ));
}

export function sampleReplayRoute(
  route: readonly TimedRoutePoint[],
  timeMs: number,
): SampledReplayPosition | null {
  if (route.length < 2 || timeMs > route[route.length - 1].timeMs) return null;
  if (timeMs <= route[0].timeMs) {
    const next = route[1];
    return {
      x: route[0].x,
      y: route[0].y,
      angle: Math.atan2(next.y - route[0].y, next.x - route[0].x) * (180 / Math.PI) + 90,
    };
  }

  let low = 0;
  let high = route.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (route[middle].timeMs <= timeMs) low = middle;
    else high = middle;
  }

  const start = route[low];
  const end = route[high];
  const duration = Math.max(1, end.timeMs - start.timeMs);
  const fraction = Math.min(1, Math.max(0, (timeMs - start.timeMs) / duration));
  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
    angle: Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI) + 90,
  };
}

export function replayScoreAt(
  splits: readonly ReplaySplit[],
  timeMs: number,
): number | null {
  if (splits.length === 0) return null;
  const first = splits[0];
  if (timeMs <= first.timeMs) {
    return first.timeMs <= 0 ? first.score : first.score * Math.max(0, timeMs) / first.timeMs;
  }

  for (let index = 1; index < splits.length; index += 1) {
    const end = splits[index];
    if (timeMs > end.timeMs) continue;
    const start = splits[index - 1];
    const fraction = (timeMs - start.timeMs) / Math.max(1, end.timeMs - start.timeMs);
    return start.score + (end.score - start.score) * fraction;
  }
  return splits[splits.length - 1].score;
}

function normalizeReplay(value: unknown): PersonalBestReplay | null {
  if (!isRecord(value) || !Array.isArray(value.route) || !Array.isArray(value.actions) || !Array.isArray(value.splits)) {
    return null;
  }

  const seed = boundedInteger(value.seed, 0, 0xffffffff);
  const score = boundedInteger(value.score, -SCORE_LIMIT, SCORE_LIMIT);
  const durationMs = boundedInteger(value.durationMs, 0, MAX_REPLAY_DURATION_MS);
  const recordedAt = boundedInteger(value.recordedAt, 0, Number.MAX_SAFE_INTEGER);
  if (seed === null || score === null || durationMs === null || recordedAt === null) return null;

  const route = value.route
    .map((point) => timedPoint(point, durationMs))
    .filter((point): point is TimedRoutePoint => point !== null)
    .sort((a, b) => a.timeMs - b.timeMs);
  if (route.length === 0) return null;

  const actions = value.actions
    .map((action) => replayAction(action, durationMs))
    .filter((action): action is TimedReplayAction => action !== null)
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, MAX_REPLAY_ACTIONS);
  const splits = value.splits
    .map((split) => replaySplit(split, durationMs))
    .filter((split): split is ReplaySplit => split !== null)
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, MAX_REPLAY_SPLITS);

  return {
    seed,
    score,
    durationMs,
    recordedAt,
    route: evenlyBound(route, MAX_REPLAY_ROUTE_POINTS),
    actions,
    splits,
  };
}

function canonicalRecords(records: readonly PersonalBestReplay[]): PersonalBestReplay[] {
  const bySeed = new Map<number, PersonalBestReplay>();
  for (const record of records) {
    const normalized = normalizeReplay(record);
    if (!normalized) continue;
    const current = bySeed.get(normalized.seed);
    if (
      !current
      || normalized.score > current.score
      || (normalized.score === current.score && normalized.recordedAt > current.recordedAt)
    ) bySeed.set(normalized.seed, normalized);
  }

  return [...bySeed.values()]
    .sort((a, b) => b.recordedAt - a.recordedAt || b.score - a.score)
    .slice(0, MAX_PB_REPLAYS);
}

export function createPersonalBestReplay(value: PersonalBestReplay): PersonalBestReplay {
  const normalized = normalizeReplay(value);
  if (!normalized) throw new RangeError('Invalid personal-best replay');
  return normalized;
}

export function getPersonalBestReplay(
  records: readonly PersonalBestReplay[],
  seed: number,
): PersonalBestReplay | null {
  return canonicalRecords(records).find((record) => record.seed === (seed >>> 0)) ?? null;
}

export function upsertPersonalBestReplay(
  records: readonly PersonalBestReplay[],
  candidate: PersonalBestReplay,
): PersonalBestUpdate {
  const current = canonicalRecords(records);
  const normalized = createPersonalBestReplay(candidate);
  const previous = current.find(({ seed }) => seed === normalized.seed);
  if (previous && previous.score >= normalized.score) return { improved: false, records: current };

  const next = canonicalRecords([
    ...current.filter(({ seed }) => seed !== normalized.seed),
    normalized,
  ]);
  const retained = next.some(({ seed, score, recordedAt }) => (
    seed === normalized.seed && score === normalized.score && recordedAt === normalized.recordedAt
  ));
  return { improved: retained, records: retained ? next : current };
}

export function serializePersonalBestReplays(records: readonly PersonalBestReplay[]): string {
  return JSON.stringify({ v: 1, r: canonicalRecords(records) });
}

export function parsePersonalBestReplays(raw: string | null): PersonalBestReplay[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as { v?: unknown; r?: unknown };
    if (value?.v !== 1 || !Array.isArray(value.r)) return [];
    return canonicalRecords(value.r as PersonalBestReplay[]);
  } catch {
    return [];
  }
}

export function loadPersonalBestReplays(
  storage: { getItem(key: string): string | null },
  key = PB_REPLAY_STORAGE_KEY,
): PersonalBestReplay[] {
  try {
    return parsePersonalBestReplays(storage.getItem(key));
  } catch {
    return [];
  }
}

export function storePersonalBestReplay(
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void },
  candidate: PersonalBestReplay,
  key = PB_REPLAY_STORAGE_KEY,
): boolean {
  const update = upsertPersonalBestReplay(loadPersonalBestReplays(storage, key), candidate);
  if (!update.improved) return false;
  try {
    storage.setItem(key, serializePersonalBestReplays(update.records));
    return true;
  } catch {
    return false;
  }
}

export function migrateLegacyPersonalBestReplay(
  storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  },
  recordedAt = Date.now(),
  legacyKey = LEGACY_PB_REPLAY_STORAGE_KEY,
  targetKey = PB_REPLAY_STORAGE_KEY,
): boolean {
  try {
    const raw = storage.getItem(legacyKey);
    if (!raw) return false;
    const legacy = JSON.parse(raw) as { seed?: unknown; score?: unknown; path?: unknown };
    const legacyPath = legacy.path;
    if (!Array.isArray(legacyPath) || legacyPath.length < 2) return false;
    const route = legacyPath.map((point, index) => {
      if (!isRecord(point)) throw new RangeError('Invalid legacy replay point');
      const x = boundedCoordinate(point.x);
      const y = boundedCoordinate(point.y);
      if (x === null || y === null) throw new RangeError('Invalid legacy replay coordinate');
      return {
        timeMs: Math.round(index * LEGACY_PB_REPLAY_DURATION_MS / (legacyPath.length - 1)),
        x,
        y,
      };
    });
    const candidate = createPersonalBestReplay({
      seed: legacy.seed as number,
      score: legacy.score as number,
      durationMs: LEGACY_PB_REPLAY_DURATION_MS,
      recordedAt,
      route,
      actions: [],
      splits: [],
    });
    const update = upsertPersonalBestReplay(loadPersonalBestReplays(storage, targetKey), candidate);
    if (update.improved) storage.setItem(targetKey, serializePersonalBestReplays(update.records));
    storage.removeItem(legacyKey);
    return true;
  } catch {
    return false;
  }
}
