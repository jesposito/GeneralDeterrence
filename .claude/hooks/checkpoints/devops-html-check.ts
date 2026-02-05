#!/usr/bin/env bun
/**
 * Azure DevOps HTML Check Checkpoint
 *
 * Validates that Azure DevOps --discussion content uses HTML, not Markdown.
 * This is a blocking checkpoint - Markdown will be rejected with HTML suggestions.
 *
 * Hook registration: PreToolUse with matcher for Bash (checks for az boards --discussion)
 */

import type { HookInput, BlockingHookOutput } from "../evaluator/types";

/**
 * Check if this is an az boards command with --discussion
 */
function isAzBoardsDiscussionCommand(hookInput: HookInput): boolean {
  if (hookInput.tool_name !== "Bash") return false;

  const toolInput = hookInput.tool_input as { command?: string } | undefined;
  if (!toolInput?.command) return false;

  return /\baz\s+boards\b.*--discussion/i.test(toolInput.command);
}

/**
 * Extract --discussion content from command
 */
function extractDiscussionContent(command: string): string | null {
  // Match --discussion "content" or --discussion 'content'
  // Handle multi-line content and escaped quotes
  const doubleQuoteMatch = command.match(/--discussion\s+"([^"]*(?:\\.[^"]*)*)"/s);
  const singleQuoteMatch = command.match(/--discussion\s+'([^']*(?:\\.[^']*)*)'/s);

  // Also handle heredoc style: --discussion "$(cat <<'EOF' ... EOF)"
  const heredocMatch = command.match(/--discussion\s+"\$\(cat\s+<<['"]?EOF['"]?\s*([\s\S]*?)\s*EOF\s*\)"/);

  if (heredocMatch) return heredocMatch[1];
  if (doubleQuoteMatch) return doubleQuoteMatch[1];
  if (singleQuoteMatch) return singleQuoteMatch[1];

  return null;
}

/**
 * Markdown patterns to detect
 */
const MARKDOWN_PATTERNS: Array<{ pattern: RegExp; name: string; htmlEquivalent: string }> = [
  { pattern: /^#{1,6}\s+/m, name: "Markdown headers (##)", htmlEquivalent: "<h3>Title</h3>" },
  { pattern: /\*\*[^*]+\*\*/, name: "Bold (**text**)", htmlEquivalent: "<strong>text</strong>" },
  { pattern: /\*[^*]+\*(?!\*)/, name: "Italic (*text*)", htmlEquivalent: "<em>text</em>" },
  { pattern: /^[-*+]\s+/m, name: "Unordered list (- item)", htmlEquivalent: "<ul><li>item</li></ul>" },
  { pattern: /^\d+\.\s+/m, name: "Ordered list (1. item)", htmlEquivalent: "<ol><li>item</li></ol>" },
  { pattern: /\[([^\]]+)\]\([^)]+\)/, name: "Links [text](url)", htmlEquivalent: '<a href="url">text</a>' },
  { pattern: /`[^`]+`/, name: "Inline code (`code`)", htmlEquivalent: "<code>code</code>" },
  { pattern: /```[\s\S]*?```/, name: "Code blocks (```)", htmlEquivalent: "<pre><code>code</code></pre>" },
  { pattern: /^>\s+/m, name: "Blockquote (>)", htmlEquivalent: "<blockquote>text</blockquote>" },
];

/**
 * Detect Markdown patterns in content
 */
function detectMarkdownPatterns(content: string): Array<{ name: string; htmlEquivalent: string }> {
  const found: Array<{ name: string; htmlEquivalent: string }> = [];

  for (const { pattern, name, htmlEquivalent } of MARKDOWN_PATTERNS) {
    if (pattern.test(content)) {
      found.push({ name, htmlEquivalent });
    }
  }

  return found;
}

/**
 * Create blocking output with HTML conversion hints
 */
function createBlockingMessage(markdownFound: Array<{ name: string; htmlEquivalent: string }>): BlockingHookOutput {
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
  lines.push(padLine("AZURE DEVOPS HTML CHECK - BLOCKED".padStart(Math.floor((innerWidth + 33) / 2))));
  lines.push(`╠${border}╣`);
  lines.push(padLine("Azure DevOps comments must use HTML, not Markdown."));
  lines.push(padLine("Markdown renders as plain text in DevOps."));
  lines.push(padLine(""));
  lines.push(padLine("MARKDOWN DETECTED:"));

  for (const { name } of markdownFound) {
    lines.push(padLine(`  ✗ ${name}`));
  }

  lines.push(padLine(""));
  lines.push(padLine("USE HTML INSTEAD:"));

  for (const { name, htmlEquivalent } of markdownFound) {
    const hint = `${name.split(" ")[0]} → ${htmlEquivalent}`;
    if (hint.length > innerWidth - 2) {
      lines.push(padLine(`  ${name.split(" ")[0]}:`));
      lines.push(padLine(`    ${htmlEquivalent}`));
    } else {
      lines.push(padLine(`  ${hint}`));
    }
  }

  lines.push(padLine(""));
  lines.push(padLine("Common HTML tags: <h3>, <p>, <ul>, <li>, <strong>, <code>"));
  lines.push(`╚${border}╝`);

  const message = lines.join("\n");

  return {
    hookSpecificOutput: {
      decision: { behavior: "block" },
      message,
    },
  };
}

/**
 * Create allowing output
 */
function createAllowingOutput(message: string = "HTML format verified"): BlockingHookOutput {
  return {
    hookSpecificOutput: {
      decision: { behavior: "allow" },
      message: `[DevOps HTML] ✓ ${message}`,
    },
  };
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
      console.log(JSON.stringify(createAllowingOutput("No input provided")));
      process.exit(0);
    }

    const hookInput: HookInput = JSON.parse(input);

    if (!isAzBoardsDiscussionCommand(hookInput)) {
      // Not a DevOps discussion command - allow
      process.exit(0);
    }

    const toolInput = hookInput.tool_input as { command?: string } | undefined;
    const command = toolInput?.command || "";

    const discussionContent = extractDiscussionContent(command);

    if (!discussionContent) {
      // Couldn't extract content - allow (fail open)
      console.log(JSON.stringify(createAllowingOutput("Could not parse discussion content")));
      process.exit(0);
    }

    const markdownFound = detectMarkdownPatterns(discussionContent);

    if (markdownFound.length > 0) {
      // Markdown detected - block
      console.log(JSON.stringify(createBlockingMessage(markdownFound)));
    } else {
      // No Markdown found - allow
      console.log(JSON.stringify(createAllowingOutput()));
    }

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
