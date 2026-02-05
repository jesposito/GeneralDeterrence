/**
 * Promote Command
 *
 * Moves an Aha Card from project-local scope to global scope.
 * Records an aha_promoted signal for scoring.
 *
 * @module self-learning/commands/promote
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import type { AhaCard } from "../types/aha-card";
import type { Signal } from "../types/signal";
import {
  findRepoRoot,
  getProjectStore,
  getGlobalStore,
  ensureStoreDirs,
  getStorePath,
  FILES,
  safeUserSlug,
} from "../lib/store";
import { readJsonl, appendJsonl, firstAndLatestById } from "../lib/jsonl";
import { sigId } from "../lib/id-generator";
import { isoNow } from "../lib/timestamp";
import { registerCommand, getFlag, getBoolFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface PromoteResult {
  ok: boolean;
  repo_root: string;
  user: string;
  project_store: string;
  global_store: string;
  promoted_card: AhaCard;
  signal: Signal;
  already_global: boolean;
}

// =============================================================================
// Command Implementation
// =============================================================================

async function promoteCommand(args: ParsedArgs): AsyncResult<void> {
  const ahaId = getFlag(args, "id") ?? args.positional[0];
  const dryRun = getBoolFlag(args, "dry-run");
  const context = getFlag(args, "context");

  if (!ahaId) {
    return err(makeError("INVALID_PAYLOAD", "Provide --id <aha-card-id> or positional argument"));
  }

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
  const projectStore = getProjectStore(repoRoot);
  const globalStore = getGlobalStore();

  // Ensure stores exist
  const projectDirResult = await ensureStoreDirs(projectStore);
  if (!projectDirResult.success) {
    return projectDirResult;
  }

  const globalDirResult = await ensureStoreDirs(globalStore);
  if (!globalDirResult.success) {
    return globalDirResult;
  }

  // Load project aha cards
  const projectAhaResult = await readJsonl<AhaCard>(getStorePath(projectStore, FILES.AHA_CARDS));
  if (!projectAhaResult.success) {
    return projectAhaResult;
  }

  const { latest: projectLatest } = firstAndLatestById(projectAhaResult.value.records);

  // Find the card to promote
  const card = projectLatest.get(ahaId);
  if (!card) {
    return err(
      makeError(
        "NOT_FOUND",
        `Aha card "${ahaId}" not found in project store. Available: ${Array.from(projectLatest.keys()).slice(0, 5).join(", ")}${projectLatest.size > 5 ? "..." : ""}`
      )
    );
  }

  // Check if already global
  const globalAhaResult = await readJsonl<AhaCard>(getStorePath(globalStore, FILES.AHA_CARDS));
  if (!globalAhaResult.success) {
    return globalAhaResult;
  }

  const { latest: globalLatest } = firstAndLatestById(globalAhaResult.value.records);
  const alreadyGlobal = globalLatest.has(ahaId);

  // Prepare the promoted card
  const ts = isoNow();
  const promotedCard: AhaCard = {
    ...card,
    scope: "portable", // Promoted cards become portable
    ts, // Update timestamp
    last_touched_ts: ts,
    note: context ?? `Promoted from project ${repoRoot}`,
  };

  // Create the signal
  const signal: Signal = {
    id: sigId("aha_promoted", ahaId, ts),
    ts,
    kind: "aha_promoted",
    aha_id: ahaId,
    source: "promote-command",
    context: context ?? `Promoted to global store`,
  };

  if (dryRun) {
    console.log("Dry run - would perform the following:");
    console.log(`- Copy card ${ahaId} to global store: ${globalStore}`);
    console.log(`- Record aha_promoted signal in project store`);
    console.log(`- Card title: ${card.title}`);
    console.log(`- Already in global: ${alreadyGlobal}`);
    return ok(undefined);
  }

  // Write to global store
  const globalAhaPath = getStorePath(globalStore, FILES.AHA_CARDS);
  const globalAppendResult = await appendJsonl(globalAhaPath, promotedCard);
  if (!globalAppendResult.success) {
    return globalAppendResult;
  }

  // Record signal in project store
  const signalsPath = getStorePath(projectStore, FILES.SIGNALS);
  const signalResult = await appendJsonl(signalsPath, signal);
  if (!signalResult.success) {
    return signalResult;
  }

  const result: PromoteResult = {
    ok: true,
    repo_root: repoRoot,
    user,
    project_store: projectStore,
    global_store: globalStore,
    promoted_card: promotedCard,
    signal,
    already_global: alreadyGlobal,
  };

  console.log(JSON.stringify(result, null, 2));
  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "promote",
  description: "Promote an Aha Card to global scope",
  usage:
    "promote <aha-id> [options]\n" +
    "promote --id <aha-id> [options]\n\n" +
    "  --id         Aha card ID to promote\n" +
    "  --dry-run    Show what would happen without making changes\n" +
    "  --context    Optional context for the promotion",
  handler: promoteCommand,
});
