/**
 * Evaluator Type Definitions
 *
 * Shared interfaces for the Claude CLI Evaluator system.
 */

/**
 * Hook input received via stdin from Claude Code hooks
 */
export interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
}

/**
 * A single record from the transcript JSONL file
 */
export interface TranscriptRecord {
  type: "system" | "assistant" | "user" | "result";
  subtype?: "init" | "success" | "error";
  session_id?: string;
  model?: string;
  tools?: unknown[];
  message?: unknown;
  tool_use?: unknown;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  result?: string;
}

/**
 * Beads item state from `bd show` output
 */
export interface BeadsState {
  id: string;
  title: string;
  status: "open" | "in_progress" | "closed";
  type: "task" | "bug" | "feature" | "epic";
  priority: number;
  description?: string;
  parentId?: string;
  azureDevOpsId?: number;
  blockedBy?: string[];
  blocks?: string[];
}

/**
 * Git repository state
 */
export interface GitState {
  hasUncommittedChanges: boolean;
  hasUnpushedCommits: boolean;
  currentBranch: string;
  modifiedFiles: string[];
  untrackedFiles: string[];
}

/**
 * Azure DevOps work item state (optional)
 */
export interface DevOpsState {
  workItemId: number;
  state: string;
  parentId?: number;
  iterationPath?: string;
  assignedTo?: string;
}

/**
 * Context gathered for evaluation
 */
export interface EvaluationContext {
  /** Recent transcript messages */
  transcript: TranscriptRecord[];
  /** Current beads item being worked on */
  beadsState?: BeadsState;
  /** Parent feature if task is under a feature */
  parentFeature?: BeadsState;
  /** Parent epic if feature is under an epic */
  parentEpic?: BeadsState;
  /** Git repository state */
  gitState: GitState;
  /** Azure DevOps state if beads item has DevOps link */
  devOpsState?: DevOpsState;
  /** Current working directory */
  cwd: string;
  /** Original hook input */
  hookInput: HookInput;
}

/**
 * Evaluation verdict
 */
export type Verdict = "pass" | "warn" | "block";

/**
 * A single rule violation detected during evaluation
 */
export interface Violation {
  rule: string;
  description: string;
  severity: "error" | "warning" | "info";
}

/**
 * Result of an evaluation
 */
export interface EvaluationResult {
  /** Overall verdict: pass, warn, or block */
  verdict: Verdict;
  /** List of rule violations found */
  violations: Violation[];
  /** Human-readable feedback message */
  feedback: string;
  /** Raw response from Claude CLI (for debugging) */
  rawResponse?: string;
}

/**
 * Configuration for a single checkpoint
 */
export interface CheckpointConfig {
  /** Whether this checkpoint is enabled */
  enabled: boolean;
  /** Whether violations should block (true) or just warn (false) */
  blocking: boolean;
}

/**
 * Evaluator configuration
 */
export interface EvaluatorConfig {
  /** Global enable/disable for the evaluator */
  enabled: boolean;
  /** Model to use for evaluation (haiku recommended for speed) */
  model: "haiku" | "sonnet";
  /** Timeout in milliseconds for Claude CLI calls */
  timeoutMs: number;
  /** Per-checkpoint configuration */
  checkpoints: {
    preFlight: CheckpointConfig;
    closingCheck: CheckpointConfig;
    sessionEnd: CheckpointConfig;
  };
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Hook output for PreToolUse hooks that can block
 */
export interface BlockingHookOutput {
  hookSpecificOutput: {
    decision: {
      behavior: "allow" | "block";
    };
    message: string;
  };
}

/**
 * Checkpoint names supported by the evaluator
 */
export type CheckpointName = "preFlight" | "closingCheck" | "sessionEnd";

/**
 * DevOps sync status detected from transcript
 */
export interface DevOpsSyncStatus {
  /** Whether beads item has a DevOps link */
  hasDevOpsLink: boolean;
  /** DevOps work item ID (if linked) */
  devOpsId?: number;
  /** Found az boards update command with --state */
  statusUpdateFound: boolean;
  /** Found az boards update command with --discussion */
  commentAddedFound: boolean;
  /** Found Invoke-RestMethod for DevOps comments */
  restApiCommentFound: boolean;
}
