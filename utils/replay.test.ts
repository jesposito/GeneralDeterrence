import { describe, expect, it } from 'vitest';
import {
  createPersonalBestReplay,
  getPersonalBestReplay,
  loadPersonalBestReplays,
  LEGACY_PB_REPLAY_STORAGE_KEY,
  MAX_PB_REPLAYS,
  MAX_REPLAY_ACTIONS,
  MAX_REPLAY_ROUTE_POINTS,
  MAX_REPLAY_SPLITS,
  migrateLegacyPersonalBestReplay,
  parsePersonalBestReplays,
  replayScoreAt,
  sampleReplayRoute,
  serializePersonalBestReplays,
  storePersonalBestReplay,
  upsertPersonalBestReplay,
  type PersonalBestReplay,
} from './replay';

function replay(seed: number, score: number, recordedAt = seed): PersonalBestReplay {
  return {
    seed,
    score,
    durationMs: 90_000,
    recordedAt,
    route: [
      { timeMs: 0, x: seed, y: 0 },
      { timeMs: 90_000, x: seed + 1, y: 1 },
    ],
    actions: [],
    splits: [],
  };
}

describe('personal-best replays', () => {
  it('sorts and bounds timed route, action, and split data', () => {
    const route = Array.from({ length: MAX_REPLAY_ROUTE_POINTS + 20 }, (_, index) => ({
      timeMs: MAX_REPLAY_ROUTE_POINTS + 19 - index,
      x: index,
      y: index,
    }));
    const actions = Array.from({ length: MAX_REPLAY_ACTIONS + 5 }, (_, index) => ({
      timeMs: index,
      x: index,
      y: index,
      kind: 'investigate' as const,
      result: 'success' as const,
    }));
    const splits = Array.from({ length: MAX_REPLAY_SPLITS + 5 }, (_, index) => ({
      timeMs: index,
      district: `District ${index}`,
      score: index,
    }));

    const result = createPersonalBestReplay({
      ...replay(4, 900),
      route,
      actions,
      splits,
    });

    expect(result.route).toHaveLength(MAX_REPLAY_ROUTE_POINTS);
    expect(result.route[0].timeMs).toBe(0);
    expect(result.route.at(-1)?.timeMs).toBe(MAX_REPLAY_ROUTE_POINTS + 19);
    expect(result.actions).toHaveLength(MAX_REPLAY_ACTIONS);
    expect(result.splits).toHaveLength(MAX_REPLAY_SPLITS);
  });

  it('samples a route by recorded time instead of assuming a fixed cadence', () => {
    const route = [
      { timeMs: 0, x: 0, y: 0 },
      { timeMs: 1_000, x: 10, y: 0 },
      { timeMs: 4_000, x: 10, y: 30 },
    ];

    expect(sampleReplayRoute(route, 500)).toMatchObject({ x: 5, y: 0, angle: 90 });
    expect(sampleReplayRoute(route, 2_500)).toMatchObject({ x: 10, y: 15, angle: 180 });
    expect(sampleReplayRoute(route, 4_001)).toBeNull();
  });

  it('interpolates the PB score at the current shift time', () => {
    const splits = [
      { timeMs: 30_000, district: 'All', score: 300 },
      { timeMs: 60_000, district: 'All', score: 900 },
    ];

    expect(replayScoreAt(splits, 15_000)).toBe(150);
    expect(replayScoreAt(splits, 45_000)).toBe(600);
    expect(replayScoreAt(splits, 80_000)).toBe(900);
    expect(replayScoreAt([], 10_000)).toBeNull();
  });

  it('keeps one strict personal best per seed and caps retained seeds', () => {
    let records: readonly PersonalBestReplay[] = [];
    for (let seed = 0; seed < MAX_PB_REPLAYS + 3; seed += 1) {
      records = upsertPersonalBestReplay(records, replay(seed, 100 + seed, seed)).records;
    }

    expect(records).toHaveLength(MAX_PB_REPLAYS);
    expect(getPersonalBestReplay(records, 0)).toBeNull();
    const lower = upsertPersonalBestReplay(records, replay(MAX_PB_REPLAYS + 2, 1, 999));
    expect(lower.improved).toBe(false);
    expect(getPersonalBestReplay(lower.records, MAX_PB_REPLAYS + 2)?.score).toBe(100 + MAX_PB_REPLAYS + 2);
  });

  it('round-trips bounded storage and only writes improvements', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    expect(storePersonalBestReplay(storage, replay(8, 800, 1))).toBe(true);
    expect(storePersonalBestReplay(storage, replay(8, 700, 2))).toBe(false);
    expect(loadPersonalBestReplays(storage)[0].score).toBe(800);

    const raw = serializePersonalBestReplays(loadPersonalBestReplays(storage));
    expect(parsePersonalBestReplays(raw)).toEqual(loadPersonalBestReplays(storage));
    expect(parsePersonalBestReplays('{broken')).toEqual([]);
  });

  it('migrates the previous untimed single-ghost format once', () => {
    const values = new Map<string, string>([[
      LEGACY_PB_REPLAY_STORAGE_KEY,
      JSON.stringify({ seed: 22, score: 700, path: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }] }),
    ]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };

    expect(migrateLegacyPersonalBestReplay(storage, 1234)).toBe(true);
    expect(values.has(LEGACY_PB_REPLAY_STORAGE_KEY)).toBe(false);
    expect(loadPersonalBestReplays(storage)[0]).toMatchObject({
      seed: 22,
      score: 700,
      recordedAt: 1234,
      route: [{ timeMs: 0 }, { timeMs: 45_000 }, { timeMs: 90_000 }],
    });
    expect(migrateLegacyPersonalBestReplay(storage, 1234)).toBe(false);
    expect(migrateLegacyPersonalBestReplay({
      getItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      setItem: () => {},
      removeItem: () => {},
    })).toBe(false);
  });
});
