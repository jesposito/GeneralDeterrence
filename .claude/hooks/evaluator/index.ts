/**
 * Claude CLI Evaluator - Main Orchestrator
 *
 * Coordinates evaluation of rule adherence using Claude CLI as the evaluator.
 *
 * Usage from checkpoint hooks:
 * ```typescript
 * import { evaluate, isCheckpointEnabled, loadConfig } from "./evaluator";
 *
 * const config = loadConfig();
 * if (isCheckpointEnabled(config, "preFlight")) {
 *   const result = await evaluate("preFlight", hookInput);
 *   // Handle result...
 * }
 * ```
 */

import { $ } from "bun";
import type {
  HookInput,
  EvaluationResult,
  EvaluatorConfig,
  CheckpointName,
  BlockingHookOutput,
} from "./types";
import { loadConfig, isCheckpointEnabled, isCheckpointBlocking, debugLog, debugLogTiming, debugLogPrompt } from "./config";
import {
  gatherContext,
  extractBeadsItemFromTranscript,
  parseTranscript,
  getRecentMessages,
  detectDevOpsSyncInTranscript,
  detectDevOpsLink,
} from "./context-gatherer";
import { buildPrompt } from "./prompt-builder";
import { parseResult, DEFAULT_PASS_RESULT, formatResultForDisplay, createBlockingOutput } from "./result-parser";

// Re-export commonly used items
export { loadConfig, isCheckpointEnabled, isCheckpointBlocking, debugLog, debugLogTiming } from "./config";
export { formatResultForDisplay, createBlockingOutput } from "./result-parser";
export type {
  HookInput,
  EvaluationResult,
  EvaluatorConfig,
  CheckpointName,
  Verdict,
  Violation,
  BlockingHookOutput,
  DevOpsSyncStatus,
} from "./types";
export { detectDevOpsSyncInTranscript, detectDevOpsLink } from "./context-gatherer";

/**
 * Call Claude CLI with the evaluation prompt
 *
 * Uses piped input to avoid shell escaping issues.
 * Implements timeout with fail-open behavior.
 */
async function callClaude(prompt: string, config: EvaluatorConfig): Promise<string> {
  const model = config.model;
  const timeoutMs = config.timeoutMs;

  debugLog(config, `Calling Claude CLI with model: ${model}, timeout: ${timeoutMs}ms`);

  try {
    // Use Bun.spawn for better control over stdin and timeout
    const proc = Bun.spawn(["claude", "--print", "--model", model], {
      stdin: new TextEncoder().encode(prompt),
      stdout: "pipe",
      stderr: "pipe",
    });

    // Create timeout promise
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error("Evaluation timed out"));
      }, timeoutMs);
    });

    // Create result promise
    const resultPromise = (async () => {
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        debugLog(config, `Claude CLI exited with code ${exitCode}`, { stderr });
        throw new Error(`Claude CLI exited with code ${exitCode}: ${stderr}`);
      }

      return stdout;
    })();

    // Race timeout against result
    const result = await Promise.race([resultPromise, timeoutPromise]);
    debugLog(config, "Claude CLI response received", { length: result.length });
    return result;
  } catch (error) {
    debugLog(config, "Claude CLI call failed", { error: String(error) });
    // Fail open - return a pass result on any error
    return JSON.stringify({
      verdict: "pass",
      violations: [],
      feedback: `Evaluation failed: ${String(error)}`,
    });
  }
}

/**
 * Main evaluation function
 *
 * Coordinates the full evaluation pipeline:
 * 1. Check if evaluation is enabled
 * 2. Gather context from transcript, beads, git, DevOps
 * 3. Build prompt from template
 * 4. Call Claude CLI
 * 5. Parse result
 *
 * Always fails open on errors - returns pass verdict.
 */
export async function evaluate(
  checkpoint: CheckpointName,
  hookInput: HookInput,
  beadsItemId?: string
): Promise<EvaluationResult> {
  const config = loadConfig();

  // Check if evaluator is enabled
  if (!config.enabled) {
    debugLog(config, "Evaluator is disabled globally");
    return DEFAULT_PASS_RESULT;
  }

  // Check if this checkpoint is enabled
  if (!isCheckpointEnabled(config, checkpoint)) {
    debugLog(config, `Checkpoint ${checkpoint} is disabled`);
    return DEFAULT_PASS_RESULT;
  }

  const evalStartTime = Date.now();
  debugLog(config, `Starting evaluation for checkpoint: ${checkpoint}`);

  try {
    // If no beads item ID provided, try to extract from transcript
    let itemId = beadsItemId;
    if (!itemId) {
      const transcriptStartTime = Date.now();
      const transcript = await parseTranscript(hookInput.transcript_path);
      const recentMessages = getRecentMessages(transcript);
      itemId = extractBeadsItemFromTranscript(recentMessages) || undefined;
      debugLogTiming(config, "transcript parsing", transcriptStartTime);
      debugLog(config, "Extracted beads item from transcript", { itemId });
    }

    // Gather context
    const contextStartTime = Date.now();
    debugLog(config, "Gathering context...");
    const context = await gatherContext(hookInput, itemId);
    debugLogTiming(config, "context gathering", contextStartTime);
    debugLog(config, "Context gathered", {
      hasBeadsState: !!context.beadsState,
      hasParentFeature: !!context.parentFeature,
      hasDevOpsState: !!context.devOpsState,
      transcriptLength: context.transcript.length,
    });

    // Build prompt
    const promptStartTime = Date.now();
    debugLog(config, "Building prompt...");
    const prompt = await buildPrompt(checkpoint, context);
    debugLogTiming(config, "prompt building", promptStartTime);
    debugLogPrompt(config, checkpoint, prompt);

    // Call Claude CLI
    const claudeStartTime = Date.now();
    const rawResult = await callClaude(prompt, config);
    debugLogTiming(config, "Claude CLI call", claudeStartTime);

    // Parse result
    const result = parseResult(rawResult);
    debugLogTiming(config, "total evaluation", evalStartTime);
    debugLog(config, "Evaluation complete", { verdict: result.verdict, rawResponseLength: rawResult.length });

    return result;
  } catch (error) {
    debugLog(config, "Evaluation failed, returning pass", { error: String(error) });
    // Fail open on any error
    return {
      ...DEFAULT_PASS_RESULT,
      feedback: `Evaluation failed: ${String(error)}`,
    };
  }
}

/**
 * Evaluate and return blocking hook output
 *
 * Convenience function for PreToolUse hooks that may need to block.
 * Returns the appropriate hook output format.
 */
export async function evaluateAndBlock(
  checkpoint: CheckpointName,
  hookInput: HookInput,
  beadsItemId?: string
): Promise<BlockingHookOutput> {
  const config = loadConfig();
  const result = await evaluate(checkpoint, hookInput, beadsItemId);

  // Only actually block if the checkpoint is configured as blocking
  const shouldBlock = isCheckpointBlocking(config, checkpoint) && result.verdict === "block";

  return {
    hookSpecificOutput: {
      decision: {
        behavior: shouldBlock ? "block" : "allow",
      },
      message: formatResultForDisplay(result),
    },
  };
}

/**
 * Evaluate and output warning message (for advisory checkpoints)
 *
 * Convenience function for PostToolUse or Stop hooks that should warn but not block.
 * Outputs the result message to stdout if there are warnings or blocks.
 */
export async function evaluateAndWarn(
  checkpoint: CheckpointName,
  hookInput: HookInput,
  beadsItemId?: string
): Promise<EvaluationResult> {
  const result = await evaluate(checkpoint, hookInput, beadsItemId);

  // Output warning/block to stdout for user visibility
  if (result.verdict !== "pass") {
    console.log(formatResultForDisplay(result));
  }

  return result;
}

/**
 * Quick check if evaluator can run
 *
 * Useful for hooks that want to skip context gathering if evaluator is disabled.
 */
export function canEvaluate(checkpoint: CheckpointName): boolean {
  const config = loadConfig();
  return config.enabled && isCheckpointEnabled(config, checkpoint);
}
