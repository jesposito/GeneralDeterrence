/**
 * Timestamp Utilities
 *
 * ISO 8601 timestamp generation and parsing.
 *
 * @module self-learning/lib/timestamp
 */

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Generate current UTC timestamp in ISO 8601 format.
 *
 * @returns ISO 8601 timestamp string (e.g., "2026-01-29T10:30:00Z")
 *
 * @example
 * ```typescript
 * const ts = isoNow();
 * // "2026-01-29T10:30:00Z"
 * ```
 */
export function isoNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Parse an ISO 8601 timestamp string to a Date.
 *
 * @param ts - ISO 8601 timestamp string
 * @returns Date object, or null if invalid
 *
 * @example
 * ```typescript
 * const date = parseIsoTs("2026-01-29T10:30:00Z");
 * ```
 */
export function parseIsoTs(ts: string): Date | null {
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

/**
 * Calculate days between a timestamp and now.
 *
 * @param ts - ISO 8601 timestamp string
 * @returns Number of days ago (can be fractional)
 *
 * @example
 * ```typescript
 * const days = daysAgo("2026-01-22T10:30:00Z");
 * // 7.5 (approximately)
 * ```
 */
export function daysAgo(ts: string): number {
  const date = parseIsoTs(ts);
  if (date === null) {
    return Infinity;
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Check if a timestamp is within the last N days.
 *
 * @param ts - ISO 8601 timestamp string
 * @param days - Number of days
 * @returns true if timestamp is within the last N days
 */
export function isWithinDays(ts: string, days: number): boolean {
  return daysAgo(ts) <= days;
}

/**
 * Format a timestamp for display (YYYY-MM-DD HH:MM).
 *
 * @param ts - ISO 8601 timestamp string
 * @returns Formatted string, or the original if invalid
 */
export function formatTimestamp(ts: string): string {
  const date = parseIsoTs(ts);
  if (date === null) {
    return ts;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Get a timestamp suitable for file/directory names.
 *
 * @returns Timestamp string like "20260129_103000"
 */
export function fileTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}
