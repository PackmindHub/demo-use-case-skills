# Confluence MCP Tools Reference

> **Note**: The Atlassian Rovo MCP server provides Confluence tools. Tool names are prefixed with `mcp__confluence__` when accessed via Claude Code MCP integration.

## Get Accessible Atlassian Resources

**Tool**: `mcp__confluence__getAccessibleAtlassianResources`

Get the cloud ID required for all other Confluence API calls.

### Parameters

No required parameters.

### Response Fields

- Array of accessible resources
  - `id` - cloud ID (UUID)
  - `name` - site name
  - `url` - site URL
  - `scopes` - available scopes

---

## Rovo Search

**Tool**: `mcp__confluence__search`

Natural-language search across Jira and Confluence using Rovo Search. Use this as the default search tool unless CQL is specifically needed.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language search query |

### Response Fields

- Array of search results with ARIs (Atlassian Resource Identifiers) that can be used with `mcp__confluence__fetch`

---

## Search Confluence Using CQL

**Tool**: `mcp__confluence__searchConfluenceUsingCql`

Search content with CQL (Confluence Query Language) for precise, structured queries.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cloudId` | string | Yes | Cloud ID (UUID or site URL) |
| `cql` | string | Yes | CQL query string |
| `limit` | number | No | Max results (default: 25, max: 250) |
| `cursor` | string | No | Pagination cursor |
| `expand` | string | No | Properties to expand |

### CQL Syntax

Common CQL patterns:
- `title ~ "coding standards" AND type = page` — search by title keyword
- `space = KEY AND type = page` — all pages in a space
- `label = "best-practice" AND type = page` — pages with a specific label
- `text ~ "convention" AND space = KEY` — full-text search within a space
- `lastModified >= "2026-01-01" AND type = page` — recently modified pages
- `ancestor = PAGE_ID AND type = page` — pages under a parent page

---

## Get Confluence Page

**Tool**: `mcp__confluence__getConfluencePage`

Get a Confluence page by ID, including body content.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cloudId` | string | Yes | Cloud ID (UUID or site URL) |
| `pageId` | string | Yes | Confluence page ID from the URL (e.g., `123456789`) |
| `contentFormat` | string | No | Body format: `"markdown"` or `"adf"` (Atlassian Document Format) |

### Response Fields

- `id` - page ID
- `title` - page title
- `spaceId` - space ID
- `status` - page status
- `body.markdown` / `body.atlas_doc_format` - page content
- `version.number` - version number
- `version.createdAt` - last modified date
- `_links.webui` - web URL for the page

---

## Get Confluence Spaces

**Tool**: `mcp__confluence__getConfluenceSpaces`

List available Confluence spaces.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cloudId` | string | Yes | Cloud ID (UUID or site URL) |
| `type` | string | No | Space type: `"global"` or `"personal"` |
| `status` | string | No | Space status: `"current"` or `"archived"` |
| `keys` | string/array | No | Filter by space key(s) |
| `limit` | number | No | Max results (default: 25, max: 250) |

### Response Fields

- `results[]` - array of space objects
  - `id` - space ID
  - `key` - space key
  - `name` - space name
  - `type` - space type
  - `status` - space status

---

## Get Pages in Confluence Space

**Tool**: `mcp__confluence__getPagesInConfluenceSpace`

List pages within a specific space.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cloudId` | string | Yes | Cloud ID (UUID or site URL) |
| `spaceId` | string | Yes | Space ID |
| `title` | string | No | Filter by title |
| `status` | string | No | Page status: `"current"`, `"archived"`, `"deleted"`, `"trashed"` |
| `sort` | string | No | Sort order (e.g., `"-modified-date"`, `"title"`) |
| `limit` | number | No | Max results (default: 25, max: 250) |
| `cursor` | string | No | Pagination cursor |

### Response Fields

- `results[]` - array of page objects
  - `id` - page ID
  - `title` - page title
  - `status` - page status
  - `spaceId` - space ID

---

## Fetch by ARI

**Tool**: `mcp__confluence__fetch`

Get details of a Confluence page (or Jira issue) by Atlassian Resource Identifier. Use this with ARIs returned from `mcp__confluence__search`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Atlassian Resource Identifier (e.g., `ari:cloud:confluence:cloudId:page/123456789`) |

### Response Fields

Returns full page or issue details depending on the ARI type.
