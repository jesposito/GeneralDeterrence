# Batch 4: Configuration and Documentation

## Feature
**Beads ID:** d1w.5
**Title:** Configuration and Documentation
**Priority:** P3
**Depends On:** d1w.2, d1w.3, d1w.4 (All checkpoints)

## Context
Make the system configurable and document usage. This is the final feature that polishes the evaluator system.

## Pre-Requisite
This batch requires creating implementation tasks first since d1w.5 has no child tasks yet.

## Tasks to Create and Complete

### Task 1: Create configuration file support
- Create `.claude/hooks/evaluator/evaluator.config.json` schema
- Support per-checkpoint enable/disable
- Support blocking vs warning mode per checkpoint
- Support custom timeouts per checkpoint

### Task 2: Implement environment variable overrides
- Document all environment variables:
  - `EVALUATOR_ENABLED` - Master switch
  - `EVALUATOR_DEBUG` - Verbose logging
  - `EVALUATOR_MODEL` - Model selection (haiku/sonnet)
  - `EVALUATOR_PREFLIGHT_ENABLED` - Pre-flight toggle
  - `EVALUATOR_PREFLIGHT_BLOCKING` - Pre-flight mode
  - `EVALUATOR_CLOSING_ENABLED` - Closing check toggle
  - `EVALUATOR_SESSION_END_ENABLED` - Session end toggle

### Task 3: Add debug mode with verbose logging
- Log evaluator input/output when `EVALUATOR_DEBUG=true`
- Log timing information
- Log prompt content
- Write logs to `.claude/state/evaluator-debug.log`

### Task 4: Create usage documentation
- Create `.claude/rules/code/evaluator/usage.md`
- Document:
  - How checkpoints work
  - Configuration options
  - Environment variables
  - Troubleshooting
  - Disabling checkpoints

### Task 5: Update CLAUDE.md with evaluator reference
- Add evaluator section to CLAUDE.md
- Reference the configuration documentation
- Note the checkpoint behavior

## Deliverables
- `.claude/hooks/evaluator/evaluator.config.json` (optional config file)
- Updated `.claude/hooks/evaluator/config.ts` (full env var support)
- `.claude/rules/code/evaluator/usage.md`
- Updated `CLAUDE.md`

## Acceptance Criteria
- [ ] Config file supports enable/disable per checkpoint
- [ ] Config supports blocking vs warning mode per checkpoint
- [ ] Environment variables can override config
- [ ] Debug mode logs evaluation details
- [ ] Documentation explains setup and customization

## Instructions

1. Verify d1w.2, d1w.3, d1w.4 are all complete
2. Create implementation tasks under d1w.5 using `bd create`
3. Set d1w.5 to `in_progress`
4. Work through each created task
5. After all tasks complete, close the feature d1w.5
6. Close the epic d1w

## Session Protocol
Before ending:
```bash
bd sync --from-main
git add .
git commit -m "Implement configuration and documentation (d1w.5)"
git pull --rebase && git push
```

## Final Epic Closure

After completing this batch:
1. Verify all features d1w.1 through d1w.5 are closed
2. Verify all acceptance criteria on epic d1w are met
3. Close epic d1w with summary of all completed work
