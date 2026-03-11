# Notion Docs Review Skill

Browse Notion documentation to extract coding practices, technical knowledge, and conventions for Packmind playbook updates.

## Usage

### Interactive

Start your AI coding agent and invoke the skill:

```
claude
> /notion-docs-review
```

The skill will ask how you want to browse Notion:
- **Page URL** — analyze a specific page
- **Database** — browse pages within a Notion database
- **Search keywords** — find relevant pages by topic

### Non-Interactive (CI)

```bash
# Search by query
claude --skill notion-docs-review --non-interactive --query "coding standards"

# Fetch a specific page
claude --skill notion-docs-review --non-interactive --url "https://www.notion.so/workspace/Page-Title-abc123def456"

# Browse a database
claude --skill notion-docs-review --non-interactive --database "https://www.notion.so/workspace/Database-abc123?v=def456"
```

At least one of `--url`, `--database`, or `--query` is required in non-interactive mode.

## Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `--url PAGE_URL` | Fetch a specific Notion page by URL | No |
| `--database DATABASE_URL` | Browse pages within a specific Notion database | No |
| `--query SEARCH_TERMS` | Search Notion for pages matching these terms | No |
| `--non-interactive` | Run without user prompts (also triggered by `CI=true`) | No |

## Output

| Mode | Report path |
|------|-------------|
| Interactive | `.claude/tmp/notion-review-findings.md` |
| CI | `.claude/reports/notion-review-findings-YYYY-MM-DD.md` |

## Prerequisites

- Notion MCP server configured (`https://mcp.notion.com/mcp`) with OAuth access to your workspace
- `PACKMIND_API_KEY_V3` environment variable set
- [Packmind CLI](https://docs.packmind.com/getting-started/gs-cli-setup) installed
