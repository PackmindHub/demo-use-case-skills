# Slack MCP Tools Reference

> **Note**: The Slack MCP server is at `https://mcp.slack.com/mcp`. Tool names are prefixed with `mcp__plugin_slack_slack__` when accessed via Claude Code MCP integration.

## Search Channels

**Tool**: `mcp__plugin_slack_slack__slack_search_channels`

Search for Slack channels by name or description. Use this to resolve channel names to IDs.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query for finding channels (e.g., "backend", "engineering") |
| `limit` | integer | No | Number of results to return, up to 20 (default: 20) |
| `cursor` | string | No | Pagination cursor for next page |
| `channel_types` | string | No | Comma-separated list: `public_channel`, `private_channel` (default: `public_channel`) |
| `include_archived` | boolean | No | Include archived channels in results |
| `response_format` | string | No | `detailed` (default) or `concise` |

### Response Fields

- `channels[]` - array of channel objects
  - `id` - channel ID (e.g., `C01ABCDEF`)
  - `name` - channel name (without `#` prefix)
  - `creator` - channel creator
  - `is_archived` - archive status

---

## Search Messages

**Tool**: `mcp__plugin_slack_slack__slack_search_public`

Search for messages in public Slack channels. Supports both keyword and semantic search.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query with modifiers (see Query Syntax below) |
| `limit` | integer | No | Number of results to return, up to 20 (default: 20) |
| `cursor` | string | No | Pagination cursor for next page |
| `sort` | string | No | Sort by: `score` or `timestamp` (default: `score`) |
| `sort_dir` | string | No | Sort direction: `asc` or `desc` (default: `desc`) |
| `include_context` | boolean | No | Include surrounding context messages (default: true). Set to false to reduce response size |
| `max_context_length` | integer | No | Max character length for each context message |
| `include_bots` | boolean | No | Include bot messages (default: false) |
| `content_types` | string | No | Comma-separated: `messages`, `files` |

### Response Fields

- Results include for each message:
  - `ts` - message timestamp (also serves as unique ID)
  - `text` - message text content
  - `user` / `username` - author ID and display name
  - `channel.id` / `channel.name` - channel info
  - `permalink` - direct link to the message
  - `reply_count` - number of thread replies (if any)

### Query Syntax

```
in:#channel-name after:YYYY-MM-DD before:YYYY-MM-DD from:@username
```

- `in:#channel` — restrict to a specific channel
- `after:YYYY-MM-DD` — messages after this date
- `before:YYYY-MM-DD` — messages before this date
- `from:@user` or `from:<@U123>` — messages from a specific user
- `is:thread` / `has:link` / `has:file` — content filters
- `"exact phrase"` — exact text matching
- Combine multiple filters with spaces (AND logic)

---

## Read Channel Messages

**Tool**: `mcp__plugin_slack_slack__slack_read_channel`

Read recent messages from a specific channel in reverse chronological order (newest first).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel_id` | string | Yes | Channel ID (e.g., `C01ABCDEF`). Can also be a user_id for DM history |
| `limit` | integer | No | Number of messages to return, 1-100 (default: 100) |
| `oldest` | string | No | Only messages after this Unix timestamp |
| `latest` | string | No | Only messages before this Unix timestamp |
| `cursor` | string | No | Pagination cursor for next page |
| `response_format` | string | No | `detailed` (default) or `concise` |

### Response Fields

- `messages[]` - array of message objects
  - `ts` - message timestamp
  - `text` - message text
  - `user` - user ID
  - `reply_count` - number of thread replies
  - `thread_ts` - thread parent timestamp (if part of a thread)

---

## Read Thread

**Tool**: `mcp__plugin_slack_slack__slack_read_thread`

Read all replies in a message thread (parent message + all replies).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel_id` | string | Yes | Channel ID where the thread exists |
| `message_ts` | string | Yes | Timestamp of the thread's parent message |
| `limit` | integer | No | Number of messages to return, 1-1000 (default: 100) |
| `oldest` | string | No | Only messages after this Unix timestamp |
| `latest` | string | No | Only messages before this Unix timestamp |
| `cursor` | string | No | Pagination cursor for next page |
| `response_format` | string | No | `detailed` (default) or `concise` |

### Response Fields

- `messages[]` - array of messages in the thread (including the parent)
  - `ts` - message timestamp
  - `text` - message text
  - `user` - user ID
  - `parent_user_id` - user ID of the thread starter (on replies)

---

## Read User Profile

**Tool**: `mcp__plugin_slack_slack__slack_read_user_profile`

Get profile information for a Slack user by ID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Slack user ID (e.g., `U01ABCDEF`) |

### Response Fields

- User profile information including:
  - `id` - user ID
  - `name` - username
  - `real_name` - display name
  - `profile.display_name` - preferred display name
