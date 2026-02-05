# Batch 3: Session End Checkpoint

## Feature
**Beads ID:** d1w.4
**Title:** Session End Checkpoint
**Priority:** P2
**Depends On:** d1w.1 (Core Evaluator Infrastructure)

## Context
Warn about unsynced beads and uncommitted changes at session end. This is the first Stop hook in the project.

## Research
See: `docs/research/d1w.4-session-end-checkpoint.md`

## Tasks to Complete

### Task 1: d1w.4.2 - Create session end evaluation prompt
- Create `.claude/hooks/prompts/session-end.md`
- Prompt instructs Claude to evaluate session end state
- Should check for:
  - `bd sync --from-main` command in transcript
  - `git push` command in transcript
  - No uncommitted changes (from git status context)
  - Optional: items still in_progress
- Output JSON: `{ "verdict": "pass|warn", "issues": [...], "recoveryCommands": [...] }`

### Task 2: d1w.4.3 - Implement session end checkpoint script
- Create `.claude/hooks/checkpoints/session-end.ts`
- Hook receives HookInput via stdin (Stop event)
- Gather context:
  - Read transcript for sync/push commands
  - Run git status --porcelain
  - Run git log @{u}..HEAD --oneline
  - Optionally: bd list --status=in_progress
- Call evaluator with context
- Output warning message (non-blocking)

### Task 3: d1w.4.4 - Register Stop hook in hooks.json
- Add Stop hook entry to hooks.json
- Use wildcard matcher `"*"`
- Point to `bun run ${CLAUDE_PROJECT_ROOT}/.claude/hooks/checkpoints/session-end.ts`
- Set timeout to 15000ms

## Deliverables
- `.claude/hooks/checkpoints/session-end.ts`
- `.claude/hooks/prompts/session-end.md`
- Updated `.claude/hooks/hooks.json`

## Acceptance Criteria
- [ ] Hook triggers on Stop event
- [ ] Evaluator checks transcript for bd sync command
- [ ] Evaluator checks git status for uncommitted changes
- [ ] Shows warning (non-blocking) with recovery commands

## Instructions

1. Verify d1w.1 (Core Evaluator Infrastructure) is complete
2. Set d1w.4 to `in_progress`
3. Work through each task sequentially (d1w.4.2 through d1w.4.4)
4. For each task:
   - Set task to `in_progress`
   - Implement the component
   - Test the hook manually
   - Close the task with completion notes
5. After all tasks complete, close the feature d1w.4

## Testing

```bash
# Test session end hook
echo '{
  "transcript_path": "/path/to/transcript.jsonl",
  "session_id": "test-123",
  "hook_event_name": "Stop",
  "cwd": "/path/to/repo"
}' | bun run .claude/hooks/checkpoints/session-end.ts
```

## Output Format Example

```
╔════════════════════════════════════════════════════════════════╗
║              SESSION END CHECK - ITEMS TO VERIFY               ║
╠════════════════════════════════════════════════════════════════╣
║  ✓ bd sync --from-main was run                                 ║
║  ✗ Uncommitted changes detected (3 files)                      ║
║  ✗ git push not found in session                               ║
║                                                                ║
║  BEFORE ENDING SESSION:                                        ║
║  1. git add <files> && git commit -m "..."                     ║
║  2. git push                                                   ║
╚════════════════════════════════════════════════════════════════╝
```

## Session Protocol
Before ending:
```bash
bd sync --from-main
git add .
git commit -m "Implement session end checkpoint (d1w.4)"
git pull --rebase && git push
```
