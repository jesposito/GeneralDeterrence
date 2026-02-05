/**
 * Record Command
 *
 * Records aha cards and recommendations to the store.
 * Handles reinforcement detection for duplicate learnings.
 *
 * @module self-learning/commands/record
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import type { AhaCard, AhaCardInput } from "../types/aha-card";
import type { Recommendation, RecommendationInput } from "../types/recommendation";
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
import { stableId, sigId } from "../lib/id-generator";
import { isoNow } from "../lib/timestamp";
import {
  validateRecordPayload,
  normalizeScope,
  normalizePrimarySkill,
  parseIdList,
} from "../lib/validation";
import { mergeListPreserve, contentChanged } from "../lib/merge";
import { registerCommand, getFlag, getBoolFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface RecordResult {
  ok: boolean;
  repo_root: string;
  user: string;
  project_store: string;
  written: Record<string, string>;
  aha_cards_written: number;
  aha_cards_reinforced: number;
  recommendations_written: number;
  signals_written: number;
  errors: string[];
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate an equivalence key for detecting duplicate Aha Cards.
 * Cards with the same key are considered the same learning.
 */
function ahaEquivalenceKey(card: Record<string, unknown>): string {
  const primarySkill = String(card.primary_skill ?? "").trim().toLowerCase();
  const title = String(card.title ?? "").trim().toLowerCase();
  const whenToUse = String(card.when_to_use ?? "").trim().toLowerCase();

  // Use explicit key if provided
  const explicitKey = card.key;
  if (typeof explicitKey === "string" && explicitKey.trim()) {
    return `key:${explicitKey.trim().toLowerCase()}`;
  }

  return `${primarySkill}|${title}|${whenToUse}`.replace(/^\|+|\|+$/g, "");
}

/**
 * Load payload from JSON file or stdin.
 */
async function loadPayload(
  jsonPath: string | undefined
): AsyncResult<Record<string, unknown>> {
  try {
    if (jsonPath) {
      const file = Bun.file(jsonPath);
      if (!(await file.exists())) {
        return err(makeError("IO_ERROR", `File not found: ${jsonPath}`));
      }
      const content = await file.text();
      return ok(JSON.parse(content));
    }

    // Read from stdin
    const chunks: Uint8Array[] = [];
    const reader = Bun.stdin.stream().getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    if (chunks.length === 0) {
      return err(
        makeError(
          "INVALID_PAYLOAD",
          "No input provided. Provide --json <file> or pipe JSON into stdin."
        )
      );
    }

    const content = Buffer.concat(chunks).toString("utf-8");
    if (!content.trim()) {
      return err(
        makeError(
          "INVALID_PAYLOAD",
          "Empty input. Provide --json <file> or pipe JSON into stdin."
        )
      );
    }

    return ok(JSON.parse(content));
  } catch (error) {
    return err(
      makeError(
        "INVALID_PAYLOAD",
        `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

/**
 * Normalize an aha card input to a full AhaCard.
 */
function normalizeAhaCard(
  input: AhaCardInput,
  defaultSkill: string
): AhaCard {
  const ts = isoNow();
  const primarySkill = normalizePrimarySkill(input.primary_skill ?? defaultSkill);
  const scope = normalizeScope(input.scope);

  // Handle aliases
  const problem = input.problem ?? input.summary;
  const solutionSteps = input.solution_steps ?? input.steps;

  const payload = {
    title: input.title,
    when_to_use: input.when_to_use ?? "",
    primary_skill: primarySkill,
    ts,
  };

  return {
    id: stableId("aha", payload),
    ts,
    title: input.title,
    primary_skill: primarySkill,
    scope,
    status: "proposed",
    when_to_use: input.when_to_use,
    problem,
    solution_steps: solutionSteps,
    evidence: input.evidence,
    tags: input.tags,
    shareable: input.shareable,
    input_shape: input.input_shape,
    output_shape: input.output_shape,
    gotchas: input.gotchas,
    links: input.links,
  };
}

/**
 * Normalize a recommendation input to a full Recommendation.
 */
function normalizeRecommendation(
  input: RecommendationInput,
  defaultSkill: string
): Recommendation {
  const ts = isoNow();
  const primarySkill = normalizePrimarySkill(input.primary_skill ?? defaultSkill);
  const scope = normalizeScope(input.scope);

  const payload = {
    title: input.title,
    primary_skill: primarySkill,
    ts,
  };

  return {
    id: stableId("rec", payload),
    ts,
    title: input.title,
    primary_skill: primarySkill,
    scope,
    status: "proposed",
    description: input.description,
    why: input.why,
    expected_impact: input.expected_impact,
    implementation_hint: input.implementation_hint,
    tags: input.tags,
    shareable: input.shareable,
    backport: input.backport,
    last_touched_ts: ts,
  };
}

/**
 * Create a signal record.
 */
function createSignal(
  kind: string,
  targetId: string,
  isAha: boolean,
  source: string,
  context?: string
): Signal {
  const ts = isoNow();
  return {
    id: sigId(kind, targetId, ts),
    ts,
    kind: kind as Signal["kind"],
    ...(isAha ? { aha_id: targetId } : { rec_id: targetId }),
    source,
    context,
  };
}

// =============================================================================
// Command Implementation
// =============================================================================

async function recordCommand(args: ParsedArgs): AsyncResult<void> {
  const jsonPath = getFlag(args, "json");
  const dryRun = getBoolFlag(args, "dry-run");

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

  // Load payload
  const payloadResult = await loadPayload(jsonPath);
  if (!payloadResult.success) {
    return payloadResult;
  }

  // Validate payload
  const validationResult = validateRecordPayload(payloadResult.value);
  if (!validationResult.success) {
    return validationResult;
  }

  const payload = validationResult.value;
  const ahaInputs = payload.aha_cards ?? [];
  const recInputs = payload.recommendations ?? [];
  const usedAhaIds = payload.used?.aha_ids ?? [];
  const usedRecIds = payload.used?.rec_ids ?? [];

  // Determine default primary skill
  let defaultSkill = "unknown";
  const allSkills = [
    ...ahaInputs.map((a) => a.primary_skill),
    ...recInputs.map((r) => r.primary_skill),
  ].filter((s): s is string => typeof s === "string" && s.trim() !== "");

  if (allSkills.length === 1) {
    defaultSkill = normalizePrimarySkill(allSkills[0]);
  } else if (allSkills.length > 1) {
    // Use the first one if they're all the same
    const unique = [...new Set(allSkills.map((s) => normalizePrimarySkill(s)))];
    if (unique.length === 1) {
      defaultSkill = unique[0];
    }
  }

  const result: RecordResult = {
    ok: true,
    repo_root: repoRoot,
    user,
    project_store: storeDir,
    written: {},
    aha_cards_written: 0,
    aha_cards_reinforced: 0,
    recommendations_written: 0,
    signals_written: 0,
    errors: [],
  };

  // Process Aha Cards
  if (ahaInputs.length > 0) {
    const ahaPath = getStorePath(storeDir, FILES.AHA_CARDS);
    const existingResult = await readJsonl<AhaCard>(ahaPath);

    if (!existingResult.success) {
      return existingResult;
    }

    const { latest: existingLatest } = firstAndLatestById(
      existingResult.value.records
    );

    // Build equivalence key -> ID map
    const keyToId = new Map<string, string>();
    for (const record of existingResult.value.records) {
      const key = ahaEquivalenceKey(record);
      if (key && !keyToId.has(key)) {
        keyToId.set(key, record.id);
      }
    }

    const signalsPath = getStorePath(storeDir, FILES.SIGNALS);

    for (const input of ahaInputs) {
      const card = normalizeAhaCard(input, defaultSkill);
      const key = ahaEquivalenceKey(card);
      const existingId = keyToId.get(key);

      if (existingId && existingLatest.has(existingId)) {
        // Reinforcement: merge with existing card
        const existing = existingLatest.get(existingId)!;
        const merged: AhaCard = {
          ...existing,
          ts: isoNow(),
          primary_skill: normalizePrimarySkill(
            existing.primary_skill ?? card.primary_skill
          ),
          title: existing.title || card.title,
          when_to_use: existing.when_to_use || card.when_to_use,
          problem: existing.problem || card.problem,
          scope: existing.scope || card.scope,
          shareable: existing.shareable ?? card.shareable,
          solution_steps: mergeListPreserve(
            existing.solution_steps ?? [],
            card.solution_steps ?? []
          ),
          evidence: mergeListPreserve(
            existing.evidence ?? [],
            card.evidence ?? []
          ),
          tags: mergeListPreserve(existing.tags ?? [], card.tags ?? []),
        };

        // Only write if content changed
        if (contentChanged(existing, merged)) {
          if (!dryRun) {
            const appendResult = await appendJsonl(ahaPath, merged);
            if (!appendResult.success) {
              result.errors.push(appendResult.error.message);
              continue;
            }
          }
        }

        // Write reinforcement signal
        const signal = createSignal(
          "aha_reinforced",
          existingId,
          true,
          "agent",
          `equivalent capture observed (key=${key})`
        );
        if (!dryRun) {
          await appendJsonl(signalsPath, signal);
        }

        result.aha_cards_reinforced++;
        result.signals_written++;
      } else {
        // New card
        if (!dryRun) {
          const appendResult = await appendJsonl(ahaPath, card);
          if (!appendResult.success) {
            result.errors.push(appendResult.error.message);
            continue;
          }
        }

        // Add to key map for subsequent cards in same batch
        if (key) {
          keyToId.set(key, card.id);
        }

        result.aha_cards_written++;
      }
    }

    result.written.aha_cards = ahaPath;
  }

  // Process Recommendations
  if (recInputs.length > 0) {
    const recPath = getStorePath(storeDir, FILES.RECOMMENDATIONS);

    for (const input of recInputs) {
      const rec = normalizeRecommendation(input, defaultSkill);

      if (!dryRun) {
        const appendResult = await appendJsonl(recPath, rec);
        if (!appendResult.success) {
          result.errors.push(appendResult.error.message);
          continue;
        }
      }

      result.recommendations_written++;
    }

    result.written.recommendations = recPath;
  }

  // Process used IDs
  const signalsPath = getStorePath(storeDir, FILES.SIGNALS);

  for (const ahaId of usedAhaIds) {
    if (!ahaId.startsWith("aha_")) {
      result.errors.push(`Invalid aha_id (missing prefix): ${ahaId}`);
      continue;
    }

    const signal = createSignal("aha_used", ahaId, true, "agent");
    if (!dryRun) {
      await appendJsonl(signalsPath, signal);
    }
    result.signals_written++;
  }

  for (const recId of usedRecIds) {
    if (!recId.startsWith("rec_")) {
      result.errors.push(`Invalid rec_id (missing prefix): ${recId}`);
      continue;
    }

    const signal = createSignal("rec_used", recId, false, "agent");
    if (!dryRun) {
      await appendJsonl(signalsPath, signal);
    }
    result.signals_written++;
  }

  if (result.signals_written > 0) {
    result.written.signals = signalsPath;
  }

  // Regenerate INDEX.md
  if (!dryRun) {
    const indexResult = await regenerateIndex(storeDir);
    if (!indexResult.success) {
      result.errors.push(`INDEX.md: ${indexResult.error.message}`);
    }
  }

  // Output result
  console.log(JSON.stringify(result, null, 2));

  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "record",
  description: "Record aha cards and recommendations",
  usage:
    "record [--json <file>] [--dry-run]\n\n" +
    "  Reads JSON payload from file or stdin.\n" +
    "  Payload format:\n" +
    "    {\n" +
    '      "aha_cards": [{ "title": "...", "primary_skill": "...", ... }],\n' +
    '      "recommendations": [{ "title": "...", ... }],\n' +
    '      "used": { "aha_ids": ["aha_..."], "rec_ids": ["rec_..."] }\n' +
    "    }",
  handler: recordCommand,
});
