/**
 * Repair Command
 *
 * Best-effort store repair:
 * - Fill missing/empty primary_skill on Aha Cards and Recommendations
 * - Normalize common recommendation status aliases
 *
 * @module self-learning/commands/repair
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import type { AhaCard } from "../types/aha-card";
import type { Recommendation, RecStatus } from "../types/recommendation";
import { REC_STATUSES, REC_STATUS_ALIASES } from "../types/recommendation";
import type { Event } from "../types/event";
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
import { isoNow, parseIsoTs } from "../lib/timestamp";
import { normalizePrimarySkill } from "../lib/validation";
import { registerCommand, getBoolFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface PlannedUpdate {
  id: string;
  primary_skill?: string;
  status?: string;
}

interface RepairResult {
  ok: boolean;
  repo_root: string;
  user: string;
  project_store: string;
  applied: boolean;
  planned: {
    aha_updates: PlannedUpdate[];
    rec_updates: PlannedUpdate[];
  };
  counts: {
    aha_updates: number;
    rec_updates: number;
  };
  note: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Infer primary skill from tags (look for "skill:<name>" tag).
 */
function inferPrimarySkillFromText(
  obj: Record<string, unknown>
): string | null {
  const tags = obj.tags;
  if (!Array.isArray(tags)) return null;

  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    if (!tag.startsWith("skill:")) continue;
    const inferred = tag.split(":", 2)[1]?.trim();
    if (inferred) return inferred;
  }

  return null;
}

/**
 * Infer primary skill from events based on timestamp.
 * Finds the nearest event before or after the given timestamp.
 */
function inferPrimarySkillFromEvents(
  events: Event[],
  ts: string | undefined
): string | null {
  if (!ts) return null;

  const targetDate = parseIsoTs(ts);
  if (!targetDate) return null;

  let bestBefore: { date: Date; skill: string } | null = null;
  let bestAfter: { date: Date; skill: string } | null = null;

  for (const event of events) {
    const eventDate = parseIsoTs(event.ts);
    if (!eventDate) continue;

    const ps = normalizePrimarySkill(event.primary_skill);
    if (ps === "unknown") continue;

    if (eventDate <= targetDate) {
      if (!bestBefore || eventDate > bestBefore.date) {
        bestBefore = { date: eventDate, skill: ps };
      }
    } else {
      if (!bestAfter || eventDate < bestAfter.date) {
        bestAfter = { date: eventDate, skill: ps };
      }
    }
  }

  // Prefer event before the item's timestamp
  if (bestBefore) return bestBefore.skill;
  if (bestAfter) return bestAfter.skill;
  return null;
}

/**
 * Normalize a recommendation status, mapping aliases to canonical values.
 */
function normalizeRecStatusForRepair(status: unknown): RecStatus {
  if (typeof status !== "string") return "proposed";

  const s = status.trim().toLowerCase();

  // Check aliases
  if (s in REC_STATUS_ALIASES) {
    return REC_STATUS_ALIASES[s as keyof typeof REC_STATUS_ALIASES];
  }

  // Check direct match
  if (REC_STATUSES.includes(s as RecStatus)) {
    return s as RecStatus;
  }

  return "proposed";
}

// =============================================================================
// Command Implementation
// =============================================================================

async function repairCommand(args: ParsedArgs): AsyncResult<void> {
  const apply = getBoolFlag(args, "apply");

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

  // Read data
  const ahaPath = getStorePath(storeDir, FILES.AHA_CARDS);
  const recPath = getStorePath(storeDir, FILES.RECOMMENDATIONS);
  const evtPath = getStorePath(storeDir, FILES.EVENTS);

  const ahaResult = await readJsonl<AhaCard>(ahaPath);
  const recResult = await readJsonl<Recommendation>(recPath);
  const evtResult = await readJsonl<Event>(evtPath);

  if (!ahaResult.success) return ahaResult;
  if (!recResult.success) return recResult;
  if (!evtResult.success) return evtResult;

  const events = evtResult.value.records;
  const { latest: ahaLatest } = firstAndLatestById(ahaResult.value.records);
  const { latest: recLatest } = firstAndLatestById(recResult.value.records);

  const planned: {
    aha_updates: PlannedUpdate[];
    rec_updates: PlannedUpdate[];
  } = {
    aha_updates: [],
    rec_updates: [],
  };

  // Process aha cards
  for (const [cardId, card] of ahaLatest) {
    const psRaw = card.primary_skill;
    if (typeof psRaw === "string" && psRaw.trim()) {
      continue; // Already has primary_skill
    }

    // Infer primary skill
    const inferred =
      inferPrimarySkillFromEvents(events, card.ts) ??
      inferPrimarySkillFromText(card as unknown as Record<string, unknown>) ??
      "unknown";

    const normalizedSkill = normalizePrimarySkill(inferred);

    planned.aha_updates.push({
      id: cardId,
      primary_skill: normalizedSkill,
    });

    if (apply) {
      const updated: AhaCard = {
        ...card,
        ts: isoNow(),
        primary_skill: normalizedSkill,
      };
      await appendJsonl(ahaPath, updated);
    }
  }

  // Process recommendations
  for (const [recId, rec] of recLatest) {
    const updates: Partial<PlannedUpdate> = {};

    // Check for missing primary_skill
    const psRaw = rec.primary_skill;
    if (!(typeof psRaw === "string" && psRaw.trim())) {
      const inferred =
        inferPrimarySkillFromEvents(events, rec.ts) ??
        inferPrimarySkillFromText(rec as unknown as Record<string, unknown>) ??
        "unknown";
      updates.primary_skill = normalizePrimarySkill(inferred);
    }

    // Check for status alias normalization
    const origStatus = String(rec.status ?? "").trim();
    const canonical = normalizeRecStatusForRepair(rec.status);

    // Only update if original was an alias (not already canonical)
    if (
      origStatus &&
      !REC_STATUSES.includes(origStatus as RecStatus) &&
      canonical !== "proposed"
    ) {
      updates.status = canonical;
    }

    if (Object.keys(updates).length === 0) {
      continue;
    }

    planned.rec_updates.push({
      id: recId,
      ...updates,
    });

    if (apply) {
      const updated: Recommendation = {
        ...rec,
        ts: isoNow(),
        // Preserve last_touched_ts so repairs don't make items look recently touched
        last_touched_ts: rec.last_touched_ts ?? rec.ts,
        ...(updates.primary_skill ? { primary_skill: updates.primary_skill } : {}),
        ...(updates.status ? { status: updates.status as RecStatus } : {}),
      };
      await appendJsonl(recPath, updated);
    }
  }

  // Regenerate INDEX.md if changes were applied
  if (apply) {
    await regenerateIndex(storeDir);
  }

  const result: RepairResult = {
    ok: true,
    repo_root: repoRoot,
    user,
    project_store: storeDir,
    applied: apply,
    planned,
    counts: {
      aha_updates: planned.aha_updates.length,
      rec_updates: planned.rec_updates.length,
    },
    note: apply
      ? "Repairs applied and INDEX.md regenerated."
      : "Run again with --apply to write changes.",
  };

  console.log(JSON.stringify(result, null, 2));
  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "repair",
  description: "Fix store issues (dry-run by default)",
  usage:
    "repair [--apply]\n\n" +
    "  Repairs:\n" +
    "  - Fill missing/empty primary_skill on aha cards and recommendations\n" +
    "  - Normalize recommendation status aliases (e.g., implemented -> done)\n\n" +
    "  --apply   Actually write the changes (default: dry-run)",
  handler: repairCommand,
});
