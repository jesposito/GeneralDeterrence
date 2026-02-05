/**
 * Evaluator Configuration Module
 *
 * Provides configuration loading from file and environment variables.
 * Priority (highest to lowest):
 *   1. Environment variables
 *   2. Config file (evaluator.config.json)
 *   3. Default values
 */

import type { EvaluatorConfig, CheckpointName, CheckpointConfig } from "./types";
import { existsSync } from "fs";
import { join, dirname } from "path";

/**
 * Default configuration
 *
 * - Evaluator enabled by default
 * - Uses haiku model for speed (2-3s latency)
 * - 10 second timeout
 * - preFlight is blocking (must pass before code writing)
 * - closingCheck and sessionEnd are advisory (warn only)
 */
export const defaultConfig: EvaluatorConfig = {
  enabled: true,
  model: "haiku",
  timeoutMs: 10000,
  checkpoints: {
    preFlight: { enabled: true, blocking: true },
    closingCheck: { enabled: true, blocking: false },
    sessionEnd: { enabled: true, blocking: false },
  },
  debug: false,
};

/**
 * Path to the config file relative to this module
 */
const CONFIG_FILE_NAME = "evaluator.config.json";

/**
 * Load configuration from file if it exists
 */
function loadConfigFile(): Partial<EvaluatorConfig> | null {
  try {
    // Look for config file in the evaluator directory
    const configPath = join(dirname(import.meta.path), CONFIG_FILE_NAME);

    if (!existsSync(configPath)) {
      return null;
    }

    const content = require(configPath);
    return content;
  } catch {
    // Config file doesn't exist or is invalid - use defaults
    return null;
  }
}

/**
 * Merge checkpoint configs, preferring source values over defaults
 */
function mergeCheckpointConfig(
  base: CheckpointConfig,
  override?: Partial<CheckpointConfig>
): CheckpointConfig {
  if (!override) return { ...base };
  return {
    enabled: override.enabled ?? base.enabled,
    blocking: override.blocking ?? base.blocking,
  };
}

/**
 * Load configuration with file and environment variable overrides
 *
 * Priority (highest to lowest):
 *   1. Environment variables
 *   2. Config file (evaluator.config.json)
 *   3. Default values
 *
 * Environment variables:
 * - EVALUATOR_ENABLED: "true" | "false" - Global enable/disable
 * - EVALUATOR_DEBUG: "true" | "false" - Enable debug logging
 * - EVALUATOR_MODEL: "haiku" | "sonnet" - Model selection
 * - EVALUATOR_TIMEOUT_MS: number - Timeout in milliseconds
 * - EVALUATOR_PREFLIGHT_ENABLED: "true" | "false"
 * - EVALUATOR_PREFLIGHT_BLOCKING: "true" | "false"
 * - EVALUATOR_CLOSING_ENABLED: "true" | "false"
 * - EVALUATOR_CLOSING_BLOCKING: "true" | "false"
 * - EVALUATOR_SESSION_ENABLED: "true" | "false"
 * - EVALUATOR_SESSION_BLOCKING: "true" | "false"
 */
export function loadConfig(): EvaluatorConfig {
  // Start with defaults
  const config: EvaluatorConfig = structuredClone(defaultConfig);

  // Load file config and merge
  const fileConfig = loadConfigFile();
  if (fileConfig) {
    if (fileConfig.enabled !== undefined) config.enabled = fileConfig.enabled;
    if (fileConfig.model === "haiku" || fileConfig.model === "sonnet") {
      config.model = fileConfig.model;
    }
    if (fileConfig.timeoutMs !== undefined && fileConfig.timeoutMs > 0) {
      config.timeoutMs = fileConfig.timeoutMs;
    }
    if (fileConfig.debug !== undefined) config.debug = fileConfig.debug;

    // Merge checkpoint configs
    if (fileConfig.checkpoints) {
      config.checkpoints.preFlight = mergeCheckpointConfig(
        config.checkpoints.preFlight,
        fileConfig.checkpoints.preFlight as Partial<CheckpointConfig> | undefined
      );
      config.checkpoints.closingCheck = mergeCheckpointConfig(
        config.checkpoints.closingCheck,
        fileConfig.checkpoints.closingCheck as Partial<CheckpointConfig> | undefined
      );
      config.checkpoints.sessionEnd = mergeCheckpointConfig(
        config.checkpoints.sessionEnd,
        fileConfig.checkpoints.sessionEnd as Partial<CheckpointConfig> | undefined
      );
    }
  }

  // Apply environment variable overrides (highest priority)

  // Global settings
  if (process.env.EVALUATOR_ENABLED === "false") {
    config.enabled = false;
  } else if (process.env.EVALUATOR_ENABLED === "true") {
    config.enabled = true;
  }

  if (process.env.EVALUATOR_DEBUG === "true") {
    config.debug = true;
  } else if (process.env.EVALUATOR_DEBUG === "false") {
    config.debug = false;
  }

  if (process.env.EVALUATOR_MODEL === "haiku" || process.env.EVALUATOR_MODEL === "sonnet") {
    config.model = process.env.EVALUATOR_MODEL;
  }

  if (process.env.EVALUATOR_TIMEOUT_MS) {
    const timeout = parseInt(process.env.EVALUATOR_TIMEOUT_MS, 10);
    if (!isNaN(timeout) && timeout > 0) {
      config.timeoutMs = timeout;
    }
  }

  // Pre-flight checkpoint
  if (process.env.EVALUATOR_PREFLIGHT_ENABLED === "false") {
    config.checkpoints.preFlight.enabled = false;
  } else if (process.env.EVALUATOR_PREFLIGHT_ENABLED === "true") {
    config.checkpoints.preFlight.enabled = true;
  }

  if (process.env.EVALUATOR_PREFLIGHT_BLOCKING === "false") {
    config.checkpoints.preFlight.blocking = false;
  } else if (process.env.EVALUATOR_PREFLIGHT_BLOCKING === "true") {
    config.checkpoints.preFlight.blocking = true;
  }

  // Closing check checkpoint
  if (process.env.EVALUATOR_CLOSING_ENABLED === "false") {
    config.checkpoints.closingCheck.enabled = false;
  } else if (process.env.EVALUATOR_CLOSING_ENABLED === "true") {
    config.checkpoints.closingCheck.enabled = true;
  }

  if (process.env.EVALUATOR_CLOSING_BLOCKING === "false") {
    config.checkpoints.closingCheck.blocking = false;
  } else if (process.env.EVALUATOR_CLOSING_BLOCKING === "true") {
    config.checkpoints.closingCheck.blocking = true;
  }

  // Session end checkpoint
  if (process.env.EVALUATOR_SESSION_ENABLED === "false") {
    config.checkpoints.sessionEnd.enabled = false;
  } else if (process.env.EVALUATOR_SESSION_ENABLED === "true") {
    config.checkpoints.sessionEnd.enabled = true;
  }

  if (process.env.EVALUATOR_SESSION_BLOCKING === "false") {
    config.checkpoints.sessionEnd.blocking = false;
  } else if (process.env.EVALUATOR_SESSION_BLOCKING === "true") {
    config.checkpoints.sessionEnd.blocking = true;
  }

  return config;
}

/**
 * Check if a specific checkpoint is enabled
 */
export function isCheckpointEnabled(config: EvaluatorConfig, checkpoint: CheckpointName): boolean {
  if (!config.enabled) {
    return false;
  }
  return config.checkpoints[checkpoint]?.enabled ?? false;
}

/**
 * Check if a specific checkpoint should block on failures
 */
export function isCheckpointBlocking(config: EvaluatorConfig, checkpoint: CheckpointName): boolean {
  return config.checkpoints[checkpoint]?.blocking ?? false;
}

/**
 * Path to the debug log file
 */
const DEBUG_LOG_PATH = ".claude/state/evaluator-debug.log";

/**
 * Write debug log entry to file
 */
async function writeDebugLog(entry: string): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    // Ensure directory exists
    const dir = path.dirname(DEBUG_LOG_PATH);
    await fs.mkdir(dir, { recursive: true });

    // Append to log file
    await fs.appendFile(DEBUG_LOG_PATH, entry + "\n");
  } catch {
    // Silently fail - debug logging should never break the evaluator
  }
}

/**
 * Debug log helper - logs to file if debug mode is enabled
 *
 * Logs to .claude/state/evaluator-debug.log
 * Also outputs to stderr for immediate visibility
 */
export function debugLog(config: EvaluatorConfig, message: string, data?: unknown): void {
  if (config.debug) {
    const timestamp = new Date().toISOString();
    const logEntry = data
      ? `[EVALUATOR ${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}`
      : `[EVALUATOR ${timestamp}] ${message}`;

    // Write to file (async, fire-and-forget)
    writeDebugLog(logEntry);

    // Also output to stderr for immediate visibility
    console.error(logEntry);
  }
}

/**
 * Log timing information for performance analysis
 */
export function debugLogTiming(
  config: EvaluatorConfig,
  operation: string,
  startTime: number
): void {
  if (config.debug) {
    const durationMs = Date.now() - startTime;
    debugLog(config, `TIMING: ${operation}`, { durationMs });
  }
}

/**
 * Log prompt content for debugging evaluations
 */
export function debugLogPrompt(
  config: EvaluatorConfig,
  checkpoint: CheckpointName,
  prompt: string
): void {
  if (config.debug) {
    debugLog(config, `PROMPT for ${checkpoint}`, {
      length: prompt.length,
      preview: prompt.substring(0, 500) + (prompt.length > 500 ? "..." : ""),
    });
  }
}
