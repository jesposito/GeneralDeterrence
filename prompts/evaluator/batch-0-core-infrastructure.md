# Batch 0: Core Evaluator Infrastructure

## Feature
**Beads ID:** d1w.1
**Title:** Core Evaluator Infrastructure
**Priority:** P1

## Context
Build the foundational components for invoking Claude CLI as an evaluator. This is the core infrastructure that all checkpoints will use.

## Research
See: `docs/research/d1w.1-core-evaluator-infrastructure.md`

## Tasks to Complete

### Task 1: d1w.1.2 - Create evaluator module structure and types
- Create `.claude/hooks/evaluator/` directory
- Create TypeScript interfaces for:
  - `EvaluatorConfig`
  - `EvaluationContext`
  - `EvaluationResult`
  - `HookInput`
- Export from `index.ts`

### Task 2: d1w.1.3 - Implement configuration module
- Create `.claude/hooks/evaluator/config.ts`
- Default config with all checkpoints enabled
- Environment variable overrides (`EVALUATOR_ENABLED`, `EVALUATOR_DEBUG`, `EVALUATOR_MODEL`)
- Export `loadConfig()` function

### Task 3: d1w.1.4 - Implement context gatherer
- Create `.claude/hooks/evaluator/context-gatherer.ts`
- `parseTranscript(path)` - Read JSONL transcript file
- `getRecentMessages(count)` - Extract recent conversation
- `getBeadsState(itemId)` - Get beads item status via `bd show`
- `getGitStatus()` - Get uncommitted/unpushed status
- `getDevOpsState(workItemId)` - Optional, only if beads has DevOps link

### Task 4: d1w.1.5 - Implement prompt builder
- Create `.claude/hooks/evaluator/prompt-builder.ts`
- Load prompt templates from `.claude/hooks/prompts/`
- Inject context variables into templates
- Export `buildPrompt(checkpoint, context)` function

### Task 5: d1w.1.6 - Implement result parser
- Create `.claude/hooks/evaluator/result-parser.ts`
- Parse Claude CLI output
- Extract JSON verdict from response
- Handle malformed responses gracefully
- Return `{ verdict: "pass" | "fail" | "warn", feedback: string, details: object }`

### Task 6: d1w.1.7 - Implement main evaluator orchestrator
- Create `.claude/hooks/evaluator/index.ts`
- `evaluate(checkpoint, hookInput)` main function
- Coordinate: config check → gather context → build prompt → call Claude CLI → parse result
- Timeout handling (default 10s)
- Fail-open on errors

## Deliverables
- `.claude/hooks/evaluator/index.ts`
- `.claude/hooks/evaluator/config.ts`
- `.claude/hooks/evaluator/context-gatherer.ts`
- `.claude/hooks/evaluator/prompt-builder.ts`
- `.claude/hooks/evaluator/result-parser.ts`
- `.claude/hooks/evaluator/types.ts`

## Acceptance Criteria
- [ ] Evaluator can invoke Claude CLI and parse response
- [ ] Context gatherer extracts transcript, beads state, git status
- [ ] Context gatherer includes DevOps state when beads item has link
- [ ] Prompt builder loads templates and injects context
- [ ] Configuration supports enable/disable and env var overrides
- [ ] Fails open on errors/timeouts

## Instructions

1. Set the feature d1w.1 and epic d1w to `in_progress`
2. Work through each task sequentially (d1w.1.2 through d1w.1.7)
3. For each task:
   - Set task to `in_progress`
   - Implement the component
   - Write unit tests where applicable
   - Close the task with completion notes
4. After all tasks complete, close the feature d1w.1

## Session Protocol
Before ending:
```bash
bd sync --from-main
git add .
git commit -m "Implement core evaluator infrastructure (d1w.1)"
git pull --rebase && git push
```
