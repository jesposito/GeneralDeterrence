# Verify Plugin Installation

Use this prompt to verify that all Claude Code plugins are installed correctly and their hooks are properly configured.

## Prompt

```
Verify that the following Claude Code plugins are installed and accessible:

- beads@beads-marketplace
- plannotator@plannotator
- code-review@claude-plugins-official
- commit-commands@claude-plugins-official
- security-guidance@claude-plugins-official
- typescript-lsp@claude-plugins-official
- csharp-lsp@claude-plugins-official
- ruby-lsp@claude-code-lsps

For each plugin, confirm:
1. The plugin is enabled in .claude/settings.json
2. Any slash commands or skills are available
3. Any hooks are correctly configured
4. Any agents are accessible

Summarize the status in a table format.
```

## Expected Output

A table showing each plugin's status, available features (commands, hooks, agents), and any issues detected.

## Updating the Plugin List

Edit the list above to match your `.claude/settings.json` `enabledPlugins` section.
