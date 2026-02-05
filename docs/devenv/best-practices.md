# Best Practices

Tips for getting the most out of the Claude Code Development Environment.

## Planning

### Start with `/plan-new`

For non-trivial work, always start with planning:

```
/plan-new
```

**Master Plan** when:
- Starting new major functionality
- Work spans multiple features
- Need to define scope and acceptance criteria

**Feature Plan** when:
- Implementing a specific feature
- Breaking down work into tasks
- Feature already exists from a Master Plan

### Research Before Planning

For complex features, complete the research task first:

```bash
bd show feat-001              # View feature
bd list --parent=feat-001     # Find research task
bd update research-001 --status=in_progress
```

Research helps identify:
- Files that need changes
- Existing patterns to follow
- Technical constraints
- Libraries or tools to use

## Implementation

### Small, Frequent Commits

Commit after each logical unit:
- Implemented a function? Commit.
- Added tests? Commit.
- Fixed a bug? Commit.

Use `/commit` for AI-assisted messages.

### Test as You Go

Write tests alongside code, not after. The environment enforces:
- Tests for new functionality
- Tests that verify business logic (not just existence)
- All tests passing before close

### Track Discovered Work

Found something while implementing? Create an issue:

```bash
# Found a bug
bd create --title="Fix null check in validate()" --type=bug --priority=1

# If it blocks current work
bd dep add current-task bug-id
```

Don't scope creep - track it and decide priority separately.

## Session Management

### Start Clean

Begin each session by checking available work:

```bash
bd ready                    # What's ready?
bd list --status=in_progress # What's in progress?
```

### End Clean

Always end sessions properly:

```bash
# 1. Close completed work
bd close item-001 item-002

# 2. Sync beads from main
bd sync --from-main

# 3. Commit and push
git add .
git commit -m "Complete user validation"
git push
```

### Partial Completion

If work isn't done, document progress:

```bash
bd update item-001 --notes="Completed validation logic
Remaining: Add tests, update controller
Files changed: src/services/UserService.ts"
```

Keep status as `in_progress` for next session.

## Code Quality

### Follow Existing Patterns

Before writing new code:
1. Find similar code in the codebase
2. Match naming conventions
3. Follow established architecture
4. Use existing utilities

### Keep Changes Focused

- Only change what's needed
- Don't refactor unrelated code
- Don't add "improvements" beyond scope
- One concern per commit

### C# Style (If Using C#)

The `.editorconfig` enforces modern C# 14:

```csharp
// File-scoped namespaces
namespace MyApp.Services;

// Pattern matching
if (user is not null) { }

// Null operators
var name = user?.Name ?? "Unknown";

// var when type is obvious
var service = new UserService();
```

## Azure DevOps Integration

### HTML, Not Markdown

Comments must use HTML:

```html
<h3>Work Completed</h3>
<p>Implemented user validation</p>
<ul>
<li>Added schema validation</li>
<li>Updated UserService</li>
</ul>
```

Never use markdown syntax like `**bold**` or `- lists`.

### Keep Systems in Sync

| Beads | Azure DevOps |
|-------|--------------|
| `open` | New |
| `in_progress` | Active |
| `closed` | Closed |

When updating one, update the other.

### Link Both Ways

Beads issue:
```bash
bd create --title="Task" --description="Azure DevOps Task #123"
```

Azure DevOps comment:
```html
<p><strong>Beads:</strong> proj-001 (closed)</p>
```

## Common Mistakes

### Planning

| Mistake | Better |
|---------|--------|
| Skipping planning for "simple" tasks | Quick plan still helps |
| Starting implementation before approval | Wait for ExitPlanMode |
| Not asking about Azure DevOps links | Always check for existing items |

### Implementation

| Mistake | Better |
|---------|--------|
| Giant commits at the end | Commit after each logical unit |
| Tests that just check existence | Test actual business logic |
| Scope creep | Create new issues for discovered work |
| Skipping adherence check | Always compare plan vs actual |

### Session End

| Mistake | Better |
|---------|--------|
| Not pushing changes | Always push before saying "done" |
| Skipping `bd sync` | Run at end of every session |
| Leaving items in progress | Document progress or close |

## Troubleshooting

### Claude Seems Confused

Provide context:
```
Working on proj-001. Here's the feature plan:
[paste relevant context]
```

### Lost Context After Compaction

Run:
```bash
bd prime
```

This reloads Beads context. The startup hook does this automatically when `.beads/` is detected.

### Beads Issues

```bash
bd doctor         # Diagnose problems
bd sync --status  # Check sync state
bd stats          # View counts
```

### Hooks Not Firing

Check hook configuration:
1. Verify `.claude/hooks/hooks.json` exists
2. Check hook script has execute permission
3. Ensure Bun is installed and in PATH

## Getting Help

- **General help**: Type `/help` in Claude Code
- **Beads help**: Run `bd --help` or `bd <command> --help`
- **Report issues**: https://github.com/anthropics/claude-code/issues
