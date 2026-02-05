# Research: Core Evaluator Infrastructure

**Beads ID:** ai-tw-claude-code-dev-env-d1w.1.1
**Feature:** Core Evaluator Infrastructure (d1w.1)
**Date:** 2026-01-30

## 1. Claude CLI Output Formats and Invocation Patterns

### Available Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `--print` | Non-interactive output | `claude --print "prompt"` |
| `--output-format` | Output format (json, text, stream-json) | `--output-format json` |
| `--model` | Model selection | `--model haiku` |

### Invocation Patterns

**Basic piped input:**
```bash
echo "prompt" | claude --print --model haiku
```

**JSON output for structured evaluation:**
```bash
echo "prompt" | claude --print --model haiku --output-format json
```

**Windows compatibility:** Direct usage works on Windows (tested successfully).

### Bun Integration

```typescript
import { $ } from "bun";

// Simple invocation
const result = await $`echo ${prompt} | claude --print --model haiku`.text();

// With timeout
const proc = Bun.spawn(["claude", "--print", "--model", "haiku"], {
  stdin: new TextEncoder().encode(prompt),
  stdout: "pipe",
  timeout: 10000
});
const output = await new Response(proc.stdout).text();
```

---

## 2. Transcript File Format and Parsing

### Location

```
~/.claude/projects/<project-slug>/<session-id>.jsonl
```

The `transcript_path` is provided in hook input.

### Format

JSONL (JSON Lines) with event stream semantics:

```json
{"type": "system", "subtype": "init", "session_id": "uuid", "model": "claude-opus-4-5-20251101", "tools": [...]}
{"type": "assistant", "message": {...}, "tool_use": {...}}
{"type": "result", "subtype": "success", "tool_name": "Bash", "tool_use_id": "...", "result": "..."}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `type` | Record type: system, assistant, result |
| `subtype` | Event subtype: init, success, error |
| `session_id` | Session identifier |
| `tool_name` | Tool that was invoked |
| `tool_input` | Arguments passed to tool |
| `tool_use_id` | Unique ID for this tool use |
| `result` | Tool execution result |

### Parsing Pattern

```typescript
async function parseTranscript(path: string): Promise<TranscriptRecord[]> {
  const content = await Bun.file(path).text();
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line));
}

// Filter for recent messages
function getRecentMessages(records: TranscriptRecord[], count: number = 20): TranscriptRecord[] {
  return records
    .filter(r => r.type === 'assistant' || r.type === 'user')
    .slice(-count);
}
```

---

## 3. Optimal Model for Fast Evaluation

### Model Comparison

| Model | Latency | Use Case |
|-------|---------|----------|
| **Haiku** | ~2-3s | ✓ Ideal for evaluation hooks |
| Sonnet | ~5-8s | Too slow for hooks |
| Opus | ~10-15s | Way too slow |

### Recommendation: Haiku

- **Latency:** 2-3 seconds (well under 15-second hook timeout)
- **Context:** 200k tokens sufficient for evaluation
- **Cost:** Negligible for evaluation calls
- **Quality:** Suitable for scoring, validation, checklist verification

### Invocation

```typescript
const EVALUATOR_MODEL = "haiku";

async function evaluate(prompt: string): Promise<string> {
  const result = await $`echo ${prompt} | claude --print --model ${EVALUATOR_MODEL}`.text();
  return result.trim();
}
```

---

## 4. Azure DevOps CLI Queries

### Configuration

```bash
az devops configure --defaults \
  organization=https://dev.azure.com/org \
  project="ProjectName"
```

### Query Work Item State

```bash
# Get single field
pwsh -Command "az boards work-item show --id 123 --query 'fields.\"System.State\"' -o tsv"

# Get multiple fields
pwsh -Command "az boards work-item show --id 123 --query '{state: fields.\"System.State\", parent: fields.\"System.Parent\"}'"
```

### Useful Fields for Context

| Field | API Name |
|-------|----------|
| State | `System.State` |
| Parent ID | `System.Parent` |
| Iteration | `System.IterationPath` |
| Assigned To | `System.AssignedTo` |
| Remaining Work | `Microsoft.VSTS.Scheduling.RemainingWork` |

### Integration Pattern

```typescript
async function getDevOpsState(workItemId: number): Promise<string | null> {
  try {
    const result = await $`pwsh -Command "az boards work-item show --id ${workItemId} --query 'fields.\"System.State\"' -o tsv"`.text();
    return result.trim();
  } catch {
    return null; // DevOps unavailable
  }
}
```

---

## 5. Bun Shell Integration Patterns

### File Operations

```typescript
// Read files
const file = Bun.file(path);
const exists = await file.exists();
const content = await file.text();

// Write files
await Bun.write(path, content);

// Read stdin (for hooks)
const input = await Bun.stdin.text();
const data: HookInput = JSON.parse(input);
```

### Process Spawning

```typescript
// Using $ shell
const output = await $`command arg1 arg2`.text();

// Using Bun.spawn with timeout
const proc = Bun.spawn(["command", "arg1"], {
  stdout: "pipe",
  stderr: "pipe",
  timeout: 5000
});
const stdout = await new Response(proc.stdout).text();
```

### Hook Exit Patterns

```typescript
// Always exit 0 (fail silently)
try {
  // Hook logic
  console.log(JSON.stringify(result));
} catch (error) {
  // Log to file if needed, but never throw
  // await Bun.write("/tmp/hook-error.log", String(error));
}
process.exit(0);
```

---

## 6. Hook Input/Output Format

### Input (via stdin)

```typescript
interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
}
```

### Output (PreToolUse blocking)

```typescript
interface HookOutput {
  hookSpecificOutput: {
    decision: {
      behavior: "allow" | "block";
    };
    message: string;
  };
}

// Example
console.log(JSON.stringify({
  hookSpecificOutput: {
    decision: { behavior: "block" },
    message: "Pre-flight checklist not complete"
  }
}));
```

### Output (PostToolUse advisory)

```typescript
// Just print message directly
console.log("✓ Evaluation passed");
```

---

## 7. Configuration Pattern

### Config File Structure

```typescript
// .claude/hooks/evaluator/config.ts
export interface EvaluatorConfig {
  enabled: boolean;
  model: "haiku" | "sonnet";
  timeoutMs: number;
  checkpoints: {
    preFlight: { enabled: boolean; blocking: boolean };
    closingCheck: { enabled: boolean; blocking: boolean };
    sessionEnd: { enabled: boolean; blocking: boolean };
  };
  debug: boolean;
}

export const defaultConfig: EvaluatorConfig = {
  enabled: true,
  model: "haiku",
  timeoutMs: 10000,
  checkpoints: {
    preFlight: { enabled: true, blocking: true },
    closingCheck: { enabled: true, blocking: false },
    sessionEnd: { enabled: true, blocking: false }
  },
  debug: false
};
```

### Environment Overrides

```typescript
function loadConfig(): EvaluatorConfig {
  const config = { ...defaultConfig };

  if (process.env.EVALUATOR_ENABLED === "false") {
    config.enabled = false;
  }
  if (process.env.EVALUATOR_DEBUG === "true") {
    config.debug = true;
  }
  if (process.env.EVALUATOR_MODEL) {
    config.model = process.env.EVALUATOR_MODEL as "haiku" | "sonnet";
  }

  return config;
}
```

---

## 8. Implementation Architecture

### Component Structure

```
.claude/hooks/
├── evaluator/
│   ├── index.ts              # Main orchestrator
│   ├── context-gatherer.ts   # Transcript, beads, DevOps
│   ├── prompt-builder.ts     # Template loading
│   ├── result-parser.ts      # JSON extraction
│   └── config.ts             # Configuration
├── checkpoints/
│   ├── pre-flight.ts
│   ├── closing-check.ts
│   └── session-end.ts
└── prompts/
    ├── pre-flight.md
    ├── closing-check.md
    └── session-end.md
```

### Main Evaluator Flow

```typescript
// evaluator/index.ts
export async function evaluate(
  checkpoint: string,
  context: EvaluationContext
): Promise<EvaluationResult> {
  const config = loadConfig();
  if (!config.enabled) {
    return { verdict: "pass", feedback: "" };
  }

  // Build prompt
  const prompt = await buildPrompt(checkpoint, context);

  // Call Claude CLI
  const rawResult = await callClaude(prompt, config);

  // Parse result
  return parseResult(rawResult);
}

async function callClaude(prompt: string, config: EvaluatorConfig): Promise<string> {
  const timeout = config.timeoutMs;
  const model = config.model;

  try {
    const result = await $`echo ${prompt} | claude --print --model ${model}`.timeout(timeout).text();
    return result;
  } catch {
    return '{"verdict": "pass", "feedback": "Evaluation timed out"}';
  }
}
```

---

## 9. Key Insights

1. **Haiku is fast enough** - 2-3s latency fits well within hook timeouts
2. **Piping works on Windows** - No special handling needed
3. **Transcript is accessible** - `transcript_path` in hook input provides full context
4. **DevOps is optional** - Check for link in beads item, skip if not present
5. **Fail open always** - Exit 0, return passing evaluation on any error
6. **JSON output available** - `--output-format json` for structured responses
7. **Bun is well-suited** - File I/O, process spawning, stdin reading all work well
