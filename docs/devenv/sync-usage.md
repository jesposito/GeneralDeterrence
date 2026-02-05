# Sync Tool Usage Guide

Bidirectional synchronization of Claude Code configuration between the dev environment and project repositories.

## Quick Start

```bash
# From the dev-env directory:

# Preview what would sync to a project (upstream)
.\scripts\Sync-Repositories.ps1 -TargetPath "C:\path\to\project" -Direction upstream -DryRun

# Actually sync to a project
.\scripts\Sync-Repositories.ps1 -TargetPath "C:\path\to\project" -Direction upstream

# Pull improvements from a project back to dev-env (downstream)
.\scripts\Sync-Repositories.ps1 -TargetPath "C:\path\to\project" -Direction downstream

# Non-interactive mode (CI/scripts)
.\scripts\Sync-Repositories.ps1 -TargetPath "C:\path\to\project" -Direction upstream -NoInteractive
```

## Sync Directions

| Direction | Flow | Use Case |
|-----------|------|----------|
| **upstream** | dev-env → project | Push latest config to a project |
| **downstream** | project → dev-env | Pull improvements back to dev-env |
| **cross** | two-way merge | Sync between dev-env forks (future) |

## Categories

Files are organized into categories that can be synced independently:

| Category | Files | Merge Strategy |
|----------|-------|----------------|
| `workflow-rules` | `.claude/rules/*.md` | 3-way merge |
| `workflow-code` | `.claude/rules/code/**/*` | 3-way merge |
| `hooks` | `.claude/hooks/*` | Copy |
| `commands` | `.claude/commands/*` | 3-way merge |
| `skills` | `.claude/skills/**/*` | Copy |
| `status-line` | `.claude/scripts/status-line.ts` | Copy |
| `settings` | `.claude/settings.json` | Deep JSON merge |
| `editor-config` | `.editorconfig` | Line append |
| `git-config` | `.gitattributes` | Line append |
| `project-readme` | `CLAUDE.md` | Section-aware merge |
| `documentation` | `docs/**/*` | 3-way merge |
| `install-scripts` | `scripts/Install-*.ps1` | Copy (peer-sync only) |
| `setup-scripts` | `scripts/Setup-*.ps1` | Copy (peer-sync only) |

### Sync Specific Categories

```bash
# Sync only workflow rules
.\scripts\Sync-Repositories.ps1 -TargetPath "..." -Direction upstream -Categories "workflow-rules"

# Sync multiple categories
.\scripts\Sync-Repositories.ps1 -TargetPath "..." -Direction upstream -Categories "workflow-rules,settings,hooks"
```

## Presets

Presets are shortcuts for common category combinations:

| Preset | Categories | Description |
|--------|------------|-------------|
| `project` | All except install/setup scripts | **Default** - Safe for project sync |
| `core` | workflow-rules, workflow-code, hooks, commands, skills | Essential workflow config |
| `config` | settings, editor-config, git-config | Configuration files only |
| `scripts` | install-scripts, setup-scripts | Peer sync only |
| `all` | Everything | Use with caution |

```bash
# Use a specific preset
.\scripts\Sync-Repositories.ps1 -TargetPath "..." -Direction upstream -Preset core
```

## Merge Strategies

Different file types use different merge strategies:

| Strategy | Behavior | Used For |
|----------|----------|----------|
| **copy** | Overwrites target completely | Hooks, skills, scripts |
| **3way** | Git 3-way merge with conflict markers | Markdown, code files |
| **deep-json** | Recursive merge, arrays combined | settings.json |
| **line-append** | Adds unique lines from source | .editorconfig, .gitattributes |
| **section-aware** | Preserves marked sections in target | CLAUDE.md |

### Protected Content

Some content is protected from being overwritten:

- **settings.json**: `permissions.allow` and `permissions.deny` arrays are preserved
- **CLAUDE.md**: `## Permissions` and `## Project-Specific Rules` sections are preserved

## Company-Specific Filtering

Files marked as company-specific are automatically excluded from sync:

- `tracking-azure-devops.md` - Azure DevOps specific rules
- `azure-devops/workflows.md` - Azure DevOps code samples

These files exist in the source but won't sync to other projects. This allows the dev-env to contain company-specific rules without polluting other projects.

## Command Reference

```
Sync-Repositories.ps1
    [-TargetPath <path>]      # Target repo (default: current directory)
    [-Direction <string>]     # upstream, downstream, or cross
    [-Categories <string>]    # Comma-separated category IDs
    [-Preset <string>]        # core, config, scripts, all, project
    [-DryRun]                 # Preview without making changes
    [-Force]                  # Skip confirmation prompts
    [-NoInteractive]          # Non-interactive mode (requires -Direction)
```

## Examples

### Initial Project Setup

```bash
# Sync all project-appropriate config to a new project
.\scripts\Sync-Repositories.ps1 -TargetPath "C:\Projects\MyApp" -Direction upstream
```

### Pull Workflow Improvements

```bash
# A project improved the workflow rules - pull them back
.\scripts\Sync-Repositories.ps1 -TargetPath "C:\Projects\MyApp" -Direction downstream -Categories "workflow-rules,workflow-code"
```

### CI/Automated Sync

```bash
# Non-interactive sync for CI pipelines
.\scripts\Sync-Repositories.ps1 -TargetPath "." -Direction upstream -NoInteractive -Preset core
```

### Preview Before Sync

```bash
# Always preview first to see what will change
.\scripts\Sync-Repositories.ps1 -TargetPath "C:\Projects\MyApp" -Direction upstream -DryRun
```

## Troubleshooting

### "Source/Target has uncommitted changes"

The sync tool requires clean git state. Commit or stash changes before syncing.

### Merge Conflicts

For 3-way merges, conflicts are marked with standard git conflict markers:
```
<<<<<<< current
Your content
=======
Incoming content
>>>>>>> incoming
```

Resolve manually, then commit.

### Empty Arrays Becoming Null

Fixed in the sync tool. If you see `"deny": null` instead of `"deny": []` in settings.json, update to the latest sync scripts.
