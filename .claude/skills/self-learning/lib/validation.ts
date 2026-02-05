/**
 * Validation Utilities
 *
 * Type guards and validation functions for self-learning data.
 *
 * @module self-learning/lib/validation
 */

import { ok, err, makeError } from "../types/result";
import type { Result } from "../types/result";
import type { AhaCardInput } from "../types/aha-card";
import type { RecommendationInput } from "../types/recommendation";
import type { SignalInput } from "../types/signal";
import type { EventInput } from "../types/event";
import { isScope, isAhaCardInput } from "../types/aha-card";
import { isRecommendationInput, REC_STATUS_ALIASES } from "../types/recommendation";
import { isSignalKind } from "../types/signal";

// =============================================================================
// Payload Validation
// =============================================================================

/**
 * Record payload for the record command.
 */
export interface RecordPayload {
  aha_cards?: AhaCardInput[];
  recommendations?: RecommendationInput[];
  events?: EventInput[];
  used?: {
    aha_ids?: string[];
    rec_ids?: string[];
  };
}

/**
 * Validate a record payload.
 *
 * @param payload - Raw payload object
 * @returns Result with validated payload or error
 */
export function validateRecordPayload(
  payload: unknown
): Result<RecordPayload> {
  if (typeof payload !== "object" || payload === null) {
    return err(makeError("INVALID_PAYLOAD", "Payload must be an object"));
  }

  const obj = payload as Record<string, unknown>;
  const result: RecordPayload = {};

  // Validate aha_cards
  if (obj.aha_cards !== undefined) {
    if (!Array.isArray(obj.aha_cards)) {
      return err(makeError("INVALID_PAYLOAD", "aha_cards must be an array"));
    }
    for (let i = 0; i < obj.aha_cards.length; i++) {
      if (!isAhaCardInput(obj.aha_cards[i])) {
        return err(
          makeError("INVALID_PAYLOAD", `aha_cards[${i}] must have a title`)
        );
      }
    }
    result.aha_cards = obj.aha_cards as AhaCardInput[];
  }

  // Validate recommendations
  if (obj.recommendations !== undefined) {
    if (!Array.isArray(obj.recommendations)) {
      return err(
        makeError("INVALID_PAYLOAD", "recommendations must be an array")
      );
    }
    for (let i = 0; i < obj.recommendations.length; i++) {
      if (!isRecommendationInput(obj.recommendations[i])) {
        return err(
          makeError(
            "INVALID_PAYLOAD",
            `recommendations[${i}] must have a title`
          )
        );
      }
    }
    result.recommendations = obj.recommendations as RecommendationInput[];
  }

  // Validate events
  if (obj.events !== undefined) {
    if (!Array.isArray(obj.events)) {
      return err(makeError("INVALID_PAYLOAD", "events must be an array"));
    }
    result.events = obj.events as EventInput[];
  }

  // Validate used
  if (obj.used !== undefined) {
    if (typeof obj.used !== "object" || obj.used === null) {
      return err(makeError("INVALID_PAYLOAD", "used must be an object"));
    }
    const used = obj.used as Record<string, unknown>;
    result.used = {};

    if (used.aha_ids !== undefined) {
      if (!Array.isArray(used.aha_ids)) {
        return err(makeError("INVALID_PAYLOAD", "used.aha_ids must be an array"));
      }
      result.used.aha_ids = used.aha_ids as string[];
    }

    if (used.rec_ids !== undefined) {
      if (!Array.isArray(used.rec_ids)) {
        return err(makeError("INVALID_PAYLOAD", "used.rec_ids must be an array"));
      }
      result.used.rec_ids = used.rec_ids as string[];
    }
  }

  return ok(result);
}

/**
 * Validate a signal input.
 *
 * @param input - Raw signal input
 * @returns Result with validated input or error
 */
export function validateSignalInput(input: unknown): Result<SignalInput> {
  if (typeof input !== "object" || input === null) {
    return err(makeError("INVALID_PAYLOAD", "Signal input must be an object"));
  }

  const obj = input as Record<string, unknown>;

  if (!isSignalKind(obj.kind)) {
    return err(makeError("INVALID_PAYLOAD", `Invalid signal kind: ${obj.kind}`));
  }

  // Must have either aha_id or rec_id for most signals
  const ahaSignals = ["aha_used", "aha_recalled", "aha_reinforced", "aha_promoted", "aha_backported"];
  const recSignals = ["rec_used", "rec_touched", "rec_done"];

  if (ahaSignals.includes(obj.kind as string) && typeof obj.aha_id !== "string") {
    return err(makeError("INVALID_PAYLOAD", `${obj.kind} requires aha_id`));
  }

  if (recSignals.includes(obj.kind as string) && typeof obj.rec_id !== "string") {
    return err(makeError("INVALID_PAYLOAD", `${obj.kind} requires rec_id`));
  }

  return ok(obj as SignalInput);
}

// =============================================================================
// Normalization
// =============================================================================

/**
 * Normalize a scope value.
 *
 * @param scope - Raw scope value
 * @returns Normalized scope ("project" or "portable"), defaults to "project"
 */
export function normalizeScope(scope: unknown): "project" | "portable" {
  if (isScope(scope)) {
    return scope;
  }
  return "project";
}

/**
 * Normalize a primary skill value.
 *
 * @param skill - Raw skill value
 * @returns Normalized skill string, defaults to "unknown"
 */
export function normalizePrimarySkill(skill: unknown): string {
  if (typeof skill === "string" && skill.trim()) {
    return skill.trim().toLowerCase().replace(/\s+/g, "-");
  }
  return "unknown";
}

/**
 * Normalize a recommendation status, handling aliases.
 *
 * @param status - Raw status value
 * @returns Normalized status, or null if invalid
 */
export function normalizeRecStatus(
  status: unknown
): "proposed" | "accepted" | "in_progress" | "done" | "rejected" | "deprecated" | null {
  if (typeof status !== "string") {
    return null;
  }

  const normalized = status.toLowerCase().trim();

  // Check aliases first
  if (normalized in REC_STATUS_ALIASES) {
    return REC_STATUS_ALIASES[normalized];
  }

  // Check direct match
  const validStatuses = [
    "proposed",
    "accepted",
    "in_progress",
    "done",
    "rejected",
    "deprecated",
  ] as const;

  if (validStatuses.includes(normalized as typeof validStatuses[number])) {
    return normalized as typeof validStatuses[number];
  }

  return null;
}

/**
 * Normalize an aha status.
 *
 * @param status - Raw status value
 * @returns Normalized status, or null if invalid
 */
export function normalizeAhaStatus(
  status: unknown
): "proposed" | "accepted" | "rejected" | "deprecated" | "backported" | null {
  if (typeof status !== "string") {
    return null;
  }

  const normalized = status.toLowerCase().trim();
  const validStatuses = [
    "proposed",
    "accepted",
    "rejected",
    "deprecated",
    "backported",
  ] as const;

  if (validStatuses.includes(normalized as typeof validStatuses[number])) {
    return normalized as typeof validStatuses[number];
  }

  return null;
}

// =============================================================================
// ID Parsing
// =============================================================================

/**
 * Parse a comma-separated or JSON array of IDs.
 *
 * @param input - Comma-separated string or JSON array string
 * @returns Array of IDs
 */
export function parseIdList(input: string): string[] {
  const trimmed = input.trim();

  // Try JSON array first
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((id) => typeof id === "string" && id.trim());
      }
    } catch {
      // Fall through to comma-separated
    }
  }

  // Comma-separated
  return trimmed
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id);
}
