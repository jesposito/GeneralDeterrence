/**
 * Backport Types
 *
 * Backports record when learnings are promoted to permanent skills/docs.
 * They provide provenance and audit trail for knowledge sharing.
 *
 * @module self-learning/types/backport
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Record of a file change in a backport.
 */
export interface BackportChange {
  /** Path to the changed file */
  path: string;

  /** Type of change */
  kind: "created" | "modified" | "appended";
}

/**
 * A BackportRecord tracks a backport operation.
 *
 * @example
 * ```typescript
 * const backport: BackportRecord = {
 *   backport_id: "slbp_20260129_abc123",
 *   generated_at: "2026-01-29T10:30:00Z",
 *   target_skill_name: "beads",
 *   target_skill_path: ".claude/skills/beads",
 *   requested_card_ids: ["aha_xyz789"],
 *   existing_card_ids: [],
 *   added_card_ids: ["aha_xyz789"],
 *   result_card_ids: ["aha_xyz789"],
 *   changes: [
 *     { path: "SKILL.md", kind: "modified" },
 *     { path: "references/self-learning-aha.md", kind: "created" }
 *   ],
 *   applied: true
 * };
 * ```
 */
export interface BackportRecord {
  /** Stable ID: slbp_<timestamp>_<hash6> */
  backport_id: string;

  /** ISO 8601 timestamp when bundle was generated */
  generated_at: string;

  /** Name of the target skill */
  target_skill_name: string;

  /** Path to the target skill directory */
  target_skill_path: string;

  /** Aha Card IDs that were requested for backport */
  requested_card_ids: string[];

  /** Aha Card IDs that already existed in the skill */
  existing_card_ids: string[];

  /** Aha Card IDs that were added */
  added_card_ids: string[];

  /** Final set of Aha Card IDs in the skill */
  result_card_ids: string[];

  /** Files changed by the backport */
  changes: BackportChange[];

  /** Whether the backport was applied (vs just generated) */
  applied?: boolean;
}

/**
 * Manifest file contents for a backport bundle.
 */
export interface BackportManifest {
  backport_id: string;
  generated_at: string;
  target_skill_name: string;
  target_skill_path: string;
  requested_card_ids: string[];
  existing_card_ids: string[];
  added_card_ids: string[];
  result_card_ids: string[];
  changes: BackportChange[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid BackportChange.
 */
export function isBackportChange(value: unknown): value is BackportChange {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.path === "string" &&
    (obj.kind === "created" || obj.kind === "modified" || obj.kind === "appended")
  );
}

/**
 * Check if a value is a valid BackportRecord.
 */
export function isBackportRecord(value: unknown): value is BackportRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.backport_id === "string" &&
    typeof obj.generated_at === "string" &&
    typeof obj.target_skill_name === "string" &&
    typeof obj.target_skill_path === "string" &&
    Array.isArray(obj.requested_card_ids) &&
    Array.isArray(obj.existing_card_ids) &&
    Array.isArray(obj.added_card_ids) &&
    Array.isArray(obj.result_card_ids) &&
    Array.isArray(obj.changes)
  );
}

// =============================================================================
// Constants
// =============================================================================

/**
 * HTML comment markers for backport blocks in SKILL.md
 */
export const BACKPORT_START_MARKER = "<!-- self-learning:backport:start";
export const BACKPORT_END_MARKER = "<!-- self-learning:backport:end -->";

/**
 * HTML comment markers for Aha cards in reference files
 */
export const AHA_CARD_START_MARKER = "<!-- self-learning:aha:start";
export const AHA_CARD_END_MARKER = "<!-- self-learning:aha:end -->";

/**
 * HTML comment marker for Aha file header
 */
export const AHA_FILE_HEADER_MARKER = "<!-- self-learning:aha-file";
