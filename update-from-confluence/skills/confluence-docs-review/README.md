# Confluence Docs Review Skill

Browse Confluence documentation to extract coding practices, technical knowledge, and conventions for Packmind playbook updates.

## Usage

### Interactive

Start your AI coding agent and invoke the skill:

```
claude
> /confluence-docs-review
```

The skill will ask how you want to browse Confluence:
- **Page URL** — analyze a specific page
- **Space** — browse pages within a Confluence space
- **Search keywords** — find relevant pages by topic

### Non-Interactive (CI)

```bash
# Search by query
claude --skill confluence-docs-review --non-interactive --query "coding standards"

# Fetch a specific page
claude --skill confluence-docs-review --non-interactive --url "https://mysite.atlassian.net/wiki/spaces/ENG/pages/123456789"

# Browse a space
claude --skill confluence-docs-review --non-interactive --space ENG
```

At least one of `--url`, `--space`, or `--query` is required in non-interactive mode.

## Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `--url PAGE_URL` | Fetch a specific Confluence page by URL | No |
| `--space SPACE_KEY` | Browse pages within a specific space | No |
| `--query SEARCH_TERMS` | Search Confluence for pages matching these terms | No |
| `--non-interactive` | Run without user prompts (also triggered by `CI=true`) | No |

## Output

| Mode | Report path |
|------|-------------|
| Interactive | `.claude/tmp/confluence-review-findings.md` |
| CI | `.claude/reports/confluence-review-findings-YYYY-MM-DD.md` |

## Prerequisites

- Atlassian Rovo MCP server configured with Confluence access
- `PACKMIND_API_KEY_V3` environment variable set
- [Packmind CLI](https://docs.packmind.com/getting-started/gs-cli-setup) installed
