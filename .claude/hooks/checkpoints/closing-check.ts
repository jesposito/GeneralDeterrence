#!/usr/bin/env bun
/**
 * Closing Check Checkpoint
 *
 * Warns about incomplete closing documentation when running `bd close`.
 * This is an advisory-only checkpoint - it never blocks.
 *
 * Hook registration: PostToolUse with matcher for Bash (checks for bd close)
 */

import type { HookInput, EvaluationResult } from "../evaluator/types";
import { evaluate, canEvaluate } from "../evaluator";
import { parseTranscript, getRecentMessages, getBeadsItemState } from "../evaluator/context-gatherer";

/**
 * Get parent info and acceptance criteria status for an item
 */
async function getParentAcceptanceCriteria(itemId: string): Promise<{
  parentId: string | null;
  parentType: string | null;
  hasAcceptanceCriteria: boolean;
  uncheckedCriteria: number;
  checkedCriteria: number;
}> {
  try {
    // Get item info to find parent
    const proc = Bun.spawn(["bd", "show", itemId], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();

    // Find parent from DEPENDS ON section
    const parentMatch = output.match(/→[^a-z]*([\w\-\.]+):/i);
    const parentId = parentMatch ? parentMatch[1] : null;

    if (!parentId) {
      return { parentId: null, parentType: null, hasAcceptanceCriteria: false, uncheckedCriteria: 0, checkedCriteria: 0 };
    }

    // Get parent info
    const parentProc = Bun.spawn(["bd", "show", parentId], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const parentOutput = await new Response(parentProc.stdout).text();

    // Get parent type
    const typeMatch = parentOutput.match(/\[(EPIC|FEATURE|TASK|BUG)\]/i) ||
                      parentOutput.match(/Type:\s*(epic|feature|task|bug)/i);
    const parentType = typeMatch ? typeMatch[1].toLowerCase() : null;

    // Check for acceptance criteria in parent
    const uncheckedMatches = parentOutput.match(/- \[ \]/g) || [];
    const checkedMatches = parentOutput.match(/- \[x\]/gi) || [];

    const hasAcceptanceCriteria = uncheckedMatches.length > 0 || checkedMatches.length > 0;

    return {
      parentId,
      parentType,
      hasAcceptanceCriteria,
      uncheckedCriteria: uncheckedMatches.length,
      checkedCriteria: checkedMatches.length,
    };
  } catch {
    return { parentId: null, parentType: null, hasAcceptanceCriteria: false, uncheckedCriteria: 0, checkedCriteria: 0 };
  }
}

/**
 * Check if this is a bd close command
 */
function isBdCloseCommand(hookInput: HookInput): boolean {
  if (hookInput.tool_name !== "Bash") return false;

  const toolInput = hookInput.tool_input as { command?: string } | undefined;
  if (!toolInput?.command) return false;

  // Match bd close commands
  return /\bbd\s+close\b/i.test(toolInput.command);
}

/**
 * Extract beads item IDs from bd close command
 */
function extractBeadsIds(command: string): string[] {
  // Match patterns like: bd close item-001 item-002 --reason "..."
  const match = command.match(/bd\s+close\s+([\w\-\.]+(?:\s+[\w\-\.]+)*)/i);
  if (!match) return [];

  // Split by whitespace and filter out flags
  return match[1]
    .split(/\s+/)
    .filter((id) => !id.startsWith("-") && id.length > 0);
}

/**
 * Extract text content from transcript
 */
function getTranscriptText(records: ReturnType<typeof getRecentMessages>): string {
  return records
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
}

/**
 * Create warning output with visual formatting
 */
function createWarningOutput(beadsIds: string[], issues: string[], suggestions: string[]): string {
  const width = 66;
  const border = "═".repeat(width);
  const innerWidth = width - 4;

  const padLine = (text: string): string => {
    const cleanText = text.substring(0, innerWidth);
    const padding = innerWidth - cleanText.length;
    return `║  ${cleanText}${" ".repeat(Math.max(0, padding))}  ║`;
  };

  const lines: string[] = [];
  lines.push(`╔${border}╗`);
  lines.push(padLine("CLOSING CHECK - DOCUMENTATION REVIEW".padStart(Math.floor((innerWidth + 37) / 2))));
  lines.push(`╠${border}╣`);

  // Show which items are being closed
  if (beadsIds.length > 0) {
    lines.push(padLine(`Closing: ${beadsIds.join(", ")}`));
    lines.push(padLine(""));
  }

  // Issues found
  for (const issue of issues) {
    lines.push(padLine(issue));
  }

  // Suggestions
  if (suggestions.length > 0) {
    lines.push(padLine(""));
    lines.push(padLine("SUGGESTIONS:"));
    for (let i = 0; i < suggestions.length; i++) {
      // Wrap long suggestions
      const suggestion = suggestions[i];
      if (suggestion.length > innerWidth - 3) {
        const words = suggestion.split(" ");
        let line = `${i + 1}. `;
        for (const word of words) {
          if ((line + word).length > innerWidth - 3) {
            lines.push(padLine(line));
            line = "   " + word + " ";
          } else {
            line += word + " ";
          }
        }
        if (line.trim()) lines.push(padLine(line));
      } else {
        lines.push(padLine(`${i + 1}. ${suggestion}`));
      }
    }
  }

  lines.push(`╚${border}╝`);

  return lines.join("\n");
}

/**
 * Create pass output
 */
function createPassOutput(beadsIds: string[]): string {
  return `[Closing Check] ✓ Documentation complete for ${beadsIds.join(", ")}`;
}

/**
 * Read stdin as text
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
  hookInput: HookInput,
  beadsIds: string[]
): Promise<{ issues: string[]; suggestions: string[] }> {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Parse transcript to check for closing documentation
  const records = await parseTranscript(hookInput.transcript_path);
  const recentMessages = getRecentMessages(records, 50);
  const transcriptText = getTranscriptText(recentMessages);

  // Check for key closing documentation elements
  const hasFilesList = /files?\s*(created|updated|modified|changed)/i.test(transcriptText);
  const hasTestsMention = /tests?\s*(created|updated|added|written|pass)/i.test(transcriptText);
  const hasAcceptanceCriteriaMention = /acceptance\s*criteria/i.test(transcriptText) || /\[x\]/i.test(transcriptText);
  const hasSummary = /summary|completed|implemented|finished/i.test(transcriptText);

  // Check the close reason if available (from the command)
  const toolInput = hookInput.tool_input as { command?: string } | undefined;
  const command = toolInput?.command || "";
  const hasCloseReason = /--reason\s+["']/.test(command) || /--reason=/.test(command);

  if (!hasCloseReason) {
    issues.push("✗ No --reason provided in bd close command");
    suggestions.push("Use: bd close <id> --reason \"Summary of work done...\"");
  }

  if (!hasFilesList) {
    issues.push("⚠ No files list found in recent conversation");
    suggestions.push("Document files created/updated in the close reason");
  }

  if (!hasTestsMention) {
    issues.push("⚠ No tests mentioned in recent conversation");
    suggestions.push("Add tests section or explain why tests not needed");
  }

  // Check parent acceptance criteria for each closed item
  let hasParentWithCriteria = false;
  let criteriaUpdated = false;
  const parentsToUpdate: string[] = [];

  for (const itemId of beadsIds) {
    const parentInfo = await getParentAcceptanceCriteria(itemId);

    if (parentInfo.parentId && parentInfo.hasAcceptanceCriteria) {
      hasParentWithCriteria = true;

      // Check if any criteria updates happened in this session
      const criteriaUpdatePattern = new RegExp(
        `bd\\s+update\\s+${parentInfo.parentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*--description`,
        'i'
      );
      const hasUpdateInTranscript = criteriaUpdatePattern.test(transcriptText);

      if (parentInfo.uncheckedCriteria > 0 && !hasUpdateInTranscript) {
        parentsToUpdate.push(
          `${parentInfo.parentId} (${parentInfo.parentType || 'item'}) has ${parentInfo.uncheckedCriteria} unchecked criteria`
        );
      } else if (hasUpdateInTranscript || hasAcceptanceCriteriaMention) {
        criteriaUpdated = true;
      }
    }
  }

  if (hasParentWithCriteria) {
    if (parentsToUpdate.length > 0 && !hasAcceptanceCriteriaMention) {
      issues.push("⚠ Parent acceptance criteria may need updating:");
      for (const parent of parentsToUpdate) {
        issues.push(`   ${parent}`);
      }
      suggestions.push("Update parent with: bd update <parent-id> --description \"...\" (check off [x] completed criteria)");
    } else if (criteriaUpdated || hasAcceptanceCriteriaMention) {
      issues.push("✓ Acceptance criteria addressed");
    }
  } else if (!hasAcceptanceCriteriaMention) {
    issues.push("ℹ No parent acceptance criteria found");
  } else {
    issues.push("✓ Acceptance criteria addressed");
  }

  // If everything looks good
  if (!issues.some(i => i.startsWith("✗") || i.startsWith("⚠"))) {
    if (!issues.some(i => i.includes("Close reason"))) {
      issues.unshift("✓ Close reason provided");
    }
    if (!issues.some(i => i.includes("Files"))) {
      issues.push("✓ Files documented");
    }
    if (!issues.some(i => i.includes("Tests"))) {
      issues.push("✓ Tests mentioned");
    }
  }

  return { issues, suggestions };
}

/**
 * Main checkpoint logic
 */
async function main(): Promise<void> {
  try {
    // Read hook input from stdin
    const input = readStdin();
    if (!input.trim()) {
      process.exit(0);
    }

    const hookInput: HookInput = JSON.parse(input);

    // Only run for bd close commands
    if (!isBdCloseCommand(hookInput)) {
      process.exit(0);
    }

    // Extract beads IDs being closed
    const toolInput = hookInput.tool_input as { command?: string } | undefined;
    const command = toolInput?.command || "";
    const beadsIds = extractBeadsIds(command);

    if (beadsIds.length === 0) {
      // No IDs found, skip check
      process.exit(0);
    }

    // Check if evaluator is enabled for closingCheck
    if (!canEvaluate("closingCheck")) {
      // Evaluator disabled - perform quick checks manually
      const { issues, suggestions } = await performQuickChecks(hookInput, beadsIds);

      // Only show output if there are warnings (suggestions present)
      if (suggestions.length > 0) {
        console.log(createWarningOutput(beadsIds, issues, suggestions));
      } else {
        console.log(createPassOutput(beadsIds));
      }

      process.exit(0);
    }

    // Full evaluation: Call the evaluator for detailed analysis
    const result = await evaluate("closingCheck", hookInput);

    // Format output based on result
    if (result.verdict === "pass") {
      console.log(createPassOutput(beadsIds));
    } else {
      // Build issues from violations
      const issues: string[] = result.violations.map((v) => `✗ ${v.description}`);

      // Extract suggestions from feedback
      const suggestions: string[] = [];
      if (result.feedback) {
        // Split feedback into individual suggestions
        const feedbackLines = result.feedback.split("\n").filter((l) => l.trim());
        for (const line of feedbackLines) {
          if (line.match(/^\d+\.|^-|^•/)) {
            suggestions.push(line.replace(/^\d+\.\s*|^-\s*|^•\s*/, ""));
          }
        }
        // If no numbered/bulleted items, use the whole feedback
        if (suggestions.length === 0 && result.feedback.length < 200) {
          suggestions.push(result.feedback);
        }
      }

      // Show warning output
      if (issues.length > 0 || suggestions.length > 0) {
        console.log(createWarningOutput(beadsIds, issues, suggestions));
      }
    }

    process.exit(0);
  } catch (error) {
    // Fail open on any error - just log and exit
    console.error(`[Closing Check] Error (fail-open): ${String(error).substring(0, 100)}`);
    process.exit(0);
  }
}

main();
