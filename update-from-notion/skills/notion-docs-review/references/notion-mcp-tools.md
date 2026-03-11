# Notion MCP Tools Reference

> **Note**: The Notion MCP server is hosted at `https://mcp.notion.com/mcp` and uses OAuth for authentication. Tool names are prefixed with `notion-` (e.g., `notion-search`, `notion-fetch`).

## Search

**Tool**: `notion-search`

Semantic search across the Notion workspace and connected sources (Slack, Google Drive, GitHub, Jira, Microsoft Teams, SharePoint, OneDrive, Linear). Auto-selects AI search (with connected sources) or workspace search (workspace-only, faster) based on the user's access to Notion AI.

Use the `notion-fetch` tool for full page/database contents after getting search results.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Semantic search query. For best results, use one question per tool call |
| `query_type` | string | No | `"internal"` (content search, default) or `"user"` (search users by name/email) |
| `content_search_mode` | string | No | Override auto-detection: `"workspace_search"` (faster, workspace-only) or `"ai_search"` (includes connected sources) |
| `page_url` | string | No | URL or ID of a page to search within. Searches content within and under the specified page |
| `teamspace_id` | string | No | Teamspace ID (UUIDv4) to restrict search results to a specific teamspace |
| `data_source_url` | string | No | Data source URL (`collection://...`) to search within a database's data source |
| `filters` | object | No | Filters for `query_type: "internal"` only |
| `filters.created_date_range` | object | No | `{ "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }` |
| `filters.created_by_user_ids` | array | No | Array of Notion user IDs (UUIDv4, max 100) |

### Response Fields

The response object has a top-level `type` field (`"workspace_search"` or `"ai_search"`) and a `results` array. Each result contains:

| Field | Description |
|-------|-------------|
| `id` | Page UUID |
| `title` | Page title |
| `url` | Full `notion.so` URL (pass directly to `notion-fetch`) |
| `type` | Entity type (e.g., `"page"`) |
| `highlight` | Matched text snippet — useful for pre-filtering before expensive `notion-fetch` calls |
| `timestamp` | Last edited time (`1970-01-01T00:00:00.000Z` when unknown) |

### Notes

- To search within a database: first fetch the database with `notion-fetch` to get the data source URL (`collection://...`) from `<data-source url="...">` tags, then pass that as `data_source_url`
- Do not combine a database URL/ID with the `collection://` prefix for `data_source_url`
- Do not use a database URL as `page_url`

---

## Fetch

**Tool**: `notion-fetch`

Retrieve details about a Notion entity (page, database, or data source) by URL or ID. Pages are returned in Notion's enhanced Markdown format.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | URL or ID of the Notion page, database, or data source. Accepts `notion.so` URLs, Notion Sites URLs (`*.notion.site`), raw UUIDs, and data source URLs (`collection://...`) |
| `include_discussions` | boolean | No | Include discussion counts and inline discussion markers |
| `include_transcript` | boolean | No | Include transcript content |

### Response Fields (Page)

- Page title
- Page content in enhanced Markdown
- Page URL (navigable `notion.so` URL)
- Last edited time
- Parent information

### Response Fields (Database)

- Database title and description
- Data sources with `<data-source url="collection://...">` tags
- View URLs in format `https://www.notion.so/workspace/db-id?v=view-id`
- Available templates

### Notes

- Make multiple calls to fetch multiple entities
- For databases, data source IDs from `<data-source>` tags can be passed back to this tool or used with `notion-search` and `notion-query-database-view`

---

## Query Database View

**Tool**: `notion-query-database-view`

Query pages from a Notion database using a pre-defined view's filters, sorts, and column selections.

### Prerequisites

1. Use `notion-fetch` first to get the database and its view URLs
2. View URLs are found in database responses, typically in the format: `https://www.notion.so/workspace/db-id?v=view-id`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `view_url` | string | Yes | URL of a specific database view to query (e.g., `https://www.notion.so/workspace/Tasks-DB-abc123?v=def456`) |

### Response Fields

- Array of pages matching the view's filters and sorts
- Each page includes properties, title, and URL

---

## Get Teams

**Tool**: `notion-get-teams`

List teams (teamspaces) in the current workspace. Useful for discovering teamspace IDs to use as filters in `notion-search`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Search query to filter teams by name (case-insensitive, max 100 chars) |

### Response Fields

- Teams split by membership status (max 10 results)
- Each team includes:
  - `id` - teamspace ID (UUIDv4)
  - `name` - team name
  - Membership status and role
