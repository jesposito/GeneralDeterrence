# Claude CLI Evaluator Usage

## Overview

The Claude CLI Evaluator enforces rule adherence at key checkpoints during development. It uses Claude CLI as a semantic evaluator to check that workflows are being followed correctly.

## Checkpoints

| Checkpoint | When | Default Mode | Purpose |
|------------|------|--------------|---------|
| `preFlight` | Before code editing | Blocking | Ensures pre-flight checklist is completed |
| `closingCheck` | When closing beads items | Warning | Validates completion notes are adequate |
| `sessionEnd` | On session stop | Warning | Checks for unsynced beads/uncommitted code |

### Pre-Flight Checkpoint

**Trigger:** PreToolUse hook on Edit/Write tools

**What it checks:**
- Pre-flight checklist acknowledgment stated
- Beads item set to `in_progress`
- Parent feature/epic also `in_progress`
- Acceptance criteria identified

**Mode:** Blocking (prevents code writing until acknowledged)

### Closing Check Checkpoint

**Trigger:** PostToolUse hook when `bd close` is detected

**What it checks:**
- Summary of work completed
- Files created/updated listed
- Tests mentioned
- Acceptance criteria addressed

**Mode:** Warning (advises but doesn't block)

### Session End Checkpoint

**Trigger:** Stop hook

**What it checks:**
- `bd sync --from-main` was run
- No uncommitted changes
- Changes pushed to remote

**Mode:** Warning (provides recovery commands)

## Configuration

### Configuration File

Create `.claude/hooks/evaluator/evaluator.config.json`:

```json
{
  "$schema": "./evaluator.config.schema.json",
  "enabled": true,
  "model": "haiku",
  "timeoutMs": 10000,
  "debug": false,
  "checkpoints": {
    "preFlight": {
      "enabled": true,
      "blocking": true
    },
    "closingCheck": {
      "enabled": true,
      "blocking": false
    },
    "sessionEnd": {
      "enabled": true,
      "blocking": false
    }
  }
}
```

Copy from `evaluator.config.example.json` as a starting point.

### Environment Variables

Environment variables override config file settings:

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `EVALUATOR_ENABLED` | `true`/`false` | `true` | Global enable/disable |
| `EVALUATOR_DEBUG` | `true`/`false` | `false` | Enable debug logging |
| `EVALUATOR_MODEL` | `haiku`/`sonnet` | `haiku` | Model for evaluation |
| `EVALUATOR_TIMEOUT_MS` | number | `10000` | Timeout in milliseconds |
| `EVALUATOR_PREFLIGHT_ENABLED` | `true`/`false` | `true` | Pre-flight checkpoint |
| `EVALUATOR_PREFLIGHT_BLOCKING` | `true`/`false` | `true` | Block on pre-flight failure |
| `EVALUATOR_CLOSING_ENABLED` | `true`/`false` | `true` | Closing check checkpoint |
| `EVALUATOR_CLOSING_BLOCKING` | `true`/`false` | `false` | Block on closing check failure |
| `EVALUATOR_SESSION_ENABLED` | `true`/`false` | `true` | Session end checkpoint |
| `EVALUATOR_SESSION_BLOCKING` | `true`/`false` | `false` | Block on session end failure |

### Priority Order

1. Environment variables (highest)
2. Config file (`evaluator.config.json`)
3. Default values (lowest)

## Disabling Checkpoints

### Disable All Checkpoints

```bash
export EVALUATOR_ENABLED=false
```

Or in config file:
```json
{ "enabled": false }
```

### Disable Specific Checkpoint

```bash
export EVALUATOR_PREFLIGHT_ENABLED=false
```

Or in config file:
```json
{
  "checkpoints": {
    "preFlight": { "enabled": false }
  }
}
```

### Change Mode from Blocking to Warning

```bash
export EVALUATOR_PREFLIGHT_BLOCKING=false
```

Or in config file:
```json
{
  "checkpoints": {
    "preFlight": { "blocking": false }
  }
}
```

## Debug Mode

Enable debug logging to see evaluation details:

```bash
export EVALUATOR_DEBUG=true
```

Debug logs are written to:
- `.claude/state/evaluator-debug.log` (persistent file)
- `stderr` (immediate visibility)

Debug output includes:
- Timing for each evaluation phase
- Context gathered (beads state, git status)
- Prompt content (first 500 chars)
- Raw Claude CLI response

## Troubleshooting

### Evaluation is too slow

- Ensure `EVALUATOR_MODEL=haiku` (default, ~2-3s latency)
- Sonnet is more capable but slower (~5-8s)

### Checkpoint blocked incorrectly

1. Enable debug mode: `EVALUATOR_DEBUG=true`
2. Check the log: `.claude/state/evaluator-debug.log`
3. Look for the verdict and violations
4. If false positive, temporarily disable: `EVALUATOR_PREFLIGHT_ENABLED=false`

### Evaluation keeps timing out

- Default timeout is 10 seconds
- Increase with: `EVALUATOR_TIMEOUT_MS=20000`
- System fails open on timeout (allows action)

### Claude CLI not found

The evaluator calls `claude --print --model <model>`. Ensure:
- Claude CLI is installed
- It's in your PATH
- You're authenticated with valid credentials

### Config file not loading

1. Check file exists: `.claude/hooks/evaluator/evaluator.config.json`
2. Validate JSON syntax
3. Check against schema: `evaluator.config.schema.json`
4. Enable debug to see if file is being read

## Fail-Open Behavior

The evaluator is designed to fail open (allow actions) in case of errors:

- Timeout → Pass
- Claude CLI error → Pass
- JSON parse error → Pass
- Config file missing → Use defaults
- Any unexpected error → Pass

This ensures the evaluator never blocks work due to infrastructure issues.

## Architecture

```
Hook Event
    │
    ▼
Checkpoint Hook (e.g., pre-flight.ts)
    │
    ▼
Evaluator Module (.claude/hooks/evaluator/)
    │
    ├─► Load Config (config.ts)
    ├─► Gather Context (context-gatherer.ts)
    ├─► Build Prompt (prompt-builder.ts)
    ├─► Call Claude CLI (index.ts)
    └─► Parse Result (result-parser.ts)
    │
    ▼
Decision: Pass / Warn / Block
```
