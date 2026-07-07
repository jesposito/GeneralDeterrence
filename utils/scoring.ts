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
 * Pure end-of-shift score computation, extracted from Game.tsx so it can be unit-tested
 * (part of gd-0wi.2 — making the god component's logic testable). Given the accumulated
 * score components and the final per-district deterrence levels, returns the numeric
 * breakdown shown on the results screen.
 */
export function computeScoreBreakdown(
  score: ScoreState,
  districts: Pick<District, 'deterrence'>[],
): ScoreBreakdownNumbers {
  const finalDeterrenceBonus = districts.reduce(
    (total, d) => total + (d.deterrence - 50) * CONSTANTS.FINAL_DETERRENCE_SCORE_MULTIPLIER,
    0,
  );
  const colleagueSaves = Math.min(score.colleagueSaves ?? 0, score.livesSaved);
  const livesSavedBonus =
    (score.livesSaved - colleagueSaves) * CONSTANTS.LIVES_SAVED_SCORE_BONUS +
    colleagueSaves * CONSTANTS.COLLEAGUE_SAVE_SCORE_BONUS;
  const livesLostPenalty = score.livesLost * CONSTANTS.LIVES_LOST_PENALTY;

  return {
    enforcementScore: score.enforcement,
    deterrenceScore: Math.round(score.deterrence),
    finalDeterrenceBonus: Math.round(finalDeterrenceBonus),
    livesSavedBonus,
    livesLostPenalty,
    finalScore:
      Math.round(score.enforcement + score.deterrence + finalDeterrenceBonus) +
      livesSavedBonus -
      livesLostPenalty,
  };
}
