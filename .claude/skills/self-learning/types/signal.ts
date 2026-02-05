/**
 * Signal Types
 *
 * Signals track usage and lifecycle events for scoring.
 * They're lightweight records that contribute to Aha Card rankings.
 *
 * @module self-learning/types/signal
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Types of signals that can be recorded.
 */
export type SignalKind =
  | "aha_used"       // Aha card was applied to solve a problem
  | "aha_recalled"   // Aha card was read/reviewed
  | "aha_reinforced" // Same learning was discovered again
  | "aha_promoted"   // Aha card was promoted to global store
  | "aha_backported" // Aha card was backported to a skill
  | "rec_used"       // Recommendation was referenced
  | "rec_touched"    // Recommendation was updated
  | "rec_done";      // Recommendation was completed

/**
 * A Signal records a usage or lifecycle event.
 *
 * @example
 * ```typescript
 * const signal: Signal = {
 *   id: "sig_abc123",
 *   ts: "2026-01-29T10:30:00Z",
 *   kind: "aha_used",
 *   aha_id: "aha_xyz789",
 *   source: "agent",
 *   context: "Applied while debugging sync issue"
 * };
 * ```
 */
export interface Signal {
  /** Stable ID: sig_<sha1-hash-12-chars> */
  id: string;

  /** ISO 8601 timestamp */
  ts: string;

  /** Type of signal */
  kind: SignalKind;

  /** Related Aha Card ID (for aha_* signals) */
  aha_id?: string;

  /** Related Recommendation ID (for rec_* signals) */
  rec_id?: string;

  /** Source of the signal: "agent" or "manual" */
  source: string;

  /** Optional context explaining the signal */
  context?: string;
}

/**
 * Input for creating a Signal.
 */
export interface SignalInput {
  kind: SignalKind;
  aha_id?: string;
  rec_id?: string;
  source?: string;
  context?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid SignalKind.
 */
export function isSignalKind(value: unknown): value is SignalKind {
  return (
    value === "aha_used" ||
    value === "aha_recalled" ||
    value === "aha_reinforced" ||
    value === "aha_promoted" ||
    value === "aha_backported" ||
    value === "rec_used" ||
    value === "rec_touched" ||
    value === "rec_done"
  );
}

/**
 * Check if a value is a valid Signal.
 */
export function isSignal(value: unknown): value is Signal {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.ts === "string" &&
    isSignalKind(obj.kind) &&
    typeof obj.source === "string"
  );
}

// =============================================================================
// Constants
// =============================================================================

export const SIGNAL_KINDS: readonly SignalKind[] = [
  "aha_used",
  "aha_recalled",
  "aha_reinforced",
  "aha_promoted",
  "aha_backported",
  "rec_used",
  "rec_touched",
  "rec_done",
] as const;

/**
 * Weights for scoring Aha Cards based on signals.
 * Higher weight = more important signal.
 */
export const SIGNAL_WEIGHTS: Record<SignalKind, number> = {
  aha_used: 2,
  aha_recalled: 1,
  aha_reinforced: 1,
  aha_promoted: 1,
  aha_backported: 2,
  rec_used: 1,
  rec_touched: 1,
  rec_done: 2,
};

/**
 * Minimum score for a card to be considered a backport candidate.
 */
export const MIN_BACKPORT_SCORE = 4;
