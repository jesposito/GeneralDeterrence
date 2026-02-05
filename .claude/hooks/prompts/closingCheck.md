# Closing Check Checkpoint Evaluation

You are evaluating whether an AI agent has provided adequate closing documentation before finishing work on a task.

## Context

### Recent Conversation
{TRANSCRIPT}

### Current Beads Item
{BEADS_STATE}

### Git Status
{GIT_STATUS}

### Azure DevOps State
{DEVOPS_STATE}

## Closing Documentation Requirements

The agent should have prepared closing documentation containing these sections:

### 1. Summary Section
- What was implemented or accomplished
- Any deviations from the original plan and why

### 2. Files Section
Lists of files organized by action:
- Files created
- Files updated
- Files removed (if any)

### 3. Tests Section
Lists of test files organized by action:
- Tests created
- Tests updated
- Tests removed (if any)

### 4. Acceptance Criteria Section
- Which feature acceptance criteria this task addresses
- Which epic acceptance criteria this contributes to

### 5. Discovered Work Section (if applicable)
- Bugs found/fixed with Beads IDs
- New tasks created during implementation

## DevOps Sync Requirements

If the beads item has an Azure DevOps link (shown in BEADS_STATE as "Azure DevOps: #<id>"):
- Agent should have updated or be planning to update the DevOps item
- Look for evidence of DevOps commands: `az boards work-item update`
- The DevOps item should be closed or have a completion comment

If there is NO Azure DevOps link, skip DevOps sync checking.

## Evaluation Criteria

Check the transcript for evidence of closing preparation:

1. **Summary present**: Is there a summary of work done?
2. **Files listed**: Are created/updated files explicitly listed?
3. **Tests listed**: Are test files mentioned (created, updated, or "no tests needed" with justification)?
4. **Acceptance criteria discussed**: Is there mention of which criteria this task addresses?
5. **DevOps sync**: If DevOps-linked, is there evidence of DevOps update intent or commands?

## Verdict Rules

- **warn**: Missing 1-2 sections, or DevOps sync not evident for linked item
- **pass**: All required sections present (or justified as N/A), DevOps sync addressed if linked

NOTE: This checkpoint is advisory only - verdict should be "warn" or "pass", never "block".

## Response Format

Respond with ONLY a JSON object (no markdown code blocks, no explanation):

```json
{
  "verdict": "pass" | "warn",
  "violations": [
    {
      "rule": "summary-section" | "files-section" | "tests-section" | "acceptance-criteria" | "devops-sync",
      "description": "Specific description of what's missing",
      "severity": "warning"
    }
  ],
  "feedback": "Clear, actionable feedback for the agent"
}
```

### Feedback Guidelines

If warning, the feedback should:
1. List what sections are missing or incomplete
2. Provide specific suggestions for what to add
3. Remind about DevOps sync if applicable

If passing, keep feedback brief (e.g., "Closing documentation is complete").

### Example Violations

```json
{
  "verdict": "warn",
  "violations": [
    {
      "rule": "tests-section",
      "description": "No tests mentioned in closing documentation",
      "severity": "warning"
    },
    {
      "rule": "devops-sync",
      "description": "Beads item linked to Azure DevOps #789 but no DevOps update seen",
      "severity": "warning"
    }
  ],
  "feedback": "Closing documentation is incomplete:\n1. Add a Tests section listing test files created/updated, or explain why tests are not needed\n2. Update Azure DevOps item #789 with completion comment and close it"
}
```
