/**
 * Scoring Module
 *
 * Calculates scores for aha cards based on signals.
 * Higher scores indicate more valuable/frequently used learnings.
 *
 * @module self-learning/lib/scoring
 */

import type { Signal, SignalKind } from "../types/signal";
import type { AhaCard } from "../types/aha-card";
import type { Recommendation, ExpectedImpact } from "../types/recommendation";
import { SIGNAL_WEIGHTS } from "../types/signal";

// =============================================================================
// Types
// =============================================================================

/**
 * Breakdown of how an aha card's score was calculated.
 */
export interface ScoreBreakdown {
  /** Aha card ID */
  aha_id: string;
  /** Total score */
  score: number;
  /** Base score (always 1) */
  base: number;
  /** Signal counts by kind */
  counts: Record<string, number>;
  /** Weighted contribution by kind */
  weighted: Record<string, number>;
  /** Human-readable explanation */
  explain: string;
}

/**
 * Aha card with score information.
 */
export interface ScoredAhaCard {
  id: string;
  title: string;
  primary_skill: string;
  score: number;
  explain: string;
  counts: Record<string, number>;
}

// =============================================================================
// Score Calculation
// =============================================================================

/**
 * Calculate score breakdown for an aha card based on signals.
 *
 * Score = base (1) + sum(signal_count * signal_weight)
 *
 * Signal weights:
 * - aha_used: 2 (applied to solve a problem)
 * - aha_recalled: 1 (read/reviewed)
 * - aha_reinforced: 1 (same learning discovered again)
 * - aha_promoted: 1 (promoted to global store)
 * - aha_backported: 2 (backported to a skill)
 *
 * @param ahaId - Aha card ID
 * @param signals - All signals from the store
 * @returns Score breakdown
 */
export function calculateScoreBreakdown(
  ahaId: string,
  signals: Signal[]
): ScoreBreakdown {
  // Initialize counts for aha-related signals
  const ahaKinds: SignalKind[] = [
    "aha_used",
    "aha_recalled",
    "aha_reinforced",
    "aha_promoted",
    "aha_backported",
  ];

  const counts: Record<string, number> = {};
  for (const kind of ahaKinds) {
    counts[kind] = 0;
  }

  // Count signals for this aha card
  for (const sig of signals) {
    if (sig.aha_id === ahaId && sig.kind in counts) {
      counts[sig.kind]++;
    }
  }

  // Calculate weighted contributions
  const base = 1;
  const weighted: Record<string, number> = {};
  for (const [kind, count] of Object.entries(counts)) {
    const weight = SIGNAL_WEIGHTS[kind as SignalKind] ?? 0;
    weighted[kind] = count * weight;
  }

  // Calculate total score
  const score = base + Object.values(weighted).reduce((a, b) => a + b, 0);

  // Generate explanation
  const parts: string[] = [];
  for (const [kind, w] of Object.entries(weighted)) {
    if (w > 0) {
      parts.push(`${kind}×${counts[kind]} (${w})`);
    }
  }

  const explain =
    `Score ${score} = base ${base}` +
    (parts.length > 0 ? " + " + parts.join(" + ") : "");

  return {
    aha_id: ahaId,
    score,
    base,
    counts,
    weighted,
    explain,
  };
}

/**
 * Get top aha cards by score.
 *
 * @param ahaCards - Map of aha card ID to card
 * @param signals - All signals from the store
 * @param limit - Maximum number of cards to return
 * @returns Sorted array of scored cards (highest score first)
 */
export function topAhaByScore(
  ahaCards: Map<string, AhaCard>,
  signals: Signal[],
  limit: number = 10
): ScoredAhaCard[] {
  const ranked: ScoredAhaCard[] = [];

  for (const [ahaId, card] of ahaCards) {
    const bd = calculateScoreBreakdown(ahaId, signals);
    ranked.push({
      id: ahaId,
      title: card.title,
      primary_skill: card.primary_skill,
      score: bd.score,
      explain: bd.explain,
      counts: bd.counts,
    });
  }

  // Sort by score descending, then by title for stability
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  return ranked.slice(0, Math.max(0, limit));
}

/**
 * Calculate the total score for an aha card.
 *
 * @param ahaId - Aha card ID
 * @param signals - All signals from the store
 * @returns Total score
 */
export function calculateScore(ahaId: string, signals: Signal[]): number {
  return calculateScoreBreakdown(ahaId, signals).score;
}

// =============================================================================
// Recommendation Scoring
// =============================================================================

/**
 * Calculate impact score for a recommendation.
 *
 * Used for sorting recommendations by priority.
 * Speed contributes more (×10) than quality (×1).
 *
 * @param impact - Expected impact from recommendation
 * @returns Impact score (0-33)
 */
export function calculateImpactScore(impact: ExpectedImpact | undefined): number {
  if (!impact) return 0;

  const levelToScore: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const speedScore = levelToScore[impact.speed ?? "low"] ?? 0;
  const qualityScore = levelToScore[impact.quality ?? "low"] ?? 0;

  // Speed is weighted more heavily
  return speedScore * 10 + qualityScore;
}

/**
 * Calculate priority score for sorting recommendations.
 *
 * @param rec - Recommendation
 * @returns Priority score
 */
export function calculateRecPriority(rec: Recommendation): number {
  return calculateImpactScore(rec.expected_impact);
}

// =============================================================================
// Backport Candidate Detection
// =============================================================================

/**
 * Check if an aha card is a backport candidate.
 *
 * Candidates must:
 * - Have shareable: true
 * - Not be rejected, deprecated, or already backported
 * - Have score >= minScore OR have been reinforced/used at least once
 *
 * @param card - Aha card
 * @param breakdown - Score breakdown
 * @param minScore - Minimum score threshold (default: 4)
 * @returns true if card is a backport candidate
 */
export function isBackportCandidate(
  card: AhaCard,
  breakdown: ScoreBreakdown,
  minScore: number = 4
): boolean {
  // Must be shareable
  if (!card.shareable) return false;

  // Must not be rejected, deprecated, or already backported
  const excludedStatuses = ["rejected", "deprecated", "backported"];
  if (excludedStatuses.includes(card.status)) return false;

  // Check score or signal counts
  const reinforced = breakdown.counts.aha_reinforced ?? 0;
  const used = breakdown.counts.aha_used ?? 0;

  // Accepted cards are always candidates regardless of score
  if (card.status === "accepted") return true;

  // Otherwise, need score >= minScore or at least one reinforcement/use
  return breakdown.score >= minScore || reinforced >= 1 || used >= 1;
}
