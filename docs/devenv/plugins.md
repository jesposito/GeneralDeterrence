# Plugins Guide

This environment includes 8 plugins plus 1 local skill. Each serves a specific role in the development workflow.

## Overview

| Plugin | Purpose | Role in Workflow |
|--------|---------|------------------|
| [Beads](#beads) | Git-backed issue tracking | Track work across sessions |
| [Plannotator](#plannotator) | Interactive code review | Review changes before commit |
| [Code Review](#code-review) | PR analysis | Comprehensive pull request review |
| [Commit Commands](#commit-commands) | Git automation | AI-assisted commits and PRs |
| [Security Guidance](#security-guidance) | Security analysis | Identify vulnerabilities |
| [TypeScript LSP](#typescript-lsp) | Code intelligence | TypeScript navigation and hints |
| [C# LSP](#csharp-lsp) | Code intelligence | C# navigation and hints |
| [Ruby LSP](#ruby-lsp) | Code intelligence | Ruby navigation and hints |
| [Self-Learning Skills](#self-learning-skills) | Persistent memory | Remember learnings across sessions |

---

## Beads

**Source:** [steveyegge/beads](https://github.com/steveyegge/beads)

**What it does:** Git-native issue tracking designed for AI agents. Issues are stored as JSONL in your repository and sync automatically with git operations.

**Why it matters:** Traditional issue trackers (Jira, GitHub Issues) require context switching and don't persist across Claude sessions. Beads keeps your work context inside the repo where Claude can always access it.

**How it fits:**
- **Planning:** `/plan-new` creates Beads epics, features, and tasks
- **Finding work:** `/ready` shows what's available to work on
- **During work:** Issues track status, blockers, and notes
- **Session end:** `bd sync --from-main` pulls team updates

**Key commands:**
```bash
bd ready                    # Find available work
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id>
bd sync --from-main
```

**Requires:** `bd` CLI binary (installed automatically)

See [Beads Guide](beads-guide.md) for detailed usage.

---

## Plannotator

**Source:** [backnotprop/plannotator](https://github.com/backnotprop/plannotator)

**What it does:** Orchestrates interactive code review sessions. Presents changes in a structured way and guides you through reviewing each modification.

**Why it matters:** Code review is often rushed or skipped. Plannotator makes review a first-class workflow step, catching issues before they're committed.

**How it fits:**
- **Before committing:** Run `/plannotator-review` to review your changes
- **Interactive:** Walk through each file and change
- **Catch issues:** Identify problems before they reach the repository

**Usage:**
```
/plannotator-review
```

**Requires:** `plannotator` binary (installed automatically)

---

## Code Review

**Source:** [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)

**What it does:** Comprehensive pull request analysis. Reviews code for bugs, security issues, style problems, and architectural concerns.

**Why it matters:** Automated review catches issues that humans miss, especially in large PRs. Provides consistent, thorough analysis every time.

**How it fits:**
- **PR creation:** Review before opening a PR
- **PR updates:** Re-review after addressing feedback
- **Learning:** Understand common issues in your codebase

**Usage:**
```
/code-review
```

---

## Commit Commands

**Source:** [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)

**What it does:** Automates git commit and PR workflows with AI-generated messages.

**Why it matters:** Good commit messages take time to write. This plugin analyzes your changes and creates meaningful, consistent messages automatically.

**How it fits:**
- **After implementation:** Use `/commit` to commit with a good message
- **PR workflow:** Use `/commit-push-pr` for the full cycle
- **Cleanup:** Use `/clean_gone` to remove stale branches

**Commands:**

| Command | Description |
|---------|-------------|
| `/commit` | Stage and commit with AI-generated message |
| `/commit-push-pr` | Commit, push, and create pull request |
| `/clean_gone` | Remove local branches deleted on remote |

---

## Security Guidance

**Source:** [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)

**What it does:** Analyzes code for security vulnerabilities. Identifies common issues like injection attacks, authentication flaws, and data exposure.

**Why it matters:** Security issues are easy to introduce and hard to find. This plugin provides continuous security awareness during development.

**How it fits:**
- **Background analysis:** Runs during code review
- **Implementation:** Warns about risky patterns as you code
- **Education:** Explains why certain patterns are dangerous

**Coverage includes:**
- SQL injection
- Cross-site scripting (XSS)
- Authentication/authorization flaws
- Sensitive data exposure
- OWASP Top 10 vulnerabilities

---

## TypeScript LSP

**Source:** [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)

**What it does:** Provides Language Server Protocol support for TypeScript. Enables code navigation, type information, and intelligent completions.

**Why it matters:** Claude can understand your TypeScript code at a deeper level—knowing types, following references, and understanding the full context of changes.

**How it fits:**
- **Code understanding:** Claude sees type information and relationships
- **Navigation:** Jump to definitions, find references
- **Refactoring:** Understand impact of changes across files

**Requires:**
- Node.js 18+
- `typescript-language-server` (installed automatically via npm)

---

## C# LSP

**Source:** [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)

**What it does:** Provides Language Server Protocol support for C#. Enables code navigation, type information, and intelligent analysis for .NET projects.

**Why it matters:** C# projects have complex type systems and project structures. The LSP helps Claude understand namespaces, inheritance, and cross-project references.

**How it fits:**
- **Code understanding:** Claude sees C# types, interfaces, and relationships
- **Navigation:** Jump to definitions across assemblies
- **Refactoring:** Understand inheritance hierarchies and implementations

**Requires:**
- .NET SDK 10+
- `csharp-ls` (installed automatically via `dotnet tool`)

**Note:** This environment enforces C# 14 style via `.editorconfig`. See [Best Practices](best-practices.md) for style guidelines.

---

## Ruby LSP

**Source:** [Piebald-AI/claude-code-lsps](https://github.com/Piebald-AI/claude-code-lsps)

**What it does:** Provides Language Server Protocol support for Ruby. Enables code navigation and intelligent analysis for Ruby projects.

**Why it matters:** Ruby's dynamic nature makes static analysis challenging. The LSP provides structure and navigation that helps Claude understand Ruby codebases.

**How it fits:**
- **Code understanding:** Claude sees Ruby methods, classes, and modules
- **Navigation:** Jump to definitions, find usages
- **Rails support:** Understand Rails conventions and patterns

**Requires:**
- Ruby 3.0+
- `ruby-lsp` gem (installed automatically)

---

## Self-Learning Skills

**Source:** [scottfalconer/self-learning-skills](https://github.com/scottfalconer/self-learning-skills) (bundled locally)

**What it does:** Persistent memory system for AI agents. Records "Aha moments" and recommendations that survive across sessions and compaction.

**Why it matters:** Without persistent memory, Claude starts fresh each session, repeating mistakes and rediscovering solutions. Self-learning skills let Claude build on past experience.

**How it fits:**
- **Before work:** Recall relevant learnings from past sessions
- **After work:** Record discoveries and patterns for future use
- **Over time:** Build a knowledge base specific to your project

**Key concepts:**

| Concept | Description |
|---------|-------------|
| **Aha Cards** | Durable, reusable learnings (fixes, patterns, constraints) |
| **Recommendations** | Actionable suggestions for improvements |
| **Scope** | `project` (repo-specific) or `portable` (generally reusable) |
| **Backporting** | Graduate proven learnings into permanent documentation |

**Commands:**
```bash
# Review recent learnings
python .claude/skills/self-learning-skills/scripts/self_learning.py review --days 7

# Find specific learnings
python .claude/skills/self-learning-skills/scripts/self_learning.py list --query "pagination"

# Record new learning (usually done by Claude automatically)
python .claude/skills/self-learning-skills/scripts/self_learning.py record --json payload.json
```

> **Note:** Use `python` (not `python3`) for Windows compatibility. The script works with either.

**Storage:** Learnings are stored in `.agent-skills/self-learning/` (gitignored by default).

**Requires:** Python 3.8+

See [Self-Learning Skills Guide](self-learning-skills.md) for detailed usage.

---

## Plugin Architecture

### Marketplaces

Plugins are distributed through GitHub-based marketplaces:

| Marketplace | Plugins |
|-------------|---------|
| `anthropics/claude-plugins-official` | code-review, commit-commands, security-guidance, typescript-lsp, csharp-lsp |
| `steveyegge/beads` | beads |
| `backnotprop/plannotator` | plannotator |
| `Piebald-AI/claude-code-lsps` | ruby-lsp |

### Local Skills

Skills in `.claude/skills/` are loaded automatically without marketplace installation. Self-learning-skills is bundled this way for easier setup.

### Configuration

Plugins are enabled in `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "beads@beads-marketplace": true,
    "plannotator@plannotator": true,
    "code-review@claude-plugins-official": true,
    ...
  }
}
```

### Permissions

Plugin tools are controlled by the permission system. Most are pre-approved in `settings.json` under `permissions.allow`. Dangerous operations require confirmation (listed under `permissions.ask`).

---

## Troubleshooting

### Plugin not loading

1. Check it's enabled in `.claude/settings.json`
2. Restart Claude Code
3. Verify required binaries are installed (see each plugin's requirements)

### LSP not working

Verify the language server is installed:

```bash
# TypeScript
npm list -g typescript-language-server

# C#
dotnet tool list -g | grep csharp-ls

# Ruby
gem list ruby-lsp
```

### Beads issues

```bash
bd doctor        # Diagnose problems
bd sync --status # Check sync state
```

### Self-learning not persisting

1. Check `.agent-skills/` directory exists
2. Initialize if needed: `python .claude/skills/self-learning-skills/scripts/self_learning.py init`
3. Verify Python 3.8+ is installed

> **Note:** Use `python` (not `python3`) for Windows compatibility.
