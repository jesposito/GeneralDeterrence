# Documentation

Welcome to the Claude Code Development Environment documentation.

## Quick Links

| Guide | Description |
|-------|-------------|
| [Getting Started](getting-started.md) | Installation, setup, and first workflow |
| [Commands Reference](commands.md) | All slash commands and CLI commands |
| [Plugins Guide](plugins.md) | All 8 plugins and how they fit together |
| [Beads Guide](beads-guide.md) | Issue tracking with Beads |
| [Self-Learning Skills](self-learning-skills.md) | Persistent memory across sessions |
| [Progressive Disclosure](progressive-disclosure.md) | How rules are structured |
| [Workflow Guide](workflow.md) | Detailed planning and implementation workflows |
| [Settings](settings.md) | Project-specific configuration (.devenv/settings.json) |
| [Best Practices](best-practices.md) | Tips for effective use |

## What is This?

The Claude Code Development Environment is a standardized setup for AI-assisted development.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                              │
├────────────────┬────────────────┬────────────────┬──────────────┤
│    Planning    │    Tracking    │    Quality     │    Memory    │
│                │                │                │              │
│  /plan-new     │  Beads (bd)    │  TypeScript    │  Self-       │
│  Plannotator   │  Azure DevOps  │  C# LSP        │  Learning    │
│  /code-review  │                │  Ruby LSP      │  Skills      │
│                │                │  Security      │              │
├────────────────┴────────────────┴────────────────┴──────────────┤
│         Git Operations: /commit, /commit-push-pr, /clean_gone   │
└─────────────────────────────────────────────────────────────────┘

Planning ──► Tracking ──► Implementation ──► Review ──► Commit
   │            │              │               │           │
/plan-new    /ready       Code + Tests    /plannotator  /commit
             bd update    LSP support     -review
             bd close
```

## Features

It provides:

- **Status line** - Emoji dashboard: 🤖 model, 🌿 git, ⚡📋🐛🚫 beads health, 🏔️✨ progress, 🧠 context
- **Structured planning** - `/plan-new` for Master Plans and Feature Plans
- **Issue tracking** - Beads for git-native, AI-friendly issues
- **Git automation** - `/commit` and `/commit-push-pr`
- **Code review** - Interactive review tools
- **Language support** - LSPs for TypeScript, C#, and Ruby
- **Persistent memory** - Self-learning skills across sessions

## Typical Workflow

```
1. /plan-new              → Design and approve plan
2. /ready                 → Find work to do
3. Work on item           → Implement with Claude
4. /commit                → Commit changes
5. bd close <id>          → Close completed work
6. bd sync --from-main    → Sync before ending session
```

## Need Help?

- **Commands not working?** Check [Commands Reference](commands.md)
- **Issues with Beads?** See [Beads Guide](beads-guide.md)
- **Session problems?** Review [Best Practices](best-practices.md)
- **General Claude Code help**: Type `/help`
- **Report bugs**: https://github.com/anthropics/claude-code/issues
