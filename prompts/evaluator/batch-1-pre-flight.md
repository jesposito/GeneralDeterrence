# Batch 1: Pre-Flight Checkpoint

## Feature
**Beads ID:** d1w.2
**Title:** Pre-Flight Checkpoint
**Priority:** P1
**Depends On:** d1w.1 (Core Evaluator Infrastructure)

## Context
Enforce the pre-flight checklist before any code-modifying operations. This checkpoint blocks Edit/Write tools until the agent has acknowledged completing the pre-flight checklist.

## Research
See: `docs/research/d1w.2-pre-flight-checkpoint.md`

## Tasks to Complete

### Task 1: d1w.2.2 - Create pre-flight evaluation prompt
- Create `.claude/hooks/prompts/pre-flight.md`
- Prompt instructs Claude to evaluate if pre-flight acknowledgment exists
- Should check for:
  - "Pre-flight checklist complete:" marker
  - "Ready to begin implementation." end marker
  - Status confirmation (in_progress)
- Output JSON: `{ "verdict": "pass|fail", "missing": [...], "feedback": "..." }`

### Task 2: d1w.2.3 - Implement pre-flight checkpoint script
- Create `.claude/hooks/checkpoints/pre-flight.ts`
- Hook receives HookInput via stdin
- Check session state first (fast path)
- If not acknowledged, call evaluator
- Output PreToolUse blocking format:
  ```json
  {
    "hookSpecificOutput": {
      "decision": { "behavior": "block" },
      "message": "Pre-flight checklist not complete..."
    }
  }
  ```
- On pass, output allow decision with confirmation message

### Task 3: d1w.2.4 - Add session state tracking
- Create `.claude/state/` directory structure
- Implement `checkpoint-state.json` for tracking acknowledged tasks
- Functions: `getState()`, `setState()`, `isAcknowledged(taskId)`
- Add to `.gitignore`

### Task 4: d1w.2.5 - Register pre-flight hooks in hooks.json
- Add PreToolUse hooks for:
  - `Edit` matcher
  - `Write` matcher
- Point to `bun run ${CLAUDE_PROJECT_ROOT}/.claude/hooks/checkpoints/pre-flight.ts`
- Set timeout to 15000ms

### Task 5: d1w.2.6 - Add .gitignore for state directory
- Add `.claude/state/` to `.gitignore`
- Ensure checkpoint state doesn't get committed

## Deliverables
- `.claude/hooks/checkpoints/pre-flight.ts`
- `.claude/hooks/prompts/pre-flight.md`
- `.claude/state/.gitkeep`
- Updated `.claude/hooks/hooks.json`
- Updated `.gitignore`

## Acceptance Criteria
- [ ] Hook triggers on first Edit/Write in a task
- [ ] Evaluator checks for pre-flight acknowledgment in transcript
- [ ] Evaluator verifies beads statuses are in_progress
- [ ] Blocks tool execution if checklist not complete
- [ ] Shows actionable feedback on what's missing

## Instructions

1. Verify d1w.1 (Core Evaluator Infrastructure) is complete
2. Set d1w.2 to `in_progress`
3. Work through each task sequentially (d1w.2.2 through d1w.2.6)
4. For each task:
   - Set task to `in_progress`
   - Implement the component
   - Test manually with echo piped to hook
   - Close the task with completion notes
5. After all tasks complete, close the feature d1w.2

## Testing

```bash
# Test blocking (no acknowledgment)
echo '{
  "transcript_path": "/tmp/empty.jsonl",
  "tool_name": "Edit",
  "tool_input": { "file_path": "src/file.ts" },
  "session_id": "test-123",
  "hook_event_name": "PreToolUse"
}' | bun run .claude/hooks/checkpoints/pre-flight.ts
```

## Session Protocol
Before ending:
```bash
bd sync --from-main
git add .
git commit -m "Implement pre-flight checkpoint (d1w.2)"
git pull --rebase && git push
```
