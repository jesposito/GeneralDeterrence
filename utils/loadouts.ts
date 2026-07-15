export type PatrolLoadoutId = 'balanced' | 'marked' | 'response' | 'community';

export interface PatrolLoadout {
  readonly id: PatrolLoadoutId;
  readonly name: string;
  readonly description: string;
  readonly requiredGrades: number;
  readonly modifiers: {
    readonly presenceRate: number;
    readonly scanRadius: number;
    readonly energyRecharge: number;
    readonly patrolPost: number;
    readonly investigationDelta: number;
    readonly colleagueDelta: number;
  };
}

export const PATROL_LOADOUTS: readonly PatrolLoadout[] = [
  {
    id: 'balanced', name: 'General Duties', requiredGrades: 0,
    description: 'Balanced presence, observation, response, and investigation capacity.',
    modifiers: { presenceRate: 1, scanRadius: 1, energyRecharge: 1, patrolPost: 1, investigationDelta: 0, colleagueDelta: 0 },
  },
  {
    id: 'community', name: 'Community Unit', requiredGrades: 5,
    description: 'Stronger posts and one extra colleague, with less pursuit energy and one fewer deep investigation.',
    modifiers: { presenceRate: 1, scanRadius: 1, energyRecharge: 0.85, patrolPost: 1.5, investigationDelta: -1, colleagueDelta: 1 },
  },
  {
    id: 'response', name: 'Response Unit', requiredGrades: 15,
    description: 'Faster energy recovery and one extra deep investigation, with weaker posts and passive presence.',
    modifiers: { presenceRate: 0.9, scanRadius: 1, energyRecharge: 1.35, patrolPost: 0.8, investigationDelta: 1, colleagueDelta: 0 },
  },
  {
    id: 'marked', name: 'High-Visibility Unit', requiredGrades: 30,
    description: 'Stronger visible presence but a tighter observation range as risky drivers react earlier.',
    modifiers: { presenceRate: 1.3, scanRadius: 0.8, energyRecharge: 1, patrolPost: 1, investigationDelta: 0, colleagueDelta: 0 },
  },
];

export const LOADOUT_STORAGE_KEY = 'gd-patrol-loadout-v1';

export function getPatrolLoadout(id: PatrolLoadoutId): PatrolLoadout {
  return PATROL_LOADOUTS.find(loadout => loadout.id === id) ?? PATROL_LOADOUTS[0];
}

export function getAvailableLoadouts(totalPresenceGrades: number): readonly PatrolLoadout[] {
  return PATROL_LOADOUTS.filter(loadout => totalPresenceGrades >= loadout.requiredGrades);
}

export function loadPatrolLoadout(storage: Pick<Storage, 'getItem'>, totalPresenceGrades: number): PatrolLoadoutId {
  try {
    const stored = storage.getItem(LOADOUT_STORAGE_KEY) as PatrolLoadoutId | null;
    return getAvailableLoadouts(totalPresenceGrades).some(loadout => loadout.id === stored) ? stored! : 'balanced';
  } catch {
    return 'balanced';
  }
}

export function savePatrolLoadout(storage: Pick<Storage, 'setItem'>, id: PatrolLoadoutId): boolean {
  try {
    storage.setItem(LOADOUT_STORAGE_KEY, id);
    return true;
  } catch {
    return false;
  }
}
