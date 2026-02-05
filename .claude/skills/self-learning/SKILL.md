---
name: self-learning
description: "Persistent memory system for capturing learnings, patterns, and recommendations that survive conversation compaction."
---

# Self-Learning Skill

A persistent memory system that captures discoveries during work and recalls them before similar tasks. Learnings persist across sessions and survive conversation compaction.

## Overview

The self-learning skill provides:

1. **Aha Cards** - Durable, reusable learnings from work sessions
2. **Recommendations** - Actionable improvement suggestions
3. **Usage Tracking** - Know which learnings have been applied
4. **Backporting** - Promote portable learnings to skill documentation

## Directory Structure

```
.agent-skills/self-learning/v1/users/<user>/  # Storage root
  aha_cards.jsonl                              # Aha card storage
  recommendations.jsonl                        # Recommendation storage
  signals.jsonl                                # Usage signals
  events.jsonl                                 # Event log
  INDEX.md                                     # Human-readable dashboard

.claude/skills/self-learning/                  # Skill implementation
  SKILL.md                                     # This file
  scripts/
    self-learning.ts                           # CLI entry point
  commands/
    record.ts                                  # Record new learnings
    list.ts                                    # Search learnings
    review.ts                                  # Review recent learnings
    use.ts                                     # Mark learnings as used
    promote.ts                                 # Promote to global scope
    export-backport.ts                         # Export for backporting
  lib/
    store.ts                                   # Storage operations
    validation.ts                              # Input validation
```

## Commands

| Command | Description |
|---------|-------------|
| `/self-learning` | Show INDEX.md dashboard |
| `/self-learning list` | Search learnings by keyword |
| `/self-learning record` | Record new aha cards or recommendations |
| `/self-learning review` | Review recent learnings |
| `/self-learning use` | Mark learnings as used |

## CLI Usage

All commands are run via Bun:

```bash
# View the dashboard
cat .agent-skills/self-learning/v1/users/<user>/INDEX.md

# Search by keyword
bun run .claude/skills/self-learning/scripts/self-learning.ts list --query "beads sync"

# Record from JSON payload
bun run .claude/skills/self-learning/scripts/self-learning.ts record --json payload.json

# Review recent learnings
bun run .claude/skills/self-learning/scripts/self-learning.ts review --days 7

# Mark as used
bun run .claude/skills/self-learning/scripts/self-learning.ts use --aha aha_123,aha_456
```

## Workflow

### Pre-Work: Recall

Before starting non-trivial work:

1. Check INDEX.md for relevant learnings
2. Search with `list --query` if needed
3. Summarize 3-7 actionable bullets for current task

### Post-Work: Record

After completing work with discoveries:

1. Create JSON payload with aha cards and/or recommendations
2. Run `record --json payload.json`
3. Mark any used learnings with `use --aha`

## Aha Card Schema

```json
{
  "title": "Clear, specific title",
  "primary_skill": "beads",
  "scope": "project",
  "summary": "What was learned",
  "steps": ["Step 1", "Step 2"],
  "tags": ["sync", "workflow"]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Clear, specific title |
| `primary_skill` | Yes | Skill this relates to (use `unknown` if unsure) |
| `scope` | Yes | `project` (repo-specific) or `portable` (reusable) |
| `summary` | Yes | What was learned |
| `steps` | No | Step-by-step procedure |
| `tags` | No | Searchable tags |

## Recommendation Schema

```json
{
  "title": "What to improve",
  "primary_skill": "beads",
  "scope": "project",
  "description": "Why and how to improve it"
}
```

## Scoping

| Scope | Meaning | Backport? |
|-------|---------|-----------|
| `project` | Specific to this repo | No |
| `portable` | Generally reusable | Yes |

**Writing portable learnings:**
- Replace repo-specific values with placeholders (`<repo-root>`, `<SERVICE>`)
- Prefer patterns over raw examples
- Avoid absolute paths
- Never include secrets

## Backporting

Promote portable learnings to skill documentation:

```bash
# Promote to global scope
bun run .claude/skills/self-learning/scripts/self-learning.ts promote <aha-id>

# Preview backport
bun run .claude/skills/self-learning/scripts/self-learning.ts export-backport \
  --skill-path .claude/skills/beads --make-diff

# Apply backport
bun run .claude/skills/self-learning/scripts/self-learning.ts export-backport \
  --skill-path .claude/skills/beads --ids aha_123 --apply
```

## What to Record

### Good Aha Cards

| Type | Example |
|------|---------|
| Bug fix | "Beads sync fails if config.yaml has wrong repo ID - run `bd migrate --update-repo-id`" |
| Pattern | "Azure DevOps comments must use HTML not Markdown" |
| Constraint | "bd edit opens $EDITOR which blocks agents - use `bd update --notes` instead" |
| Command | "Check beads health with `bd doctor` before debugging sync issues" |

### Not Worth Recording

- Obvious things (basic git commands, how to run tests)
- One-off fixes unlikely to recur
- Information already in official docs
- Secrets or sensitive data

## Error Handling

| Error | Resolution |
|-------|------------|
| Storage directory missing | Run `init` command to create structure |
| Invalid JSON payload | Check against schema above |
| ID not found | Use `list` to find correct ID |
| Permission denied | Check file permissions on .agent-skills/ |

## Integration with Rules

The workflow rules at `.claude/rules/workflow-self-learning.md` document when and how to use this skill during work sessions.
