/**
 * Prompt Builder Module
 *
 * Loads prompt templates and injects context for evaluation.
 */

import type { EvaluationContext, CheckpointName, TranscriptRecord } from "./types";
import { join, dirname } from "path";

/**
 * Get the prompts directory path
 */
function getPromptsDir(): string {
  // Prompts are stored in .claude/hooks/prompts/
  // This file is at .claude/hooks/evaluator/prompt-builder.ts
  return join(dirname(import.meta.path), "..", "prompts");
}

/**
 * Load a prompt template from the prompts directory
 */
export async function loadTemplate(checkpoint: CheckpointName): Promise<string | null> {
  const templatePath = join(getPromptsDir(), `${checkpoint}.md`);

  try {
    const file = Bun.file(templatePath);
    if (!(await file.exists())) {
      return null;
    }
    return await file.text();
  } catch {
    return null;
  }
}

/**
 * Format transcript records for inclusion in prompt
 */
function formatTranscript(records: TranscriptRecord[]): string {
  if (records.length === 0) {
    return "(No transcript available)";
  }

  const formatted: string[] = [];

  for (const record of records) {
    if (record.type === "user") {
      const content = typeof record.message === "string"
        ? record.message
        : JSON.stringify(record.message);
      formatted.push(`USER: ${content}`);
    } else if (record.type === "assistant") {
      // Extract text content from assistant message
      let content = "";
      if (typeof record.message === "string") {
        content = record.message;
      } else if (record.message && typeof record.message === "object") {
        const msg = record.message as { content?: unknown };
        if (Array.isArray(msg.content)) {
          content = msg.content
            .filter((c: unknown) => c && typeof c === "object" && (c as { type?: string }).type === "text")
            .map((c: unknown) => (c as { text?: string }).text || "")
            .join("\n");
        } else if (typeof msg.content === "string") {
          content = msg.content;
        }
      }
      if (content) {
        formatted.push(`ASSISTANT: ${content.substring(0, 2000)}${content.length > 2000 ? "..." : ""}`);
      }
    }
  }

  return formatted.join("\n\n");
}

/**
 * Format beads state for inclusion in prompt
 */
function formatBeadsState(context: EvaluationContext): string {
  const parts: string[] = [];

  if (context.beadsState) {
    const b = context.beadsState;
    parts.push(`Current Item: ${b.id}`);
    parts.push(`  Title: ${b.title}`);
    parts.push(`  Type: ${b.type}`);
    parts.push(`  Status: ${b.status}`);
    parts.push(`  Priority: P${b.priority}`);
    if (b.azureDevOpsId) {
      parts.push(`  Azure DevOps: #${b.azureDevOpsId}`);
    }
    if (b.blockedBy && b.blockedBy.length > 0) {
      parts.push(`  Blocked By: ${b.blockedBy.join(", ")}`);
    }
  } else {
    parts.push("(No beads item context available)");
  }

  if (context.parentFeature) {
    const f = context.parentFeature;
    parts.push("");
    parts.push(`Parent Feature: ${f.id}`);
    parts.push(`  Title: ${f.title}`);
    parts.push(`  Status: ${f.status}`);
    if (f.description) {
      // Extract acceptance criteria if present
      const acMatch = f.description.match(/## Acceptance Criteria[\s\S]*?(?=##|$)/);
      if (acMatch) {
        parts.push(`  Acceptance Criteria:`);
        const criteria = acMatch[0].split("\n").filter(l => l.match(/^\s*-\s*\[/));
        for (const c of criteria.slice(0, 10)) { // Limit to 10 criteria
          parts.push(`    ${c.trim()}`);
        }
      }
    }
  }

  if (context.parentEpic) {
    const e = context.parentEpic;
    parts.push("");
    parts.push(`Parent Epic: ${e.id}`);
    parts.push(`  Title: ${e.title}`);
    parts.push(`  Status: ${e.status}`);
  }

  return parts.join("\n");
}

/**
 * Format git state for inclusion in prompt
 */
function formatGitState(context: EvaluationContext): string {
  const g = context.gitState;
  const parts: string[] = [];

  parts.push(`Branch: ${g.currentBranch}`);
  parts.push(`Uncommitted Changes: ${g.hasUncommittedChanges ? "Yes" : "No"}`);
  parts.push(`Unpushed Commits: ${g.hasUnpushedCommits ? "Yes" : "No"}`);

  if (g.modifiedFiles.length > 0) {
    parts.push(`Modified Files (${g.modifiedFiles.length}):`);
    for (const f of g.modifiedFiles.slice(0, 10)) {
      parts.push(`  - ${f}`);
    }
    if (g.modifiedFiles.length > 10) {
      parts.push(`  ... and ${g.modifiedFiles.length - 10} more`);
    }
  }

  if (g.untrackedFiles.length > 0) {
    parts.push(`Untracked Files (${g.untrackedFiles.length}):`);
    for (const f of g.untrackedFiles.slice(0, 5)) {
      parts.push(`  - ${f}`);
    }
    if (g.untrackedFiles.length > 5) {
      parts.push(`  ... and ${g.untrackedFiles.length - 5} more`);
    }
  }

  return parts.join("\n");
}

/**
 * Format DevOps state for inclusion in prompt
 */
function formatDevOpsState(context: EvaluationContext): string {
  if (!context.devOpsState) {
    return "(Not linked to Azure DevOps)";
  }

  const d = context.devOpsState;
  const parts: string[] = [];

  parts.push(`Work Item: #${d.workItemId}`);
  parts.push(`State: ${d.state}`);
  if (d.assignedTo) {
    parts.push(`Assigned To: ${d.assignedTo}`);
  }
  if (d.iterationPath) {
    parts.push(`Iteration: ${d.iterationPath}`);
  }
  if (d.parentId) {
    parts.push(`Parent: #${d.parentId}`);
  }

  return parts.join("\n");
}

/**
 * Build a prompt for evaluation by loading template and injecting context
 *
 * Template placeholders:
 * - {TRANSCRIPT} - Recent conversation transcript
 * - {BEADS_STATE} - Current beads item and parents
 * - {GIT_STATUS} - Git repository state
 * - {DEVOPS_STATE} - Azure DevOps state (if linked)
 * - {TOOL_NAME} - Current tool being used (if applicable)
 * - {TOOL_INPUT} - Tool input (if applicable)
 */
export async function buildPrompt(
  checkpoint: CheckpointName,
  context: EvaluationContext
): Promise<string> {
  // Load template
  const template = await loadTemplate(checkpoint);

  if (!template) {
    // Return a minimal prompt if template not found
    return `Evaluate the following context for the "${checkpoint}" checkpoint.

Context:
${formatBeadsState(context)}

Git Status:
${formatGitState(context)}

Respond with JSON: {"verdict": "pass" | "warn" | "block", "violations": [], "feedback": ""}`;
  }

  // Inject context into template
  let prompt = template;

  prompt = prompt.replace("{TRANSCRIPT}", formatTranscript(context.transcript));
  prompt = prompt.replace("{BEADS_STATE}", formatBeadsState(context));
  prompt = prompt.replace("{GIT_STATUS}", formatGitState(context));
  prompt = prompt.replace("{DEVOPS_STATE}", formatDevOpsState(context));

  // Tool-specific placeholders
  if (context.hookInput.tool_name) {
    prompt = prompt.replace("{TOOL_NAME}", context.hookInput.tool_name);
  } else {
    prompt = prompt.replace("{TOOL_NAME}", "(none)");
  }

  if (context.hookInput.tool_input) {
    prompt = prompt.replace(
      "{TOOL_INPUT}",
      JSON.stringify(context.hookInput.tool_input, null, 2).substring(0, 2000)
    );
  } else {
    prompt = prompt.replace("{TOOL_INPUT}", "(none)");
  }

  return prompt;
}

/**
 * Get template placeholders that were not replaced (for debugging)
 */
export function getUnreplacedPlaceholders(prompt: string): string[] {
  const matches = prompt.match(/\{[A-Z_]+\}/g);
  return matches ? [...new Set(matches)] : [];
}
