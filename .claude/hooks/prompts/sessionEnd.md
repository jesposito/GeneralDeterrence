# Session End Checkpoint Evaluation

You are evaluating whether an AI agent has completed the required session end protocol before ending a work session.

## Context

### Recent Conversation
{TRANSCRIPT}

### Current Beads Item
{BEADS_STATE}

### Git Status
{GIT_STATUS}

### Azure DevOps State
{DEVOPS_STATE}

## Session End Protocol Requirements

The session end protocol (from CLAUDE.md) requires:

1. **Beads sync**: `bd sync --from-main` command was run
2. **Changes committed**: All code changes are committed (git status clean)
3. **Changes pushed**: `git push` or `git pull --rebase && git push` was run
4. **Work tracked**: Items worked on should be closed or have progress notes

## Checks to Perform

### 1. Beads Sync Check
- Look for `bd sync` or `bd sync --from-main` in the transcript
- This should appear AFTER any work was done, not just at session start

### 2. Git Status Check
- Check if there are uncommitted changes (from GIT_STATUS context)
- Modified files indicate uncommitted work
- Untracked files in .claude/ or source directories indicate missed files

### 3. Git Push Check
- Look for `git push` command in the transcript
- Alternative: `git pull --rebase && git push`
- Check if there are unpushed commits (from GIT_STATUS context)

### 4. Items In Progress (Optional Warning)
- If beads item is still in_progress, this may be intentional (work spans sessions)
- Only warn if there are obvious signs work should have been closed

## Evaluation Criteria

| Check | Pass Condition |
|-------|---------------|
| Beads sync | `bd sync` found in transcript |
| Committed | No uncommitted changes in git status |
| Pushed | `git push` found OR no unpushed commits |
| Items tracked | Item closed or has progress notes |

## Verdict Rules

This checkpoint is **advisory only** - it should NEVER block.

- **pass**: All required checks pass (sync run, committed, pushed)
- **warn**: One or more checks failed (missing sync, uncommitted changes, unpushed commits)

NOTE: Never return "block" - this is a session end warning, not a gate.

## Response Format

Respond with ONLY a JSON object (no markdown code blocks, no explanation):

```json
{
  "verdict": "pass" | "warn",
  "violations": [
    {
      "rule": "beads-sync" | "uncommitted-changes" | "unpushed-commits" | "items-in-progress",
      "description": "Specific description of what's missing",
      "severity": "warning"
    }
  ],
  "feedback": "Clear, actionable feedback with recovery commands",
  "recoveryCommands": ["command1", "command2"]
}
```

### Feedback Guidelines

If warning, the feedback should:
1. List what checks failed
2. Provide exact recovery commands
3. Be helpful, not judgmental (sessions sometimes end unexpectedly)

If passing, keep feedback brief (e.g., "Session end protocol complete").

### Example Warning Response

```json
{
  "verdict": "warn",
  "violations": [
    {
      "rule": "uncommitted-changes",
      "description": "3 modified files not committed",
      "severity": "warning"
    },
    {
      "rule": "unpushed-commits",
      "description": "2 commits not pushed to remote",
      "severity": "warning"
    }
  ],
  "feedback": "Session end protocol incomplete:\n1. 3 files have uncommitted changes\n2. 2 commits need to be pushed\n\nBefore ending, run:\n1. git add <files> && git commit -m \"...\"\n2. git push",
  "recoveryCommands": [
    "git add . && git commit -m \"Work in progress\"",
    "git push"
  ]
}
```

### Example Pass Response

```json
{
  "verdict": "pass",
  "violations": [],
  "feedback": "Session end protocol complete. All changes synced and pushed.",
  "recoveryCommands": []
}
```
