/**
 * Checkpoint State Management
 *
 * Tracks acknowledged sessions to avoid repeated checkpoint evaluations.
 * State is stored in a JSON file that is gitignored.
 */

import { join, dirname } from "path";

/**
 * State structure stored in checkpoint-state.json
 */
interface CheckpointState {
  /** Session IDs that have passed pre-flight acknowledgment */
  acknowledgedSessions: {
    [sessionId: string]: {
      acknowledgedAt: number;
      checkpoint: "preFlight";
    };
  };
  /** Timestamp of last state update */
  lastUpdated: number;
}

/**
 * Get the state file path
 */
function getStateFilePath(): string {
  // State is stored in .claude/state/checkpoint-state.json
  // This file is relative to .claude/hooks/checkpoints/
  return join(dirname(import.meta.path), "..", "..", "state", "checkpoint-state.json");
}

/**
 * Ensure the state directory exists
 */
async function ensureStateDir(): Promise<void> {
  const stateDir = dirname(getStateFilePath());
  try {
    await Bun.write(join(stateDir, ".gitkeep"), "");
  } catch {
    // Directory might already exist, that's fine
  }
}

/**
 * Load the current checkpoint state
 */
export function getCheckpointState(): CheckpointState {
  try {
    const file = Bun.file(getStateFilePath());
    // Note: Using synchronous approach via existsSync pattern
    // For Bun, we'll use a try/catch with JSON.parse
    const content = require(getStateFilePath());
    return content as CheckpointState;
  } catch {
    // Return empty state if file doesn't exist or is invalid
    return {
      acknowledgedSessions: {},
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Save the checkpoint state
 */
export function saveCheckpointState(state: CheckpointState): void {
  try {
    // Ensure directory exists synchronously
    const stateDir = dirname(getStateFilePath());
    const fs = require("fs");
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    // Write state
    fs.writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2));
  } catch {
    // Silently fail - state is just an optimization
  }
}

/**
 * Check if a session has been acknowledged for pre-flight
 */
export function isSessionAcknowledged(sessionId: string): boolean {
  const state = getCheckpointState();
  const session = state.acknowledgedSessions[sessionId];

  if (!session) {
    return false;
  }

  // Check if acknowledgment is recent (within 4 hours)
  // This prevents stale acknowledgments from persisting too long
  const maxAge = 4 * 60 * 60 * 1000; // 4 hours
  const age = Date.now() - session.acknowledgedAt;

  return age < maxAge;
}

/**
 * Mark a session as acknowledged
 */
export function setCheckpointState(sessionId: string, acknowledged: boolean): void {
  const state = getCheckpointState();

  if (acknowledged) {
    state.acknowledgedSessions[sessionId] = {
      acknowledgedAt: Date.now(),
      checkpoint: "preFlight",
    };
  } else {
    delete state.acknowledgedSessions[sessionId];
  }

  state.lastUpdated = Date.now();

  // Clean up old sessions (older than 24 hours)
  const maxAge = 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const [id, session] of Object.entries(state.acknowledgedSessions)) {
    if (now - session.acknowledgedAt > maxAge) {
      delete state.acknowledgedSessions[id];
    }
  }

  saveCheckpointState(state);
}

/**
 * Clear all session acknowledgments
 * Useful for testing or manual reset
 */
export function clearAllAcknowledgments(): void {
  saveCheckpointState({
    acknowledgedSessions: {},
    lastUpdated: Date.now(),
  });
}
