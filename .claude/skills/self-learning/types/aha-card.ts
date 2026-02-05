/**
 * Aha Card Types
 *
 * Aha Cards are durable, reusable learnings captured during work.
 * They represent patterns, gotchas, and solutions that can help
 * avoid repeating mistakes.
 *
 * @module self-learning/types/aha-card
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Scope determines where a learning applies.
 */
export type Scope = "project" | "portable";

/**
 * Status tracks the lifecycle of an Aha Card.
 */
export type AhaStatus =
  | "proposed"   // Initial state - needs review
  | "accepted"   // Reviewed and confirmed valuable
  | "rejected"   // Reviewed and deemed not useful
  | "deprecated" // Was useful, no longer applies
  | "backported"; // Promoted to permanent skill/doc

/**
 * An Aha Card represents a durable learning.
 *
 * JSON fields use snake_case for JSONL format compatibility.
 *
 * @example
 * ```typescript
 * const card: AhaCard = {
 *   id: "aha_abc123def456",
 *   ts: "2026-01-29T10:30:00Z",
 *   title: "Beads sync fails with wrong repo ID",
 *   primary_skill: "beads",
 *   scope: "portable",
 *   status: "proposed",
 *   problem: "Spent 20 mins debugging sync errors",
 *   solution_steps: ["Run 'bd migrate --update-repo-id'"],
 *   tags: ["debug", "beads", "sync"]
 * };
 * ```
 */
export interface AhaCard {
  /** Stable ID: aha_<sha1-hash-12-chars> */
  id: string;

  /** ISO 8601 timestamp when created/updated */
  ts: string;

  /** Short, specific title */
  title: string;

  /** Skill this learning applies to (use "unknown" if unsure) */
  primary_skill: string;

  /** Where this learning applies */
  scope: Scope;

  /** Lifecycle status */
  status: AhaStatus;

  /** Keywords/trigger phrase for when to apply */
  when_to_use?: string;

  /** What slowed us down or caused uncertainty */
  problem?: string;

  /** Step-by-step solution */
  solution_steps?: string[];

  /** File paths, commands, or other evidence */
  evidence?: string[];

  /** Categorization tags */
  tags?: string[];

  /** Whether safe to share (no secrets/PII) */
  shareable?: boolean;

  /** Equivalence key for detecting duplicates */
  key?: string;

  /** Schema-like summary of inputs (optional) */
  input_shape?: Record<string, unknown>;

  /** Schema-like summary of outputs (optional) */
  output_shape?: Record<string, unknown>;

  /** Caveats and edge cases */
  gotchas?: string[];

  /** Internal references/links */
  links?: string[];

  /** Last status change timestamp */
  last_touched_ts?: string;

  /** Note explaining status change */
  note?: string;
}

/**
 * Minimum required fields for recording an Aha Card.
 */
export interface AhaCardInput {
  title: string;
  primary_skill?: string;
  scope?: Scope;
  when_to_use?: string;
  problem?: string;
  solution_steps?: string[];
  summary?: string; // Alias for problem
  steps?: string[]; // Alias for solution_steps
  evidence?: string[];
  tags?: string[];
  shareable?: boolean;
  input_shape?: Record<string, unknown>;
  output_shape?: Record<string, unknown>;
  gotchas?: string[];
  links?: string[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid Scope.
 */
export function isScope(value: unknown): value is Scope {
  return value === "project" || value === "portable";
}

/**
 * Check if a value is a valid AhaStatus.
 */
export function isAhaStatus(value: unknown): value is AhaStatus {
  return (
    value === "proposed" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "deprecated" ||
    value === "backported"
  );
}

/**
 * Check if a value is a valid AhaCard.
 */
export function isAhaCard(value: unknown): value is AhaCard {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.ts === "string" &&
    typeof obj.title === "string" &&
    typeof obj.primary_skill === "string" &&
    isScope(obj.scope) &&
    isAhaStatus(obj.status)
  );
}

/**
 * Check if a value is a valid AhaCardInput.
 */
export function isAhaCardInput(value: unknown): value is AhaCardInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.title === "string";
}

// =============================================================================
// Constants
// =============================================================================

export const AHA_STATUSES: readonly AhaStatus[] = [
  "proposed",
  "accepted",
  "rejected",
  "deprecated",
  "backported",
] as const;

export const SCOPES: readonly Scope[] = ["project", "portable"] as const;
