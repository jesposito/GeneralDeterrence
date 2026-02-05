#!/usr/bin/env bun
/**
 * Pre-Flight Checkpoint
 *
 * Enforces the pre-flight checklist before any code-modifying operations.
 * Blocks Edit/Write tools until the agent has acknowledged completing the checklist.
 *
 * Hook registration: PreToolUse with matchers for Edit and Write
 */

import type { HookInput, BlockingHookOutput } from "../evaluator/types";
import { evaluateAndBlock, canEvaluate, loadConfig, isCheckpointBlocking } from "../evaluator";
import { getCheckpointState, setCheckpointState, isSessionAcknowledged } from "./checkpoint-state";
import { parseTranscript, getRecentMessages } from "../evaluator/context-gatherer";

/**
 * Check if the transcript contains the pre-flight acknowledgment markers
 *
 * Fast path check before calling the full evaluator.
 */
async function hasAcknowledgmentMarkers(transcriptPath: string): Promise<boolean> {
  try {
    const records = await parseTranscript(transcriptPath);
    const recentMessages = getRecentMessages(records, 30); // Check more messages for acknowledgment

    // Convert to text for simple marker search
    const transcriptText = recentMessages
      .filter((r) => r.type === "assistant")
      .map((r) => {
        if (typeof r.message === "string") return r.message;
        if (r.message && typeof r.message === "object") {
          const msg = r.message as { content?: unknown };
          if (Array.isArray(msg.content)) {
            return msg.content
              .filter((c: unknown) => c && typeof c === "object" && (c as { type?: string }).type === "text")
              .map((c: unknown) => (c as { text?: string }).text || "")
              .join("\n");
          }
          if (typeof msg.content === "string") return msg.content;
        }
        return "";
      })
      .join("\n");

    // Check for both markers
    const hasStartMarker = transcriptText.includes("Pre-flight checklist complete:");
    const hasEndMarker = transcriptText.includes("Ready to begin implementation.");

    return hasStartMarker && hasEndMarker;
  } catch {
    // On error, assume no acknowledgment (will trigger full evaluation)
    return false;
  }
}

/**
 * Create a blocking output with detailed instructions
 */
function createBlockingMessage(): BlockingHookOutput {
  const message = `
╔════════════════════════════════════════════════════════════════╗
║              PRE-FLIGHT CHECKPOINT NOT COMPLETE                ║
╠════════════════════════════════════════════════════════════════╣
║  You must complete the pre-flight checklist before writing     ║
║  any code.                                                     ║
║                                                                ║
║  REQUIRED: State the following before proceeding:              ║
║                                                                ║
║  Pre-flight checklist complete:                                ║
║  - Plan confirmed: [yes/no - how]                              ║
║  - Acceptance criteria: [feature and epic both have them]      ║
║  - Research referenced: [yes/no/N/A - path if exists]          ║
║  - Beads tasks: [list task IDs that will be worked]            ║
║  - Status: [feature], [epic], [task] all in_progress           ║
║  - This task addresses:                                        ║
║    - Feature criteria: [list specific criteria]                ║
║    - Epic criteria: [list or "contributes via feature"]        ║
║                                                                ║
║  Ready to begin implementation.                                ║
╚════════════════════════════════════════════════════════════════╝`.trim();

  return {
    hookSpecificOutput: {
      decision: { behavior: "block" },
      message,
    },
  };
}

/**
 * Create an allowing output
 */
function createAllowingOutput(message: string = "Pre-flight checkpoint verified"): BlockingHookOutput {
  return {
    hookSpecificOutput: {
      decision: { behavior: "allow" },
      message: `[Pre-flight] ✓ ${message}`,
    },
  };
}

/**
 * Read stdin as text
 * Uses fs.readFileSync for reliable stdin reading in Bun
 */
function readStdin(): string {
  const fs = require("fs");
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Main checkpoint logic
 */
async function main(): Promise<void> {
  try {
    // Read hook input from stdin
    const input = readStdin();
    if (!input.trim()) {
      // No input - allow (fail open)
      console.log(JSON.stringify(createAllowingOutput("No input provided")));
      process.exit(0);
    }

    const hookInput: HookInput = JSON.parse(input);

    // Only run for Edit and Write tools
    if (hookInput.tool_name !== "Edit" && hookInput.tool_name !== "Write") {
      console.log(JSON.stringify(createAllowingOutput("Not a code-modifying tool")));
      process.exit(0);
    }

    // Fast path: Check if already acknowledged for this session
    const sessionId = hookInput.session_id;
    if (isSessionAcknowledged(sessionId)) {
      console.log(JSON.stringify(createAllowingOutput("Session already acknowledged")));
      process.exit(0);
    }

    // Check if evaluator is enabled
    if (!canEvaluate("preFlight")) {
      // Evaluator disabled - check for markers manually as fast path
      const hasMarkers = await hasAcknowledgmentMarkers(hookInput.transcript_path);
      if (hasMarkers) {
        // Mark session as acknowledged
        setCheckpointState(sessionId, true);
        console.log(JSON.stringify(createAllowingOutput("Acknowledgment markers found")));
      } else {
        // Evaluator disabled but no markers - still block if configured
        const config = loadConfig();
        if (isCheckpointBlocking(config, "preFlight")) {
          console.log(JSON.stringify(createBlockingMessage()));
        } else {
          console.log(JSON.stringify(createAllowingOutput("Evaluator disabled, allowing")));
        }
      }
      process.exit(0);
    }

    // Fast path: Check for acknowledgment markers before full evaluation
    const hasMarkers = await hasAcknowledgmentMarkers(hookInput.transcript_path);
    if (hasMarkers) {
      // Markers found - mark session as acknowledged and allow
      setCheckpointState(sessionId, true);
      console.log(JSON.stringify(createAllowingOutput("Acknowledgment verified")));
      process.exit(0);
    }

    // Full evaluation: Call the evaluator for detailed analysis
    const result = await evaluateAndBlock("preFlight", hookInput);

    // If the evaluator passed, mark session as acknowledged
    if (result.hookSpecificOutput.decision.behavior === "allow") {
      setCheckpointState(sessionId, true);
    }

    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    // Fail open on any error
    console.log(
      JSON.stringify(createAllowingOutput(`Error (fail-open): ${String(error).substring(0, 100)}`))
    );
    process.exit(0);
  }
}

main();
