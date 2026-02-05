# Commands Reference

Quick reference for all slash commands and Beads CLI commands.

## Slash Commands

### Planning

| Command | Description |
|---------|-------------|
| `/plan-new` | Start a new planning workflow (Master Plan or Feature Plan) |

### Git Operations

| Command | Description |
|---------|-------------|
| `/commit` | Create a git commit with AI-generated message |
| `/commit-push-pr` | Commit, push, and create a pull request |
| `/clean_gone` | Remove local branches deleted on remote |

### Code Review

| Command | Description |
|---------|-------------|
| `/code-review` | Comprehensive PR review |
| `/plannotator-review` | Interactive code review with orchestration |

### Issue Tracking

| Command | Description |
|---------|-------------|
| `/beads` | Show full Beads workflow guide |
| `/ready` | Show issues ready to work (no blockers) |
| `/blocked` | Show blocked issues |
| `/stats` | Show project statistics |
| `/show <id>` | Show details for a specific issue |
| `/search <query>` | Search issues by text |

## Beads CLI Commands

### Finding Work

```bash
# Issues ready to work (no blockers)
bd ready

# All open issues
bd list --status=open

# Issues you're working on
bd list --status=in_progress

# View issue details
bd show <id>
```

### Creating Issues

```bash
# Create a task
bd create --title="Fix login bug" --type=task --priority=2

# Create a bug
bd create --title="Null reference in UserService" --type=bug --priority=1

# Create under a parent
bd create --title="Add validation" --type=task --parent=feat-001
```

**Types:** `task`, `bug`, `feature`, `epic`

**Priority:** 0 (critical) to 4 (backlog), default is 2

### Working on Issues

```bash
# Start work
bd update <id> --status=in_progress

# Add notes
bd update <id> --notes="Found the root cause"

# Close when done
bd close <id>

# Close with reason
bd close <id> --reason="Implemented with tests"

# Close multiple at once
bd close <id1> <id2> <id3>
```

### Dependencies

```bash
# Add dependency (issue depends on blocker)
bd dep add <issue> <blocker>

# View blocked issues
bd blocked

# Remove dependency
bd dep remove <issue> <blocker>
```

### Syncing

```bash
# Pull updates from main branch
bd sync --from-main

# Check sync status
bd sync --status
```

### Diagnostics

```bash
# Check for problems
bd doctor

# Project statistics
bd stats
```

## Common Patterns

### Start a New Session

```bash
bd ready                              # What's available?
bd show <id>                          # Review details
bd update <id> --status=in_progress   # Claim it
```

### End a Session

```bash
bd close <id1> <id2>                  # Close completed work
bd sync --from-main                   # Pull beads updates
git add . && git commit -m "..."      # Commit changes
```

### Track Discovered Work

```bash
# Found a bug while implementing something else
bd create --title="Fix null check" --type=bug --priority=1

# It blocks your current work
bd dep add <current-task> <bug-id>
```

## Azure DevOps Integration

When linked to Azure DevOps, use PowerShell on Windows:

```bash
# Query your tasks
pwsh -Command "az boards query --wiql \"SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.AssignedTo] = 'you@company.com' AND [System.WorkItemType] = 'Task'\" --output table"

# Update a work item
pwsh -Command "az boards work-item update --id 123 --state Active"
```

See the [Azure DevOps rules](../.claude/rules/tracking-azure-devops.md) for detailed integration docs.
