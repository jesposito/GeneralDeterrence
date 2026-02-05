/**
 * List Command
 *
 * Lists and filters aha cards from the store.
 *
 * @module self-learning/commands/list
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import type { AhaCard } from "../types/aha-card";
import {
  findRepoRoot,
  getProjectStore,
  getStorePath,
  FILES,
  safeUserSlug,
} from "../lib/store";
import { readJsonl, firstAndLatestById } from "../lib/jsonl";
import { registerCommand, getFlag, getNumFlag, getBoolFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface ListResult {
  repo_root: string;
  user: string;
  count: number;
  items: AhaCard[];
  message?: string;
}

// =============================================================================
// Command Implementation
// =============================================================================

async function listCommand(args: ParsedArgs): AsyncResult<void> {
  const skill = getFlag(args, "skill");
  const tag = getFlag(args, "tag");
  const query = getFlag(args, "query", "q");
  const limit = getNumFlag(args, "limit", "n");
  const latestOnly = getBoolFlag(args, "latest");

  // Find repository root
  const repoRoot = await findRepoRoot();
  if (repoRoot === null) {
    return err(
      makeError(
        "STORE_NOT_FOUND",
        "Not in a git repository. Run this command from within a git repo."
      )
    );
  }

  const user = safeUserSlug();
  const storeDir = getProjectStore(repoRoot);
  const ahaPath = getStorePath(storeDir, FILES.AHA_CARDS);

  // Read aha cards
  const readResult = await readJsonl<AhaCard>(ahaPath);
  if (!readResult.success) {
    return readResult;
  }

  let cards = readResult.value.records;

  // If --latest, dedupe by ID (keep latest version)
  if (latestOnly) {
    const { latest } = firstAndLatestById(cards);
    cards = Array.from(latest.values());
  }

  // Handle empty store
  if (cards.length === 0) {
    const result: ListResult = {
      repo_root: repoRoot,
      user,
      count: 0,
      items: [],
      message: "No memories recorded yet. Proceed with the task using standard tools.",
    };
    console.log(JSON.stringify(result, null, 2));
    return ok(undefined);
  }

  // Apply filters
  const filtered = cards.filter((card) => {
    // Filter by skill
    if (skill && card.primary_skill !== skill) {
      return false;
    }

    // Filter by tag
    if (tag) {
      const tags = card.tags ?? [];
      if (!tags.includes(tag)) {
        return false;
      }
    }

    // Filter by query (search in all fields)
    if (query) {
      const q = query.toLowerCase();
      const blob = JSON.stringify(card).toLowerCase();
      if (!blob.includes(q)) {
        return false;
      }
    }

    return true;
  });

  // Apply limit (take last N items)
  const limited = limit ? filtered.slice(-limit) : filtered;

  const result: ListResult = {
    repo_root: repoRoot,
    user,
    count: limited.length,
    items: limited,
  };

  console.log(JSON.stringify(result, null, 2));
  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "list",
  description: "List and filter aha cards",
  usage:
    "list [--skill <skill>] [--tag <tag>] [--query <text>] [--limit <n>] [--latest]\n\n" +
    "  --skill   Filter by primary skill\n" +
    "  --tag     Filter by tag\n" +
    "  --query   Search in all fields\n" +
    "  --limit   Return only the last N items\n" +
    "  --latest  Dedupe by ID, keeping latest version",
  handler: listCommand,
});
