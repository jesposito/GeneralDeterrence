/**
 * Command Router
 *
 * Routes CLI commands to their implementations.
 *
 * @module self-learning/commands
 */

import type { AsyncResult } from "../types/result";
import { err, makeError } from "../types/result";

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed command-line arguments.
 */
export interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

/**
 * Command handler function signature.
 */
export type CommandHandler = (args: ParsedArgs) => AsyncResult<void>;

/**
 * Command definition.
 */
export interface Command {
  name: string;
  description: string;
  usage: string;
  handler: CommandHandler;
}

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * Parse command-line arguments.
 *
 * @param argv - Raw arguments (typically process.argv.slice(2))
 * @returns Parsed arguments
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: "",
    flags: {},
    positional: [],
  };

  let i = 0;

  // First non-flag argument is the command
  while (i < argv.length && argv[i].startsWith("-")) {
    i++;
  }

  if (i < argv.length) {
    result.command = argv[i];
    i++;
  }

  // Parse remaining arguments
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      // Long flag
      const eqIndex = arg.indexOf("=");
      if (eqIndex !== -1) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result.flags[key] = value;
      } else {
        const key = arg.slice(2);
        // Check if next arg is the value
        if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
          result.flags[key] = argv[i + 1];
          i++;
        } else {
          result.flags[key] = true;
        }
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flag
      const key = arg.slice(1);
      if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        result.flags[key] = argv[i + 1];
        i++;
      } else {
        result.flags[key] = true;
      }
    } else {
      // Positional argument
      result.positional.push(arg);
    }

    i++;
  }

  return result;
}

/**
 * Get a string flag value.
 */
export function getFlag(args: ParsedArgs, name: string, alias?: string): string | undefined {
  const value = args.flags[name] ?? (alias ? args.flags[alias] : undefined);
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

/**
 * Get a boolean flag value.
 */
export function getBoolFlag(args: ParsedArgs, name: string, alias?: string): boolean {
  const value = args.flags[name] ?? (alias ? args.flags[alias] : undefined);
  return value === true || value === "true";
}

/**
 * Get a numeric flag value.
 */
export function getNumFlag(args: ParsedArgs, name: string, alias?: string): number | undefined {
  const value = getFlag(args, name, alias);
  if (value !== undefined) {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      return num;
    }
  }
  return undefined;
}

// =============================================================================
// Command Registry
// =============================================================================

const commands = new Map<string, Command>();

/**
 * Register a command.
 */
export function registerCommand(command: Command): void {
  commands.set(command.name, command);
}

/**
 * Get a command by name.
 */
export function getCommand(name: string): Command | undefined {
  return commands.get(name);
}

/**
 * Get all registered commands.
 */
export function getAllCommands(): Command[] {
  return Array.from(commands.values());
}

// =============================================================================
// Command Execution
// =============================================================================

/**
 * Execute a command.
 *
 * @param args - Parsed arguments
 * @returns Result of command execution
 */
export async function executeCommand(args: ParsedArgs): AsyncResult<void> {
  const command = commands.get(args.command);

  if (!command) {
    return err(
      makeError(
        "NOT_FOUND",
        `Unknown command: ${args.command}. Run with --help to see available commands.`
      )
    );
  }

  return command.handler(args);
}

// =============================================================================
// Help Generation
// =============================================================================

/**
 * Generate help text for all commands.
 */
export function generateHelp(): string {
  const lines: string[] = [
    "Self-Learning Skills CLI",
    "",
    "A system for capturing, recalling, and sharing durable learnings.",
    "",
    "USAGE:",
    "  bun run scripts/self-learning.ts <command> [options]",
    "",
    "COMMANDS:",
  ];

  for (const command of getAllCommands()) {
    lines.push(`  ${command.name.padEnd(20)} ${command.description}`);
  }

  lines.push("");
  lines.push("Run '<command> --help' for command-specific help.");
  lines.push("");
  lines.push("ATTRIBUTION:");
  lines.push("  Inspired by self-learning-skills by Scott Falconer");
  lines.push("  https://github.com/scottfalconer/self-learning-skills");

  return lines.join("\n");
}

/**
 * Generate help text for a specific command.
 */
export function generateCommandHelp(command: Command): string {
  return [
    `${command.name} - ${command.description}`,
    "",
    "USAGE:",
    `  ${command.usage}`,
  ].join("\n");
}
