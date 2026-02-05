/**
 * Backport Inspect Command
 *
 * Examines a target skill directory for existing backport markers.
 * Shows what Aha Cards have already been backported to the skill.
 *
 * @module self-learning/commands/backport-inspect
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import {
  AHA_CARD_START_MARKER,
  AHA_FILE_HEADER_MARKER,
} from "../types/backport";
import { registerCommand, getFlag, getBoolFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface BackportedCard {
  id: string;
  title: string | null;
}

interface BackportMarker {
  skill: string | null;
  backport_id: string | null;
}

interface InspectResult {
  ok: boolean;
  skill_path: string;
  skill_name: string;
  reference_file_exists: boolean;
  reference_file_path: string;
  marker: BackportMarker | null;
  backported_cards: BackportedCard[];
  total_cards: number;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Read file content or return null if doesn't exist.
 */
async function readFileOrNull(path: string): Promise<string | null> {
  try {
    const file = Bun.file(path);
    if (await file.exists()) {
      return await file.text();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract backported card IDs and titles from reference file content.
 */
function extractBackportedCards(content: string): BackportedCard[] {
  const cards: BackportedCard[] = [];

  // Build escaped marker for regex
  const escapedMarker = AHA_CARD_START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match pattern: <!-- self-learning:aha:start id="aha_xxx" -->
  // followed by ### Title
  const cardPattern = new RegExp(
    escapedMarker + '\\s+id="([^"]+)"[^>]*-->\\s*\\n###\\s*([^\\n]+)',
    'g'
  );

  let match;
  while ((match = cardPattern.exec(content)) !== null) {
    cards.push({
      id: match[1],
      title: match[2].trim(),
    });
  }

  // Also try simpler pattern if above didn't match (just ID)
  if (cards.length === 0) {
    const simplePattern = new RegExp(
      escapedMarker + '\\s+id="([^"]+)"',
      'g'
    );

    while ((match = simplePattern.exec(content)) !== null) {
      cards.push({
        id: match[1],
        title: null,
      });
    }
  }

  return cards;
}

/**
 * Extract file header marker info.
 */
function extractHeaderMarker(content: string): BackportMarker | null {
  // Build escaped marker for regex
  const escapedMarker = AHA_FILE_HEADER_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match: <!-- self-learning:aha-file skill="xxx" backport="yyy" -->
  const pattern = new RegExp(
    escapedMarker + '\\s+skill="([^"]*)"\\s+backport="([^"]*)"'
  );

  const match = pattern.exec(content);
  if (match) {
    return {
      skill: match[1] || null,
      backport_id: match[2] || null,
    };
  }

  return null;
}

// =============================================================================
// Command Implementation
// =============================================================================

async function backportInspectCommand(args: ParsedArgs): AsyncResult<void> {
  const skillPath = getFlag(args, "skill-path") ?? args.positional[0];
  const jsonOutput = getBoolFlag(args, "json");

  if (!skillPath) {
    return err(makeError("INVALID_PAYLOAD", "Provide --skill-path <path> or positional argument"));
  }

  // Resolve skill name from path
  const skillName = skillPath.split("/").pop() ?? "unknown";

  // Check for reference file
  const refFileName = "self-learning-aha.md";
  const refFilePath = `${skillPath}/references/${refFileName}`;
  const content = await readFileOrNull(refFilePath);

  const refExists = content !== null;
  const marker = content ? extractHeaderMarker(content) : null;
  const cards = content ? extractBackportedCards(content) : [];

  const result: InspectResult = {
    ok: true,
    skill_path: skillPath,
    skill_name: skillName,
    reference_file_exists: refExists,
    reference_file_path: refFilePath,
    marker,
    backported_cards: cards,
    total_cards: cards.length,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Human-readable output
    console.log(`Skill: ${skillName}`);
    console.log(`Path: ${skillPath}`);
    console.log(`Reference file: ${refExists ? "exists" : "not found"}`);

    if (refExists) {
      console.log(`Reference path: ${refFilePath}`);

      if (marker) {
        console.log(`Last backport ID: ${marker.backport_id ?? "unknown"}`);
      }

      console.log(`Backported cards: ${cards.length}`);

      if (cards.length > 0) {
        console.log("");
        console.log("Cards:");
        for (const card of cards) {
          if (card.title) {
            console.log(`  - ${card.id}: ${card.title}`);
          } else {
            console.log(`  - ${card.id}`);
          }
        }
      }
    } else {
      console.log("No backports found for this skill.");
      console.log("");
      console.log("To backport cards to this skill, run:");
      console.log(`  bun run scripts/self-learning.ts export-backport --skill-path ${skillPath} --make-diff`);
    }
  }

  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "backport-inspect",
  description: "Inspect a skill for existing backport markers",
  usage:
    "backport-inspect <skill-path>\n" +
    "backport-inspect --skill-path <path> [options]\n\n" +
    "  --skill-path <path>  Path to target skill directory\n" +
    "  --json               Output as JSON\n\n" +
    "Examples:\n" +
    "  # Check what's backported to beads skill\n" +
    "  backport-inspect .claude/skills/beads\n\n" +
    "  # JSON output for scripting\n" +
    "  backport-inspect --skill-path .claude/skills/beads --json",
  handler: backportInspectCommand,
});
