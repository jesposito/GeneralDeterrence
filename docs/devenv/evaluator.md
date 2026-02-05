# Rule Adherence Evaluator

The Rule Adherence Evaluator automatically enforces workflow rules at key checkpoints during development. It uses Claude CLI to semantically evaluate whether you're following the established workflows.

## Why It Exists

Agents often skip workflow steps despite documented rules:
- Starting code without completing pre-flight checklists
- Closing items without proper completion notes
- Ending sessions without syncing beads or pushing code

The evaluator catches these issues automatically.

## Checkpoints

### Pre-Flight Checkpoint

**When:** Before any Edit or Write operation

**What it checks:**
- Pre-flight checklist acknowledgment is stated
- Beads item is set to `in_progress`
- Parent feature/epic are also `in_progress`

**Behavior:** Blocks code writing until requirements are met

**Example block message:**
```
✗ PRE-FLIGHT CHECKPOINT NOT COMPLETE

You must complete the pre-flight checklist before writing any code.

REQUIRED: State the following before proceeding:

"Pre-flight checklist complete:
- Plan confirmed: [yes/no - how]
- Beads tasks: [list task IDs]
- Status: [feature], [epic], [task] all in_progress
Ready to begin implementation."
```

### Closing Check Checkpoint

**When:** When all TodoWrite items are marked complete

**What it checks:**
- Summary of work completed
- Files created/updated listed
- Tests mentioned
- Acceptance criteria addressed

**Behavior:** Warning only (advises but doesn't block)

### Session End Checkpoint

**When:** On session stop

**What it checks:**
- `bd sync --from-main` was run
- No uncommitted changes
- Changes pushed to remote

**Behavior:** Warning with recovery commands

**Example warning:**
```
╔══════════════════════════════════════════════════════════════════╗
║               SESSION END CHECK - ITEMS TO VERIFY                ║
╠══════════════════════════════════════════════════════════════════╣
║  ✓ bd sync --from-main was run                                   ║
║  ✗ Uncommitted changes detected (3 files)                        ║
║  ✗ git push not found in session                                 ║
║                                                                  ║
║  BEFORE ENDING SESSION:                                          ║
║  1. git add <files> && git commit -m "..."                       ║
║  2. git push                                                     ║
╚══════════════════════════════════════════════════════════════════╝
```

## Quick Disable

If you need to bypass the evaluator temporarily:

```bash
# Disable all checkpoints
export EVALUATOR_ENABLED=false

# Disable just pre-flight (most common)
export EVALUATOR_PREFLIGHT_ENABLED=false

# Change pre-flight from blocking to warning
export EVALUATOR_PREFLIGHT_BLOCKING=false
```

## Configuration

For full configuration options including config files, debug mode, and troubleshooting, see the detailed documentation:

→ [Evaluator Configuration](../../.claude/rules/code/evaluator/usage.md)

## How It Works

```
Hook Event (Edit/Write/Stop)
    │
    ▼
Checkpoint Script (.claude/hooks/checkpoints/)
    │
    ▼
Evaluator Module
    │
    ├─► Gather Context (transcript, beads state, git status)
    ├─► Build Evaluation Prompt
    ├─► Call Claude CLI (haiku model, ~2-3s)
    └─► Parse Result
    │
    ▼
Decision: Pass / Warn / Block
```

## Fail-Open Design

The evaluator is designed to never block work due to infrastructure issues:

- Timeout → Pass (allows action)
- Claude CLI error → Pass
- Config file missing → Use defaults
- Any unexpected error → Pass

This ensures the evaluator helps without getting in the way.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Evaluation too slow | Ensure `EVALUATOR_MODEL=haiku` (default) |
| False positive block | `EVALUATOR_PREFLIGHT_ENABLED=false` |
| Keeps timing out | `EVALUATOR_TIMEOUT_MS=20000` |
| Need more details | `EVALUATOR_DEBUG=true` |

Debug logs are written to `.claude/state/evaluator-debug.log`.
