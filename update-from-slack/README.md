# Update Playbook from Slack Conversations

Mine Slack channel discussions for conventions, architectural decisions, best practices, and recurring patterns, then automatically create Packmind change proposals. Includes a codebase relevance gate that filters out team-life signals (meeting scheduling, HR processes, etc.) to keep findings focused on what matters for code.

Interactive usage only.

## How It Works

```mermaid
flowchart TD
    Slack["Slack<br>(channel messages)"] -->|Slack MCP Server| Fetch["slack-channel-review<br>Phase 1-2: Fetch messages & threads"]
    Fetch --> Filter["Phase 2: Filter noise<br>(short, emoji-only, bot status)"]
    Filter --> Classify["Phase 3: Classify<br>(convention, decision,<br>best-practice, recurring-pattern,<br>action-item)"]
    Classify --> Gate["Phase 3: Codebase<br>Relevance Gate"]
    Gate -->|codebase-relevant| Report["Phase 4: Build<br>findings report"]
    Gate -.->|discarded| TeamLife["Team-life signals<br>(meetings, HR, tooling)"]
    Report --> Update["packmind-update-playbook"]
    Update -->|Packmind CLI| Packmind["Packmind<br>Change Proposals"]
```

## Skills

| Skill | Description |
|-------|-------------|
| `slack-channel-review` | Fetches Slack messages and threads via Slack MCP, filters noise, classifies by playbook relevance, applies a codebase relevance gate, and produces a structured findings report |
| `packmind-update-playbook` | Reads the findings report and creates/updates Packmind playbook artifacts (standards, commands, skills) |
| `packmind-cli-list-commands` | Reference for Packmind CLI listing commands — used to discover existing artifacts before creating duplicates |

## Setup

### 1. Install Packmind CLI

```bash
npm install -g @packmind/cli
```

### 2. Configure Slack MCP Server

Add the [Slack MCP server](https://docs.slack.dev/ai/slack-mcp-server/) to your AI coding agent's MCP configuration (e.g. `.claude/mcp.json` for Claude Code):

```json
{
  "mcpServers": {
    "slack": {
      "type": "http",
      "url": "https://mcp.slack.com/mcp",
      "headers": {
        "Authorization": "Bearer <SLACK_TOKEN>"
      }
    }
  }
}
```

Follow the [Slack MCP server documentation](https://docs.slack.dev/ai/slack-mcp-server/) to create a Slack app and obtain the required token.

### 3. Deploy Skills

Copy the skills from this demo into your target repository:

```bash
cp -r update-from-slack/skills/slack-channel-review <your-repo>/.claude/skills/
cp -r update-from-slack/skills/packmind-update-playbook <your-repo>/.claude/skills/
cp -r update-from-slack/skills/packmind-cli-list-commands <your-repo>/.claude/skills/
```

### 4. Authentication

| Secret / Variable | Where | Purpose |
|-------------------|-------|---------|
| `PACKMIND_API_KEY_V3` | Environment variable | Packmind API authentication |
| Slack app token | MCP config | Slack MCP server access (see [Slack MCP docs](https://docs.slack.dev/ai/slack-mcp-server/)) |

## Usage

Start your AI coding agent in the repository and invoke the skill. Example with Claude Code:

```
claude
> /slack-channel-review
```

The skill will prompt you for:
- **Channels**: which Slack channels to analyze (default: `general`)
- **Time period**: how far back to look (default: 7 days, max: 30 days)

After analysis, findings are saved to `.claude/tmp/slack-review-findings.md` and you're asked whether to proceed with playbook updates.

## Codebase Relevance Gate

Unlike the GitHub PR use case, Slack conversations often contain signals that aren't relevant to code — meeting scheduling, HR processes, project management tooling, etc. The `slack-channel-review` skill applies a **codebase relevance gate** after classification:

> **Litmus test**: "Would an AI coding agent need to know this when writing, reviewing, or shipping code in this repository?"

| Signal | Verdict | Why |
|--------|---------|-----|
| "Always name hooks `useXxx`" | KEEP | Coding convention |
| "Going with Option B for auth" | KEEP | Architecture decision |
| "Run `nx test` before pushing" | KEEP | Dev workflow |
| "Standup at 10am" | DISCARD | Meeting scheduling |
| "Retros bi-weekly" | DISCARD | Team ritual |
| "Vacation via BambooHR" | DISCARD | HR process |

Discarded signals are listed in a transparency section at the end of the findings report.

## Output

| Mode | Report path |
|------|-------------|
| Interactive | `.claude/tmp/slack-review-findings.md` |

## Links

- [Packmind](https://github.com/PackmindHub/packmind/)
- [Packmind Documentation](https://docs.packmind.com)
- [Packmind CLI Setup](https://docs.packmind.com/getting-started/gs-cli-setup)
- [Slack MCP Server](https://docs.slack.dev/ai/slack-mcp-server/)
