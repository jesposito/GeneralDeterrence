/**
 * ID Generator
 *
 * Generates stable, deterministic IDs using SHA1 hashing.
 * IDs are reproducible given the same input.
 *
 * @module self-learning/lib/id-generator
 */

import { createHash } from "crypto";
import { isoNow, fileTimestamp } from "./timestamp";

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Generate a stable ID from a payload.
 *
 * @param prefix - ID prefix (e.g., "aha", "rec", "sig")
 * @param payload - Object to hash (typically includes title and ts)
 * @returns Stable ID like "aha_abc123def456"
 *
 * @example
 * ```typescript
 * const id = stableId("aha", { title: "My learning", ts: "2026-01-29T10:30:00Z" });
 * // "aha_a1b2c3d4e5f6"
 * ```
 */
export function stableId(
  prefix: string,
  payload: Record<string, unknown>
): string {
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  const hash = createHash("sha1").update(json).digest("hex").slice(0, 12);
  return `${prefix}_${hash}`;
}

/**
 * Generate an Aha Card ID.
 *
 * @param title - Card title
 * @param ts - Optional timestamp (defaults to now)
 * @returns Stable ID like "aha_abc123def456"
 */
export function ahaId(title: string, ts?: string): string {
  return stableId("aha", { title, ts: ts ?? isoNow() });
}

/**
 * Generate a Recommendation ID.
 *
 * @param title - Recommendation title
 * @param ts - Optional timestamp (defaults to now)
 * @returns Stable ID like "rec_abc123def456"
 */
export function recId(title: string, ts?: string): string {
  return stableId("rec", { title, ts: ts ?? isoNow() });
}

/**
 * Generate a Signal ID.
 *
 * @param kind - Signal kind
 * @param targetId - Related aha_id or rec_id
 * @param ts - Optional timestamp (defaults to now)
 * @returns Stable ID like "sig_abc123def456"
 */
export function sigId(kind: string, targetId: string, ts?: string): string {
  return stableId("sig", { kind, target: targetId, ts: ts ?? isoNow() });
}

/**
 * Generate an Event ID.
 *
 * @param taskSummary - Task summary (optional)
 * @param ts - Optional timestamp (defaults to now)
 * @returns Stable ID like "evt_abc123def456"
 */
export function evtId(taskSummary?: string, ts?: string): string {
  return stableId("evt", { task: taskSummary ?? "", ts: ts ?? isoNow() });
}

/**
 * Generate a Backport ID.
 *
 * Format: slbp_<timestamp>_<hash6>
 *
 * @param skillName - Target skill name
 * @param cardIds - Aha Card IDs being backported
 * @returns Backport ID like "slbp_20260129_103000_abc123"
 */
export function backportId(skillName: string, cardIds: string[]): string {
  const ts = fileTimestamp();
  const hash = createHash("sha1")
    .update(JSON.stringify({ skill: skillName, cards: cardIds.sort() }))
    .digest("hex")
    .slice(0, 6);
  return `slbp_${ts}_${hash}`;
}

/**
 * Generate an equivalence key for detecting duplicate Aha Cards.
 *
 * Cards with the same equivalence key are considered the same learning.
 *
 * @param card - Partial Aha Card with title and optional problem/solution
 * @returns Equivalence key string
 */
export function ahaEquivalenceKey(card: {
  title: string;
  problem?: string;
  solution_steps?: string[];
}): string {
  const parts = [
    normalizeText(card.title),
    normalizeText(card.problem ?? ""),
    (card.solution_steps ?? []).map(normalizeText).join("|"),
  ];
  return createHash("sha1").update(parts.join("::")).digest("hex").slice(0, 16);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalize text for comparison (lowercase, collapse whitespace).
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Extract the prefix from an ID.
 *
 * @param id - ID string like "aha_abc123"
 * @returns Prefix like "aha", or null if invalid
 */
export function idPrefix(id: string): string | null {
  const match = id.match(/^([a-z]+)_/);
  return match ? match[1] : null;
}

/**
 * Check if a string looks like a valid ID.
 *
 * @param id - String to check
 * @param prefix - Optional expected prefix
 * @returns true if valid ID format
 */
export function isValidId(id: string, prefix?: string): boolean {
  if (prefix) {
    return new RegExp(`^${prefix}_[a-f0-9]{6,}$`).test(id);
  }
  return /^[a-z]+_[a-f0-9]{6,}$/.test(id);
}
