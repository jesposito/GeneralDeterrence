# Research: Pre-Flight Checkpoint

**Beads ID:** ai-tw-claude-code-dev-env-d1w.2.1
**Feature:** Pre-Flight Checkpoint (d1w.2)
**Date:** 2026-01-30

## 1. Code-Modifying Tool Patterns

**Code-modifying tools** that should trigger the pre-flight checkpoint:

| Tool | Description | Detection |
|------|-------------|-----------|
| **Edit** | Modifies existing files | Always triggers |
| **Write** | Creates/replaces files | Always triggers |
| **Bash** | Can modify files via redirects | Check for unsafe patterns |

### Hook Registration Pattern

From `hooks.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [{
          "type": "command",
          "command": "bun run ${CLAUDE_PROJECT_ROOT}/.claude/hooks/checkpoints/pre-flight.ts",
          "timeout": 15000
        }]
      }
    ]
  }
}
```

### Hook Input Format

Hooks receive JSON via stdin:
```typescript
interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
}
```

### Bash Tool Handling

Bash requires pattern detection for unsafe operations:
- Redirect operators: `>`, `>>`, `|`
- File modification commands: `rm`, `mv`, `cp`, `touch`, `mkdir`
- If safe (read-only), skip checkpoint

---

## 2. First-Edit Detection Mechanism

**Challenge:** Detect "first code-modifying tool per task" to avoid repeated checkpoint prompts.

### Option Analysis

| Option | Pros | Cons |
|--------|------|------|
| **Session state file** | Fast lookup, persists | Requires file I/O |
| **Environment variable** | Simple | Doesn't persist across processes |
| **Transcript analysis** | Authoritative | Slower, requires parsing |

### Recommended: Hybrid Approach

1. Check session state file first (fast path)
2. Fall back to transcript analysis if state unclear
3. Store acknowledged task IDs in state

**State file location:** `.claude/state/checkpoint-state.json` (gitignored)

```typescript
interface CheckpointState {
  sessionId: string;
  acknowledgedTaskIds: string[];
  lastAcknowledgmentTime: number;
}
```

---

## 3. Transcript Markers for Acknowledgment Detection

### Pre-Flight Acknowledgment Format

From `workflow-implementation.md`:
```
Pre-flight checklist complete:
- Plan confirmed: [yes/no - how]
- Acceptance criteria: [feature and epic both have them]
- Research referenced: [yes/no/N/A - path to research doc if exists]
- Beads tasks: [list task IDs that will be worked]
- Status: [feature], [epic], [task] all in_progress
- This task addresses:
  - Feature criteria: [list specific criteria from feature]
  - Epic criteria: [list specific criteria from epic, or "contributes via feature"]

Ready to begin implementation.
```

### Detection Strategy

Search transcript backward for markers (in order of confidence):

1. **High confidence:** `"Ready to begin implementation."` - End marker
2. **Medium confidence:** `"Pre-flight checklist complete:"` - Start marker
3. **Supporting:** `"all in_progress"` - Status confirmation

### Search Logic

```typescript
function hasPreFlightAcknowledgment(transcript: string): boolean {
  // Look for end marker (most reliable)
  if (transcript.includes("Ready to begin implementation.")) {
    // Verify it's recent (within last ~10 messages)
    const lastOccurrence = transcript.lastIndexOf("Ready to begin implementation.");
    const recentSection = transcript.slice(-50000); // ~50KB of recent content
    return recentSection.includes("Ready to begin implementation.");
  }
  return false;
}
```

### Edge Cases

| Case | Handling |
|------|----------|
| Multiple acknowledgments | Use most recent |
| Partial acknowledgment | Block anyway |
| Task changes mid-session | Require new acknowledgment |
| New session | Always require acknowledgment |

---

## 4. PreToolUse Hook Output Format for Blocking

### Blocking Decision Format

```typescript
const blockingOutput = {
  hookSpecificOutput: {
    decision: {
      behavior: "block"
    },
    message: `╔════════════════════════════════════════════════════════════════╗
║              PRE-FLIGHT CHECKPOINT NOT COMPLETE                ║
╠════════════════════════════════════════════════════════════════╣
║  You must complete the pre-flight checklist before writing     ║
║  any code.                                                     ║
║                                                                ║
║  MISSING: Pre-flight acknowledgment not found in transcript    ║
║                                                                ║
║  REQUIRED: State the following before proceeding:              ║
║                                                                ║
║  "Pre-flight checklist complete:                               ║
║  - Plan confirmed: [yes/no - how]                              ║
║  - Beads tasks: [list task IDs]                                ║
║  - Status: [feature], [epic], [task] all in_progress           ║
║  Ready to begin implementation."                               ║
╚════════════════════════════════════════════════════════════════╝`
  }
};
console.log(JSON.stringify(blockingOutput));
```

### Allowing Decision Format

```typescript
const allowingOutput = {
  hookSpecificOutput: {
    decision: {
      behavior: "allow"
    },
    message: "[Pre-flight] ✓ Checkpoint verified"
  }
};
console.log(JSON.stringify(allowingOutput));
```

### Critical Requirements

- Output must be JSON to stdout
- Exit code must always be 0 (fail silently per hook standards)
- Message field is displayed to user
- Behavior field controls whether tool execution proceeds

---

## 5. Implementation Architecture

### File Structure

```
.claude/hooks/
├── checkpoints/
│   └── pre-flight.ts      # Main checkpoint script
├── evaluator/
│   └── context-gatherer.ts # Shared transcript reading
└── state/
    └── checkpoint-state.json # Session state (gitignored)
```

### Hook Registration (hooks.json additions)

```json
{
  "PreToolUse": [
    {
      "matcher": "Edit",
      "hooks": [{
        "type": "command",
        "command": "bun run ${CLAUDE_PROJECT_ROOT}/.claude/hooks/checkpoints/pre-flight.ts",
        "timeout": 15000
      }]
    },
    {
      "matcher": "Write",
      "hooks": [{
        "type": "command",
        "command": "bun run ${CLAUDE_PROJECT_ROOT}/.claude/hooks/checkpoints/pre-flight.ts",
        "timeout": 15000
      }]
    }
  ]
}
```

---

## 6. Testing Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| First Edit after acknowledgment | Allow |
| First Edit without acknowledgment | Block with message |
| Second Edit after acknowledgment | Allow (skip check) |
| Different task acknowledged | Require new acknowledgment |
| Partial acknowledgment | Block |

### Manual Test Command

```bash
echo '{
  "transcript_path": "/path/to/transcript.jsonl",
  "tool_name": "Edit",
  "tool_input": { "file_path": "src/file.ts" },
  "session_id": "sess-123",
  "hook_event_name": "PreToolUse"
}' | bun run .claude/hooks/checkpoints/pre-flight.ts
```

---

## 7. Key Insights

1. **Transcript is source of truth** - More reliable than state files for acknowledgment detection
2. **Bash requires special handling** - Check for write operations vs read-only
3. **Hooks must fail silently** - Always exit 0; use decision field for blocking
4. **Acknowledgment format is unambiguous** - "Ready to begin implementation." is unlikely in normal conversation
5. **First-edit optimization** - Cache acknowledged tasks in state file to skip repeated transcript parsing
