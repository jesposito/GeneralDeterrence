# Planning Workflow

## Overview

The planning workflow provides a structured approach to breaking down work into trackable items. It uses Claude Code's planning mode to design and get approval before creating Beads/Azure DevOps items.

## Two Plan Types

| Plan Type | Creates | Use When |
|-----------|---------|----------|
| **Master Plan** | Epic + Features + Research Tasks | Starting new major work, defining scope |
| **Feature Plan** | Tasks | Implementing a specific feature |

---

## Triggering the Workflow

**Command:** `/plan-new`

This command:
1. Asks: "Master Plan or Feature Plan?"
2. If Feature Plan, asks for the feature ID
3. Enters planning mode

---

## Master Plan Process

### Step 1: Enter Planning Mode
User runs `/plan-new` → selects "Master Plan" → Claude enters planning mode

### Step 2: Gather Context
- Explore the codebase to understand existing architecture
- Review related existing Beads items (`bd list`)
- Identify dependencies and constraints

### Step 3: Ask About Azure DevOps
Before designing, ask the user:
- Do they have an existing Azure DevOps Epic?
- If yes → get the Epic ID for linking
- If no → confirm they want one created

### Step 4: Design the Plan
Write to the plan file:
- Epic title and description
- Acceptance criteria (required for Azure DevOps)
- Feature breakdown with titles and descriptions
- Dependencies between features (if any)
- Priority assignments (0-4 scale)

### Step 5: Exit for Approval
Use `ExitPlanMode` → User reviews and approves

### Step 6: Hook Fires
The `ExitPlanMode` hook injects:
> "Create items, STOP, don't implement, wait for user"

### Step 7: Create Items
```
Epic (+ Azure DevOps Epic if linked)
 │
 ├─► Feature 1 (+ Azure DevOps Story if epic linked)
 │    └─► Research: Feature 1 (task)
 │
 ├─► Feature 2 (+ Azure DevOps Story if epic linked)
 │    └─► Research: Feature 2 (task)
 │
 └─► Feature 3 (+ Azure DevOps Story if epic linked)
      └─► Research: Feature 3 (task)
```

### Step 8: STOP
Report what was created. Do NOT start implementation.
User runs `bd ready` to pick work when ready.

---

## Feature Plan Process

### Step 1: Enter Planning Mode
User runs `/plan-new` → selects "Feature Plan" → provides feature ID → Claude enters planning mode

### Step 2: Review the Feature
```bash
bd show <feature-id>
```
Understand:
- Feature scope and acceptance criteria
- Parent epic context
- Whether feature has Azure DevOps Story link
- Any existing dependencies or blockers

### Step 3: Check for Research Task
```bash
bd list --parent <feature-id>
```
If a "Research: \<feature title\>" task exists and is completed, review its notes for:
- Identified code areas and files
- Technical constraints discovered
- Implementation options explored
- Recommended patterns or libraries

### Step 4: Gather Implementation Context
- Explore relevant code areas
- Identify files that will need changes
- Review existing patterns and conventions
- Note any technical constraints

### Step 5: Design the Plan
Write to the plan file:
- Task breakdown with clear, actionable titles
- Implementation order and dependencies
- Files expected to be created/modified
- Testing approach
- Priority assignments (0-4 scale)

### Step 6: Exit for Approval
Use `ExitPlanMode` → User reviews and approves

### Step 7: Hook Fires
Same hook injects: "Create items, STOP, don't implement"

### Step 8: Create Items
```bash
# If feature has Azure DevOps Story link:
# 1. Get iteration path from Story
# 2. Create DevOps Task first
# 3. Create Beads task with link

# If no DevOps link:
# Just create Beads tasks under the feature
```

### Step 9: STOP
Report what was created. Do NOT start implementation.

---

## Research Tasks

**Purpose:** Inform feature planning before implementation begins.

**Created:** Automatically with every feature (during Master Plan)

**Naming:** `"Research: <feature title>"`

**Priority:** Same as parent feature

**Output Location:** `docs/research/<issue-id>-<slug>.md`

Example: `docs/research/proj-005-oauth-providers.md`

**Scope:**
- Explore relevant code areas in the codebase
- Identify files that will need to be created/modified
- Document technical constraints and dependencies
- Explore implementation options and approaches
- Research best practices and patterns
- Research OSS libraries, tooling, or techniques that might apply

**When Research is Required vs Optional:**

| Situation | Research Required? |
|-----------|-------------------|
| New technology or library | Yes |
| Complex architectural decisions | Yes |
| Multiple valid implementation approaches | Yes |
| Well-understood scope with clear patterns | Optional |
| Small bug fix or simple task | No |

**Linking Research to Features:**

When research is complete, update the parent feature description to reference the findings:

```bash
bd update <feature-id> --description "Feature description...

## Research
See: docs/research/<issue-id>-<research-slug>.md"
```

This ensures traceability between research and implementation. The Feature Plan should review research findings before designing tasks.

**Research Workflow:**

```
1. bd update <research-id> --status=in_progress
2. Explore codebase, research options
3. Write findings to docs/research/<issue-id>-<slug>.md
4. bd close <research-id> --reason="Research complete, see docs/research/..."
5. bd update <feature-id> --description="... ## Research See: docs/research/..."
```

---

## Hook Behavior

### `ExitPlanMode` Hook (PermissionRequest)

**When:** Fires when Claude tries to exit planning mode

**What it does:**
- Allows the action to proceed
- Injects message telling Claude to:
  1. Create the Beads and Azure DevOps items
  2. STOP after creating items
  3. Report what was created
  4. NOT start implementation
  5. Wait for user to run `bd ready`

---

## Visual Flow

```
/plan-new
    │
    ▼
Ask: Master Plan or Feature Plan?
    │
    ├─► Master Plan
    │       │
    │       ▼
    │   EnterPlanMode
    │       │
    │       ├─► Explore codebase
    │       ├─► Ask about DevOps Epic
    │       ├─► Design epic + features
    │       │
    │       ▼
    │   ExitPlanMode (approval)
    │       │
    │       ▼
    │   Hook: "Create items, STOP"
    │       │
    │       ▼
    │   Create Epic + Features + Research Tasks
    │   (+ DevOps Epic/Stories if linked)
    │       │
    │       ▼
    │   STOP → Report → Wait for user
    │
    └─► Feature Plan
            │
            ▼
        Ask: Feature ID?
            │
            ▼
        EnterPlanMode
            │
            ├─► Review feature (bd show)
            ├─► Check for research task
            ├─► Explore implementation areas
            ├─► Design task breakdown
            │
            ▼
        ExitPlanMode (approval)
            │
            ▼
        Hook: "Create items, STOP"
            │
            ▼
        Create Tasks
        (+ DevOps Tasks if feature linked)
            │
            ▼
        STOP → Report → Wait for user
```

---

## After Planning

Once items are created, the user:
1. Runs `bd ready` to see available work
2. Picks an item to work on
3. Asks Claude to implement it
4. Implementation workflow begins (see below)

---

# Implementation Workflow

## Overview

The implementation workflow is what happens after planning - when work is picked up and code is written. It includes pre-work validation, plan adherence checks, and structured closing procedures.

## Triggering

User asks Claude to work on something. No special command required.

Claude will:
1. Identify the Beads item being worked on
2. Confirm with the user if unclear
3. Begin pre-work validation

---

## Pre-Work Validation

Before starting implementation, verify ALL of the following:

### Item Validation
- [ ] Item exists and is not blocked
- [ ] Item has required fields (title, type, priority)
- [ ] Azure DevOps link is valid (if linked)

### Status Updates
- [ ] Set Beads item to `in_progress`
- [ ] Set Azure DevOps item to `Active` (if linked)
- [ ] Set parent Feature to `in_progress` (if task/bug under feature)
- [ ] Set parent Epic to `in_progress` (if feature under epic)

### Acceptance Criteria Mapping
- [ ] Identify which feature acceptance criteria this task addresses
- [ ] Identify which epic acceptance criteria this task contributes to
- [ ] If task doesn't map to any criteria, verify it's actually needed

---

## Plan Adherence Check (BEFORE)

**Purpose:** Ensure alignment with the plan before writing code.

### What to Review
1. Feature Plan tasks (`bd list --parent <feature-id>`)
2. Current task description and notes
3. Expected files to create/modify
4. Expected approach and patterns

### What to Confirm
1. Similar patterns exist in the codebase
2. Dependencies are met
3. No concerns with the approach

### What to Document
Before starting, state:
- What you're about to implement
- What files you expect to create/modify
- What approach you'll follow

---

## During Implementation

### TodoWrite for Subtasks

Break down the task into implementation steps:

```
Working on: "Add user validation"

Todos:
[ ] Add validation schema
[ ] Update UserService
[ ] Add unit tests
[ ] Run tests
[ ] Fix linting errors
```

### Code Quality Guardrails

| Requirement | Description |
|-------------|-------------|
| **Test Coverage** | Tests required for new functionality |
| **Business Logic Tests** | Tests must test actual logic, not just existence |
| **Tests Pass** | All tests must pass before closing |
| **Linting Clean** | Fix all linting errors |
| **No Vulnerabilities** | Follow OWASP top 10 |

### Commit Frequency

Commit after each logical unit of work:
- After implementing a cohesive piece of functionality
- After adding tests for that functionality
- After fixing a distinct issue

### Track Discovered Work

| Discovery | Action |
|-----------|--------|
| Small fix in scope | Do it, document in completion notes |
| Bug found | Create Beads bug item |
| New feature need | Create Beads task/feature |
| Technical debt | Create Beads task (priority 3-4) |

---

## Plan Adherence Check (AFTER)

**Purpose:** Verify implementation matches the plan before closing.

### Compare Plan vs. Actual

| Planned | Actual | Status |
|---------|--------|--------|
| Create src/schemas/user.ts | Created src/schemas/user.ts | ✓ Match |
| Update UserService | Updated UserService + UserController | Deviation |
| Add unit tests | Added unit tests | ✓ Match |

### Document Deviations

For each deviation, document:
- What was different
- Why it was necessary
- Whether it was planned or discovered

### Verification Checklist

- [ ] New code has tests
- [ ] Tests test actual business logic
- [ ] Tests pass
- [ ] No linting errors
- [ ] Task contributes to feature acceptance criteria
- [ ] Feature acceptance criteria have verification method
- [ ] Epic acceptance criteria are being addressed

---

## Closing

### Update Acceptance Criteria

Before closing the task, update parent items:

1. **Feature acceptance criteria** - Check off `[x]` any criteria this task completes
   ```bash
   bd show <feature-id>  # Review current criteria
   bd update <feature-id> --description "..." # Update with [x] for completed items
   ```

2. **Epic acceptance criteria** - Check off `[x]` any criteria now complete
   ```bash
   bd show <epic-id>  # Review current criteria
   bd update <epic-id> --description "..." # Update with [x] for completed items
   ```

### Required Completion Notes

**Summary:**
- What was implemented
- Any deviations from plan and why

**Files:**
- Files created (list)
- Files updated (list)
- Files removed (list)

**Tests:**
- Tests created (list)
- Tests updated (list)
- Tests removed (list)

**Acceptance Criteria:**
- Which feature criteria this task addressed
- Which epic criteria this task contributes to

**Discovered Work:**
- Bugs found and fixed (with Beads IDs)
- New items created (with Beads IDs)

### Close Both Systems

1. Close Beads item with detailed notes
2. Close Azure DevOps item with HTML comment (if linked)

---

## Session End Protocol

1. **Apply Self-Learning Skills** - Record learnings from the session
2. **Sync Beads** - `bd sync --from-main`
3. **Final Commit** - `git commit`
4. **Verify Clean State** - `git status`

---

## Rule Adherence Evaluator

The Rule Adherence Evaluator automatically enforces workflow rules at key checkpoints. It uses Claude CLI to semantically evaluate whether workflows are being followed.

### Checkpoints

| Checkpoint | Trigger | Mode | Purpose |
|------------|---------|------|---------|
| **Pre-Flight** | Edit/Write tools | Blocking | Ensures checklist acknowledged before coding |
| **Closing Check** | TodoWrite (all complete) | Warning | Validates completion notes are adequate |
| **Session End** | Stop | Warning | Checks for unsynced beads/uncommitted code |

### Pre-Flight Checkpoint

Blocks code writing until you've acknowledged the pre-flight checklist:
- "Pre-flight checklist complete:" marker present
- "Ready to begin implementation." end marker present
- Beads item set to `in_progress`

If blocked, state the full pre-flight acknowledgment to proceed.

### Quick Disable

```bash
export EVALUATOR_ENABLED=false           # Disable all checkpoints
export EVALUATOR_PREFLIGHT_ENABLED=false # Disable just pre-flight
```

→ See [Evaluator Guide](evaluator.md) for full documentation

---

## Adherence Check Hook Behavior

### `PostToolUse` Hook (TodoWrite matcher)

**When:** Fires after TodoWrite is called, when all todos are marked complete

**What it does:**
- Checks if ALL todos have `status: "completed"`
- If all complete, outputs the adherence checklist
- Triggers the **Closing Check** evaluator checkpoint
- If not all complete, does nothing (implementation still in progress)
- Claude must verify all checklist items before closing

---

## Implementation Visual Flow

```
User asks to work on something
    │
    ▼
Identify Beads item
    │
    ▼
┌─────────────────────────────────────┐
│         PRE-WORK VALIDATION         │
├─────────────────────────────────────┤
│ • Item not blocked                  │
│ • Set item → in_progress            │
│ • Set parent feature → in_progress  │
│ • Set parent epic → in_progress     │
│ • Update Azure DevOps → Active      │
│ • Map to acceptance criteria        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│   PLAN ADHERENCE CHECK (BEFORE)     │
├─────────────────────────────────────┤
│ • Review Feature Plan tasks         │
│ • Understand expected changes       │
│ • Confirm approach                  │
│ • Document understanding            │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│         IMPLEMENTATION              │
├─────────────────────────────────────┤
│ • Use TodoWrite for subtasks        │
│ • Write code following plan         │
│ • Ensure test coverage              │
│ • Tests test business logic         │
│ • Tests pass                        │
│ • Fix linting errors                │
│ • Commit after each logical unit    │
│ • Track discovered work in Beads    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│   PLAN ADHERENCE CHECK (AFTER)      │
├─────────────────────────────────────┤
│ • Compare plan vs actual            │
│ • Document deviations               │
│ • Verify test coverage              │
│ • Verify linting clean              │
│ • Check acceptance criteria chain   │
└─────────────────────────────────────┘
    │
    ▼
All todos marked complete?
    │
    ├─► No → Continue implementation
    │
    └─► Yes → TodoWrite hook fires
            │
            ▼
        Adherence checklist displayed
            │
            ├─► Issues found → Fix issues, retry
            │
            └─► All verified → Proceed to closing
            │
            ▼
┌─────────────────────────────────────┐
│            CLOSING                  │
├─────────────────────────────────────┤
│ • Update feature acceptance criteria│
│ • Update epic acceptance criteria   │
│ • Detailed notes (files + tests)    │
│ • Close Beads item                  │
│ • Close Azure DevOps item           │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│          SESSION END                │
├─────────────────────────────────────┤
│ • Apply self-learning skills        │
│ • bd sync --from-main               │
│ • git commit                        │
└─────────────────────────────────────┘
```

---

## Common Mistakes to Avoid

1. ❌ Starting work without setting parent items to in_progress
2. ❌ Skipping the plan review before implementation
3. ❌ Writing code without tests
4. ❌ Tests that don't test business logic
5. ❌ Waiting until end to commit everything
6. ❌ Scope creep - doing unplanned work without tracking it
7. ❌ Closing without detailed completion notes
8. ❌ Forgetting to close Azure DevOps item
9. ❌ Skipping self-learning skills at session end
10. ❌ Not syncing beads before ending session
