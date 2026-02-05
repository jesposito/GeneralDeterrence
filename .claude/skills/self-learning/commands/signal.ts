/**
 * Signal Command
 *
 * Records a signal directly to signals.jsonl.
 * Signals track usage and lifecycle events for scoring.
 *
 * @module self-learning/commands/signal
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import type { Signal, SignalKind } from "../types/signal";
import { isSignalKind, SIGNAL_KINDS } from "../types/signal";
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
import { registerCommand, getFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface SignalResult {
  ok: boolean;
  repo_root: string;
  user: string;
  project_store: string;
  written_to: string;
  signal: Signal;
}

// =============================================================================
// Command Implementation
// =============================================================================

async function signalCommand(args: ParsedArgs): AsyncResult<void> {
  const kind = getFlag(args, "kind");
  const ahaId = getFlag(args, "aha-id");
  const recId = getFlag(args, "rec-id");
  const source = getFlag(args, "source") ?? "manual";
  const context = getFlag(args, "context");

  // Validate kind
  if (!kind) {
    return err(makeError("INVALID_PAYLOAD", "Provide --kind <signal-kind>"));
  }

  if (!isSignalKind(kind)) {
    return err(
      makeError(
        "INVALID_PAYLOAD",
        `Invalid --kind "${kind}". Expected one of: ${SIGNAL_KINDS.join(", ")}`
      )
    );
  }

  // Validate target ID
  const isAhaSignal = kind.startsWith("aha_");
  const isRecSignal = kind.startsWith("rec_");

  if (isAhaSignal && !ahaId) {
    return err(makeError("INVALID_PAYLOAD", `${kind} requires --aha-id`));
  }

  if (isRecSignal && !recId) {
    return err(makeError("INVALID_PAYLOAD", `${kind} requires --rec-id`));
  }

  if (ahaId && recId) {
    return err(
      makeError("INVALID_PAYLOAD", "Provide exactly one of --aha-id or --rec-id")
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

  // Create signal
  const ts = isoNow();
  const targetId = ahaId ?? recId ?? "";
  const signal: Signal = {
    id: sigId(kind, targetId, ts),
    ts,
    kind: kind as SignalKind,
    ...(ahaId ? { aha_id: ahaId } : {}),
    ...(recId ? { rec_id: recId } : {}),
    source,
    ...(context ? { context } : {}),
  };

  // Write signal
  const signalsPath = getStorePath(storeDir, FILES.SIGNALS);
  const appendResult = await appendJsonl(signalsPath, signal);
  if (!appendResult.success) {
    return appendResult;
  }

  const result: SignalResult = {
    ok: true,
    repo_root: repoRoot,
    user,
    project_store: storeDir,
    written_to: signalsPath,
    signal,
  };

  console.log(JSON.stringify(result, null, 2));
  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "signal",
  description: "Record a signal directly",
  usage:
    "signal --kind <kind> [--aha-id <id> | --rec-id <id>] [--source <source>] [--context <text>]\n\n" +
    "  --kind     Signal kind: " + SIGNAL_KINDS.join(", ") + "\n" +
    "  --aha-id   Aha card ID (required for aha_* signals)\n" +
    "  --rec-id   Recommendation ID (required for rec_* signals)\n" +
    "  --source   Signal source (default: manual)\n" +
    "  --context  Optional context for the signal",
  handler: signalCommand,
});
