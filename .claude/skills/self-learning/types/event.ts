/**
 * Event Types
 *
 * Events track high-level task summaries for context.
 * They provide audit trail and help infer primary_skill.
 *
 * @module self-learning/types/event
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * An Event records a high-level task summary.
 *
 * @example
 * ```typescript
 * const event: Event = {
 *   id: "evt_abc123",
 *   ts: "2026-01-29T10:30:00Z",
 *   task_summary: "Implemented user authentication",
 *   primary_skill: "auth"
 * };
 * ```
 */
export interface Event {
  /** Stable ID: evt_<sha1-hash-12-chars> */
  id: string;

  /** ISO 8601 timestamp */
  ts: string;

  /** Summary of the task performed */
  task_summary?: string;

  /** Primary skill involved */
  primary_skill?: string;

  /** Tools used during the task */
  tools_used?: string[];
}

/**
 * Input for creating an Event.
 */
export interface EventInput {
  task_summary?: string;
  primary_skill?: string;
  tools_used?: string[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid Event.
 */
export function isEvent(value: unknown): value is Event {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.ts === "string";
}

/**
 * Check if a value is a valid EventInput.
 */
export function isEventInput(value: unknown): value is EventInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  // EventInput has all optional fields, so any object is valid
  return true;
}
