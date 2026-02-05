/**
 * JSONL Operations
 *
 * Read and append operations for append-only JSONL files.
 * Follows event stream semantics where later lines override earlier
 * for the same ID.
 *
 * @module self-learning/lib/jsonl
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Error encountered while parsing a JSONL line.
 */
export interface JsonlParseError {
  line: number;
  message: string;
  content: string;
}

/**
 * Result of reading a JSONL file.
 */
export interface JsonlReadResult<T> {
  records: T[];
  errors: JsonlParseError[];
}

/**
 * Read all records from a JSONL file.
 *
 * Skips invalid lines and reports them in errors array.
 * Returns empty array if file doesn't exist.
 *
 * @param path - Path to JSONL file
 * @returns Result with records and any parse errors
 *
 * @example
 * ```typescript
 * const result = await readJsonl<AhaCard>(path);
 * if (result.success) {
 *   console.log(`Read ${result.value.records.length} records`);
 *   if (result.value.errors.length > 0) {
 *     console.warn(`Skipped ${result.value.errors.length} invalid lines`);
 *   }
 * }
 * ```
 */
export async function readJsonl<T>(
  path: string
): AsyncResult<JsonlReadResult<T>> {
  try {
    const file = Bun.file(path);

    if (!(await file.exists())) {
      return ok({ records: [], errors: [] });
    }

    const content = await file.text();
    const lines = content.split("\n").filter((line) => line.trim());
    const records: T[] = [];
    const errors: JsonlParseError[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const record = JSON.parse(lines[i]) as T;
        records.push(record);
      } catch (error) {
        errors.push({
          line: i + 1,
          message: error instanceof Error ? error.message : String(error),
          content: lines[i].slice(0, 100),
        });
      }
    }

    return ok({ records, errors });
  } catch (error) {
    return err(
      makeError(
        "IO_ERROR",
        `Failed to read JSONL file: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

/**
 * Read the last N lines from a JSONL file.
 *
 * @param path - Path to JSONL file
 * @param n - Number of lines to read
 * @returns Result with records (most recent last)
 */
export async function tailJsonl<T>(
  path: string,
  n: number
): AsyncResult<JsonlReadResult<T>> {
  const result = await readJsonl<T>(path);
  if (!result.success) {
    return result;
  }

  const { records, errors } = result.value;
  return ok({
    records: records.slice(-n),
    errors: errors.filter((e) => e.line > records.length - n),
  });
}

// =============================================================================
// Write Operations
// =============================================================================

/**
 * Append a record to a JSONL file.
 *
 * Creates the file if it doesn't exist.
 *
 * @param path - Path to JSONL file
 * @param record - Record to append
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * const result = await appendJsonl(path, { id: "aha_123", title: "My learning" });
 * if (!result.success) {
 *   console.error(result.error.message);
 * }
 * ```
 */
export async function appendJsonl<T>(path: string, record: T): AsyncResult<void> {
  try {
    const file = Bun.file(path);
    const line = JSON.stringify(record) + "\n";

    if (await file.exists()) {
      // Append to existing file
      const existing = await file.text();
      const newContent = existing.endsWith("\n")
        ? existing + line
        : existing + "\n" + line;
      await Bun.write(path, newContent);
    } else {
      // Create new file
      await Bun.write(path, line);
    }

    return ok(undefined);
  } catch (error) {
    return err(
      makeError(
        "IO_ERROR",
        `Failed to append to JSONL file: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

/**
 * Append multiple records to a JSONL file.
 *
 * @param path - Path to JSONL file
 * @param records - Records to append
 * @returns Result indicating success or failure
 */
export async function appendJsonlBatch<T>(
  path: string,
  records: T[]
): AsyncResult<void> {
  if (records.length === 0) {
    return ok(undefined);
  }

  try {
    const file = Bun.file(path);
    const lines = records.map((r) => JSON.stringify(r)).join("\n") + "\n";

    if (await file.exists()) {
      const existing = await file.text();
      const newContent = existing.endsWith("\n")
        ? existing + lines
        : existing + "\n" + lines;
      await Bun.write(path, newContent);
    } else {
      await Bun.write(path, lines);
    }

    return ok(undefined);
  } catch (error) {
    return err(
      makeError(
        "IO_ERROR",
        `Failed to append batch to JSONL file: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

// =============================================================================
// Event Stream Processing
// =============================================================================

/**
 * Result of processing records as an event stream.
 */
export interface EventStreamResult<T> {
  /** First occurrence of each ID (creation record) */
  first: Map<string, T>;
  /** Latest occurrence of each ID (current state) */
  latest: Map<string, T>;
}

/**
 * Process JSONL records as an event stream.
 *
 * In event stream semantics, later lines with the same ID override earlier ones.
 * This function returns both the first and latest version of each record.
 *
 * @param records - Array of records with id field
 * @returns Maps of first and latest records by ID
 *
 * @example
 * ```typescript
 * const { first, latest } = firstAndLatestById(records);
 * // first.get("aha_123") = original record
 * // latest.get("aha_123") = most recent update
 * ```
 */
export function firstAndLatestById<T extends { id: string }>(
  records: T[]
): EventStreamResult<T> {
  const first = new Map<string, T>();
  const latest = new Map<string, T>();

  for (const record of records) {
    if (!first.has(record.id)) {
      first.set(record.id, record);
    }
    latest.set(record.id, record);
  }

  return { first, latest };
}

/**
 * Get unique records by ID (latest version wins).
 *
 * @param records - Array of records with id field
 * @returns Array of unique records (latest version of each)
 */
export function uniqueById<T extends { id: string }>(records: T[]): T[] {
  const { latest } = firstAndLatestById(records);
  return Array.from(latest.values());
}

/**
 * Check if a record with the given ID exists.
 *
 * @param records - Array of records with id field
 * @param id - ID to search for
 * @returns true if record exists
 */
export function recordExists<T extends { id: string }>(
  records: T[],
  id: string
): boolean {
  return records.some((r) => r.id === id);
}
