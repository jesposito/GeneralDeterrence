/**
 * Result Types for Self-Learning Operations
 *
 * Follows diary project conventions: return Result objects instead of throwing.
 *
 * @module self-learning/types/result
 */

// =============================================================================
// Core Result Type
// =============================================================================

/**
 * Discriminated union for operation results.
 * Use this instead of throwing exceptions.
 *
 * @example
 * ```typescript
 * const result = await readJsonl<AhaCard>(path);
 * if (result.success) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export type Result<T, E = SelfLearningError> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Async version of Result for promise-returning functions.
 */
export type AsyncResult<T, E = SelfLearningError> = Promise<Result<T, E>>;

// =============================================================================
// Error Types
// =============================================================================

/**
 * Standard error structure for self-learning operations.
 */
export interface SelfLearningError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Error codes for categorizing failures.
 */
export type ErrorCode =
  | "STORE_NOT_INITIALIZED"
  | "STORE_NOT_FOUND"
  | "INVALID_PAYLOAD"
  | "PARSE_ERROR"
  | "IO_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "INVALID_ID"
  | "INVALID_STATUS";

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a success result.
 */
export function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Create a failure result.
 */
export function err<E = SelfLearningError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Create a SelfLearningError.
 */
export function makeError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): SelfLearningError {
  return { code, message, details };
}
