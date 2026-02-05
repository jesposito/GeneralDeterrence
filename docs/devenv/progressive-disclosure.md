# Progressive Disclosure Guide

This guide explains how rules are structured in this development environment. Understanding this pattern helps you create new rules or modify existing ones effectively.

## What is Progressive Disclosure?

Progressive disclosure organizes information so Claude loads only what's needed:

- **Main rule files** are concise reference guides with tables and key points
- **Code files** contain detailed command examples and payloads
- **Critical information** appears at the top
- **Edge cases** appear at the bottom

This keeps Claude's context small while ensuring important rules are seen first.

## Directory Structure

```
.claude/rules/
├── my-rule.md                    # Concise rule file
└── code/
    └── my-rule/
        ├── workflows.md          # Command examples
        ├── creating-items.md     # Creation procedures
        └── edge-cases.md         # Error handling
```

## Content Ordering

Order content by importance - what breaks things goes first.

| Position | Content Type | Example |
|----------|--------------|---------|
| **Top** | Critical rules | "NEVER do X without Y" |
| **Upper** | Core workflow | Creating, updating items |
| **Middle** | Reference tables | Field descriptions, options |
| **Lower** | Less common operations | Dependencies, advanced features |
| **Bottom** | Edge cases | Error recovery, troubleshooting |

### Standard Section Order

1. Critical Rules (Read First)
2. Overview / When to Use
3. Quick Reference (tables)
4. Common Workflows
5. Creating / Updating
6. Closing / Completing
7. Edge Cases and Error Recovery
8. Common Mistakes to Avoid

## Writing Main Rule Files

### Do

- Put critical rules at the very top
- Use tables for quick reference
- Keep sections brief (3-5 bullets)
- Link to code files with `See:` references
- Put edge cases at the bottom

### Don't

- Include multi-line code blocks
- Put JSON payloads inline
- Bury important rules in later sections
- Lead with error handling
- Duplicate information across sections

### Example: Good Section

```markdown
## Creating Items

Create items with required fields: title, type, priority.

| Field | Required | Default |
|-------|----------|---------|
| `title` | Yes | - |
| `type` | Yes | - |
| `priority` | No | 2 |

See: [code/tracking-beads/creating-items.md](code/tracking-beads/creating-items.md)
```

### Example: Bad Section

```markdown
## Creating Items

To create an item, run:

```bash
bd create --title "My item" --type task --priority 2
```

You can also create with a parent:

```bash
bd create --title "Child item" --type task --parent devenv-001
```
```

The bad example has inline code blocks that should be in a code file.

## Writing Code Files

Code files contain the detailed examples that would clutter the main rule.

### What to Include

- Full command examples with all flags
- JSON payload samples
- Multi-step procedures
- Platform-specific variants
- Edge case handling

### How to Organize

```markdown
# Topic Commands

## Basic Operations

```bash
command --basic-example
```

## Advanced Operations

```bash
command --with --many --flags \
  --and --options
```

## Payload Formats

```json
{
  "field": "value",
  "nested": {
    "example": true
  }
}
```
```

## When to Split Content

| Put in Code File | Keep in Main Rule |
|------------------|-------------------|
| 3+ command examples | Single short command |
| Multi-line JSON | Simple key-value reference |
| Step-by-step procedures | Checklist items |
| Platform-specific variants | Universal one-liners |
| Error recovery procedures | Brief error mentions |

## Linking Pattern

In the main rule, link to code files at the end of each section:

```markdown
See: [code/topic/workflows.md](code/topic/workflows.md)
```

## Existing Code Directories

| Directory | Contents |
|-----------|----------|
| `code/tracking-azure-devops/` | Azure DevOps CLI commands |
| `code/tracking-beads/` | Beads workflows, dependencies, edge cases |
| `code/style-csharp/` | C# code patterns |
| `code/workflow-implementation/` | Implementation workflow commands |
| `code/workflow-planning/` | Planning workflow commands |
| `code/workflow-self-learning/` | Self-learning CLI and payloads |
| `code/versioning/` | Git tag and release commands |

## Creating a New Rule

### 1. Create the Main Rule File

```bash
# Create the rule
touch .claude/rules/my-new-rule.md
```

Structure it with:
- Critical rules at top
- Tables for reference
- `See:` links to code files
- Edge cases at bottom

### 2. Create the Code Directory

```bash
# Create code directory
mkdir -p .claude/rules/code/my-new-rule
```

### 3. Add Code Files

```bash
# Add workflow examples
touch .claude/rules/code/my-new-rule/workflows.md
```

### 4. Update CLAUDE.md

Add your rule to the rules table in `CLAUDE.md`:

```markdown
| `my-new-rule.md` | All projects | Brief description of purpose |
```

## Example: Complete Rule Structure

**Main rule** (`.claude/rules/example-rule.md`):

```markdown
# Example Rule

## Critical Rules

> **NEVER do X without first doing Y.**

## Overview

Brief description of what this rule covers.

## Quick Reference

| Term | Meaning |
|------|---------|
| A | Description of A |
| B | Description of B |

## Common Workflow

1. Step one
2. Step two
3. Step three

See: [code/example/workflows.md](code/example/workflows.md)

## Edge Cases

| Situation | Action |
|-----------|--------|
| Error X | Do Y |
| Error Z | Do W |

See: [code/example/edge-cases.md](code/example/edge-cases.md)
```

**Code file** (`.claude/rules/code/example/workflows.md`):

```markdown
# Example Workflows

## Basic Operation

```bash
example-command --flag value
```

## With Options

```bash
example-command \
  --flag1 value1 \
  --flag2 value2
```
```

## Best Practices

1. **Start with critical rules** - What breaks if done wrong?
2. **Use tables liberally** - They're scannable and concise
3. **One concept per section** - Don't mix concerns
4. **Link, don't inline** - Code examples go in code files
5. **Order by frequency** - Common operations before rare ones
6. **End with edge cases** - Error handling last
