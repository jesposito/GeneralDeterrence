#!/usr/bin/env bun
/**
 * Beads Status Update Checkpoint
 *
 * Validates that when setting an item to in_progress, parent items are also
 * set to in_progress.
 *
 * Hook registration: PostToolUse with matcher for Bash (checks for bd update --status)
 */

import type { HookInput } from "../evaluator/types";

/**
 * Check if this is a bd update --status=in_progress command
 */
function isBdStatusInProgressCommand(hookInput: HookInput): boolean {
  if (hookInput.tool_name !== "Bash") return false;

  const toolInput = hookInput.tool_input as { command?: string } | undefined;
  if (!toolInput?.command) return false;

  return /\bbd\s+update\b.*--status[=\s]+in_progress/i.test(toolInput.command);
}

/**
 * Extract item ID from bd update command
 */
function extractItemId(command: string): string | null {
  // Match: bd update <item-id> --status...
  const match = command.match(/bd\s+update\s+([\w\-\.]+)/i);
  return match ? match[1] : null;
}

/**
 * Get parent info by running bd show
 */
async function getItemInfo(itemId: string): Promise<{
  parentId: string | null;
  parentStatus: string | null;
  itemType: string | null;
}> {
  try {
    const proc = Bun.spawn(["bd", "show", itemId], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();

    // Look for parent in "DEPENDS ON" section or parent reference
    // Example: "→ ✓ ai-tw-claude-code-dev-env-gx3: Additional Rule..." or "Parent: gx3"
    const parentMatch = output.match(/→[^a-z]*([\w\-\.]+):/i) ||
                        output.match(/Parent:\s*([\w\-\.]+)/i);
    const parentId = parentMatch ? parentMatch[1] : null;

    // Get item type
    const typeMatch = output.match(/\[(EPIC|FEATURE|TASK|BUG)\]/i) ||
                      output.match(/Type:\s*(epic|feature|task|bug)/i);
    const itemType = typeMatch ? typeMatch[1].toLowerCase() : null;

    // If we have a parent, get its status
    let parentStatus: string | null = null;
    if (parentId) {
      const parentProc = Bun.spawn(["bd", "show", parentId], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const parentOutput = await new Response(parentProc.stdout).text();

      // Look for status: OPEN, IN_PROGRESS, CLOSED
      if (/IN_PROGRESS|in_progress/i.test(parentOutput)) {
        parentStatus = "in_progress";
      } else if (/CLOSED|closed/i.test(parentOutput)) {
        parentStatus = "closed";
      } else if (/OPEN|open/i.test(parentOutput)) {
        parentStatus = "open";
      }
    }

    return { parentId, parentStatus, itemType };
  } catch {
    return { parentId: null, parentStatus: null, itemType: null };
  }
}

/**
 * Create warning output with visual formatting
 */
function createWarningOutput(itemId: string, issues: string[], commands: string[]): string {
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
  lines.push(padLine("BEADS STATUS CHECK".padStart(Math.floor((innerWidth + 18) / 2))));
  lines.push(`╠${border}╣`);

  lines.push(padLine(`Item: ${itemId}`));
  lines.push(padLine(""));

  for (const issue of issues) {
    lines.push(padLine(issue));
  }

  if (commands.length > 0) {
    lines.push(padLine(""));
    lines.push(padLine("ALSO RUN:"));
    for (const cmd of commands) {
      lines.push(padLine(cmd));
    }
  }

  lines.push(`╚${border}╝`);

  return lines.join("\n");
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
 * Main checkpoint logic
 */
async function main(): Promise<void> {
  try {
    const input = readStdin();
    if (!input.trim()) {
      process.exit(0);
    }

    const hookInput: HookInput = JSON.parse(input);

    if (!isBdStatusInProgressCommand(hookInput)) {
      process.exit(0);
    }

    const toolInput = hookInput.tool_input as { command?: string } | undefined;
    const command = toolInput?.command || "";

    const itemId = extractItemId(command);
    if (!itemId) {
      process.exit(0);
    }

    const { parentId, parentStatus, itemType } = await getItemInfo(itemId);

    const issues: string[] = [];
    const commands: string[] = [];

    if (parentId) {
      if (parentStatus === "open") {
        issues.push(`⚠ Parent item ${parentId} is still 'open'`);
        issues.push("  Parent should also be set to in_progress");
        commands.push(`bd update ${parentId} --status=in_progress`);
      } else if (parentStatus === "in_progress") {
        issues.push(`✓ Parent ${parentId} is already in_progress`);
      } else if (parentStatus === "closed") {
        issues.push(`⚠ Parent ${parentId} is closed`);
        issues.push("  Working on items under closed parents is unusual");
      }
    } else {
      // No parent - that's fine for epics, might be an issue for tasks
      if (itemType === "task" || itemType === "feature") {
        issues.push("ℹ No parent item found");
        issues.push("  Standalone items are valid for independent work");
      }
    }

    // Only show output if there are warnings
    if (issues.some(i => i.startsWith("⚠"))) {
      console.log(createWarningOutput(itemId, issues, commands));
    }

    process.exit(0);
  } catch (error) {
    console.error(`[Beads Status] Error (fail-open): ${String(error).substring(0, 100)}`);
    process.exit(0);
  }
}

main();
