/**
 * Store Management
 *
 * Handles paths, directory creation, and gitignore management
 * for self-learning storage.
 *
 * @module self-learning/lib/store
 */

import { mkdir } from "fs/promises";
import { homedir } from "os";
import { ok, err, makeError } from "../types/result";
import type { AsyncResult } from "../types/result";

// =============================================================================
// Constants
// =============================================================================

/** Version of the storage format */
export const STORE_VERSION = "v1";

/** Base path for agent skills storage */
export const AGENT_SKILLS_DIR = ".agent-skills";

/** Self-learning subdirectory */
export const SELF_LEARNING_DIR = "self-learning";

/** Users subdirectory */
export const USERS_DIR = "users";

/** JSONL file names */
export const FILES = {
  AHA_CARDS: "aha_cards.jsonl",
  RECOMMENDATIONS: "recommendations.jsonl",
  SIGNALS: "signals.jsonl",
  EVENTS: "events.jsonl",
  BACKPORTS: "backports.jsonl",
  INDEX: "INDEX.md",
} as const;

// =============================================================================
// Path Functions
// =============================================================================

/**
 * Get safe username slug for directory naming.
 *
 * @returns Lowercase username with special chars replaced
 */
export function safeUserSlug(): string {
  const username =
    process.env.USER ||
    process.env.USERNAME ||
    process.env.LOGNAME ||
    "default";
  return username.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

/**
 * Find repository root by traversing up to find .git directory.
 *
 * @param startDir - Starting directory (defaults to cwd)
 * @returns Repository root path, or null if not in a git repo
 */
export async function findRepoRoot(startDir?: string): Promise<string | null> {
  let current = (startDir ?? process.cwd()).replace(/\\/g, "/");

  while (current !== "/" && current !== "") {
    const gitPath = `${current}/.git`;
    const file = Bun.file(gitPath);

    // .git can be a file (worktree) or directory
    if (await file.exists()) {
      return current;
    }

    // Check if it's a directory
    try {
      const dirFile = Bun.file(`${gitPath}/HEAD`);
      if (await dirFile.exists()) {
        return current;
      }
    } catch {
      // Not a directory, continue
    }

    // Move up one directory
    const parent = current.replace(/\/[^/]+$/, "");
    if (parent === current) break;
    current = parent;
  }

  return null;
}

/**
 * Get the project-local store directory path.
 *
 * @param repoRoot - Repository root path
 * @param user - Username slug (defaults to current user)
 * @returns Store directory path
 */
export function getProjectStore(repoRoot: string, user?: string): string {
  const userSlug = user ?? safeUserSlug();
  return `${repoRoot}/${AGENT_SKILLS_DIR}/${SELF_LEARNING_DIR}/${STORE_VERSION}/${USERS_DIR}/${userSlug}`;
}

/**
 * Get the global store directory path.
 *
 * @param user - Username slug (defaults to current user)
 * @returns Store directory path in home directory
 */
export function getGlobalStore(user?: string): string {
  const home = homedir().replace(/\\/g, "/");
  const userSlug = user ?? safeUserSlug();
  return `${home}/${AGENT_SKILLS_DIR}/${SELF_LEARNING_DIR}/${STORE_VERSION}/${USERS_DIR}/${userSlug}`;
}

/**
 * Get path to a specific file in a store.
 *
 * @param storeDir - Store directory path
 * @param file - File name from FILES constant
 * @returns Full file path
 */
export function getStorePath(
  storeDir: string,
  file: (typeof FILES)[keyof typeof FILES]
): string {
  return `${storeDir}/${file}`;
}

// =============================================================================
// Directory Management
// =============================================================================

/**
 * Ensure store directories exist.
 *
 * @param storeDir - Store directory path
 * @returns Result indicating success or failure
 */
export async function ensureStoreDirs(storeDir: string): AsyncResult<void> {
  try {
    await mkdir(storeDir, { recursive: true });

    // Create exports/backports subdirectory
    await mkdir(`${storeDir}/exports/backports`, { recursive: true });

    return ok(undefined);
  } catch (error) {
    return err(
      makeError(
        "IO_ERROR",
        `Failed to create store directories: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

/**
 * Check if a store is initialized.
 *
 * @param storeDir - Store directory path
 * @returns true if store exists
 */
export async function isStoreInitialized(storeDir: string): Promise<boolean> {
  try {
    // Check if any JSONL file exists
    const ahaPath = getStorePath(storeDir, FILES.AHA_CARDS);
    const file = Bun.file(ahaPath);
    return await file.exists();
  } catch {
    return false;
  }
}

// =============================================================================
// Gitignore Management
// =============================================================================

/**
 * Update .gitignore to exclude agent-skills directory.
 *
 * @param repoRoot - Repository root path
 * @returns Result indicating success or failure
 */
export async function updateGitignore(repoRoot: string): AsyncResult<void> {
  const gitignorePath = `${repoRoot}/.gitignore`;
  const entry = `/${AGENT_SKILLS_DIR}/`;

  try {
    const file = Bun.file(gitignorePath);
    let content = "";

    if (await file.exists()) {
      content = await file.text();

      // Check if already present
      const lines = content.split("\n");
      const hasEntry = lines.some(
        (line) =>
          line.trim() === entry.trim() ||
          line.trim() === AGENT_SKILLS_DIR ||
          line.trim() === `.${AGENT_SKILLS_DIR}` ||
          line.trim() === `${AGENT_SKILLS_DIR}/`
      );

      if (hasEntry) {
        return ok(undefined);
      }
    }

    // Add entry
    const newContent = content.endsWith("\n")
      ? `${content}${entry}\n`
      : content.length > 0
        ? `${content}\n${entry}\n`
        : `${entry}\n`;

    await Bun.write(gitignorePath, newContent);
    return ok(undefined);
  } catch (error) {
    return err(
      makeError(
        "IO_ERROR",
        `Failed to update .gitignore: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

// =============================================================================
// Store Resolution
// =============================================================================

/**
 * Resolve the project store for the current working directory.
 *
 * @returns Result with store path, or error if not in a git repo
 */
export async function resolveProjectStore(): AsyncResult<string> {
  const repoRoot = await findRepoRoot();

  if (repoRoot === null) {
    return err(
      makeError(
        "STORE_NOT_FOUND",
        "Not in a git repository. Run from within a git repo."
      )
    );
  }

  return ok(getProjectStore(repoRoot));
}

/**
 * Resolve the global store.
 *
 * @returns Store path (always succeeds)
 */
export function resolveGlobalStore(): string {
  return getGlobalStore();
}

// =============================================================================
// INDEX.md Regeneration
// =============================================================================

interface AhaCardSummary {
  id: string;
  ts: string;
  title: string;
  primary_skill: string;
  scope: string;
  status: string;
  problem?: string;
  tags?: string[];
}

interface RecommendationSummary {
  id: string;
  ts: string;
  title: string;
  primary_skill: string;
  scope: string;
  status: string;
  description?: string;
}

/**
 * Read JSONL file and return parsed records.
 */
async function readJsonlRecords<T>(path: string): Promise<T[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return [];
  }

  const content = await file.text();
  if (!content.trim()) {
    return [];
  }

  const records: T[] = [];
  for (const line of content.split("\n")) {
    if (line.trim()) {
      try {
        records.push(JSON.parse(line));
      } catch {
        // Skip invalid lines
      }
    }
  }
  return records;
}

/**
 * Get latest version of each record by ID.
 */
function latestById<T extends { id: string }>(records: T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const record of records) {
    latest.set(record.id, record);
  }
  return latest;
}

/**
 * Regenerate INDEX.md from stored learnings.
 *
 * @param storeDir - Store directory path
 * @returns Result indicating success or failure
 */
export async function regenerateIndex(storeDir: string): AsyncResult<void> {
  try {
    const ahaPath = getStorePath(storeDir, FILES.AHA_CARDS);
    const recPath = getStorePath(storeDir, FILES.RECOMMENDATIONS);

    const ahaRecords = await readJsonlRecords<AhaCardSummary>(ahaPath);
    const recRecords = await readJsonlRecords<RecommendationSummary>(recPath);

    const ahaLatest = latestById(ahaRecords);
    const recLatest = latestById(recRecords);

    // Filter out rejected/deprecated aha cards, sort by timestamp descending
    const ahaCards = [...ahaLatest.values()]
      .filter((a) => a.status !== "rejected" && a.status !== "deprecated")
      .sort((a, b) => b.ts.localeCompare(a.ts));

    // Filter out dismissed recommendations, sort by timestamp descending
    const recommendations = [...recLatest.values()]
      .filter((r) => r.status !== "dismissed")
      .sort((a, b) => b.ts.localeCompare(a.ts));

    // Generate markdown
    const lines: string[] = ["# Self-Learning Index", ""];

    // Stats
    const totalAha = ahaCards.length;
    const totalRec = recommendations.length;
    const skillsSet = new Set([
      ...ahaCards.map((a) => a.primary_skill),
      ...recommendations.map((r) => r.primary_skill),
    ]);

    lines.push(`**${totalAha}** aha cards | **${totalRec}** recommendations | **${skillsSet.size}** skills`);
    lines.push("");

    // Aha Cards section
    if (ahaCards.length > 0) {
      lines.push("## Aha Cards");
      lines.push("");

      // Group by skill
      const bySkill = new Map<string, AhaCardSummary[]>();
      for (const card of ahaCards) {
        const skill = card.primary_skill || "unknown";
        if (!bySkill.has(skill)) {
          bySkill.set(skill, []);
        }
        bySkill.get(skill)!.push(card);
      }

      for (const [skill, cards] of [...bySkill.entries()].sort()) {
        lines.push(`### ${skill}`);
        lines.push("");

        for (const card of cards) {
          const status = card.status !== "proposed" ? ` [${card.status}]` : "";
          const scope = card.scope === "portable" ? " 🌐" : "";
          lines.push(`- **${card.title}**${scope}${status}`);
          lines.push(`  - ID: \`${card.id}\``);
          if (card.problem) {
            const problem = card.problem.length > 100
              ? card.problem.slice(0, 100) + "..."
              : card.problem;
            lines.push(`  - ${problem}`);
          }
          if (card.tags && card.tags.length > 0) {
            lines.push(`  - Tags: ${card.tags.join(", ")}`);
          }
        }
        lines.push("");
      }
    } else {
      lines.push("*No aha cards recorded yet.*");
      lines.push("");
    }

    // Recommendations section
    if (recommendations.length > 0) {
      lines.push("## Recommendations");
      lines.push("");

      // Group by status
      const open = recommendations.filter(
        (r) => r.status === "proposed" || r.status === "in_progress"
      );
      const done = recommendations.filter(
        (r) => r.status === "done" || r.status === "dismissed"
      );

      if (open.length > 0) {
        lines.push("### Open");
        lines.push("");
        for (const rec of open) {
          const status = rec.status === "in_progress" ? " [in progress]" : "";
          lines.push(`- **${rec.title}**${status}`);
          lines.push(`  - ID: \`${rec.id}\``);
          if (rec.description) {
            const desc = rec.description.length > 100
              ? rec.description.slice(0, 100) + "..."
              : rec.description;
            lines.push(`  - ${desc}`);
          }
        }
        lines.push("");
      }

      if (done.length > 0) {
        lines.push("### Completed");
        lines.push("");
        for (const rec of done) {
          const status = rec.status === "dismissed" ? " [dismissed]" : " [done]";
          lines.push(`- ~~${rec.title}~~${status}`);
          lines.push(`  - ID: \`${rec.id}\``);
        }
        lines.push("");
      }
    }

    // Footer
    lines.push("---");
    lines.push("");
    lines.push("*Generated by self-learning-skills (TypeScript)*");
    lines.push("*Inspired by [Scott Falconer's self-learning-skills](https://github.com/scottfalconer/self-learning-skills)*");
    lines.push("");

    const indexPath = getStorePath(storeDir, FILES.INDEX);
    await Bun.write(indexPath, lines.join("\n"));

    return ok(undefined);
  } catch (error) {
    return err(
      makeError(
        "IO_ERROR",
        `Failed to regenerate INDEX.md: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}
