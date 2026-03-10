# Jira MCP Tools Reference

> **Note**: The Atlassian Rovo MCP server provides Jira tools. Tool names are prefixed with `mcp__atlassian__` when accessed via Claude Code MCP integration.

## Search Issues Using JQL

**Tool**: `mcp__atlassian__searchJiraIssuesUsingJql`

Search for Jira issues using JQL (Jira Query Language).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `jql` | string | Yes | JQL query string |
| `maxResults` | number | No | Maximum number of results to return (default: 50) |
| `startAt` | number | No | Index of the first result to return for pagination (default: 0) |

### Response Fields

- `issues[]` - array of issue objects
  - `key` - issue key (e.g., `PROJ-123`)
  - `fields.summary` - issue title
  - `fields.status.name` - current status
  - `fields.resolution.name` - resolution type (e.g., `Done`, `Won't Do`)
  - `fields.resolutiondate` - resolution date
  - `fields.issuetype.name` - issue type (e.g., `Story`, `Bug`, `Task`, `Sub-task`)
  - `fields.reporter.displayName` - reporter name
  - `fields.assignee.displayName` - assignee name
  - `fields.labels[]` - array of labels
  - `fields.description` - issue description (may be Atlassian Document Format or plain text)
  - `fields.comment.comments[]` - array of comments
  - `fields.subtasks[]` - array of sub-task references
  - `fields.parent` - parent issue reference (for sub-tasks)

### JQL Syntax

```
project = KEY AND resolved >= -7d ORDER BY resolved DESC
```

Common JQL patterns:
- `resolved >= -7d` — resolved in the last 7 days
- `resolved >= -14d` — resolved in the last 14 days
- `project = KEY AND resolved >= -7d ORDER BY resolved DESC` — project-scoped, recently resolved
- `resolution = Done AND resolutiondate >= "2026-03-03"` — resolved as Done since a specific date
- `issuetype != Sub-task AND resolved >= -7d` — exclude sub-tasks
- `labels in (architecture, convention) AND resolved >= -7d` — filter by labels

Date qualifiers:
- `-Nd` — relative days (e.g., `-7d`, `-14d`, `-90d`)
- `"YYYY-MM-DD"` — absolute date

---

## Get Jira Issue

**Tool**: `mcp__atlassian__getJiraIssue`

Get full details for a specific Jira issue by key or ID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `issueIdOrKey` | string | Yes | Issue key (e.g., `PROJ-123`) or numeric ID |

### Response Fields

- `key` - issue key
- `fields.summary` - issue title
- `fields.description` - full description
- `fields.status.name` - current status
- `fields.resolution.name` - resolution type
- `fields.resolutiondate` - resolution date
- `fields.issuetype.name` - issue type
- `fields.reporter.displayName` - reporter name
- `fields.assignee.displayName` - assignee name
- `fields.labels[]` - array of labels
- `fields.comment.comments[]` - array of comment objects
  - `author.displayName` - comment author
  - `body` - comment text
  - `created` - comment creation timestamp
  - `updated` - comment update timestamp
- `fields.subtasks[]` - sub-tasks
- `fields.parent` - parent issue (for sub-tasks)
- `fields.issuelinks[]` - linked issues (duplicates, blocks, relates to)

---

## Get Visible Jira Projects

**Tool**: `mcp__atlassian__getVisibleJiraProjects`

List all Jira projects visible to the authenticated user.

### Parameters

No required parameters.

### Response Fields

- `values[]` (or top-level array) of project objects
  - `key` - project key (e.g., `PROJ`)
  - `name` - project name
  - `projectTypeKey` - project type (e.g., `software`, `business`)

---

## Get Issue Remote Links

**Tool**: `mcp__atlassian__getJiraIssueRemoteIssueLinks`

Get remote links associated with an issue (e.g., Confluence pages, GitHub PRs, external URLs).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `issueIdOrKey` | string | Yes | Issue key (e.g., `PROJ-123`) or numeric ID |

### Response Fields

- Array of remote link objects
  - `object.url` - remote link URL
  - `object.title` - link title
  - `relationship` - link relationship type

---

## Lookup Jira Account ID

**Tool**: `mcp__atlassian__lookupJiraAccountId`

Resolve user display names or emails to Jira account IDs.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | User display name or email to search for |

### Response Fields

- Array of user match objects
  - `accountId` - Jira account ID
  - `displayName` - user display name
  - `emailAddress` - user email (if visible)
