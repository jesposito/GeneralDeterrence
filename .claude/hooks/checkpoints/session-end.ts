#!/usr/bin/env bun
/**
 * Session End Checkpoint
 *
 * Warns about unsynced beads and uncommitted changes at session end.
 * This is an advisory-only checkpoint - it never blocks.
 *
 * Hook registration: Stop with wildcard matcher
 */

import type { HookInput, EvaluationResult } from "../evaluator/types";
import { evaluate, canEvaluate, loadConfig } from "../evaluator";
import { parseTranscript, getRecentMessages, getGitStatus } from "../evaluator/context-gatherer";

/**
 * Check for bd sync command in transcript
 */
function hasBdSync(transcriptText: string): boolean {
  const syncPatterns = [/bd sync --from-main/i, /bd sync\s*$/im, /bd sync\s+--/i];
  return syncPatterns.some((p) => p.test(transcriptText));
}

/**
 * Check for git push command in transcript
 */
function hasGitPush(transcriptText: string): boolean {
  const pushPatterns = [
    /git push\s*$/im,
    /git push\s+/i,
    /git pull --rebase && git push/i,
    /git pull --rebase.*&&.*git push/i,
  ];
  return pushPatterns.some((p) => p.test(transcriptText));
}

/**
 * Extract text content from transcript for command detection
 */
function getTranscriptText(records: ReturnType<typeof getRecentMessages>): string {
  return records
    .map((r) => {
      if (r.tool_input) {
        const command = (r.tool_input as { command?: string }).command;
        if (command && typeof command === "string") {
          return command;
        }
      }
      if (r.result && typeof r.result === "string") {
        return r.result;
      }
      if (typeof r.message === "string") {
        return r.message;
      }
      if (r.message && typeof r.message === "object") {
        const msg = r.message as { content?: unknown };
        if (Array.isArray(msg.content)) {
          return msg.content
            .filter((c: unknown) => c && typeof c === "object" && (c as { type?: string }).type === "text")
            .map((c: unknown) => (c as { text?: string }).text || "")
            .join("\n");
        }
        if (typeof msg.content === "string") {
          return msg.content;
        }
      }
      return "";
    })
    .join("\n");
}

/**
 * Format recovery commands as a list
 */
function formatRecoveryCommands(commands: string[]): string {
  if (commands.length === 0) return "";
  return commands.map((cmd, i) => `  ${i + 1}. ${cmd}`).join("\n");
}

/**
 * Create warning output with visual formatting
 */
function createWarningOutput(issues: string[], recoveryCommands: string[]): string {
  const width = 66;
  const border = "═".repeat(width);
  const innerWidth = width - 4; // Account for "║  " and " ║"

  const padLine = (text: string): string => {
    const cleanText = text.substring(0, innerWidth);
    const padding = innerWidth - cleanText.length;
    return `║  ${cleanText}${" ".repeat(Math.max(0, padding))}  ║`;
  };

  const lines: string[] = [];
  lines.push(`╔${border}╗`);
  lines.push(padLine("SESSION END CHECK - ITEMS TO VERIFY".padStart(Math.floor((innerWidth + 35) / 2))));
  lines.push(`╠${border}╣`);

  // Issues
  for (const issue of issues) {
    lines.push(padLine(issue));
  }

  if (recoveryCommands.length > 0) {
    lines.push(padLine(""));
    lines.push(padLine("BEFORE ENDING SESSION:"));
    for (let i = 0; i < recoveryCommands.length; i++) {
      lines.push(padLine(`${i + 1}. ${recoveryCommands[i]}`));
    }
  }

  lines.push(`╚${border}╝`);

  return lines.join("\n");
}

/**
 * Create pass output
 */
function createPassOutput(): string {
  return "[Session End] ✓ All checks passed - ready to end session";
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
 * Perform quick checks without calling the evaluator
 */
async function performQuickChecks(
  hookInput: HookInput
): Promise<{ issues: string[]; recoveryCommands: string[] }> {
  const issues: string[] = [];
  const recoveryCommands: string[] = [];

  // Parse transcript
  const records = await parseTranscript(hookInput.transcript_path);
  const recentMessages = getRecentMessages(records, 100); // Check more messages for session end
  const transcriptText = getTranscriptText(recentMessages);

  // Check for bd sync
  const hasSyncCommand = hasBdSync(transcriptText);
  if (hasSyncCommand) {
    issues.push("✓ bd sync --from-main was run");
  } else {
    issues.push("✗ bd sync --from-main not found in session");
    recoveryCommands.push("bd sync --from-main");
  }

  // Check git status
  const gitState = await getGitStatus();

  if (gitState.hasUncommittedChanges) {
    const fileCount = gitState.modifiedFiles.length + gitState.untrackedFiles.length;
    issues.push(`✗ Uncommitted changes detected (${fileCount} files)`);
    recoveryCommands.push('git add <files> && git commit -m "..."');
  } else {
    issues.push("✓ All changes committed");
  }

  // Check for git push
  const hasPushCommand = hasGitPush(transcriptText);
  if (gitState.hasUnpushedCommits) {
    issues.push("✗ Unpushed commits detected");
    if (!recoveryCommands.some((c) => c.includes("git push"))) {
      recoveryCommands.push("git push");
    }
  } else if (!hasPushCommand && gitState.currentBranch !== "unknown") {
    // No push found and no unpushed commits - might be okay, just note it
    issues.push("⚠ git push not found in session (may be okay if no changes)");
  } else {
    issues.push("✓ Changes pushed to remote");
  }

  return { issues, recoveryCommands };
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
      process.exit(0);
    }

    const hookInput: HookInput = JSON.parse(input);

    // Only run for Stop events
    if (hookInput.hook_event_name !== "Stop") {
      process.exit(0);
    }

    // Check if evaluator is enabled for sessionEnd
    if (!canEvaluate("sessionEnd")) {
      // Evaluator disabled - perform quick checks manually
      const { issues, recoveryCommands } = await performQuickChecks(hookInput);

      // Only show output if there are warnings
      if (recoveryCommands.length > 0) {
        console.log(createWarningOutput(issues, recoveryCommands));
      } else {
        console.log(createPassOutput());
      }

      process.exit(0);
    }

    // Full evaluation: Call the evaluator for detailed analysis
    const result = await evaluate("sessionEnd", hookInput);

    // Format output based on result
    if (result.verdict === "pass") {
      console.log(createPassOutput());
    } else {
      // Extract recovery commands if present in the result
      // Note: rawResponse may contain markdown code blocks, so we need to extract JSON first
      const recoveryCommands: string[] = [];
      if (result.rawResponse) {
        try {
          // Try to extract JSON from the raw response (may be wrapped in markdown)
          const jsonMatch = result.rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
          const jsonStr = jsonMatch ? jsonMatch[1] : result.rawResponse;
          const rawResult = JSON.parse(jsonStr);
          if (rawResult?.recoveryCommands && Array.isArray(rawResult.recoveryCommands)) {
            recoveryCommands.push(...rawResult.recoveryCommands);
          }
        } catch {
          // Ignore JSON parse errors - recovery commands are optional
        }
      }

      // Build issues from violations
      const issues: string[] = result.violations.map((v) => `✗ ${v.description}`);

      // Show warning output
      if (issues.length > 0 || recoveryCommands.length > 0) {
        console.log(createWarningOutput(issues, recoveryCommands));
      } else if (result.feedback) {
        console.log(`[Session End] ⚠ ${result.feedback}`);
      }
    }

    process.exit(0);
  } catch (error) {
    // Fail open on any error - just log and exit
    console.error(`[Session End] Error (fail-open): ${String(error).substring(0, 100)}`);
    process.exit(0);
  }
}

main();
