# Research: Session End Checkpoint

**Beads ID:** ai-tw-claude-code-dev-env-d1w.4.1
**Feature:** Session End Checkpoint (d1w.4)
**Date:** 2026-01-30

## 1. Stop Hook Behavior and Timing

### When It Fires

- `Stop` event fires when a Claude Code session ends
- Documented in `.claude/rules/scripting-hooks.md` as a common hook event type
- Currently **no Stop hooks registered** in `.claude/hooks/hooks.json`

### Hook Input Format

Same as other hooks - receives JSON via stdin:
```typescript
interface HookInput {
  session_id: string;
  transcript_path: string;  // Key: allows reading full conversation
  cwd: string;
  permission_mode: string;
  hook_event_name: string;  // Will be "Stop"
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}
```

### Registration Pattern

```json
{
  "Stop": [
    {
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "bun run ${CLAUDE_PROJECT_ROOT}/.claude/hooks/checkpoints/session-end.ts",
        "timeout": 15000
      }]
    }
  ]
}
```

---

## 2. Reliable bd sync Detection

### Required Command

From `CLAUDE.md` Session Protocol:
```bash
bd sync --from-main  # Pull latest from main, sync beads
```

### Detection Strategy

1. Read transcript from `transcript_path`
2. Search for `bd sync --from-main` or `bd sync` command
3. Verify it appears in recent session activity (not just history)

### Detection Code Pattern

```typescript
function hasBdSync(transcript: string): boolean {
  // Look for bd sync command in transcript
  const syncPatterns = [
    /bd sync --from-main/,
    /bd sync\s*$/m,  // Just "bd sync" at end of line
  ];
  return syncPatterns.some(p => p.test(transcript));
}
```

### Edge Cases

| Case | Handling |
|------|----------|
| Sync failed | Check for error output after command |
| Partial sync | Look for completion message |
| Multiple syncs | Any sync is acceptable |
| Sync before work | Should sync AFTER work too |

---

## 3. Git Status Check Requirements

### Session End Protocol (from CLAUDE.md)

```bash
git status                    # 1. Check what changed
git add <files>               # 2. Stage code changes
bd sync --from-main           # 3. Sync beads
git commit -m "..."           # 4. Commit code
git pull --rebase && git push # 5. Push to remote
git status                    # 6. Verify "up to date"
```

### Required Checks

| Check | Command | Expected |
|-------|---------|----------|
| Uncommitted changes | `git status --porcelain` | Empty output |
| Unpushed commits | `git log @{u}..HEAD --oneline` | Empty output |
| Clean working tree | `git status` | "nothing to commit" |

### Implementation Pattern

From `status-line.ts`:
```typescript
async function runCommand(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
  const text = await new Response(proc.stdout).text();
  return text.trim();
}

async function hasUncommittedChanges(): Promise<boolean> {
  const result = await runCommand(["git", "status", "--porcelain"]);
  return result.length > 0;
}

async function hasUnpushedCommits(): Promise<boolean> {
  try {
    const result = await runCommand(["git", "log", "@{u}..HEAD", "--oneline"]);
    return result.length > 0;
  } catch {
    return false; // No upstream configured
  }
}
```

---

## 4. Session Cleanup Patterns

### Required Sequence (from docs/best-practices.md)

1. Close completed work: `bd close item-001 item-002`
2. Sync beads: `bd sync --from-main`
3. Commit and push: `git add . && git commit && git push`

### Beads State Inspection

Check for items still in progress:
```typescript
async function getInProgressItems(): Promise<BeadsItem[]> {
  const result = await runCommand(["bd", "list", "--status=in_progress", "--json"]);
  if (!result) return [];
  return JSON.parse(result);
}
```

### Self-Learning Check

From `workflow-self-learning.md`:
- Record discoveries as Aha Cards after work
- Review open recommendations
- Mark completed recommendations as done

Detection: Look for `self-learning.ts record` or `self-learning.ts list` in transcript.

---

## 5. Transcript Reading

### Reading Full Transcript

```typescript
async function readTranscript(path: string): Promise<string> {
  try {
    const file = Bun.file(path);
    return await file.text();
  } catch {
    return "";
  }
}
```

### Command Detection in Transcript

```typescript
function findCommandsInTranscript(transcript: string, patterns: RegExp[]): string[] {
  const found: string[] = [];
  for (const pattern of patterns) {
    const matches = transcript.match(pattern);
    if (matches) found.push(...matches);
  }
  return found;
}

// Example usage
const syncCommands = findCommandsInTranscript(transcript, [
  /bd sync[^\n]*/g,
  /git push[^\n]*/g,
  /git commit[^\n]*/g
]);
```

---

## 6. Output Format

### Warning (Non-Blocking) Output

```
╔════════════════════════════════════════════════════════════════╗
║              SESSION END CHECK - ITEMS TO VERIFY               ║
╠════════════════════════════════════════════════════════════════╣
║  ✓ bd sync --from-main was run                                 ║
║  ✗ Uncommitted changes detected (3 files)                      ║
║  ✗ git push not found in session                               ║
║  ⚠ 1 item still in_progress: d1w.1 Core Evaluator              ║
║                                                                ║
║  BEFORE ENDING SESSION:                                        ║
║  1. git add <files> && git commit -m "..."                     ║
║  2. git push                                                   ║
║  3. (Optional) bd update d1w.1 --notes "Progress: ..."         ║
╚════════════════════════════════════════════════════════════════╝
```

### Validation Checklist

```typescript
interface SessionEndStatus {
  bdSyncRun: boolean;
  uncommittedChanges: boolean;
  unpushedCommits: boolean;
  itemsInProgress: number;
  selfLearningApplied: boolean;
}
```

---

## 7. Implementation Considerations

### Safe Execution

- **Always exit 0** - Never break session end with hook failure
- **Handle missing files** - Transcript may not exist
- **Graceful degradation** - If git/bd unavailable, skip those checks
- **Timeout handling** - Complete within 15 seconds

### Performance Budget

| Check | Expected Time |
|-------|---------------|
| Read transcript | <100ms |
| git status | <500ms |
| git log | <500ms |
| bd list | <1s |
| **Total** | **<3s** |

### User Experience

- **Don't block** - Session end check is advisory only
- **Be helpful** - Provide exact commands to fix issues
- **Tolerate in-progress** - Some items legitimately span sessions
- **Focus on critical** - Uncommitted work is most important

---

## 8. Files Referenced

| File | Purpose |
|------|---------|
| `.claude/hooks/hooks.json` | Hook registration |
| `.claude/hooks/check-todos-complete.ts` | Example hook pattern |
| `.claude/scripts/status-line.ts` | Bun command execution patterns |
| `.claude/rules/scripting-hooks.md` | Hook standards |
| `CLAUDE.md` | Session Protocol (mandatory) |

---

## 9. Key Insights

1. **Stop hook is available** but not currently used - first Stop hook in project
2. **Transcript is the key** - Contains full session history for command detection
3. **Git checks are fast** - Can run multiple git commands within timeout
4. **Beads state is accessible** - `bd list --status=in_progress` works in hooks
5. **Advisory only** - Don't frustrate users, just remind them
6. **Recovery commands** - Always show exact commands to fix issues
