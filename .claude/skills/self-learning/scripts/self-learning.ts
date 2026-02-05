#!/usr/bin/env bun

/**
 * Self-Learning Skills CLI
 *
 * A system for capturing, recalling, and sharing durable learnings.
 *
 * Inspired by the Python self-learning-skills implementation by Scott Falconer.
 * Original: https://github.com/scottfalconer/self-learning-skills
 *
 * @module self-learning/scripts/self-learning
 */

import {
  parseArgs,
  executeCommand,
  generateHelp,
  getBoolFlag,
} from "../commands/index";

// Import commands to register them
import "../commands/init";
import "../commands/record";
import "../commands/list";
import "../commands/use";
import "../commands/review";
import "../commands/signal";
import "../commands/aha-status";
import "../commands/rec-status";
import "../commands/repair";
import "../commands/promote";
import "../commands/export-backport";
import "../commands/backport-inspect";

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Handle global --help flag
  if (getBoolFlag(args, "help", "h") && !args.command) {
    console.log(generateHelp());
    process.exit(0);
  }

  // Handle --version flag
  if (getBoolFlag(args, "version", "v") && !args.command) {
    console.log("self-learning v0.1.0");
    process.exit(0);
  }

  // Require a command
  if (!args.command) {
    console.log(generateHelp());
    process.exit(1);
  }

  // Execute the command
  const result = await executeCommand(args);

  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    if (result.error.details) {
      console.error("Details:", JSON.stringify(result.error.details, null, 2));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
