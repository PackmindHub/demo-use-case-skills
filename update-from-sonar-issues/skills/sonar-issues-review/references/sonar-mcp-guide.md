# SonarQube MCP Reference

Quick reference for MCP tool parameters and response schemas. All calls use the MCP server identifier `user-sonarqube`.

The main workflow (discover project → fetch issues → aggregate → fetch rule details → present) is described in the SKILL.md phases. This file provides supplementary detail on tool signatures and response structures.

---

## `search_my_sonarqube_projects`

Lists all projects in the organization. Optionally filter by name with the `q` parameter:

```
server: user-sonarqube
tool: search_my_sonarqube_projects
arguments:
  q: "packmind"   # optional name filter
```

The response contains an array of projects, each with a `key` and `name`. Use the `key` value as the `projectKey` for subsequent calls.

---

## `search_sonar_issues_in_projects`

### Available parameters

| Parameter                | Type       | Description                                                        |
|--------------------------|------------|--------------------------------------------------------------------|
| `projects`               | `string[]` | Project keys to search in                                          |
| `severities`             | `string[]` | Filter: `BLOCKER`, `HIGH`, `MEDIUM`, `LOW`, `MINOR`                |
| `issueStatuses`          | `string[]` | Filter: `OPEN`, `CONFIRMED`, `FALSE_POSITIVE`, `ACCEPTED`, `FIXED` |
| `impactSoftwareQualities`| `string[]` | Filter: `MAINTAINABILITY`, `RELIABILITY`, `SECURITY`               |
| `ps`                     | `number`   | Page size (1–500, default 100)                                     |
| `p`                      | `number`   | Page number (1-based, default 1)                                   |
| `files`                  | `string[]` | Filter by component keys (file paths)                              |
| `pullRequestId`          | `string`   | Filter by pull request identifier                                  |

### Response structure (per issue)

| Field                        | Description                              |
|------------------------------|------------------------------------------|
| `rule`                       | Rule key (e.g. `typescript:S3863`)       |
| `severity`                   | Issue severity level                     |
| `message`                    | Issue description                        |
| `component`                  | File path where the issue is located     |
| `textRange.startLine`        | Starting line number                     |
| `textRange.endLine`          | Ending line number                       |
| `cleanCodeAttribute`         | Clean code attribute (e.g. `FOCUSED`)    |
| `cleanCodeAttributeCategory` | Attribute category (e.g. `ADAPTABLE`)    |
| `status`                     | Current status                           |
| `author`                     | Author who introduced the issue          |
| `creationDate`               | Date the issue was created               |

### Pagination

Check `paging.total` in the response. If it exceeds 500, fetch subsequent pages (`p: 2`, `p: 3`, `p: 4`).

---

## `show_rule`

The `key` parameter is required and must match the rule key exactly as returned in the issue (e.g. `typescript:S3863`).

### Response structure

| Field                | Description                                                                 |
|----------------------|-----------------------------------------------------------------------------|
| `key`                | Rule key                                                                    |
| `name`               | Human-readable rule name                                                    |
| `severity`           | Rule severity level                                                         |
| `type`               | Rule type: `BUG`, `VULNERABILITY`, or `CODE_SMELL`                          |
| `lang` / `langName`  | Language key and human-readable language name                               |
| `impacts`            | Array of `{ softwareQuality, severity }` describing quality impacts         |
| `htmlDesc`           | Full HTML description including why it is an issue, noncompliant/compliant examples, and references |
| `descriptionSections`| Array of content sections (same information as `htmlDesc`, split into parts) |
