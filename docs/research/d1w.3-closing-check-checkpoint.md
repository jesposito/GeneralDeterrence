# Research: Closing Check Checkpoint

**Beads ID:** ai-tw-claude-code-dev-env-d1w.3.1
**Feature:** Closing Check Checkpoint (d1w.3)
**Date:** 2026-01-30

## 1. TodoWrite Hook Behavior

**Existing implementation:** `.claude/hooks/check-todos-complete.ts`

### How It Works

- Fires as `PostToolUse` hook when TodoWrite tool is used
- Receives JSON input via stdin with `tool_input.todos` array
- Each Todo has: `content`, `status` ("pending" | "in_progress" | "completed")
- Checks if ALL todos are complete: `todos.every(todo => todo.status === "completed")`
- Outputs adherence checklist to stdout when all complete
- Always exits with code 0 (fail-silent pattern)

### Current Checklist Structure

The hook outputs sections covering:
1. **CODE QUALITY** - Tests exist, test business logic, tests pass, no linting errors
2. **PLAN ADHERENCE** - Plan vs actual documented, deviations explained
3. **COMPLETION NOTES** - Files listed, tests listed, discovered work tracked
4. **CLOSING** - Beads item has notes, Azure DevOps updated (if linked)

### Hook Input Format

```typescript
interface HookInput {
  tool_input: {
    todos: Array<{
      content: string;
      status: "pending" | "in_progress" | "completed";
    }>;
  };
  transcript_path: string;
  session_id: string;
  // ... other fields
}
```

---

## 2. Completion Notes Detection Patterns

### Required Sections

From `workflow-implementation.md` (lines 204-212):

| Section | Required Content |
|---------|------------------|
| **Summary** | What was implemented, deviations from plan |
| **Files** | Created, updated, removed with file paths |
| **Tests** | Created, updated, removed test files |
| **Acceptance Criteria** | Which feature/epic criteria task addresses |
| **Discovered Work** | Bugs found/fixed with Beads IDs |

### Detection Regex Patterns

```typescript
const patterns = {
  // Section headers
  sectionHeader: /^#{1,4}\s+(Summary|Files|Tests|Acceptance Criteria|Discovered Work)/mi,

  // File entries under Files/Tests sections
  fileEntry: /^\s*[-*]\s+.+\.(ts|tsx|cs|js|jsx|py|java|go|rb|md)$/m,
  testEntry: /^\s*[-*]\s+.+(test|spec)\.(ts|tsx|js|jsx|cs|py|java)$/m,

  // Beads references (e.g., devenv-001, d1w-042)
  beadsRef: /[a-z]+-[a-z0-9]+(\.\d+)*/gi,

  // Acceptance criteria checkboxes
  checkbox: /- \[[x ]\]/gi,
  checkedBox: /- \[x\]/gi
};
```

### Command Patterns in Transcript

```bash
# Beads closing command
bd close <id> --reason "..."

# Feature criteria update
bd update <feature-id> --description "..."

# Epic criteria update
bd update <epic-id> --description "..."
```

---

## 3. Acceptance Criteria Update Detection

### What to Detect

1. **Beads description updates** containing acceptance criteria sections
2. **Checkbox state changes** from `[ ]` to `[x]`
3. **Which criteria were checked off** during this session

### Detection Approach

```typescript
// Search transcript for bd update commands
const updatePattern = /bd update ([a-z]+-[a-z0-9.]+) --description "([^"]+)"/g;

// Extract acceptance criteria section
const criteriaPattern = /## Acceptance Criteria\n([\s\S]*?)(?=\n##|$)/;

// Count checked vs unchecked
const checkedCount = (text.match(/- \[x\]/g) || []).length;
const uncheckedCount = (text.match(/- \[ \]/g) || []).length;
```

### Criteria Structure in Beads Items

```markdown
## Acceptance Criteria
- [x] Criteria this task completed (Task X.X)
- [x] Another completed criteria (Task X.Y)
- [ ] Still pending criteria (Task X.Z)
```

---

## 4. DevOps Sync Verification

### Detection Patterns

**Azure DevOps CLI updates:**
```bash
# State update
az boards work-item update --id <devops-id> --state Closed

# With HTML comment
az boards work-item update --id <devops-id> --discussion "<h3>Work Completed</h3>..."

# PowerShell REST API (for full HTML)
Invoke-RestMethod -Uri "$org/$project/_apis/wit/workItems/$workItemId/comments?api-version=7.1-preview.3" -Method Post
```

### Detection Strategy

Search transcript for:
1. `az boards work-item update` with `--state` → status sync
2. `az boards work-item update` with `--discussion` → documentation sync
3. `Invoke-RestMethod` with `workItems` and `comments` → full HTML comment

### Link Verification

**Beads → DevOps:**
- Beads description contains: `Azure DevOps Task #<id>` or `Azure DevOps Story #<id>`

**DevOps → Beads:**
- DevOps comment contains: `Beads: <beads-id> (closed)`

### Verification Checklist

```typescript
interface DevOpsSyncStatus {
  hasDevOpsLink: boolean;      // Beads item references DevOps
  statusUpdated: boolean;      // az boards ... --state Closed found
  commentAdded: boolean;       // az boards ... --discussion found
  crossReferenced: boolean;    // DevOps comment mentions Beads ID
}
```

---

## 5. Implementation Approach

### Hook Trigger Options

| Option | Trigger | Pros | Cons |
|--------|---------|------|------|
| **A** | PostToolUse: TodoWrite (all complete) | Structured input, clear signal | May miss manual closes |
| **B** | PostToolUse: Bash (bd close pattern) | Catches actual closes | Pattern matching complexity |

**Recommended:** Option A - TodoWrite completion is the natural workflow endpoint.

### Hook Logic Flow

```typescript
async function closingCheck(input: HookInput): Promise<void> {
  const { todos, transcript_path } = input.tool_input;

  // Only fire when all todos complete
  if (!todos.every(t => t.status === "completed")) {
    process.exit(0);
  }

  // Read transcript for closing patterns
  const transcript = await Bun.file(transcript_path).text();

  // Gather context for evaluator
  const context = {
    completionNotes: detectCompletionNotes(transcript),
    criteriaUpdates: detectCriteriaUpdates(transcript),
    devOpsSync: detectDevOpsSync(transcript)
  };

  // Call Claude CLI evaluator
  const evaluation = await evaluateClosingCheck(context);

  // Output findings (warning, not blocking)
  console.log(formatClosingCheckResult(evaluation));

  process.exit(0);
}
```

### Output Format (Warning, Non-Blocking)

```
╔════════════════════════════════════════════════════════════════╗
║              CLOSING CHECK - ITEMS TO VERIFY                   ║
╠════════════════════════════════════════════════════════════════╣
║  ✓ Completion notes have Summary section                       ║
║  ✓ Files section lists 3 files                                 ║
║  ✗ Tests section not found                                     ║
║  ✓ Acceptance criteria updated on feature                      ║
║  ✗ Azure DevOps not updated (item has link to Task #789)       ║
║                                                                ║
║  SUGGESTED ACTIONS:                                            ║
║  1. Add Tests section to completion notes                      ║
║  2. Run: az boards work-item update --id 789 --state Closed    ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 6. Integration with Existing Hook

The existing `check-todos-complete.ts` already fires on TodoWrite completion. Options:

1. **Extend existing hook** - Add evaluator call to current implementation
2. **Chain hooks** - Register second hook on same matcher
3. **Replace hook** - New implementation supersedes old

**Recommended:** Extend existing hook to add evaluator-based verification while keeping the current checklist output.

---

## 7. Key Insights

1. **TodoWrite completion is the signal** - Natural workflow endpoint, structured input available
2. **Transcript parsing is essential** - Must read recent messages for closing patterns
3. **DevOps link detection first** - Only check DevOps sync if Beads item has link
4. **Warning, not blocking** - Closing check is advisory to avoid frustrating users
5. **Existing hook provides foundation** - Can extend rather than replace
