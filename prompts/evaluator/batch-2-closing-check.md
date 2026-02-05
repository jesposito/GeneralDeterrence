# Batch 2: Closing Check Checkpoint

## Feature
**Beads ID:** d1w.3
**Title:** Closing Check Checkpoint
**Priority:** P2
**Depends On:** d1w.1 (Core Evaluator Infrastructure)

## Context
Verify completion notes and acceptance criteria when todos complete. This checkpoint warns (non-blocking) when closing documentation is incomplete.

## Research
See: `docs/research/d1w.3-closing-check-checkpoint.md`

## Tasks to Complete

### Task 1: d1w.3.2 - Create closing check evaluation prompt
- Create `.claude/hooks/prompts/closing-check.md`
- Prompt instructs Claude to evaluate closing documentation
- Should check for:
  - Summary section with what was implemented
  - Files section listing created/updated/removed
  - Tests section listing test files
  - Acceptance criteria discussion
  - Azure DevOps sync (if item has DevOps link)
- Output JSON: `{ "verdict": "pass|warn", "missing": [...], "suggestions": [...] }`

### Task 2: d1w.3.3 - Extend check-todos-complete.ts with evaluator
- Modify `.claude/hooks/check-todos-complete.ts`
- After existing checklist output, call evaluator
- Import evaluator from `./evaluator`
- Build context from transcript and recent messages
- Append evaluator feedback to output
- Keep existing checklist structure

### Task 3: d1w.3.4 - Implement DevOps link detection
- Add to context gatherer: `detectDevOpsLink(beadsItem)`
- Parse description for "Azure DevOps Task #<id>" or "Azure DevOps Story #<id>"
- If linked, include DevOps state in context
- Add to closing check: verify DevOps sync commands in transcript

## Deliverables
- `.claude/hooks/prompts/closing-check.md`
- Updated `.claude/hooks/check-todos-complete.ts`
- Updated `.claude/hooks/evaluator/context-gatherer.ts` (DevOps detection)

## Acceptance Criteria
- [ ] Hook triggers when all TodoWrite items are complete
- [ ] Evaluator checks for completion note structure in recent messages
- [ ] Evaluator verifies acceptance criteria discussion
- [ ] Shows warning (non-blocking) with guidance on what's missing

## Instructions

1. Verify d1w.1 (Core Evaluator Infrastructure) is complete
2. Set d1w.3 to `in_progress`
3. Work through each task sequentially (d1w.3.2 through d1w.3.4)
4. For each task:
   - Set task to `in_progress`
   - Implement the component
   - Test the integration
   - Close the task with completion notes
5. After all tasks complete, close the feature d1w.3

## Testing

```bash
# Test with completed todos
echo '{
  "tool_input": {
    "todos": [
      {"content": "Task 1", "status": "completed"},
      {"content": "Task 2", "status": "completed"}
    ]
  },
  "transcript_path": "/path/to/transcript.jsonl",
  "session_id": "test-123",
  "hook_event_name": "PostToolUse"
}' | bun run .claude/hooks/check-todos-complete.ts
```

## Session Protocol
Before ending:
```bash
bd sync --from-main
git add .
git commit -m "Implement closing check checkpoint (d1w.3)"
git pull --rebase && git push
```
