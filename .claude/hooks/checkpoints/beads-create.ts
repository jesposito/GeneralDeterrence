#!/usr/bin/env bun
/**
 * Beads Create Checkpoint
 *
 * Validates bd create commands for proper type hierarchy and reminds about
 * research tasks for features.
 *
 * Hook registration: PostToolUse with matcher for Bash (checks for bd create)
 */

import type { HookInput } from "../evaluator/types";

/**
 * Check if this is a bd create command
 */
function isBdCreateCommand(hookInput: HookInput): boolean {
  if (hookInput.tool_name !== "Bash") return false;

  const toolInput = hookInput.tool_input as { command?: string } | undefined;
  if (!toolInput?.command) return false;

  return /\bbd\s+create\b/i.test(toolInput.command);
}

/**
 * Extract type from bd create command
 */
function extractType(command: string): string | null {
  const match = command.match(/--type[=\s]+(\w+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract parent from bd create command
 */
function extractParent(command: string): string | null {
  const match = command.match(/--parent[=\s]+([\w\-\.]+)/i);
  return match ? match[1] : null;
}

/**
 * Extract title from bd create command
 */
function extractTitle(command: string): string | null {
  const match = command.match(/--title[=\s]+["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/**
 * Get parent item type by running bd show
 */
async function getParentType(parentId: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["bd", "show", parentId], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();

    // Look for type indicator in output like "[EPIC]" or "[FEATURE]" or "Type: epic"
    const typeMatch = output.match(/\[(EPIC|FEATURE|TASK|BUG)\]/i) ||
                      output.match(/Type:\s*(epic|feature|task|bug)/i);
    return typeMatch ? typeMatch[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Create warning output with visual formatting
 */
function createWarningOutput(title: string, issues: string[], suggestions: string[]): string {
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
  lines.push(padLine("BEADS CREATE CHECK".padStart(Math.floor((innerWidth + 18) / 2))));
  lines.push(`╠${border}╣`);

  if (title) {
    lines.push(padLine(`Creating: ${title.substring(0, innerWidth - 11)}`));
    lines.push(padLine(""));
  }

  for (const issue of issues) {
    lines.push(padLine(issue));
  }

  if (suggestions.length > 0) {
    lines.push(padLine(""));
    lines.push(padLine("REMINDERS:"));
    for (let i = 0; i < suggestions.length; i++) {
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

    if (!isBdCreateCommand(hookInput)) {
      process.exit(0);
    }

    const toolInput = hookInput.tool_input as { command?: string } | undefined;
    const command = toolInput?.command || "";

    const itemType = extractType(command);
    const parentId = extractParent(command);
    const title = extractTitle(command);

    const issues: string[] = [];
    const suggestions: string[] = [];

    // Validate type hierarchy
    if (itemType && parentId) {
      const parentType = await getParentType(parentId);

      if (parentType) {
        // Check hierarchy rules
        if (itemType === "task" && parentType === "epic") {
          issues.push("⚠ Creating task directly under epic");
          suggestions.push("Consider: Tasks should be under features, not epics");
          suggestions.push("Epic → Feature → Task is the correct hierarchy");
        } else if (itemType === "feature" && parentType === "feature") {
          issues.push("⚠ Creating feature under another feature");
          suggestions.push("Features should be under epics, not other features");
        } else if (itemType === "epic" && parentId) {
          issues.push("⚠ Epics should not have parents");
          suggestions.push("Epics are top-level items");
        } else {
          issues.push(`✓ Valid hierarchy: ${itemType} under ${parentType}`);
        }
      }
    }

    // Check for feature without parent
    if (itemType === "feature" && !parentId) {
      issues.push("⚠ Feature created without parent epic");
      suggestions.push("Features should be under an epic for proper organization");
    }

    // Remind about research task for features
    if (itemType === "feature") {
      suggestions.push("REQUIRED: Create a research task for this feature");
      suggestions.push('Use: bd create --title "Research: <feature title>" --type task --parent <this-feature-id>');
    }

    // Only show output if there are warnings or it's a feature (research reminder)
    if (issues.some(i => i.startsWith("⚠")) || itemType === "feature") {
      console.log(createWarningOutput(title || "", issues, suggestions));
    }

    process.exit(0);
  } catch (error) {
    console.error(`[Beads Create] Error (fail-open): ${String(error).substring(0, 100)}`);
    process.exit(0);
  }
}

main();
