# Beads Issue Hierarchy Guide

This document explains the parent-child relationships in beads and how to visualize them in perles.

## Issue Structure

### Planning Workflow Hierarchy

```
Epic: User Authentication Plan (created by /plan-optimize)
  ↳ Task F001: Implement login (created by /plan-optimize)
      ↳ Bug: Fix login test coverage (created by /plan-orchestrate quality review)
      ↳ Bug: Fix login error handling (created by /plan-orchestrate quality review)
  ↳ Task F002: Implement logout (created by /plan-optimize)
  ↳ Task F003: Add password reset (created by /plan-optimize)
      ↳ Bug: Add password validation tests (created by quality review)
```

### Migration Validation Hierarchy

```
Epic: Migration Validation Run - 2026-01-05 (created by migration-validator)
  ↳ Bug: [NotMyself.Security] GenerateHash non-equivalent (P0)
  ↳ Bug: [NotMyself.Security] IsBlacklisted non-equivalent (P0)
  ↳ Bug: [NotMyself.Security] GetHash non-equivalent (P0)
  ↳ Bug: [NotMyself.Caching] Missing type CachingViewModel (P1)
  ↳ Task: [NotMyself.Caching] Poor test quality (P2)
```

## Key Differences

### Planning Workflow
- **Epic** → **Task** → **Bug** (3 levels)
- Bugfix issues are **children of feature tasks**
- Allows grouping bugfixes by feature

### Migration Validation
- **Epic** → **Bug/Task** (2 levels)
- Findings are direct children of epic
- Simpler flat structure for validation runs

---

## Viewing Hierarchy in Beads CLI

### List Children of an Epic

```bash
# Show all children of an epic
bd list --parent=admin-zc1

# Output:
# admin-zc1.1 [P0] [bug] - GenerateHash non-equivalent
# admin-zc1.2 [P0] [bug] - IsBlacklisted non-equivalent
# admin-zc1.3 [P0] [bug] - GetHash non-equivalent
```

### List Children of a Task (Including Bugfixes)

```bash
# Show bugfixes for a specific feature task
bd list --parent=admin-f001

# Output:
# admin-f001.1 [P1] [bug] - Fix login test coverage
# admin-f001.2 [P2] [bug] - Fix login error handling
```

### Show Issue with Parent Relationship

```bash
bd show admin-zc1.1

# Output shows:
# Depends on (1):
#   → admin-zc1: Migration Validation Run - 2026-01-05 [P2]
```

### Show Epic with All Children

```bash
bd show admin-zc1

# Output shows:
# Children (3):
#   ↳ admin-zc1.1: GenerateHash non-equivalent [P0 - open]
#   ↳ admin-zc1.2: IsBlacklisted non-equivalent [P0 - open]
#   ↳ admin-zc1.3: GetHash non-equivalent [P0 - open]
```

---

## Viewing Hierarchy in Perles

### Method 1: Tree View (Press Enter)

1. Open perles: `perles`
2. Navigate to a task or epic issue
3. **Press `Enter`** - Opens tree view showing children
4. See all bugfixes under the task
5. Press `Esc` to go back

### Method 2: BQL Search with Expand

Press `Ctrl+Space` in perles:

```bql
# Show epic with all descendants (tasks + bugfixes)
id = admin-epic-123 expand down depth *

# Show task with its bugfixes
id = admin-f001 expand down depth 1

# Show bugfix with its parent task
id = admin-f001.1 expand up depth 1

# Show full tree for a feature
id = admin-f001 expand down depth 2
```

### Method 3: Planning Features View

1. Press `Ctrl+J` or `Ctrl+V` to switch to "Planning Features" view
2. See columns:
   - **Tasks Ready** - Features ready to implement
   - **Tasks In Progress** - Being worked on
   - **Tasks with Bugfixes** - Quality review found issues (has children)
   - **Tasks Done** - Completed
3. Press `Enter` on any task to see its bugfixes

---

## Creating Issues with Hierarchy

### Create Task as Child of Epic

```bash
# /plan-optimize does this automatically
bd create "Implement login feature" \
  --type=task \
  --parent=admin-epic-123 \
  --priority=2
```

### Create Bug as Child of Task

```bash
# /plan-orchestrate does this during quality review
bd create "bugfix: Fix login test coverage in F001" \
  --type=bug \
  --parent=admin-f001 \
  --priority=1 \
  --labels bugfix,quality-review
```

### Create Bug as Child of Epic

```bash
# migration-validator does this
bd create "[NotMyself.Security]: Non-Equivalent Logic - GenerateHash" \
  --type=bug \
  --parent=admin-zc1 \
  --priority=0 \
  --labels migration-validation,equivalence
```

---

## Benefits of Hierarchical Structure

### 1. Grouping Related Work

All bugfixes for F001 are children of F001, making it easy to:
- See what's blocking feature completion
- Close all related issues together
- Track feature progress including fixes

### 2. Epic Progress Tracking

```bash
bd show admin-epic-123

# Shows:
# Children (5):
#   ↳ Task F001 [closed]
#       ↳ Bug F001.1 [closed]
#       ↳ Bug F001.2 [closed]
#   ↳ Task F002 [in_progress]
#   ↳ Task F003 [open]
```

### 3. Automatic Epic Closure

```bash
# When all children are closed, close epic automatically
bd epic close-eligible

# Finds epics where all children are closed and closes them
```

### 4. Perles Tree Visualization

Pressing `Enter` on a task in perles shows:
```
Task F001: Implement login [closed]
  ├─ Bug: Fix login test coverage [closed]
  └─ Bug: Fix login error handling [closed]
```

Visual confirmation that all work for F001 is complete.

---

## Common Queries

### Find All Bugfixes

```bash
# All bugfix issues (type = bug with bugfix label)
bd list --all | grep bugfix

# Or in perles (Ctrl+Space):
type = bug and label ~ bugfix
```

### Find Tasks with Open Bugfixes

```bash
# In perles (Ctrl+Space):
type = task and status != closed and label ~ quality-review
```

This shows tasks that had quality review issues.

### Find Orphaned Bugs (No Parent)

```bash
# In perles (Ctrl+Space):
type = bug and parent = null
```

These bugs should probably have a parent task or epic.

---

## Migration Path

### Before (Flat Structure)

```
Epic: Authentication
Bug: Fix login tests
Bug: Fix logout handling
Task: Implement login
Task: Implement logout
```

All issues are siblings - hard to tell which bugs belong to which features.

### After (Hierarchical Structure)

```
Epic: Authentication
  ↳ Task: Implement login
      ↳ Bug: Fix login tests
  ↳ Task: Implement logout
      ↳ Bug: Fix logout handling
```

Clear parent-child relationships - easy to see which bugs belong to which features.

---

## Tips

1. **Always use `--parent` when creating related issues**
   - Bugfixes → parent is feature task
   - Feature tasks → parent is epic

2. **Use perles tree view liberally**
   - Press `Enter` on tasks to see their bugfixes
   - Press `Enter` on epics to see all work

3. **Close children before closing parents**
   - Close bugfixes first
   - Then close feature task
   - Epic can auto-close with `bd epic close-eligible`

4. **Use BQL `expand` for complex queries**
   - `expand down` - show descendants (children, grandchildren)
   - `expand up` - show ancestors (parent, grandparent)
   - `depth N` - control how many levels to traverse
