import { describe, it, expect } from 'vitest';
import { computeCoverageQuality, computeScoreBreakdown } from './scoring';
import * as CONSTANTS from '../constants';

describe('computeScoreBreakdown', () => {
  it('sums enforcement + deterrence + district bonus, plus the LAR net', () => {
    const districts = [{ deterrence: 60 }, { deterrence: 40 }];
    const r = computeScoreBreakdown({ enforcement: 1000, deterrence: 200.4, livesSaved: 2, livesLost: 1 }, districts);
    expect(r.enforcementScore).toBe(1000);
    expect(r.deterrenceScore).toBe(200); // rounded from 200.4
    const expectedFinalBonus = Math.round((computeCoverageQuality(districts) - 50) * districts.length * CONSTANTS.FINAL_DETERRENCE_SCORE_MULTIPLIER);
    expect(r.finalDeterrenceBonus).toBe(expectedFinalBonus);
    expect(r.livesSavedBonus).toBe(2 * CONSTANTS.LIVES_SAVED_SCORE_BONUS);
    expect(r.livesLostPenalty).toBe(1 * CONSTANTS.LIVES_LOST_PENALTY);
    expect(r.finalScore).toBe(
      1000 + r.deterrenceScore + r.finalDeterrenceBonus + 2 * CONSTANTS.LIVES_SAVED_SCORE_BONUS - 1 * CONSTANTS.LIVES_LOST_PENALTY,
    );
  });

  it('rewards high deterrence and penalizes low (relative to the 50 baseline)', () => {
    const high = computeScoreBreakdown({ enforcement: 0, deterrence: 0, livesSaved: 0, livesLost: 0 }, [{ deterrence: 100 }]);
    expect(high.finalDeterrenceBonus).toBe(Math.round(50 * CONSTANTS.FINAL_DETERRENCE_SCORE_MULTIPLIER));
    const low = computeScoreBreakdown({ enforcement: 0, deterrence: 0, livesSaved: 0, livesLost: 0 }, [{ deterrence: 0 }]);
    expect(low.finalDeterrenceBonus).toBe(Math.round(-50 * CONSTANTS.FINAL_DETERRENCE_SCORE_MULTIPLIER));
  });

  it('handles empty districts and a zero-event shift', () => {
    const r = computeScoreBreakdown({ enforcement: 500, deterrence: 0, livesSaved: 0, livesLost: 0 }, []);
    expect(r.finalDeterrenceBonus).toBe(0);
    expect(r.finalScore).toBe(500);
  });

  it('pays colleague saves at the reduced rate, personal saves at full', () => {
    const r = computeScoreBreakdown(
      { enforcement: 0, deterrence: 0, livesSaved: 3, livesLost: 0, colleagueSaves: 2 },
      [],
    );
    expect(r.livesSavedBonus).toBe(
      1 * CONSTANTS.LIVES_SAVED_SCORE_BONUS + 2 * CONSTANTS.COLLEAGUE_SAVE_SCORE_BONUS,
    );
    expect(r.finalScore).toBe(r.livesSavedBonus);
  });

  it('rewards balanced coverage over the same lopsided average', () => {
    const balanced = Array.from({ length: 5 }, () => ({ deterrence: 60 }));
    const lopsided = [100, 100, 100, 0, 0].map(deterrence => ({ deterrence }));
    expect(computeCoverageQuality(balanced)).toBeGreaterThan(computeCoverageQuality(lopsided));
    expect(computeScoreBreakdown({ enforcement: 0, deterrence: 0, livesSaved: 0, livesLost: 0 }, balanced).finalScore)
      .toBeGreaterThan(computeScoreBreakdown({ enforcement: 0, deterrence: 0, livesSaved: 0, livesLost: 0 }, lopsided).finalScore);
  });
});
