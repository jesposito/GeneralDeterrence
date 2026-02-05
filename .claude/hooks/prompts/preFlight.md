# Pre-Flight Checkpoint Evaluation

You are evaluating whether an AI agent has completed the required pre-flight checklist before writing code.

## Context

### Recent Conversation
{TRANSCRIPT}

### Current Beads Item
{BEADS_STATE}

### Git Status
{GIT_STATUS}

### Azure DevOps State
{DEVOPS_STATE}

### Tool Being Used
Tool: {TOOL_NAME}
Input: {TOOL_INPUT}

## Pre-Flight Checklist Requirements

The agent MUST have stated an explicit acknowledgment containing ALL of these elements:

1. **Start marker**: Text containing "Pre-flight checklist complete:"
2. **Plan confirmation**: A line like "- Plan confirmed: [yes/no - how]"
3. **Beads tasks**: A line listing the task IDs being worked on
4. **Status confirmation**: Confirmation that feature, epic, and task are all "in_progress"
5. **End marker**: Text containing "Ready to begin implementation."

### Example Valid Acknowledgment
```
Pre-flight checklist complete:
- Plan confirmed: yes - user approved in previous message
- Acceptance criteria: feature and epic both have them
- Research referenced: yes - docs/research/d1w.2-pre-flight-checkpoint.md
- Beads tasks: d1w.2.2, d1w.2.3, d1w.2.4
- Status: d1w.2 (feature), d1w (epic), d1w.2.2 (task) all in_progress
- This task addresses:
  - Feature criteria: Hook triggers on Edit/Write
  - Epic criteria: Pre-flight checkpoint blocks code writing

Ready to begin implementation.
```

## Evaluation Criteria

1. **Check for start marker**: Is "Pre-flight checklist complete:" present in the transcript?
2. **Check for end marker**: Is "Ready to begin implementation." present in the transcript?
3. **Check timing**: Do the markers appear BEFORE the current tool use (not in an earlier, unrelated session)?
4. **Check beads status**: Is the current beads item status "in_progress"?

## Verdict Rules

- **block**: Missing acknowledgment entirely OR beads item not in_progress
- **warn**: Partial acknowledgment (missing some elements but has markers)
- **pass**: Complete acknowledgment found and beads item is in_progress

## Response Format

Respond with ONLY a JSON object (no markdown code blocks, no explanation):

```json
{
  "verdict": "pass" | "warn" | "block",
  "violations": [
    {
      "rule": "pre-flight-acknowledgment" | "beads-status" | "status-hierarchy",
      "description": "Specific description of what's missing",
      "severity": "error" | "warning"
    }
  ],
  "feedback": "Clear, actionable feedback for the agent"
}
```

### Feedback Guidelines

If blocking, the feedback should:
1. State that the pre-flight checklist is required
2. List what specific elements are missing
3. Provide the template for the acknowledgment

If passing, keep feedback brief (e.g., "Pre-flight checklist verified").
