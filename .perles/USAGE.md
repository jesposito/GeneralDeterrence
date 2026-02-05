# Perles Board Usage Guide

Quick reference for using perles with the planning workflow.

## Board Views

Switch between views with `Shift+J` (next) and `Shift+K` (previous).

### 1. Planning Epics (High-Level Overview)

**When to use:** Start of day, sprint planning, executive summary

**What it shows:**
- Active Epics: All open planning epics (from `/plan-optimize`)
- Blocked Epics: Epics waiting on dependencies
- Completed Epics: Finished plans

**Key navigation:**
- Press `Enter` on an epic to see its description and child tasks
- Use `Ctrl+Space` to switch to search mode and query child tasks

**Example workflow:**
```
1. Open perles, view "Planning Epics"
2. See 3 active epics: "user-authentication", "realtime-notifications", "api-caching"
3. Press Enter on "user-authentication" to see details
4. Note: 5/12 tasks complete
```

---

### 2. Feature Development (Main Work Board)

**When to use:** During `/plan-orchestrate` execution, daily feature work

**What it shows:**
- Blocked: Features waiting on dependencies (red)
- Ready: Features with no blockers (green) - **START HERE**
- In Progress: Currently being implemented (blue)
- Testing: In quality review phase (orange)
- Done: Completed and verified (gray)

**Key navigation:**
- Focus on "Ready" column for next work
- Move right to see progress
- Use `d` to view dependency details

**Example workflow:**
```
1. /plan-orchestrate starts running
2. Open perles "Feature Development" view
3. Watch features move: Ready → In Progress → Testing → Done
4. If feature stuck in "Blocked", use search mode to find blocker:
   - Ctrl+Space to enter search
   - Query: "id = <feature-id> expand up depth 1"
   - See what's blocking it
```

---

### 3. Quality Review (Quality Gate Issues)

**When to use:** After features complete, during bugfix phase

**What it shows:**
- Critical Issues: P0-P1 bugs from quality gates (red)
- Test Coverage: Missing test coverage (blue)
- Silent Failures: Error handling issues (orange)
- Incomplete: NotImplementedException, TODOs, disabled tests (yellow)
- Resolved: Fixed quality issues (green)

**Key navigation:**
- Priority: Critical → Test Coverage → Silent Failures → Incomplete
- Press `Enter` to see issue details and affected files

**Example workflow:**
```
1. /plan-orchestrate runs quality review for feature F005
2. Opens perles "Quality Review" view
3. Sees 2 issues in "Test Coverage" column
4. Press Enter on issue to see details
5. Quality agent spawns bugfix sub-agent to fix
6. Watch issue move to "Resolved" column
```

---

### 4. Dependency View (Understand Blockers)

**When to use:** When features are blocked, debugging stalled progress

**What it shows:**
- Blocked (High Priority): P0-P2 issues with blockers (dark red)
- Blocked (Normal): P3-P4 issues with blockers (light red)
- Ready (High Priority): P0-P2 issues ready to work (dark green)
- Ready (Normal): P3-P4 issues ready to work (light green)
- In Progress: Currently active (blue)

**Key navigation:**
- Press `d` on a blocked issue to see dependency tree
- Use search mode with `expand up` to trace blockers

**Example workflow:**
```
1. Feature F007 stuck in "Blocked (High Priority)"
2. Press 'd' to view dependency tree
3. See: F007 → F005 → F003
4. F003 is still in progress (the root blocker)
5. Wait for F003 to complete, then F005, then F007 will unblock
```

---

### 5. Recent Activity (What's Happening)

**When to use:** Status updates, sprint retros, understanding recent changes

**What it shows:**
- Created (Last 7 Days): New issues from last week
- Updated (Last 3 Days): Recently modified issues
- Recently Closed: Issues completed in last week

**Key navigation:**
- Scan "Created" to see new work added
- Check "Recently Closed" for velocity tracking

**Example workflow:**
```
1. Monday morning standup
2. Open "Recent Activity" view
3. See 12 issues created last week (migration validator run)
4. See 8 issues closed (good progress!)
5. See 3 issues updated yesterday (active work)
```

---

### 6. Migration Validation (Migration Issues)

**When to use:** Tracking .NET Framework → .NET 10 migration progress

**What it shows:**
- Non-Equivalent Logic (P0): Critical logic mismatches (red)
- Missing Types (P1): Types not found in new solution (orange)
- Test Quality (P2): Test coverage issues (yellow)
- Warnings (P3-P4): Non-critical findings (gray)
- Resolved: Fixed migration issues (green)

**Key navigation:**
- Start with P0 column (highest priority)
- Press `Enter` to see project name and finding details
- Use search mode to filter by project: `label ~ NotMyself.Security`

**Example workflow:**
```
1. Migration validator creates 45 issues across 20 projects
2. Open "Migration Validation" view
3. See 3 P0 issues (non-equivalent logic)
4. Press Enter on first P0 issue
5. See: NotMyself.Security - PasswordHash logic changed
6. Use /plan-new to create plan to fix it
```

---

### 7. Default (General Kanban)

**When to use:** Non-planning work, general issue tracking

Standard kanban board for all issues regardless of type/label.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Shift+J` | Next board view |
| `Shift+K` | Previous board view |
| `↑↓←→` or `hjkl` | Navigate between columns and issues |
| `Enter` | View issue details |
| `d` | View dependency tree |
| `Ctrl+Space` | Toggle search mode |
| `?` | Help overlay |
| `Ctrl+C` | Quit |

---

## BQL Query Examples

Press `Ctrl+Space` to enter search mode and run these queries:

### Planning Queries

```bql
# Find all features for a specific plan epic
parent = bd-123

# Show feature with all its dependencies
id = bd-456 expand up depth *

# Show feature with everything that depends on it
id = bd-456 expand down depth 2

# Find all planning tasks ready to work
type = task and status = open and ready = true and label ~ planning

# Find high-priority blocked features
type = task and priority <= 2 and blocked = true and label ~ planning
```

### Quality Review Queries

```bql
# Find all quality issues for a specific feature
label ~ F005 and label in (bugfix, quality-review)

# Find all test coverage gaps
label ~ test-coverage and status != closed

# Find incomplete implementations (TODO, NotImplementedException)
label ~ incomplete-implementation

# Find error handling issues
label ~ error-handling and priority <= 2
```

### Migration Queries

```bql
# Critical migration issues (P0)
priority = 0 and label ~ migration-validation

# Migration issues for specific project
label ~ NotMyself.Security and label ~ migration-validation

# All migration issues with dependencies
label ~ migration-validation expand up depth 1

# Migration issues created this week
label ~ migration-validation and created > -7d
```

### General Queries

```bql
# All bugs created in last 7 days
type = bug and created > -7d

# High-priority issues updated recently
priority <= 2 and updated > -3d

# Issues assigned to me (if using assignee field)
assignee = username

# Issues blocked by specific issue
blocked_by = bd-789

# Issues with specific label
label in (urgent, critical)

# Issues with title containing keyword
title ~ authentication
```

---

## Workflow Integration

### Scenario: Running /plan-orchestrate

1. **Start orchestration:**
   ```bash
   /plan-orchestrate dev/active/user-authentication
   ```

2. **Open perles in another terminal:**
   ```bash
   perles
   ```

3. **Watch progress:**
   - Switch to "Feature Development" view (`Shift+J`)
   - See features move through columns in real-time
   - If feature stuck in "Blocked", switch to "Dependency View" to debug

4. **Quality review phase:**
   - Switch to "Quality Review" view
   - See bugfix issues appear as quality agents run
   - Watch issues move to "Resolved" as bugfixes complete

5. **Final status:**
   - Switch to "Planning Epics" view
   - See epic progress update (e.g., 12/12 tasks complete)
   - Epic auto-closes when all children close

---

### Scenario: Migration Validation

1. **Run migration validator:**
   ```bash
   cd scripts/migration-validator
   bun run index.ts --all
   ```

2. **View issues in perles:**
   ```bash
   perles
   ```

3. **Analyze findings:**
   - Switch to "Migration Validation" view
   - Start with "Non-Equivalent Logic (P0)" column
   - Press `Enter` on each issue to see details

4. **Create plans to fix:**
   ```bash
   /plan-new  # Create plan for P0 issue
   ```

5. **Track progress:**
   - Watch issues move to "Resolved" as fixes complete

---

## Tips & Tricks

### 1. Auto-refresh

The config has `auto_refresh: true`, so boards update automatically when beads database changes.

### 2. Column Colors

Colors follow a consistent scheme:
- **Red/Orange**: Blockers, critical issues, P0-P1 priorities
- **Green**: Ready to work, completed, resolved
- **Blue**: In progress, informational
- **Gray**: Low priority, completed work

### 3. Search Mode Power

Use `Ctrl+Space` to enter search mode for ad-hoc queries:
- Test queries before adding them to boards
- Explore dependency trees with `expand up/down depth N`
- Filter by any field (type, priority, status, label, etc.)

### 4. Tree Mode (Advanced)

For dependency visualization, use tree columns in custom views:

```yaml
- name: Feature Dependencies
  columns:
    - name: F005 Dependency Tree
      type: tree
      issue_id: bd-F005
      tree_mode: deps  # Show what this depends on
      color: "#3498DB"
```

### 5. Multiple Perles Instances

You can run multiple perles instances in different terminals:
- Terminal 1: "Feature Development" view (main work board)
- Terminal 2: "Quality Review" view (bugfix tracking)
- Terminal 3: "Migration Validation" view (migration progress)

All instances auto-refresh when beads updates.

---

## Customizing Views

Edit `.perles/config.yaml` to add custom views:

```yaml
views:
  - name: My Custom View
    columns:
      - name: My Query
        type: bql
        query: "your BQL query here"
        color: "#HEXCOLOR"
```

See `perles --help` or the perles README for full BQL syntax and examples.
