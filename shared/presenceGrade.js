export const PRESENCE_GRADE_THRESHOLDS = Object.freeze({
  S: 0.75,
  A: 0.65,
  B: 0.52,
});
export const PRESENCE_GRADE_CONTRACT_VERSION = 2;

const LEGACY_PRESENCE_GRADE_THRESHOLDS = Object.freeze({
  S: 0.9,
  A: 0.7,
  B: 0.45,
});

/** @param {number} coverageRatio @returns {'S' | 'A' | 'B' | 'C'} */
export function getPresenceGrade(coverageRatio) {
  if (coverageRatio >= PRESENCE_GRADE_THRESHOLDS.S) return 'S';
  if (coverageRatio >= PRESENCE_GRADE_THRESHOLDS.A) return 'A';
  if (coverageRatio >= PRESENCE_GRADE_THRESHOLDS.B) return 'B';
  return 'C';
}

/** @param {number} coverageRatio @returns {'S' | 'A' | 'B' | 'C'} */
export function getLegacyPresenceGrade(coverageRatio) {
  if (coverageRatio >= LEGACY_PRESENCE_GRADE_THRESHOLDS.S) return 'S';
  if (coverageRatio >= LEGACY_PRESENCE_GRADE_THRESHOLDS.A) return 'A';
  if (coverageRatio >= LEGACY_PRESENCE_GRADE_THRESHOLDS.B) return 'B';
  return 'C';
}
