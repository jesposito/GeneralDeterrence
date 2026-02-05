# Self-Learning Skills Guide

Self-learning skills is a persistent memory system that helps Claude remember discoveries, patterns, and fixes across sessions.

## Why Use It?

Without persistent memory, Claude starts fresh each session:
- Rediscovers the same solutions repeatedly
- Makes the same mistakes
- Loses context after compaction

With self-learning skills, Claude:
- Recalls past solutions before starting work
- Builds on previous discoveries
- Improves over time on your specific codebase

## Quick Start

### Verify Setup

The skill is pre-installed in `.claude/skills/self-learning-skills/`. Storage is in `.agent-skills/` (gitignored).

```bash
# Check if storage exists
ls .agent-skills/self-learning/v1/users/

# If not, initialize
python .claude/skills/self-learning-skills/scripts/self_learning.py init
```

### Review Learnings

```bash
# See recent learnings (last 7 days)
python .claude/skills/self-learning-skills/scripts/self_learning.py review --days 7

# See portable learnings (good for backporting)
python .claude/skills/self-learning-skills/scripts/self_learning.py review --days 30 --scope portable
```

### Find Specific Learnings

```bash
# Search by keyword
python .claude/skills/self-learning-skills/scripts/self_learning.py list --query "authentication"

# Filter by skill
python .claude/skills/self-learning-skills/scripts/self_learning.py list --skill "beads"
```

## How It Works

### Automatic Operation

Claude uses self-learning skills automatically during normal operation:

1. **Before work**: Claude checks `.agent-skills/self-learning/v1/users/<user>/INDEX.md` for relevant past learnings
2. **After work**: Claude records new discoveries as Aha Cards and Recommendations

You don't need to do anything special - just work normally and the memory accumulates.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Aha Cards** | Durable, reusable learnings (fixes, patterns, constraints) |
| **Recommendations** | Actionable suggestions for future improvements |
| **Scope** | `project` (repo-specific) or `portable` (generally reusable) |
| **Backporting** | Graduate proven learnings into permanent docs/skills |

### Storage Structure

```
.agent-skills/
└── self-learning/
    └── v1/
        └── users/
            └── <user>/
                ├── INDEX.md           # Human-readable dashboard
                ├── aha_cards.jsonl    # Recorded learnings
                ├── recommendations.jsonl
                └── backports.jsonl    # Graduation history
```

## Commands Reference

All commands run from the repository root. Use `python` (not `python3`) for Windows compatibility.

### Initialize Storage

```bash
python .claude/skills/self-learning-skills/scripts/self_learning.py init
```

Creates the storage directory and adds `.agent-skills/` to `.gitignore`.

### Review Learnings

```bash
# Basic review (last 7 days)
python .claude/skills/self-learning-skills/scripts/self_learning.py review --days 7

# Portable learnings only
python .claude/skills/self-learning-skills/scripts/self_learning.py review --scope portable --days 30

# JSON output
python .claude/skills/self-learning-skills/scripts/self_learning.py review --days 7 --format json

# Filter by skill
python .claude/skills/self-learning-skills/scripts/self_learning.py review --skill "beads" --days 30
```

### Search Learnings

```bash
# Search by keyword
python .claude/skills/self-learning-skills/scripts/self_learning.py list --query "pagination"

# Search with filters
python .claude/skills/self-learning-skills/scripts/self_learning.py list --query "auth" --skill "security"
```

### Record Learnings (Manual)

Usually Claude records learnings automatically. For manual recording:

```bash
python .claude/skills/self-learning-skills/scripts/self_learning.py record --json payload.json
```

Payload format: See `.claude/skills/self-learning-skills/references/FORMAT.md`

### Update Recommendation Status

```bash
# Mark as in progress
python .claude/skills/self-learning-skills/scripts/self_learning.py rec-status \
  --id rec_123 \
  --status in_progress \
  --note "Working on this"

# Mark as done and portable
python .claude/skills/self-learning-skills/scripts/self_learning.py rec-status \
  --id rec_123 \
  --status done \
  --scope portable \
  --note "Generalized for reuse"
```

### Repair/Normalize Storage

```bash
# Dry run
python .claude/skills/self-learning-skills/scripts/self_learning.py repair

# Apply fixes
python .claude/skills/self-learning-skills/scripts/self_learning.py repair --apply
```

## Backporting Workflow

Backporting "graduates" a proven learning into permanent documentation or skills.

### 1. Identify Candidates

```bash
# Review portable learnings (backport candidates)
python .claude/skills/self-learning-skills/scripts/self_learning.py review --scope portable --days 30
```

### 2. Preview Backport

```bash
# Generate bundle with diff (no changes)
python .claude/skills/self-learning-skills/scripts/self_learning.py export-backport \
  --skill-path .claude/skills/my-skill \
  --ids aha_123,aha_456 \
  --make-diff
```

### 3. Apply Backport

```bash
# Apply changes
python .claude/skills/self-learning-skills/scripts/self_learning.py export-backport \
  --skill-path .claude/skills/my-skill \
  --ids aha_123,aha_456 \
  --apply
```

### 4. Inspect Markers

```bash
# See existing backport markers in a skill
python .claude/skills/self-learning-skills/scripts/self_learning.py backport-inspect \
  --skill-path .claude/skills/my-skill
```

## Scoping: Project vs Portable

Each Aha Card can have a scope:

| Scope | Meaning | Backport? |
|-------|---------|-----------|
| `project` | Specific to this repo | No - stays local |
| `portable` | Generally reusable | Yes - candidate for graduation |

### Writing Portable Learnings

When creating portable learnings:
- Replace repo-specific values with placeholders (`<repo-root>`, `<SERVICE>`, `<PROJECT_KEY>`)
- Prefer patterns/templates over raw examples
- Avoid absolute paths
- Never include secrets

## Best Practices

### Let Claude Do It

Self-learning works best when you let Claude manage it:
- Don't micromanage what gets recorded
- Review periodically with `review --days 30`
- Backport the good stuff to permanent docs

### Review Regularly

```bash
# Weekly review
python .claude/skills/self-learning-skills/scripts/self_learning.py review --days 7

# Monthly review for backport candidates
python .claude/skills/self-learning-skills/scripts/self_learning.py review --scope portable --days 30
```

### Keep INDEX.md Readable

The `INDEX.md` file is what Claude reads at the start of each task. If it gets cluttered:

```bash
# Repair and normalize
python .claude/skills/self-learning-skills/scripts/self_learning.py repair --apply
```

### Backport Proven Patterns

When you see the same learning applied 3+ times:
1. Mark it as `scope: portable`
2. Backport it to a permanent skill or documentation
3. This keeps the memory store lean and the real docs complete

## Troubleshooting

### No Learnings Found

```bash
# Check if storage exists
ls -la .agent-skills/

# Initialize if missing
python .claude/skills/self-learning-skills/scripts/self_learning.py init
```

### Storage Too Large

The JSONL files are append-only. If they get too large:
1. Backport valuable learnings to permanent docs
2. Archive old files manually
3. Re-initialize with `init`

### Python Not Found

Use `python` instead of `python3` on Windows. The script works with Python 3.8+.

## Reference Files

| File | Purpose |
|------|---------|
| `.claude/skills/self-learning-skills/SKILL.md` | Instructions for Claude |
| `.claude/skills/self-learning-skills/AGENTS.md` | Policy configuration |
| `.claude/skills/self-learning-skills/README.md` | Full technical documentation |
| `.claude/skills/self-learning-skills/references/FORMAT.md` | Payload format specification |
| `.claude/skills/self-learning-skills/references/RUBRIC.md` | Quality rubric for learnings |
| `.claude/skills/self-learning-skills/references/PORTABILITY.md` | Scoping and graduation guide |
