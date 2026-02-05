/**
 * Context Gatherer Module
 *
 * Extracts context from transcript, beads, git, and optionally Azure DevOps
 * for use in evaluation prompts.
 */

import { $ } from "bun";
import type {
  HookInput,
  TranscriptRecord,
  BeadsState,
  GitState,
  DevOpsState,
  DevOpsSyncStatus,
  EvaluationContext,
} from "./types";

/**
 * Parse the JSONL transcript file
 */
export async function parseTranscript(path: string): Promise<TranscriptRecord[]> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return [];
    }
    const content = await file.text();
    const lines = content.split("\n").filter((line) => line.trim());
    return lines.map((line) => JSON.parse(line) as TranscriptRecord);
  } catch {
    return [];
  }
}

/**
 * Get recent messages from transcript
 *
 * Filters for user and assistant messages, returns the most recent N
 */
export function getRecentMessages(
  records: TranscriptRecord[],
  count: number = 20
): TranscriptRecord[] {
  return records
    .filter((r) => r.type === "assistant" || r.type === "user")
    .slice(-count);
}

/**
 * Parse beads state from `bd show` output
 */
function parseBeadsOutput(output: string): BeadsState | null {
  try {
    // Parse the bd show output format:
    // ○ ai-tw-claude-code-dev-env-d1w.1 · Title   [● P1 · OPEN]
    // Owner: ... · Type: feature
    // DESCRIPTION
    // ...

    const lines = output.split("\n");
    if (lines.length === 0) {
      return null;
    }

    // First line: ○ id · title   [● P1 · STATUS]
    const firstLine = lines[0];
    const idMatch = firstLine.match(/^[○✓]\s+(\S+)\s+·\s+(.+?)\s+\[●\s+P(\d)\s+·\s+(\w+)\]/);
    if (!idMatch) {
      return null;
    }

    const [, id, title, priorityStr, statusStr] = idMatch;
    const priority = parseInt(priorityStr, 10);
    const status = statusStr.toLowerCase() === "closed"
      ? "closed"
      : statusStr.toLowerCase() === "in_progress"
        ? "in_progress"
        : "open";

    // Second line: Owner: ... · Type: task/feature/bug/epic
    const secondLine = lines[1] || "";
    const typeMatch = secondLine.match(/Type:\s+(\w+)/);
    const type = (typeMatch?.[1] || "task") as BeadsState["type"];

    // Find description section
    const descIndex = lines.findIndex((l) => l.trim() === "DESCRIPTION");
    let description = "";
    if (descIndex >= 0) {
      // Get lines until next section (DEPENDS ON, CHILDREN, BLOCKS, etc.)
      const sectionHeaders = ["DEPENDS ON", "CHILDREN", "BLOCKS", "BLOCKED BY"];
      let endIndex = lines.length;
      for (let i = descIndex + 1; i < lines.length; i++) {
        if (sectionHeaders.some((h) => lines[i].trim().startsWith(h))) {
          endIndex = i;
          break;
        }
      }
      description = lines
        .slice(descIndex + 1, endIndex)
        .join("\n")
        .trim();
    }

    // Check for Azure DevOps link in description
    let azureDevOpsId: number | undefined;
    const devOpsMatch = description.match(/Azure DevOps (?:Task|Story|Epic|Bug) #(\d+)/);
    if (devOpsMatch) {
      azureDevOpsId = parseInt(devOpsMatch[1], 10);
    }

    // Find parent ID from DEPENDS ON section
    let parentId: string | undefined;
    const dependsIndex = lines.findIndex((l) => l.trim().startsWith("DEPENDS ON"));
    if (dependsIndex >= 0) {
      for (let i = dependsIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith("  →")) break;
        // Look for parent relationship (usually the feature/epic this belongs to)
        const parentMatch = line.match(/→\s+[○✓]\s+(\S+):/);
        if (parentMatch) {
          parentId = parentMatch[1];
          break;
        }
      }
    }

    // Find blocked by
    const blockedBy: string[] = [];
    const blockedByIndex = lines.findIndex((l) => l.trim().startsWith("BLOCKED BY"));
    if (blockedByIndex >= 0) {
      for (let i = blockedByIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith("  →")) break;
        const blockerMatch = line.match(/→\s+[○✓]\s+(\S+):/);
        if (blockerMatch) {
          blockedBy.push(blockerMatch[1]);
        }
      }
    }

    // Find blocks
    const blocks: string[] = [];
    const blocksIndex = lines.findIndex((l) => l.trim().startsWith("BLOCKS"));
    if (blocksIndex >= 0) {
      for (let i = blocksIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith("  ←")) break;
        const blockeeMatch = line.match(/←\s+[○✓]\s+(\S+):/);
        if (blockeeMatch) {
          blocks.push(blockeeMatch[1]);
        }
      }
    }

    return {
      id,
      title,
      status,
      type,
      priority,
      description,
      parentId,
      azureDevOpsId,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
      blocks: blocks.length > 0 ? blocks : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Get beads item state via `bd show`
 */
export async function getBeadsState(itemId: string): Promise<BeadsState | null> {
  try {
    const result = await $`bd show ${itemId}`.text();
    return parseBeadsOutput(result);
  } catch {
    return null;
  }
}

/**
 * Get git repository state
 */
export async function getGitStatus(): Promise<GitState> {
  const defaultState: GitState = {
    hasUncommittedChanges: false,
    hasUnpushedCommits: false,
    currentBranch: "unknown",
    modifiedFiles: [],
    untrackedFiles: [],
  };

  try {
    // Get current branch
    const branch = await $`git rev-parse --abbrev-ref HEAD`.text();
    defaultState.currentBranch = branch.trim();

    // Get status (porcelain format for easy parsing)
    const status = await $`git status --porcelain`.text();
    const statusLines = status.split("\n").filter((l) => l.trim());

    for (const line of statusLines) {
      const indicator = line.substring(0, 2);
      const file = line.substring(3);

      if (indicator === "??") {
        defaultState.untrackedFiles.push(file);
      } else {
        defaultState.modifiedFiles.push(file);
      }
    }

    defaultState.hasUncommittedChanges =
      defaultState.modifiedFiles.length > 0 || defaultState.untrackedFiles.length > 0;

    // Check for unpushed commits
    try {
      const unpushed = await $`git log @{u}..HEAD --oneline`.text();
      defaultState.hasUnpushedCommits = unpushed.trim().length > 0;
    } catch {
      // No upstream configured or other error
      defaultState.hasUnpushedCommits = false;
    }

    return defaultState;
  } catch {
    return defaultState;
  }
}

/**
 * Get Azure DevOps work item state (optional - only if beads item has DevOps link)
 */
export async function getDevOpsState(workItemId: number): Promise<DevOpsState | null> {
  try {
    // Query Azure DevOps for work item state
    const result =
      await $`pwsh -Command "az boards work-item show --id ${workItemId} --query '{state: fields.\"System.State\", parent: fields.\"System.Parent\", iteration: fields.\"System.IterationPath\", assignedTo: fields.\"System.AssignedTo\".displayName}' -o json"`.text();

    const data = JSON.parse(result);

    return {
      workItemId,
      state: data.state || "Unknown",
      parentId: data.parent || undefined,
      iterationPath: data.iteration || undefined,
      assignedTo: data.assignedTo || undefined,
    };
  } catch {
    // DevOps unavailable or not configured
    return null;
  }
}

/**
 * Gather all context for evaluation
 *
 * @param hookInput - The hook input from stdin
 * @param beadsItemId - Optional beads item ID to query
 */
export async function gatherContext(
  hookInput: HookInput,
  beadsItemId?: string
): Promise<EvaluationContext> {
  // Parse transcript
  const allRecords = await parseTranscript(hookInput.transcript_path);
  const transcript = getRecentMessages(allRecords);

  // Get git state
  const gitState = await getGitStatus();

  // Get beads state if item ID provided
  let beadsState: BeadsState | undefined;
  let parentFeature: BeadsState | undefined;
  let parentEpic: BeadsState | undefined;
  let devOpsState: DevOpsState | undefined;

  if (beadsItemId) {
    const state = await getBeadsState(beadsItemId);
    if (state) {
      beadsState = state;

      // Get parent feature if this is a task
      if (state.parentId && state.type === "task") {
        const parent = await getBeadsState(state.parentId);
        if (parent && parent.type === "feature") {
          parentFeature = parent;

          // Get parent epic if feature has parent
          if (parent.parentId) {
            const grandparent = await getBeadsState(parent.parentId);
            if (grandparent && grandparent.type === "epic") {
              parentEpic = grandparent;
            }
          }
        } else if (parent && parent.type === "epic") {
          // Task directly under epic
          parentEpic = parent;
        }
      }

      // Get DevOps state if beads item has DevOps link
      if (state.azureDevOpsId) {
        devOpsState = await getDevOpsState(state.azureDevOpsId) || undefined;
      }
    }
  }

  return {
    transcript,
    beadsState,
    parentFeature,
    parentEpic,
    gitState,
    devOpsState,
    cwd: hookInput.cwd,
    hookInput,
  };
}

/**
 * Detect DevOps sync commands in transcript
 *
 * Scans transcript for Azure DevOps CLI commands that indicate sync activity.
 */
export function detectDevOpsSyncInTranscript(
  transcript: TranscriptRecord[],
  devOpsId?: number
): DevOpsSyncStatus {
  const status: DevOpsSyncStatus = {
    hasDevOpsLink: devOpsId !== undefined,
    devOpsId,
    statusUpdateFound: false,
    commentAddedFound: false,
    restApiCommentFound: false,
  };

  if (!devOpsId) {
    return status;
  }

  // Search through transcript for DevOps commands
  for (const record of transcript) {
    // Check tool inputs (Bash commands)
    if (record.tool_input) {
      const command = (record.tool_input as { command?: string }).command;
      if (command && typeof command === "string") {
        // Check for state update: az boards work-item update --id <id> --state
        if (
          command.includes("az boards work-item update") &&
          command.includes(`--id ${devOpsId}`) &&
          command.includes("--state")
        ) {
          status.statusUpdateFound = true;
        }

        // Check for comment: az boards work-item update --id <id> --discussion
        if (
          command.includes("az boards work-item update") &&
          command.includes(`--id ${devOpsId}`) &&
          command.includes("--discussion")
        ) {
          status.commentAddedFound = true;
        }

        // Check for REST API comment: Invoke-RestMethod with workItems
        if (
          command.includes("Invoke-RestMethod") &&
          command.includes("workItems") &&
          command.includes(String(devOpsId))
        ) {
          status.restApiCommentFound = true;
        }
      }
    }

    // Also check results for evidence of DevOps updates
    if (record.result && typeof record.result === "string") {
      // Look for successful update confirmations
      if (
        record.result.includes(`work item ${devOpsId}`) ||
        record.result.includes(`WorkItem/${devOpsId}`)
      ) {
        // If we see the DevOps ID in results, likely some update happened
        if (record.result.toLowerCase().includes("closed")) {
          status.statusUpdateFound = true;
        }
      }
    }
  }

  return status;
}

/**
 * Detect DevOps link from beads item
 *
 * Extracts Azure DevOps work item ID from beads item description.
 */
export function detectDevOpsLink(beadsState: BeadsState | undefined): number | undefined {
  if (!beadsState) {
    return undefined;
  }
  return beadsState.azureDevOpsId;
}

/**
 * Extract beads item ID from recent transcript
 *
 * Looks for patterns like "bd update <id>", "bd show <id>", etc.
 */
export function extractBeadsItemFromTranscript(transcript: TranscriptRecord[]): string | null {
  // Look through recent tool uses for beads commands
  for (const record of [...transcript].reverse()) {
    if (record.type === "result" && record.tool_name === "Bash" && record.result) {
      // Look for bd commands in the result
      const bdMatch = record.result.match(
        /(?:Updated|Closed|Created|Showing)\s+(?:issue:?\s+)?(\S+-\w+\.\d+(?:\.\d+)?)/i
      );
      if (bdMatch) {
        return bdMatch[1];
      }
    }

    // Also check tool inputs for bd commands
    if (record.tool_input) {
      const command = (record.tool_input as { command?: string }).command;
      if (command && typeof command === "string") {
        const bdCmdMatch = command.match(/bd\s+(?:show|update|close)\s+(\S+-\w+\.\d+(?:\.\d+)?)/);
        if (bdCmdMatch) {
          return bdCmdMatch[1];
        }
      }
    }
  }

  return null;
}
