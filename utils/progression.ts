import { getPatrolLoadout, type PatrolLoadoutId } from './loadouts';

export const PRESENCE_GRADES = ['S', 'A', 'B', 'C'] as const;
export type PresenceGrade = typeof PRESENCE_GRADES[number];

export type CareerUnlockKind = 'livery' | 'callsign' | 'ghost-style' | 'operation-badge' | 'loadout';

export interface CareerUnlock {
  readonly id: string;
  readonly kind: CareerUnlockKind;
  readonly label: string;
  readonly description: string;
  readonly loadoutId?: PatrolLoadoutId;
}

export interface CareerRank {
  readonly id: string;
  readonly name: string;
  readonly minimumPresenceGrades: number;
  readonly unlocks: readonly CareerUnlock[];
}

function loadoutUnlock(loadoutId: PatrolLoadoutId, id: string): CareerUnlock {
  const loadout = getPatrolLoadout(loadoutId);
  return {
    id,
    kind: 'loadout',
    label: loadout.name,
    description: loadout.description,
    loadoutId,
  };
}

const communityLoadout = getPatrolLoadout('community');
const responseLoadout = getPatrolLoadout('response');
const markedLoadout = getPatrolLoadout('marked');

export const CAREER_RANKS: readonly CareerRank[] = [
  { id: 'constable', name: 'Constable', minimumPresenceGrades: 0, unlocks: [] },
  {
    id: 'sergeant',
    name: 'Sergeant',
    minimumPresenceGrades: communityLoadout.requiredGrades,
    unlocks: [{
      id: 'highway-livery',
      kind: 'livery',
      label: 'Highway Livery',
      description: 'A visual patrol-car livery with no gameplay advantage.',
    }, loadoutUnlock('community', 'community-unit')],
  },
  {
    id: 'senior-sergeant',
    name: 'Senior Sergeant',
    minimumPresenceGrades: responseLoadout.requiredGrades,
    unlocks: [{
      id: 'checkpoint-ghost',
      kind: 'ghost-style',
      label: 'Checkpoint Ghost',
      description: 'An alternate visual treatment for personal-best replays.',
    }, loadoutUnlock('response', 'response-unit')],
  },
  {
    id: 'inspector',
    name: 'Inspector',
    minimumPresenceGrades: markedLoadout.requiredGrades,
    unlocks: [
      {
        id: 'callsign-one',
        kind: 'callsign',
        label: 'Callsign One',
        description: 'An optional callsign shown alongside career results.',
      },
      loadoutUnlock('marked', 'high-visibility-unit'),
      {
        id: 'operations-inspector',
        kind: 'operation-badge',
        label: 'Operations Inspector',
        description: 'A profile badge for completing the career rank track.',
      },
    ],
  },
];

export interface CareerState {
  readonly version: 1;
  readonly grades: Readonly<Record<PresenceGrade, number>>;
}

export interface CareerProgress {
  readonly totalPresenceGrades: number;
  readonly rank: CareerRank;
  readonly nextRank: CareerRank | null;
  readonly gradesUntilNextRank: number;
  readonly unlocks: readonly CareerUnlock[];
}

export const CAREER_STORAGE_KEY = 'gd-career-v1';

export function isPresenceGrade(value: unknown): value is PresenceGrade {
  return typeof value === 'string' && PRESENCE_GRADES.includes(value as PresenceGrade);
}

export function createCareerState(): CareerState {
  return { version: 1, grades: { S: 0, A: 0, B: 0, C: 0 } };
}

export function recordPresenceGrade(state: CareerState, grade: PresenceGrade): CareerState {
  if (!isPresenceGrade(grade)) throw new RangeError(`Invalid Presence Grade: ${String(grade)}`);
  return {
    version: 1,
    grades: {
      ...state.grades,
      [grade]: Math.min(Number.MAX_SAFE_INTEGER, state.grades[grade] + 1),
    },
  };
}

export function getCareerProgress(state: CareerState): CareerProgress {
  const totalPresenceGrades = Math.min(
    Number.MAX_SAFE_INTEGER,
    PRESENCE_GRADES.reduce((total, grade) => total + state.grades[grade], 0),
  );
  let rankIndex = 0;

  for (let index = 1; index < CAREER_RANKS.length; index += 1) {
    if (totalPresenceGrades < CAREER_RANKS[index].minimumPresenceGrades) break;
    rankIndex = index;
  }

  const rank = CAREER_RANKS[rankIndex];
  const nextRank = CAREER_RANKS[rankIndex + 1] ?? null;
  return {
    totalPresenceGrades,
    rank,
    nextRank,
    gradesUntilNextRank: nextRank ? nextRank.minimumPresenceGrades - totalPresenceGrades : 0,
    unlocks: CAREER_RANKS.slice(0, rankIndex + 1).flatMap(({ unlocks }) => unlocks),
  };
}

function validGradeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function parseCareerState(raw: string | null): CareerState {
  if (!raw) return createCareerState();

  try {
    const value = JSON.parse(raw) as { v?: unknown; g?: unknown };
    if (value?.v !== 1 || !Array.isArray(value.g) || value.g.length !== PRESENCE_GRADES.length) {
      return createCareerState();
    }
    if (!value.g.every(validGradeCount)) return createCareerState();

    return {
      version: 1,
      grades: { S: value.g[0], A: value.g[1], B: value.g[2], C: value.g[3] },
    };
  } catch {
    return createCareerState();
  }
}

export function serializeCareerState(state: CareerState): string {
  return JSON.stringify({
    v: 1,
    g: PRESENCE_GRADES.map((grade) => state.grades[grade]),
  });
}

export function loadCareerState(
  storage: { getItem(key: string): string | null },
  key = CAREER_STORAGE_KEY,
): CareerState {
  try {
    return parseCareerState(storage.getItem(key));
  } catch {
    return createCareerState();
  }
}

export function saveCareerState(
  storage: { setItem(key: string, value: string): void },
  state: CareerState,
  key = CAREER_STORAGE_KEY,
): boolean {
  try {
    storage.setItem(key, serializeCareerState(state));
    return true;
  } catch {
    return false;
  }
}
