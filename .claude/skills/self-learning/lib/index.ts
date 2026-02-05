/**
 * Self-Learning Library Index
 *
 * Re-exports all library modules for convenient imports.
 *
 * @module self-learning/lib
 */

// Store management
export {
  STORE_VERSION,
  AGENT_SKILLS_DIR,
  SELF_LEARNING_DIR,
  USERS_DIR,
  FILES,
  safeUserSlug,
  findRepoRoot,
  getProjectStore,
  getGlobalStore,
  getStorePath,
  ensureStoreDirs,
  isStoreInitialized,
  updateGitignore,
  resolveProjectStore,
  resolveGlobalStore,
} from "./store";

// JSONL operations
export type { JsonlParseError, JsonlReadResult, EventStreamResult } from "./jsonl";
export {
  readJsonl,
  tailJsonl,
  appendJsonl,
  appendJsonlBatch,
  firstAndLatestById,
  uniqueById,
  recordExists,
} from "./jsonl";

// ID generation
export {
  stableId,
  ahaId,
  recId,
  sigId,
  evtId,
  backportId,
  ahaEquivalenceKey,
  idPrefix,
  isValidId,
} from "./id-generator";

// Timestamp utilities
export {
  isoNow,
  parseIsoTs,
  daysAgo,
  isWithinDays,
  formatTimestamp,
  fileTimestamp,
} from "./timestamp";

// Validation
export type { RecordPayload } from "./validation";
export {
  validateRecordPayload,
  validateSignalInput,
  normalizeScope,
  normalizePrimarySkill,
  normalizeRecStatus,
  normalizeAhaStatus,
  parseIdList,
} from "./validation";

// Merge utilities
export {
  mergeListPreserve,
  dedupePreserveOrder,
  dedupeByKey,
  deepMerge,
  mergeAhaCard,
  shallowEqual,
  contentChanged,
} from "./merge";

// Scoring
export type { ScoreBreakdown, ScoredAhaCard } from "./scoring";
export {
  calculateScoreBreakdown,
  topAhaByScore,
  calculateScore,
  calculateImpactScore,
  calculateRecPriority,
  isBackportCandidate,
} from "./scoring";
