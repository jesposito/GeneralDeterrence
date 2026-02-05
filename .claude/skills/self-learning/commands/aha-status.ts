/**
 * Aha Status Command
 *
 * Updates the status of an aha card.
 * Appends a new version with the updated status to aha_cards.jsonl.
 *
 * @module self-learning/commands/aha-status
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import type { AhaCard, AhaStatus } from "../types/aha-card";
import { AHA_STATUSES, isAhaStatus } from "../types/aha-card";
import {
  findRepoRoot,
  getProjectStore,
  ensureStoreDirs,
  getStorePath,
  FILES,
  safeUserSlug,
  regenerateIndex,
} from "../lib/store";
import { readJsonl, appendJsonl, firstAndLatestById } from "../lib/jsonl";
import { isoNow } from "../lib/timestamp";
import { registerCommand, getFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface AhaStatusResult {
  ok: boolean;
  repo_root: string;
  user: string;
  project_store: string;
  id: string;
  previous: {
    status: AhaStatus;
    ts: string;
    created_ts: string;
    title: string;
  };
  updated: {
    status: AhaStatus;
    ts: string;
    note?: string;
  };
  written_to: string;
}

// =============================================================================
// Command Implementation
// =============================================================================

async function ahaStatusCommand(args: ParsedArgs): AsyncResult<void> {
  const id = getFlag(args, "id");
  const status = getFlag(args, "status");
  const note = getFlag(args, "note");

  // Validate inputs
  if (!id) {
    return err(makeError("INVALID_PAYLOAD", "Provide --id aha_..."));
  }

  if (!status) {
    return err(
      makeError(
        "INVALID_PAYLOAD",
        `Provide --status. Expected one of: ${AHA_STATUSES.join(", ")}`
      )
    );
  }

  if (!isAhaStatus(status)) {
    return err(
      makeError(
        "INVALID_PAYLOAD",
        `Invalid --status "${status}". Expected one of: ${AHA_STATUSES.join(", ")}`
      )
    );
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
  const storeDir = getProjectStore(repoRoot);

  // Ensure store exists
  const dirResult = await ensureStoreDirs(storeDir);
  if (!dirResult.success) {
    return dirResult;
  }

  // Read aha cards
  const ahaPath = getStorePath(storeDir, FILES.AHA_CARDS);
  const readResult = await readJsonl<AhaCard>(ahaPath);
  if (!readResult.success) {
    return readResult;
  }

  const { first, latest } = firstAndLatestById(readResult.value.records);

  // Find the card
  const current = latest.get(id);
  if (!current) {
    return err(
      makeError("NOT_FOUND", `Aha Card id not found in project store: ${id}`)
    );
  }

  const created = first.get(id);
  const createdTs = created?.ts ?? current.ts;

  // Create updated card
  const now = isoNow();
  const updated: AhaCard = {
    ...current,
    ts: now,
    status,
    last_touched_ts: now,
    ...(note ? { note } : {}),
  };

  // Write updated card
  const appendResult = await appendJsonl(ahaPath, updated);
  if (!appendResult.success) {
    return appendResult;
  }

  // Regenerate INDEX.md
  await regenerateIndex(storeDir);

  const result: AhaStatusResult = {
    ok: true,
    repo_root: repoRoot,
    user,
    project_store: storeDir,
    id,
    previous: {
      status: (current.status as AhaStatus) ?? "proposed",
      ts: current.ts,
      created_ts: createdTs,
      title: current.title,
    },
    updated: {
      status,
      ts: now,
      ...(note ? { note } : {}),
    },
    written_to: ahaPath,
  };

  console.log(JSON.stringify(result, null, 2));
  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "aha-status",
  description: "Update the status of an aha card",
  usage:
    "aha-status --id <aha_id> --status <status> [--note <text>]\n\n" +
    "  --id      Aha card ID (e.g., aha_abc123)\n" +
    "  --status  New status: " + AHA_STATUSES.join(", ") + "\n" +
    "  --note    Optional note explaining the status change",
  handler: ahaStatusCommand,
});
