/**
 * Self-Learning Types Index
 *
 * Re-exports all types for convenient imports.
 *
 * @module self-learning/types
 */

// Result types
export type {
  Result,
  AsyncResult,
  SelfLearningError,
  ErrorCode,
} from "./result";
export { ok, err, makeError } from "./result";

// Aha Card types
export type { Scope, AhaStatus, AhaCard, AhaCardInput } from "./aha-card";
export {
  isScope,
  isAhaStatus,
  isAhaCard,
  isAhaCardInput,
  AHA_STATUSES,
  SCOPES,
} from "./aha-card";

// Recommendation types
export type {
  RecStatus,
  ExpectedImpact,
  BackportHint,
  Recommendation,
  RecommendationInput,
} from "./recommendation";
export {
  isRecStatus,
  isRecommendation,
  isRecommendationInput,
  REC_STATUSES,
  REC_STATUS_ALIASES,
} from "./recommendation";

// Signal types
export type { SignalKind, Signal, SignalInput } from "./signal";
export {
  isSignalKind,
  isSignal,
  SIGNAL_KINDS,
  SIGNAL_WEIGHTS,
  MIN_BACKPORT_SCORE,
} from "./signal";

// Event types
export type { Event, EventInput } from "./event";
export { isEvent, isEventInput } from "./event";

// Backport types
export type {
  BackportChange,
  BackportRecord,
  BackportManifest,
} from "./backport";
export {
  isBackportChange,
  isBackportRecord,
  BACKPORT_START_MARKER,
  BACKPORT_END_MARKER,
  AHA_CARD_START_MARKER,
  AHA_CARD_END_MARKER,
  AHA_FILE_HEADER_MARKER,
} from "./backport";
