/**
 * Use Command
 *
 * Marks aha cards or recommendations as "used" by writing signals.
 * This helps track which learnings are actively being applied.
 *
 * @module self-learning/commands/use
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import type { Signal } from "../types/signal";
import {
  findRepoRoot,
  getProjectStore,
  ensureStoreDirs,
  getStorePath,
  FILES,
  safeUserSlug,
} from "../lib/store";
import { appendJsonl } from "../lib/jsonl";
import { sigId } from "../lib/id-generator";
import { isoNow } from "../lib/timestamp";
import { parseIdList } from "../lib/validation";
import { registerCommand, getFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface UseResult {
  ok: boolean;
  repo_root: string;
  user: string;
  project_store: string;
  written_to: string;
  signals_written: Signal[];
  invalid_ids: Array<{ id: string; expected_prefix: string }>;
  errors: Array<{ id: string; error: string }>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a signal record.
 */
function createSignal(
  kind: Signal["kind"],
  targetId: string,
  isAha: boolean,
  source: string,
  context?: string
): Signal {
  const ts = isoNow();
  return {
    id: sigId(kind, targetId, ts),
    ts,
    kind,
    ...(isAha ? { aha_id: targetId } : { rec_id: targetId }),
    source,
    context,
  };
}

// =============================================================================
// Command Implementation
// =============================================================================

async function useCommand(args: ParsedArgs): AsyncResult<void> {
  const ahaArg = getFlag(args, "aha");
  const recArg = getFlag(args, "rec");
  const source = getFlag(args, "source") ?? "agent";
  const context = getFlag(args, "context");

  // Parse ID lists
  const ahaIds = ahaArg ? parseIdList(ahaArg) : [];
  const recIds = recArg ? parseIdList(recArg) : [];

  if (ahaIds.length === 0 && recIds.length === 0) {
    return err(
      makeError(
        "INVALID_PAYLOAD",
        "Provide --aha <aha_...[,aha_...]> and/or --rec <rec_...[,rec_...]>"
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

  const signalsPath = getStorePath(storeDir, FILES.SIGNALS);

  const result: UseResult = {
    ok: true,
    repo_root: repoRoot,
    user,
    project_store: storeDir,
    written_to: signalsPath,
    signals_written: [],
    invalid_ids: [],
    errors: [],
  };

  // Process aha IDs
  for (const ahaId of ahaIds) {
    if (!ahaId.startsWith("aha_")) {
      result.invalid_ids.push({ id: ahaId, expected_prefix: "aha_" });
      continue;
    }

    try {
      const signal = createSignal("aha_used", ahaId, true, source, context);
      const appendResult = await appendJsonl(signalsPath, signal);
      if (!appendResult.success) {
        result.errors.push({ id: ahaId, error: appendResult.error.message });
        continue;
      }
      result.signals_written.push(signal);
    } catch (error) {
      result.errors.push({
        id: ahaId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Process rec IDs
  for (const recId of recIds) {
    if (!recId.startsWith("rec_")) {
      result.invalid_ids.push({ id: recId, expected_prefix: "rec_" });
      continue;
    }

    try {
      const signal = createSignal("rec_used", recId, false, source, context);
      const appendResult = await appendJsonl(signalsPath, signal);
      if (!appendResult.success) {
        result.errors.push({ id: recId, error: appendResult.error.message });
        continue;
      }
      result.signals_written.push(signal);
    } catch (error) {
      result.errors.push({
        id: recId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify(result, null, 2));
  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "use",
  description: "Mark aha cards or recommendations as used",
  usage:
    "use --aha <ids> [--rec <ids>] [--source <source>] [--context <text>]\n\n" +
    "  --aha      Comma-separated aha card IDs (e.g., aha_abc123,aha_def456)\n" +
    "  --rec      Comma-separated recommendation IDs\n" +
    "  --source   Signal source (default: agent)\n" +
    "  --context  Optional context for the signal",
  handler: useCommand,
});
