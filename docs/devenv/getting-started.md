# Getting Started

This guide walks you through setting up and using the Claude Code Development Environment.

## What You Get

After setup, you'll have:

- **Status line** - Emoji dashboard: 🤖 model, 🌿 git, ⚡📋🐛🚫 beads health, 🏔️✨ progress, 🧠 context
- **Issue tracking** - Track work with Beads, a git-native issue tracker
- **Structured planning** - Break down work into epics, features, and tasks
- **Code intelligence** - LSP support for TypeScript, C#, and Ruby
- **Git automation** - AI-assisted commits and PR creation
- **Code review** - Interactive review tools
- **Persistent memory** - AI learns from your sessions

## Prerequisites

Before installing, make sure you have:

| Tool | Version | Why |
|------|---------|-----|
| [Node.js](https://nodejs.org/) | 18+ | TypeScript language server |
| [.NET SDK](https://dotnet.microsoft.com/) | 10+ | C# language server |
| [Ruby](https://www.ruby-lang.org/) | 3.0+ | Ruby language server |
| [Python](https://www.python.org/) | 3.8+ | Self-learning skills |
| [Bun](https://bun.sh/) | Latest | Hook scripts, status line |
| [Azure CLI](https://aka.ms/installazurecli) | Latest | Azure DevOps integration |
| [Claude Code](https://claude.ai/code) | Latest | AI assistant |

After installing Azure CLI, add the DevOps extension:
```bash
az extension add --name azure-devops
```

## Installation

Run the install script for your platform:

**Windows (PowerShell)**
```powershell
.\scripts\Install-ClaudePlugins.ps1
```

**macOS/Linux**
```bash
./scripts/install-claude-plugins.sh
```

The script installs all plugins and downloads required tools.

## Setup Your Project

Use the setup script to copy configuration files to your project:

**Windows (PowerShell)**
```powershell
.\scripts\Setup-Repository.ps1 -TargetPath C:\path\to\your\project -Prefix myproject
```

**macOS/Linux**
```bash
./scripts/setup-repository.sh /path/to/your/project --prefix myproject
```

The script:
1. Copies `.claude/` configuration (rules, hooks, commands, skills)
2. Copies `.editorconfig` and `.gitattributes`
3. Copies `CLAUDE.md` project instructions
4. Initializes Beads issue tracking with your prefix

**Options:**
- `--dry-run` - Preview changes without modifying files
- `--force` - Overwrite existing files without merging (default: merge)

The prefix creates readable issue IDs like `myproject-001` instead of `bd-a1b2`.

### Configure Settings

Copy the settings templates:

```bash
cp .devenv/settings.example.json .devenv/settings.json
cp .devenv/settings.local.example.json .devenv/settings.local.json
```

Edit `.devenv/settings.json` with your project's Azure DevOps configuration (if applicable), and `.devenv/settings.local.json` with your email.

See [Settings](settings.md) for details.

### Verify Setup

Check that everything works:

```bash
bd doctor
```

## Your First Workflow

### Planning Work

Start by creating a plan:

```
/plan-new
```

Claude will ask:
1. **Master Plan** - For new major work (creates epic + features)
2. **Feature Plan** - For implementing a specific feature (creates tasks)

Choose based on your scope, then Claude guides you through designing the plan.

### Finding Work

See what's ready to work on:

```bash
/ready
```

This shows issues with no blockers.

### Working on an Issue

Tell Claude what to work on:

```
Work on myproject-003
```

Claude will:
1. Validate the issue isn't blocked
2. Set status to in-progress
3. Review the plan
4. Implement with tests
5. Close with detailed notes

### Committing Changes

Use AI-assisted commits:

```
/commit
```

Claude analyzes changes and creates a meaningful commit message.

## What's Next

- [Commands Reference](commands.md) - All available slash commands
- [Plugins Guide](plugins.md) - All 8 plugins and how they fit together
- [Beads Guide](beads-guide.md) - Detailed issue tracking guide
- [Workflow Guide](workflow.md) - Planning and implementation details
- [Best Practices](best-practices.md) - Tips for effective use
