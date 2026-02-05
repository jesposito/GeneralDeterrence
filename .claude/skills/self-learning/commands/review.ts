/**
 * Review Command
 *
 * Dashboard/summary view of the self-learning store.
 * Shows top aha cards, open recommendations, and backport candidates.
 *
 * @module self-learning/commands/review
 */

import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";
import type { AhaCard, AhaStatus } from "../types/aha-card";
import type { Recommendation, RecStatus, ExpectedImpact } from "../types/recommendation";
import type { Signal, SignalKind } from "../types/signal";
import type { BackportRecord } from "../types/backport";
import { SIGNAL_WEIGHTS, MIN_BACKPORT_SCORE } from "../types/signal";
import { REC_STATUS_ALIASES } from "../types/recommendation";
import {
  findRepoRoot,
  getProjectStore,
  ensureStoreDirs,
  getStorePath,
  FILES,
  safeUserSlug,
} from "../lib/store";
import { readJsonl, firstAndLatestById } from "../lib/jsonl";
import { parseIsoTs, daysAgo } from "../lib/timestamp";
import { normalizeScope, normalizePrimarySkill } from "../lib/validation";
import { registerCommand, getFlag, getNumFlag, getBoolFlag } from "./index";
import type { ParsedArgs } from "./index";

// =============================================================================
// Types
// =============================================================================

interface ScoreBreakdown {
  aha_id: string;
  score: number;
  base: number;
  counts: Record<string, number>;
  weighted: Record<string, number>;
  explain: string;
}

interface RecView {
  id: string;
  title: string;
  status: RecStatus;
  created_ts: string;
  last_touched_ts: string;
  scope: "project" | "portable";
  priority: number;
  expected_impact?: ExpectedImpact;
  primary_skill: string;
  tags?: string[];
  why?: string;
  implementation_hint?: string;
  days_since?: number;
}

interface AhaView {
  id: string;
  title: string;
  primary_skill: string;
  score: number;
  explain: string;
  counts: Record<string, number>;
}

interface BackportCandidate {
  id: string;
  title: string;
  primary_skill: string;
  score: number;
  explain: string;
  tags?: string[];
  artifact_suggestion: string;
  how_to_backport: string;
}

interface NextAction {
  type: "recommendation" | "backport_candidate";
  id: string;
  title: string;
  status?: string;
  scope?: string;
  why?: string;
  target_skill?: string;
  score?: number;
  suggested_next: string;
}

interface ReviewFilters {
  skill: string | null;
  scope: string | null;
  since: string | null;
  stale_days: number;
  query: string | null;
  status: string[] | null;
}

interface ReviewSummary {
  aha_cards: number;
  recommendations: number;
  open_recommendations: number;
  open_recommendations_project: number;
  open_recommendations_portable: number;
  stale_recommendations: number;
  untouched_recommendations: number;
  backport_candidates: number;
  signals: number;
  backports: number;
}

interface ReviewResult {
  ok: boolean;
  repo_root: string;
  user: string;
  project_store: string;
  filters: ReviewFilters;
  summary: ReviewSummary;
  next_actions: NextAction[];
  recommendations: {
    open: RecView[];
    stale: RecView[];
    untouched: RecView[];
    by_status: Record<string, RecView[]>;
  };
  aha: {
    top_by_score: AhaView[];
    backport_candidates: BackportCandidate[];
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalize recommendation status, handling aliases.
 */
function normalizeRecStatus(status: unknown): RecStatus {
  if (typeof status !== "string") return "proposed";
  const s = status.trim().toLowerCase();
  if (s in REC_STATUS_ALIASES) {
    return REC_STATUS_ALIASES[s as keyof typeof REC_STATUS_ALIASES];
  }
  const valid: RecStatus[] = ["proposed", "accepted", "in_progress", "done", "rejected", "deprecated"];
  return valid.includes(s as RecStatus) ? (s as RecStatus) : "proposed";
}

/**
 * Normalize aha status.
 */
function normalizeAhaStatus(status: unknown): AhaStatus {
  if (typeof status !== "string") return "proposed";
  const s = status.trim().toLowerCase();
  const valid: AhaStatus[] = ["proposed", "accepted", "rejected", "deprecated", "backported"];
  return valid.includes(s as AhaStatus) ? (s as AhaStatus) : "proposed";
}

/**
 * Get last touched timestamp for a recommendation.
 */
function getRecLastTouched(rec: Recommendation): string {
  return rec.last_touched_ts ?? rec.ts;
}

/**
 * Calculate impact score for sorting.
 */
function impactScore(impact: ExpectedImpact | undefined): number {
  if (!impact) return 0;
  const speedScore = { high: 3, medium: 2, low: 1 }[impact.speed ?? "low"] ?? 0;
  const qualityScore = { high: 3, medium: 2, low: 1 }[impact.quality ?? "low"] ?? 0;
  return speedScore * 10 + qualityScore;
}

/**
 * Calculate score breakdown for an aha card based on signals.
 */
function calculateScoreBreakdown(ahaId: string, signals: Signal[]): ScoreBreakdown {
  const counts: Record<string, number> = {};
  const ahaKinds: SignalKind[] = ["aha_used", "aha_recalled", "aha_reinforced", "aha_promoted", "aha_backported"];

  for (const kind of ahaKinds) {
    counts[kind] = 0;
  }

  for (const sig of signals) {
    if (sig.aha_id === ahaId && sig.kind in counts) {
      counts[sig.kind]++;
    }
  }

  const base = 1;
  const weighted: Record<string, number> = {};
  for (const [kind, count] of Object.entries(counts)) {
    const weight = SIGNAL_WEIGHTS[kind as SignalKind] ?? 0;
    weighted[kind] = count * weight;
  }

  const score = base + Object.values(weighted).reduce((a, b) => a + b, 0);

  const parts: string[] = [];
  for (const [kind, w] of Object.entries(weighted)) {
    if (w > 0) {
      parts.push(`${kind}×${counts[kind]} (${w})`);
    }
  }

  const explain = `Score ${score} = base ${base}${parts.length > 0 ? " + " + parts.join(" + ") : ""}`;

  return { aha_id: ahaId, score, base, counts, weighted, explain };
}

/**
 * Get top aha cards by score.
 */
function topAhaByScore(
  ahaLatest: Map<string, AhaCard>,
  signals: Signal[],
  limit: number
): AhaView[] {
  const ranked: AhaView[] = [];

  for (const [ahaId, card] of ahaLatest) {
    const bd = calculateScoreBreakdown(ahaId, signals);
    ranked.push({
      id: ahaId,
      title: card.title,
      primary_skill: card.primary_skill,
      score: bd.score,
      explain: bd.explain,
      counts: bd.counts,
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  return ranked.slice(0, limit);
}

// =============================================================================
// Command Implementation
// =============================================================================

async function reviewCommand(args: ParsedArgs): AsyncResult<void> {
  // Parse arguments
  const skill = getFlag(args, "skill");
  const scope = getFlag(args, "scope");
  const query = getFlag(args, "query");
  const since = getFlag(args, "since");
  const days = getNumFlag(args, "days");
  const staleDays = getNumFlag(args, "stale-days") ?? 7;
  const status = getFlag(args, "status");
  const format = getFlag(args, "format") ?? "summary";
  const minAhaScore = getNumFlag(args, "min-aha-score") ?? MIN_BACKPORT_SCORE;
  const backportLimit = getNumFlag(args, "backport-limit") ?? 10;
  const topAhaLimit = getNumFlag(args, "top-aha-limit") ?? 10;
  const nextActionsLimit = getNumFlag(args, "next-actions-limit") ?? 10;
  const recsLimit = getNumFlag(args, "recs-limit") ?? 10;

  // Calculate since date
  let sinceDate: Date | null = null;
  if (since) {
    sinceDate = parseIsoTs(since);
    if (!sinceDate) {
      return err(makeError("INVALID_PAYLOAD", "Invalid --since (expected ISO-8601 like 2025-12-26T00:00:00Z)"));
    }
  } else if (days !== undefined) {
    sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  const statusFilter = status ? status.split(",").map((s) => s.trim()).filter(Boolean) : null;

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

  // Load data
  const ahaResult = await readJsonl<AhaCard>(getStorePath(storeDir, FILES.AHA_CARDS));
  const recResult = await readJsonl<Recommendation>(getStorePath(storeDir, FILES.RECOMMENDATIONS));
  const sigResult = await readJsonl<Signal>(getStorePath(storeDir, FILES.SIGNALS));
  const bpResult = await readJsonl<BackportRecord>(getStorePath(storeDir, FILES.BACKPORTS));

  if (!ahaResult.success) return ahaResult;
  if (!recResult.success) return recResult;
  if (!sigResult.success) return sigResult;
  if (!bpResult.success) return bpResult;

  const signals = sigResult.value.records;
  const backports = bpResult.value.records;

  const { first: recFirst, latest: recLatest } = firstAndLatestById(recResult.value.records);
  const { latest: ahaLatest } = firstAndLatestById(ahaResult.value.records);

  // Build set of backported IDs
  const backportedIds = new Set<string>();
  for (const bp of backports) {
    if (bp.applied) {
      for (const cardId of bp.result_card_ids ?? bp.requested_card_ids ?? []) {
        if (cardId) backportedIds.add(cardId);
      }
    }
  }
  for (const [id, card] of ahaLatest) {
    if (normalizeAhaStatus(card.status) === "backported") {
      backportedIds.add(id);
    }
  }

  // Build set of rec IDs that have signals
  const recSignalIds = new Set<string>();
  for (const sig of signals) {
    if (sig.rec_id) recSignalIds.add(sig.rec_id);
  }

  // Count rec updates
  const recUpdateCounts = new Map<string, number>();
  for (const rec of recResult.value.records) {
    const count = recUpdateCounts.get(rec.id) ?? 0;
    recUpdateCounts.set(rec.id, count + 1);
  }

  // Filter matcher
  const matchesCommon = (obj: { primary_skill?: string; scope?: string; ts?: string; last_touched_ts?: string }): boolean => {
    if (skill && normalizePrimarySkill(obj.primary_skill) !== skill) return false;
    if (scope && normalizeScope(obj.scope) !== scope) return false;
    if (query) {
      const blob = JSON.stringify(obj).toLowerCase();
      if (!blob.includes(query.toLowerCase())) return false;
    }
    if (sinceDate) {
      const ts = obj.last_touched_ts ?? obj.ts;
      if (ts) {
        const d = parseIsoTs(ts);
        if (!d || d < sinceDate) return false;
      } else {
        return false;
      }
    }
    return true;
  };

  // Process recommendations
  const openStatuses: RecStatus[] = ["proposed", "accepted", "in_progress"];
  const openRecs: RecView[] = [];
  const staleRecs: RecView[] = [];
  const untouchedRecs: RecView[] = [];
  const recsByStatus: Record<string, RecView[]> = {};

  for (const [recId, rec] of recLatest) {
    if (!matchesCommon(rec)) continue;

    const st = normalizeRecStatus(rec.status);
    const lt = getRecLastTouched(rec);
    const createdTs = recFirst.get(recId)?.ts ?? "";
    const recScope = normalizeScope(rec.scope);
    const daysSince = daysAgo(lt);

    const view: RecView = {
      id: recId,
      title: rec.title,
      status: st,
      created_ts: createdTs,
      last_touched_ts: lt,
      scope: recScope,
      priority: impactScore(rec.expected_impact),
      expected_impact: rec.expected_impact,
      primary_skill: rec.primary_skill,
      tags: rec.tags,
      why: rec.why,
      implementation_hint: rec.implementation_hint,
      days_since: Math.floor(daysSince),
    };

    if (!recsByStatus[st]) recsByStatus[st] = [];
    recsByStatus[st].push(view);

    if (openStatuses.includes(st)) {
      openRecs.push(view);
      if (daysSince >= staleDays) {
        staleRecs.push(view);
      }
      const touched = (recUpdateCounts.get(recId) ?? 0) > 1 || recSignalIds.has(recId);
      if (!touched) {
        untouchedRecs.push(view);
      }
    }
  }

  // Sort recommendations
  openRecs.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (b.days_since ?? 0) - (a.days_since ?? 0);
  });
  staleRecs.sort((a, b) => {
    if ((b.days_since ?? 0) !== (a.days_since ?? 0)) return (b.days_since ?? 0) - (a.days_since ?? 0);
    return b.priority - a.priority;
  });
  untouchedRecs.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (b.days_since ?? 0) - (a.days_since ?? 0);
  });

  // Apply status filter
  if (statusFilter) {
    for (const st of Object.keys(recsByStatus)) {
      if (!statusFilter.includes(st)) {
        delete recsByStatus[st];
      }
    }
  }

  // Process aha cards for backport candidates
  const backportCandidates: BackportCandidate[] = [];

  for (const [ahaId, card] of ahaLatest) {
    if (!matchesCommon(card)) continue;
    if (backportedIds.has(ahaId)) continue;
    if (card.shareable === false) continue;

    const st = normalizeAhaStatus(card.status);
    if (st === "rejected" || st === "deprecated" || st === "backported") continue;
    if (!card.shareable) continue;

    const bd = calculateScoreBreakdown(ahaId, signals);
    const reinforced = bd.counts.aha_reinforced ?? 0;
    const used = bd.counts.aha_used ?? 0;

    if (bd.score < minAhaScore && reinforced < 1 && used < 1 && st !== "accepted") {
      continue;
    }

    // Infer artifact type from tags
    const tags = card.tags ?? [];
    const tagBlob = tags.join(" ").toLowerCase();
    let artifact = "reference-file";
    if (tagBlob.includes("template") || tagBlob.includes("query")) {
      artifact = "template";
    } else if (tagBlob.includes("schema")) {
      artifact = "reference-file";
    } else if (tagBlob.includes("script") || tagBlob.includes("tooling")) {
      artifact = "script";
    } else if (tagBlob.includes("skill") || tagBlob.includes("docs")) {
      artifact = "skill-md-snippet";
    }

    backportCandidates.push({
      id: ahaId,
      title: card.title,
      primary_skill: card.primary_skill,
      score: bd.score,
      explain: bd.explain,
      tags,
      artifact_suggestion: artifact,
      how_to_backport: `bun run scripts/self-learning.ts export-backport --skill-path <target-skill-dir> --ids ${ahaId} --make-diff`,
    });
  }

  backportCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  // Top aha by score
  const filteredAha = new Map<string, AhaCard>();
  for (const [id, card] of ahaLatest) {
    if (matchesCommon(card)) {
      filteredAha.set(id, card);
    }
  }
  const topAha = topAhaByScore(filteredAha, signals, topAhaLimit);

  // Build next actions
  const nextActions: NextAction[] = [];
  for (const r of openRecs.slice(0, nextActionsLimit)) {
    nextActions.push({
      type: "recommendation",
      id: r.id,
      title: r.title,
      status: r.status,
      scope: r.scope,
      why: r.why,
      suggested_next: "mark in_progress and implement, or reject/deprecate if no longer relevant",
    });
  }
  for (const c of backportCandidates.slice(0, nextActionsLimit)) {
    nextActions.push({
      type: "backport_candidate",
      id: c.id,
      title: c.title,
      target_skill: c.primary_skill,
      score: c.score,
      suggested_next: c.how_to_backport,
    });
  }

  // Build result
  const result: ReviewResult = {
    ok: true,
    repo_root: repoRoot,
    user,
    project_store: storeDir,
    filters: {
      skill: skill ?? null,
      scope: scope ?? null,
      since: sinceDate?.toISOString().replace(/\.\d{3}Z$/, "Z") ?? null,
      stale_days: staleDays,
      query: query ?? null,
      status: statusFilter,
    },
    summary: {
      aha_cards: ahaLatest.size,
      recommendations: recLatest.size,
      open_recommendations: openRecs.length,
      open_recommendations_project: openRecs.filter((r) => r.scope === "project").length,
      open_recommendations_portable: openRecs.filter((r) => r.scope === "portable").length,
      stale_recommendations: staleRecs.length,
      untouched_recommendations: untouchedRecs.length,
      backport_candidates: backportCandidates.length,
      signals: signals.length,
      backports: backports.length,
    },
    next_actions: nextActions.slice(0, nextActionsLimit),
    recommendations: {
      open: openRecs.slice(0, recsLimit),
      stale: staleRecs.slice(0, recsLimit),
      untouched: untouchedRecs.slice(0, recsLimit),
      by_status: recsByStatus,
    },
    aha: {
      top_by_score: topAha,
      backport_candidates: backportCandidates.slice(0, backportLimit),
    },
  };

  // Output
  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Summary format
    const s = result.summary;
    const f = result.filters;

    console.log("Self-learning review (summary)");
    console.log(`Project store: ${result.project_store}`);

    const activeFilters = Object.entries(f).filter(([, v]) => v !== null && v !== "");
    if (activeFilters.length > 0) {
      const filterObj = Object.fromEntries(activeFilters);
      console.log(`Filters: ${JSON.stringify(filterObj)}`);
    }

    console.log(
      `Counts: aha=${s.aha_cards}; recs=${s.recommendations} ` +
        `(open=${s.open_recommendations} [project=${s.open_recommendations_project}, portable=${s.open_recommendations_portable}], ` +
        `stale=${s.stale_recommendations}, untouched=${s.untouched_recommendations}); ` +
        `backport_candidates=${s.backport_candidates}`
    );

    const maxNext = Math.min(5, nextActionsLimit);
    if (result.next_actions.length > 0 && maxNext > 0) {
      console.log("Next actions:");
      for (const a of result.next_actions.slice(0, maxNext)) {
        if (a.type === "recommendation") {
          console.log(`- ${a.id} [${a.status}, ${a.scope}] ${a.title}`);
        } else {
          console.log(`- ${a.id} (backport; score=${a.score}; target=${a.target_skill}) ${a.title}`);
        }
      }
    }

    console.log("View more:");
    console.log(`- Open ${result.project_store}/INDEX.md`);
    console.log(`- Full JSON: bun run scripts/self-learning.ts review --format json`);
  }

  return ok(undefined);
}

// =============================================================================
// Registration
// =============================================================================

registerCommand({
  name: "review",
  description: "Dashboard view of learnings and recommendations",
  usage:
    "review [options]\n\n" +
    "  --skill <skill>       Filter by primary skill\n" +
    "  --scope <scope>       Filter by scope (project|portable)\n" +
    "  --query <text>        Search in all fields\n" +
    "  --days <n>            Only show items from last N days\n" +
    "  --since <ISO>         Only show items since date\n" +
    "  --stale-days <n>      Days before recommendation is stale (default: 7)\n" +
    "  --status <s1,s2>      Filter recommendations by status\n" +
    "  --format <fmt>        Output format: summary (default) or json\n" +
    "  --min-aha-score <n>   Min score for backport candidates (default: 4)\n" +
    "  --backport-limit <n>  Max backport candidates (default: 10)\n" +
    "  --top-aha-limit <n>   Max top aha cards (default: 10)\n" +
    "  --next-actions-limit  Max next actions (default: 10)\n" +
    "  --recs-limit <n>      Max recommendations per category (default: 10)",
  handler: reviewCommand,
});
