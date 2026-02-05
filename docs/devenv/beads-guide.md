# Beads Issue Tracking Guide

Beads is a git-native issue tracker designed for AI-assisted development. Issues are stored in your repository and sync automatically with git.

## Why Beads?

- **Persistent context** - Issues survive across sessions and compaction
- **Git-native** - Issues live in your repo, tracked like code
- **AI-friendly** - Designed for Claude to read and update
- **Dependencies** - Track what blocks what
- **No external service** - Works offline, no accounts needed

## Quick Start

### Initialize in Your Project

```bash
cd your-project
bd init --prefix proj --quiet
```

This creates `.beads/` with your issue database.

### Create Your First Issue

```bash
bd create --title="Add user authentication" --type=feature --priority=2
```

### See What to Work On

```bash
bd ready
```

## Issue Types

| Type | Use For |
|------|---------|
| `epic` | Large initiatives with multiple features |
| `feature` | User-facing functionality |
| `task` | Implementation work, research, refactoring |
| `bug` | Defects and fixes |

## Priority Scale

| Priority | Meaning | When to Use |
|----------|---------|-------------|
| 0 (P0) | Critical | Blocking all work |
| 1 (P1) | High | Must do this session |
| 2 (P2) | Medium | Normal priority (default) |
| 3 (P3) | Low | Nice to have |
| 4 (P4) | Backlog | Future consideration |

## Working with Issues

### Viewing Issues

```bash
# Ready to work (no blockers)
bd ready

# All open issues
bd list --status=open

# Your active work
bd list --status=in_progress

# Issue details
bd show proj-001
```

### Creating Issues

```bash
# Simple task
bd create --title="Write unit tests" --type=task --priority=2

# Bug with high priority
bd create --title="Login fails on mobile" --type=bug --priority=1

# Task under a parent feature
bd create --title="Add validation" --type=task --parent=proj-005
```

### Updating Issues

```bash
# Start working
bd update proj-001 --status=in_progress

# Add notes (appends to existing)
bd update proj-001 --notes="Root cause identified"

# Change priority
bd update proj-001 --priority=1
```

### Closing Issues

```bash
# Simple close
bd close proj-001

# Close with reason
bd close proj-001 --reason="Implemented with full test coverage"

# Close multiple
bd close proj-001 proj-002 proj-003
```

## Dependencies

Dependencies track blocking relationships - what must be done before something else.

### Add a Dependency

```bash
# proj-002 depends on proj-001 (proj-001 must complete first)
bd dep add proj-002 proj-001
```

### View Blocked Issues

```bash
bd blocked
```

### View What Blocks an Issue

```bash
bd show proj-002
```

Look for the "blocked by" section in the output.

## Hierarchy

Beads supports parent-child relationships:

```
Epic
 └── Feature
      ├── Task
      ├── Task
      └── Bug
```

### Create with Parent

```bash
bd create --title="API integration" --type=task --parent=proj-feat-01
```

### View Children

```bash
bd list --parent=proj-epic-01
```

## Syncing

Beads issues live in git. To collaborate:

### Pull Updates from Main

```bash
bd sync --from-main
```

Run this at the end of each session to get teammate updates.

### Check Sync Status

```bash
bd sync --status
```

## Best Practices

### When to Create Issues

Create a Beads issue when:
- Work spans multiple sessions
- Work has dependencies or blockers
- You discover work while implementing something else
- Context must survive session compaction

Use TodoWrite (not Beads) for:
- Single-session subtasks
- Implementation checklists
- Temporary progress tracking

### Issue Titles

Good titles are:
- **Actionable**: Start with a verb
- **Specific**: Include what and where
- **Concise**: One line, essential info only

| Good | Bad |
|------|-----|
| "Add email validation to signup form" | "Validation" |
| "Fix null reference in UserService.Get" | "Bug fix" |
| "Research OAuth2 providers" | "OAuth stuff" |

### Closing with Context

Include useful details when closing:

```bash
bd close proj-001 --reason="Added email validation

Files created:
- src/validators/email.ts

Files updated:
- src/forms/signup.ts

Tests added:
- tests/validators/email.test.ts"
```

### Session Workflow

**Starting:**
```bash
bd ready                              # Find available work
bd show proj-001                      # Review details
bd update proj-001 --status=in_progress
```

**Ending:**
```bash
bd close proj-001 --reason="..."      # Close completed work
bd sync --from-main                   # Get updates
git add . && git commit               # Commit
```

## Troubleshooting

### Check for Problems

```bash
bd doctor
```

### Fix Sync Issues

```bash
bd sync --import-only
```

### View Statistics

```bash
bd stats
```

Shows open/closed/blocked counts and progress.

## Linking to Azure DevOps

When work has a corresponding Azure DevOps item, add the ID to your description:

```bash
bd create --title="Implement login" --type=task \
  --description="Azure DevOps Task #1234"
```

When closing, reference the Beads ID in Azure DevOps comments:

```html
<p><strong>Beads:</strong> proj-001 (closed)</p>
```
