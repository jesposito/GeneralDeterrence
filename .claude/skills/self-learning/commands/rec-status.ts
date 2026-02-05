/**
 * Rec Status Command
 *
 * Updates the status of a recommendation.
 * Appends a new version with the updated status to recommendations.jsonl.
 * Also writes rec_touched signal, and rec_done signal if status is "done".
 *
 * @module self-learning/commands/rec-status
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import type { Recommendation, RecStatus } from "../types/recommendation";
import { REC_STATUSES, isRecStatus } from "../types/recommendation";
import type { Signal } from "../types/signal";
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
import { sigId } from "../lib/id-generator";
import { isoNow } from "../lib/timestamp";
import { normalizeScope } from "../lib/validation";
import { registerCommand, getFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface RecStatusResult {
  ok: boolean;
  repo_root: string;
  user: string;
  project_store: string;
  id: string;
  previous: {
    status: RecStatus;
    last_touched_ts: string;
    ts: string;
    created_ts: string;
    title: string;
    scope: "project" | "portable";
  };
  updated: {
    status: RecStatus;
    last_touched_ts: string;
    ts: string;
    note?: string;
    scope: "project" | "portable";
  };
  written_to: string;
}

// =============================================================================
// Helpers
// =============================================================================

function createSignal(
  kind: Signal["kind"],
  recId: string,
  source: string,
  context?: string
): Signal {
  const ts = isoNow();
  return {
    id: sigId(kind, recId, ts),
    ts,
    kind,
    rec_id: recId,
    source,
    ...(context ? { context } : {}),
  };
}

// =============================================================================
// Command Implementation
// =============================================================================

async function recStatusCommand(args: ParsedArgs): AsyncResult<void> {
  const id = getFlag(args, "id");
  const status = getFlag(args, "status");
  const scope = getFlag(args, "scope");
  const note = getFlag(args, "note");

  // Validate inputs
  if (!id) {
    return err(makeError("INVALID_PAYLOAD", "Provide --id rec_..."));
  }

  if (!status) {
    return err(
      makeError(
        "INVALID_PAYLOAD",
        `Provide --status. Expected one of: ${REC_STATUSES.join(", ")}`
      )
    );
  }

  if (!isRecStatus(status)) {
    return err(
      makeError(
        "INVALID_PAYLOAD",
        `Invalid --status "${status}". Expected one of: ${REC_STATUSES.join(", ")}`
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

  // Read recommendations
  const recPath = getStorePath(storeDir, FILES.RECOMMENDATIONS);
  const readResult = await readJsonl<Recommendation>(recPath);
  if (!readResult.success) {
    return readResult;
  }

  const { first, latest } = firstAndLatestById(readResult.value.records);

  // Find the recommendation
  const current = latest.get(id);
  if (!current) {
    return err(
      makeError("NOT_FOUND", `Recommendation id not found in project store: ${id}`)
    );
  }

  const created = first.get(id);
  const createdTs = created?.ts ?? current.ts;

  // Determine scope
  const newScope = scope ? normalizeScope(scope) : normalizeScope(current.scope);

  // Create updated recommendation
  const now = isoNow();
  const updated: Recommendation = {
    ...current,
    ts: now,
    status,
    last_touched_ts: now,
    scope: newScope,
    ...(note ? { note } : {}),
  };

  // Write updated recommendation
  const appendResult = await appendJsonl(recPath, updated);
  if (!appendResult.success) {
    return appendResult;
  }

  // Write signals (best-effort)
  const signalsPath = getStorePath(storeDir, FILES.SIGNALS);
  try {
    // Always write rec_touched signal
    const touchedSignal = createSignal("rec_touched", id, "agent", `status=${status}`);
    await appendJsonl(signalsPath, touchedSignal);

    // Write rec_done signal if status is "done"
    if (status === "done") {
      const doneSignal = createSignal("rec_done", id, "agent");
      await appendJsonl(signalsPath, doneSignal);
    }
  } catch {
    // Best-effort; do not fail status updates if signals cannot be written
  }

  // Regenerate INDEX.md
  await regenerateIndex(storeDir);

  const result: RecStatusResult = {
    ok: true,
    repo_root: repoRoot,
    user,
    project_store: storeDir,
    id,
    previous: {
      status: (current.status as RecStatus) ?? "proposed",
      last_touched_ts: current.last_touched_ts ?? current.ts,
      ts: current.ts,
      created_ts: createdTs,
      title: current.title,
      scope: normalizeScope(current.scope),
    },
    updated: {
      status,
      last_touched_ts: now,
      ts: now,
      scope: newScope,
      ...(note ? { note } : {}),
    },
    written_to: recPath,
  };

  console.log(JSON.stringify(result, null, 2));
  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "rec-status",
  description: "Update the status of a recommendation",
  usage:
    "rec-status --id <rec_id> --status <status> [--scope <scope>] [--note <text>]\n\n" +
    "  --id      Recommendation ID (e.g., rec_abc123)\n" +
    "  --status  New status: " + REC_STATUSES.join(", ") + "\n" +
    "  --scope   Scope: project, portable (optional, preserves existing)\n" +
    "  --note    Optional note explaining the status change",
  handler: recStatusCommand,
});
