export type ShiftPhase = 'establish' | 'respond' | 'resolve' | 'overtime';

export interface ShiftPhaseInfo {
  id: ShiftPhase;
  label: string;
  objective: string;
}

const PHASES: Record<ShiftPhase, ShiftPhaseInfo> = {
  establish: { id: 'establish', label: 'ESTABLISH', objective: 'Build broad visible coverage' },
  respond: { id: 'respond', label: 'RESPOND', objective: 'Balance patrol with emerging risk' },
  resolve: { id: 'resolve', label: 'RESOLVE', objective: 'Protect weak districts and finish priority work' },
  overtime: { id: 'overtime', label: 'OVERTIME', objective: 'Convert secured coverage time into a strong finish' },
};

export function getShiftPhase(elapsedSeconds: number, baseDurationSeconds: number, overtime = false): ShiftPhaseInfo {
  if (overtime) return PHASES.overtime;
  const progress = baseDurationSeconds > 0 ? Math.max(0, elapsedSeconds) / baseDurationSeconds : 1;
  if (progress < 1 / 3) return PHASES.establish;
  if (progress < 2 / 3) return PHASES.respond;
  return PHASES.resolve;
}

export interface RoadFreshnessState {
  visitedAt: Record<string, number>;
  lastSegmentId: string | null;
  chain: number;
  uniqueSegments: number;
  entries: number;
  repeatEntries: number;
}

export interface RoadVisitResult {
  state: RoadFreshnessState;
  multiplier: number;
  fresh: boolean;
}

export const createRoadFreshnessState = (): RoadFreshnessState => ({
  visitedAt: {},
  lastSegmentId: null,
  chain: 0,
  uniqueSegments: 0,
  entries: 0,
  repeatEntries: 0,
});

/**
 * Records the road currently being patrolled. Fresh beats are substantially more valuable,
 * while circling one segment still contributes a small amount rather than becoming useless.
 */
export function visitRoadSegment(
  current: RoadFreshnessState,
  segmentId: string,
  nowSeconds: number,
): RoadVisitResult {
  const previousVisit = current.visitedAt[segmentId];
  const age = previousVisit === undefined ? Infinity : Math.max(0, nowSeconds - previousVisit);
  const changedSegment = current.lastSegmentId !== segmentId;
  if (!changedSegment) {
    const multiplier = age < 6 ? 1.35 : age < 14 ? 0.9 : 0.55;
    return { state: current, multiplier, fresh: false };
  }

  const fresh = previousVisit === undefined || age >= 18;
  const multiplier = previousVisit === undefined ? 1.6 : age >= 35 ? 1.35 : fresh ? 1.1 : 0.6;
  const chain = fresh ? Math.min(12, current.chain + 1) : 0;
  const visitedAt = { ...current.visitedAt, [segmentId]: nowSeconds };
  if (current.lastSegmentId) visitedAt[current.lastSegmentId] = nowSeconds;

  return {
    multiplier,
    fresh,
    state: {
      visitedAt,
      lastSegmentId: segmentId,
      chain,
      uniqueSegments: current.uniqueSegments + (previousVisit === undefined ? 1 : 0),
      entries: current.entries + 1,
      repeatEntries: current.repeatEntries + (fresh ? 0 : 1),
    },
  };
}

export interface CoverageTier {
  securedDistricts: number;
  label: string;
  scoreMultiplier: number;
}

/** Staged rewards avoid a single 85% all-district scoring cliff. */
export function getCoverageTier(deterrence: readonly number[], securedThreshold = 85): CoverageTier {
  const securedDistricts = deterrence.filter(value => value >= securedThreshold).length;
  if (securedDistricts >= 5) return { securedDistricts, label: 'ALL SECURE', scoreMultiplier: 1.6 };
  if (securedDistricts === 4) return { securedDistricts, label: '4/5 SECURE', scoreMultiplier: 1.35 };
  if (securedDistricts === 3) return { securedDistricts, label: '3/5 SECURE', scoreMultiplier: 1.15 };
  return { securedDistricts, label: `${securedDistricts}/5 SECURE`, scoreMultiplier: 1 };
}

/** Cumulative time with at least three secured districts earns overtime progressively. */
export function getEarnedOvertimeSeconds(securedCoverageSeconds: number): number {
  if (securedCoverageSeconds >= 45) return 30;
  if (securedCoverageSeconds >= 30) return 20;
  if (securedCoverageSeconds >= 15) return 10;
  return 0;
}

export function roadRepeatEntryRatio(state: Pick<RoadFreshnessState, 'entries' | 'repeatEntries'>): number {
  return state.entries > 0 ? state.repeatEntries / state.entries : 0;
}
