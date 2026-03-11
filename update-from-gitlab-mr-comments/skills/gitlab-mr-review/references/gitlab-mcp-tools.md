# GitLab MCP Tools Reference

> **Note**: The GitLab MCP server provides tools for interacting with GitLab projects, merge requests, issues, and more. Tool names are prefixed with `mcp__gitlab__` when accessed via Claude Code MCP integration.

## Search

**Tool**: `mcp__gitlab__search`

Search across GitLab for merge requests, issues, notes, and more.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scope` | string | Yes | Search scope: `merge_requests`, `issues`, `notes`, `milestones`, `projects`, etc. |
| `search` | string | Yes | Search query string. **Use `"*"` to match all** — an empty string `""` causes a 500 error. |
| `state` | string | No | Filter by state: `opened`, `closed`, `merged` (for merge requests) |
| `project_id` | string | No | Project path (`namespace/project`) to scope the search |
| `page` | number | No | Page number for pagination (default: 1) |
| `per_page` | number | No | Results per page, max 100 (default: 20) |

### Response Fields (merge_requests scope)

- Array of merge request objects
  - `iid` - merge request IID (project-scoped ID)
  - `title` - MR title
  - `web_url` - web URL (e.g., `https://gitlab.com/namespace/project/-/merge_requests/123`)
  - `state` - current state (`merged`, `opened`, `closed`)
  - `author.username` - author username
  - `merged_at` - merge timestamp (null if not merged)
  - `description` - MR description

### Response Fields (notes scope)

- Array of note objects
  - `body` - note text
  - `author.username` - note author
  - `created_at` - creation timestamp
  - `noteable_type` - type of parent object (`MergeRequest`, `Issue`, etc.)
  - `noteable_iid` - IID of the parent object

### Usage for Merged MRs

```
mcp__gitlab__search(
  scope: "merge_requests",
  search: "*",
  state: "merged",
  project_id: "namespace/project",
  per_page: 100
)
```

### Usage for MR Notes (Recommended for MR Comments)

Use `scope: "notes"` to fetch review comments from merge requests. This is the **primary method** for retrieving MR discussion notes — `get_workitem_notes` does not support MR URLs (see caveat below).

```
mcp__gitlab__search(
  scope: "notes",
  search: "*",
  project_id: "namespace/project",
  per_page: 100
)
```

Response includes `noteable_type` (`"MergeRequest"`, `"Issue"`) and `noteable_iid` to correlate notes back to their parent MR.

---

## Get Merge Request

**Tool**: `mcp__gitlab__get_merge_request`

Get full details for a specific merge request.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Project path (`namespace/project`) |
| `merge_request_iid` | number | Yes | Merge request IID (project-scoped ID) |

### Response Fields

- `iid` - merge request IID
- `title` - MR title
- `description` - MR description
- `state` - current state (`merged`, `opened`, `closed`)
- `author.username` - author username
- `merged_at` - merge timestamp
- `merged_by.username` - user who merged
- `web_url` - web URL
- `labels[]` - array of labels
- `source_branch` - source branch name
- `target_branch` - target branch name
- `diff_refs` - diff reference information
- `changes_count` - number of file changes

---

## Get Work Item Notes

**Tool**: `mcp__gitlab__get_workitem_notes`

Get discussion notes for a work item by URL.

> **CAVEAT — NOT usable for Merge Request notes.** This tool only accepts `/-/work_items/<iid>` URLs. Passing a merge request URL (`/-/merge_requests/<iid>`) returns a validation error. Using `project_id` + `work_item_iid` with an MR IID also fails because MR IIDs are not work item IIDs.
>
> **For MR comments, use `mcp__gitlab__search` with `scope: "notes"` instead** (see Search section above).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Full web URL of a **work item** (e.g., `https://gitlab.com/namespace/project/-/work_items/42`). MR URLs are **not supported**. |
| `project_id` | string | No | Project path (alternative to URL-based lookup) |
| `work_item_iid` | number | No | Work item IID (alternative to URL-based lookup) — this is a **work item** IID, not an MR IID |
| `first` | number | No | Number of notes to return (forward pagination, max 100) |
| `after` | string | No | Cursor for forward pagination |

### Response Fields

- Array of note objects
  - `id` - note ID
  - `body` - note text (Markdown)
  - `author.username` - note author
  - `author.name` - author display name
  - `created_at` - creation timestamp
  - `updated_at` - update timestamp
  - `system` - boolean flag indicating if this is a system-generated note
  - `discussion_id` - discussion thread ID (notes in the same thread share this ID)
  - `noteable_type` - type of parent object (`MergeRequest`, `Issue`)
  - `resolvable` - whether the note can be resolved (true for diff notes)
  - `resolved` - whether the note has been resolved

### System Notes

When `system: true`, the note was auto-generated by GitLab. Common system notes:
- Label changes: "added ~label" / "removed ~label"
- Assignee changes: "assigned to @user" / "unassigned @user"
- Milestone changes: "changed milestone to %milestone"
- Pipeline status: "Pipeline #123 passed" / "Pipeline #123 failed"
- Branch operations: "merged", "rebased"
- Reviewer assignments: "requested review from @user"

**Always filter out system notes** — they are not human review comments.

---

## Get Merge Request Diffs

**Tool**: `mcp__gitlab__get_merge_request_diffs`

Get the file diffs for a merge request (useful for understanding code context of comments).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Project path (`namespace/project`) |
| `merge_request_iid` | number | Yes | Merge request IID |
| `page` | number | No | Page number for pagination (default: 1) |
| `per_page` | number | No | Results per page (default: 20) |

### Response Fields

- Array of diff objects
  - `old_path` - file path before change
  - `new_path` - file path after change
  - `diff` - unified diff content
  - `new_file` - boolean, true if file was created
  - `renamed_file` - boolean, true if file was renamed
  - `deleted_file` - boolean, true if file was deleted
