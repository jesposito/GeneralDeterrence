# Project Settings

Settings are split across two files in `.devenv/`:

| File | Purpose | Git Status |
|------|---------|------------|
| `settings.json` | Project settings (Azure DevOps) | Gitignored |
| `settings.local.json` | User settings (email) | Gitignored |

## Setup

Copy both settings templates:

```bash
cp .devenv/settings.example.json .devenv/settings.json
cp .devenv/settings.local.example.json .devenv/settings.local.json
```

Edit `settings.json` with your project's Azure DevOps settings, and `settings.local.json` with your email:

```json
{
  "$schema": "./settings.schema.json",
  "user": {
    "email": "your-email@company.com"
  }
}
```

## Project Settings (settings.json)

Committed to the repository. Contains project-wide Azure DevOps configuration.

```json
{
  "$schema": "./settings.schema.json",
  "azureDevOps": {
    "orgUrl": "https://dev.azure.com/your-org",
    "project": "Your Project",
    "area": "Your Area",
    "defaultIteration": "Your Project"
  }
}
```

**Note:** The `azureDevOps` section is optional. Projects not using Azure DevOps can omit it entirely.

### Azure DevOps Fields

| Field | Description | Example |
|-------|-------------|---------|
| `orgUrl` | Organization URL | `https://dev.azure.com/myorg` |
| `project` | Project name | `My Project` |
| `area` | Default area path | `My Project\Team` |
| `defaultIteration` | Default iteration path | `My Project\Sprint 1` |

## User Settings (settings.local.json)

Gitignored. Each developer creates their own with their email.

```json
{
  "$schema": "./settings.schema.json",
  "user": {
    "email": "your-email@company.com"
  }
}
```

### User Fields

| Field | Description | Example |
|-------|-------------|---------|
| `email` | Your email for this project | `user@company.com` |

## Tokens

Code examples use tokens that Claude substitutes with your settings:

| Token | Source | Settings Path |
|-------|--------|---------------|
| `<user-email>` | `settings.local.json` | `user.email` |
| `<azure-devops-org-url>` | `settings.json` | `azureDevOps.orgUrl` |
| `<azure-devops-project>` | `settings.json` | `azureDevOps.project` |
| `<azure-devops-area>` | `settings.json` | `azureDevOps.area` |
| `<azure-devops-iteration>` | `settings.json` | `azureDevOps.defaultIteration` |

## Files

| File | Purpose | Git Status |
|------|---------|------------|
| `.devenv/settings.json` | Project settings | Gitignored |
| `.devenv/settings.example.json` | Template for project settings | Committed |
| `.devenv/settings.local.json` | User settings | Gitignored |
| `.devenv/settings.local.example.json` | Template for user settings | Committed |
| `.devenv/settings.schema.json` | JSON schema for validation | Committed |
