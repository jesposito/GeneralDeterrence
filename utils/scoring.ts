import * as CONSTANTS from '../constants';
import { District } from '../types';

export interface ScoreState {
  enforcement: number;
  deterrence: number;
  livesSaved: number;
  livesLost: number;
  /** Subset of livesSaved resolved by colleague assist — pays half a personal save. */
  colleagueSaves?: number;
}

export interface ScoreBreakdownNumbers {
  enforcementScore: number;
  deterrenceScore: number;
  finalDeterrenceBonus: number;
  livesSavedBonus: number;
  livesLostPenalty: number;
  finalScore: number;
}

/**
 * Teaching-aligned district quality: average presence matters, but weak and uncovered
 * districts prevent a lopsided patrol from scoring like balanced coverage.
 */
export function computeCoverageQuality(districts: Pick<District, 'deterrence'>[]): number {
  if (districts.length === 0) return 0;
  let total = 0;
  let weakest = 100;
  let coveredCount = 0;
  for (const district of districts) {
    total += district.deterrence;
    weakest = Math.min(weakest, district.deterrence);
    if (district.deterrence >= 50) coveredCount++;
  }
  const average = total / districts.length;
  const covered = coveredCount / districts.length * 100;
  return Math.max(0, Math.min(100, average * 0.5 + weakest * 0.3 + covered * 0.2));
}

/**
 * Pure end-of-shift score computation, extracted from Game.tsx so it can be unit-tested
 * (part of gd-0wi.2 — making the god component's logic testable). Given the accumulated
 * score components and the final per-district deterrence levels, returns the numeric
 * breakdown shown on the results screen.
 */
export function computeScoreBreakdown(
  score: ScoreState,
  districts: Pick<District, 'deterrence'>[],
): ScoreBreakdownNumbers {
  const finalDeterrenceBonus = districts.length
    ? (computeCoverageQuality(districts) - 50) * districts.length * CONSTANTS.FINAL_DETERRENCE_SCORE_MULTIPLIER
    : 0;
  const colleagueSaves = Math.min(score.colleagueSaves ?? 0, score.livesSaved);
  const livesSavedBonus =
    (score.livesSaved - colleagueSaves) * CONSTANTS.LIVES_SAVED_SCORE_BONUS +
    colleagueSaves * CONSTANTS.COLLEAGUE_SAVE_SCORE_BONUS;
  const livesLostPenalty = score.livesLost * CONSTANTS.LIVES_LOST_PENALTY;
  const deterrenceScore = Math.round(score.deterrence);
  const roundedFinalDeterrenceBonus = Math.round(finalDeterrenceBonus);

  return {
    enforcementScore: score.enforcement,
    deterrenceScore,
    finalDeterrenceBonus: roundedFinalDeterrenceBonus,
    livesSavedBonus,
    livesLostPenalty,
    finalScore:
      score.enforcement + deterrenceScore + roundedFinalDeterrenceBonus +
      livesSavedBonus -
      livesLostPenalty,
  };
}
