# Perles Quick Start

## Opening Perles

```bash
perles
```

## Navigation

### Switching Views

- `Ctrl+J` or `n` - Next view
- `Ctrl+K` or `p` - Previous view
- `Ctrl+V` - View menu (quick picker)

### Moving Around

- `↑↓` or `jk` - Move between issues in a column
- `←→` or `hl` - Move between columns
- `Enter` - View issue details
- `d` - View dependency tree (if issue has dependencies)
- `Esc` - Go back / close detail view

### Search Mode

Press `Ctrl+Space` (or `^space`) to enter **search mode** and run BQL queries:

```bql
# Show all P0 issues
priority = 0

# Show issues updated recently
updated > -3d

# Show migration issues for specific project
label ~ NotMyself.Security

# Show issue with dependencies
id = admin-zc1.1 expand up depth 2
```

Press `Esc` to exit search mode.

**Note**: `/` is for searching **within a column** (filtering), while `Ctrl+Space` opens full **search mode** for BQL queries.

### Other Keys

- `?` - Toggle help overlay
- `r` - Refresh issues manually
- `y` - Copy issue ID
- `w` - Toggle status bar
- `q` - Quit
- `a` - Add column
- `e` - Edit column
- `Ctrl+D` - Delete column
- `Ctrl+H` / `Ctrl+L` - Move column left/right
- `/` - Search within column (filter)
- `Ctrl+Space` - **Search mode** (BQL queries)

---

## Available Views

You currently have **7 views** configured:

### 1. **Default** (Start here!)

Standard kanban showing all work:
- Blocked
- Ready (issues you can work on now)
- In Progress
- Closed (Recent)

### 2. **Migration Epics**

Shows migration validation run epics:
- Active Epics
- Blocked Epics
- Completed Epics

### 3. **All Tasks**

Task-type issues only (filters out epics):
- Blocked
- Ready
- In Progress
- Done (Recent)

### 4. **By Priority**

All issues organized by priority:
- Critical (P0) - Non-equivalent logic
- High (P1) - Missing types, critical issues
- Medium (P2) - Test quality, normal work
- Low (P3-P4) - Warnings, nice-to-haves

### 5. **By Type**

All issues organized by type:
- Bugs
- Tasks
- Features
- Epics

### 6. **Planning Features**

Planning workflow features with task → bugfix hierarchy:
- Tasks Ready (ready to implement)
- Tasks In Progress (being worked on)
- Tasks with Bugfixes (quality review found issues)
- Tasks Done (completed features)

**Note**: Bugfix issues are **children of feature tasks**, not siblings. Use `Enter` on a task to see its bugfixes in tree view.

### 7. **Migration Validation**

Migration validator findings by severity:
- Non-Equivalent Logic (P0) - **Fix these first!**
- Missing Types (P1)
- Test Quality (P2)
- Warnings (P3-P4)
- Resolved

---

## Current Issues in Your Database

You have **339 total issues**:
- **26 open** (22 ready to work)
- **4 blocked**
- **313 closed**

Most issues are from **migration-validator** with labels:
- `migration-validation`
- `equivalence` (logic differences)
- `type-mapping` (missing types)
- `test-quality` (test coverage issues)
- Project labels: `notmyself-security`, `notmyself-accounting`, `notmyself-caching`

---

## Recommended Workflow

### 1. Start with "Migration Validation" View

```bash
perles
# Press 'Ctrl+J' to cycle through views
# Keep pressing until you see "Migration Validation"
```

This shows your migration issues by severity. Start with the **P0 column** (Non-Equivalent Logic).

### 2. Press Enter on an Issue

See details:
- Description of what's different
- Project name
- Finding type
- Priority

### 3. Use Search Mode to Filter

Press `/` and try:

```bql
# Show P0 issues for NotMyself.Security
priority = 0 and label ~ notmyself-security

# Show all equivalence issues (logic differences)
label ~ equivalence and status != closed

# Show test quality issues
label ~ test-quality
```

### 4. Switch to "By Priority" View

Press `v`, select "By Priority"

Focus on the **Critical (P0)** column first - these are non-equivalent logic issues that need immediate attention.

---

## Troubleshooting

### "No issues showing in columns"

This happens when the BQL query doesn't match your data. Try:

1. Press `v` to switch views
2. Try the **Default** view first (should show all issues)
3. If still empty, press `/` and search: `status != closed`

### "Keybindings not working"

- View switching: Use `v` (view picker) or `Tab` (cycle)
- Search: Use `/` (not `Ctrl+Space`)
- Help: Press `?` to see all keybindings
- Quit: `Ctrl+C` or `q`

### "Can't see recent activity"

Auto-refresh is enabled, but if needed:
- Press `Ctrl+R` to manually refresh
- Or restart perles

---

## BQL Query Examples

Press `Ctrl+Space` in perles to enter search mode:

### Finding Issues

```bql
# All P0 issues (critical)
priority = 0

# All bugs
type = bug

# Issues from last week
created > -7d

# Issues updated recently
updated > -3d
```

### By Project

```bql
# NotMyself.Security issues
label ~ notmyself-security

# NotMyself.Accounting issues
label ~ notmyself-accounting

# NotMyself.Caching issues
label ~ notmyself-caching
```

### By Finding Type

```bql
# Non-equivalent logic (critical!)
label ~ equivalence

# Missing types
label ~ type-mapping

# Test quality issues
label ~ test-quality
```

### Dependencies

```bql
# Show issue with what blocks it
id = admin-zc1.1 expand up depth 1

# Show issue with what it blocks
id = admin-zc1.1 expand down depth 1

# Show full dependency tree
id = admin-cpn expand up depth *
```

### Combining Queries

```bql
# P0 NotMyself.Security issues
priority = 0 and label ~ notmyself-security

# Open bugs with high priority
type = bug and priority <= 1 and status != closed

# Recent migration findings
label ~ migration-validation and created > -7d
```

---

## Next Steps

1. **Open perles now**: `perles`
2. **Switch views**: Press `Ctrl+V` for view menu, or `Ctrl+J` to cycle to "Migration Validation"
3. **Check "Migration Validation"**: See your P0 issues
4. **Try search mode**: Press `Ctrl+Space` and query: `priority = 0`
5. **View issue details**: Navigate to an issue, press `Enter`

For full perles documentation:
- Press `?` inside perles for keybindings
- Run `perles --help` for CLI options
- Visit: https://github.com/zjrosen/perles

---

## Tips

- **Start with "Migration Validation" or "By Priority" views** - These show the most important work
- **Use search mode liberally** - Press `/` to filter on the fly
- **Check dependency trees** - Press `d` on blocked issues to see what's blocking them
- **Multiple terminals** - Run `perles` in multiple terminals with different views open
- **Auto-refresh is on** - Boards update automatically when beads changes
