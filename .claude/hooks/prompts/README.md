# Evaluator Prompt Templates

This directory contains prompt templates for the Claude CLI Evaluator checkpoints.

## Template Format

Templates are Markdown files with placeholder variables that get replaced with context.

## Available Placeholders

| Placeholder | Description |
|-------------|-------------|
| `{TRANSCRIPT}` | Recent user/assistant conversation messages |
| `{BEADS_STATE}` | Current beads item, parent feature, and parent epic |
| `{GIT_STATUS}` | Git branch, uncommitted changes, unpushed commits |
| `{DEVOPS_STATE}` | Azure DevOps work item state (if beads item is linked) |
| `{TOOL_NAME}` | Current tool being invoked (for PreToolUse/PostToolUse) |
| `{TOOL_INPUT}` | Input to the current tool (for PreToolUse/PostToolUse) |

## Expected Response Format

All prompts should instruct Claude to respond with JSON:

```json
{
  "verdict": "pass" | "warn" | "block",
  "violations": [
    {
      "rule": "rule-name",
      "description": "What was violated",
      "severity": "error" | "warning" | "info"
    }
  ],
  "feedback": "Human-readable feedback message"
}
```

## Checkpoint Templates

- `preFlight.md` - Checks before code writing begins
- `closingCheck.md` - Checks before closing a beads/DevOps item
- `sessionEnd.md` - Checks before ending a session

## Creating New Templates

1. Create a new `.md` file named after the checkpoint
2. Include the placeholders you need
3. Clearly specify the evaluation criteria
4. Request JSON output in the expected format
5. Register the checkpoint in `evaluator/config.ts`
