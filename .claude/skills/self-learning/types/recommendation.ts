/**
 * Recommendation Types
 *
 * Recommendations are improvement suggestions - things to change
 * to make the next similar task faster or cleaner.
 *
 * @module self-learning/types/recommendation
 */

import type { Scope } from "./aha-card";

// =============================================================================
// Core Types
// =============================================================================

/**
 * Status tracks the lifecycle of a Recommendation.
 */
export type RecStatus =
  | "proposed"    // Initial state - needs review
  | "accepted"    // Reviewed and will be implemented
  | "in_progress" // Currently being worked on
  | "done"        // Implemented
  | "rejected"    // Reviewed and deemed not useful
  | "deprecated"; // Was useful, no longer applies

/**
 * Impact assessment for a recommendation.
 */
export interface ExpectedImpact {
  speed?: "low" | "medium" | "high";
  quality?: "low" | "medium" | "high";
}

/**
 * Hint for backporting a recommendation.
 */
export interface BackportHint {
  target_skill?: string;
  target_file?: string;
  section?: string;
}

/**
 * A Recommendation represents an improvement suggestion.
 *
 * @example
 * ```typescript
 * const rec: Recommendation = {
 *   id: "rec_xyz789abc123",
 *   ts: "2026-01-29T10:30:00Z",
 *   title: "Add pre-flight checklist to implementation workflow",
 *   primary_skill: "workflow",
 *   scope: "portable",
 *   status: "proposed",
 *   description: "Would prevent starting work without proper setup"
 * };
 * ```
 */
export interface Recommendation {
  /** Stable ID: rec_<sha1-hash-12-chars> */
  id: string;

  /** ISO 8601 timestamp when created/updated */
  ts: string;

  /** Short, specific title */
  title: string;

  /** Skill this recommendation applies to */
  primary_skill: string;

  /** Where this recommendation applies */
  scope: Scope;

  /** Lifecycle status */
  status: RecStatus;

  /** Detailed description of the recommendation */
  description?: string;

  /** Why this would help */
  why?: string;

  /** Expected impact assessment */
  expected_impact?: ExpectedImpact;

  /** Hint for how to implement */
  implementation_hint?: string;

  /** Categorization tags */
  tags?: string[];

  /** Whether safe to share */
  shareable?: boolean;

  /** Hint for backporting */
  backport?: BackportHint;

  /** Last status change timestamp */
  last_touched_ts?: string;

  /** Note explaining status change */
  note?: string;
}

/**
 * Minimum required fields for recording a Recommendation.
 */
export interface RecommendationInput {
  title: string;
  primary_skill?: string;
  scope?: Scope;
  description?: string;
  why?: string;
  expected_impact?: ExpectedImpact;
  implementation_hint?: string;
  tags?: string[];
  shareable?: boolean;
  backport?: BackportHint;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid RecStatus.
 */
export function isRecStatus(value: unknown): value is RecStatus {
  return (
    value === "proposed" ||
    value === "accepted" ||
    value === "in_progress" ||
    value === "done" ||
    value === "rejected" ||
    value === "deprecated"
  );
}

/**
 * Check if a value is a valid Recommendation.
 */
export function isRecommendation(value: unknown): value is Recommendation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.ts === "string" &&
    typeof obj.title === "string" &&
    typeof obj.primary_skill === "string" &&
    (obj.scope === "project" || obj.scope === "portable") &&
    isRecStatus(obj.status)
  );
}

/**
 * Check if a value is a valid RecommendationInput.
 */
export function isRecommendationInput(
  value: unknown
): value is RecommendationInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.title === "string";
}

// =============================================================================
// Constants
// =============================================================================

export const REC_STATUSES: readonly RecStatus[] = [
  "proposed",
  "accepted",
  "in_progress",
  "done",
  "rejected",
  "deprecated",
] as const;

/**
 * Aliases for status values (for convenience).
 */
export const REC_STATUS_ALIASES: Record<string, RecStatus> = {
  implemented: "done",
  complete: "done",
  completed: "done",
  wip: "in_progress",
  working: "in_progress",
};
