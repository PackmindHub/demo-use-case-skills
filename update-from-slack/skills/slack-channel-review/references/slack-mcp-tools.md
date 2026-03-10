# Slack MCP Tools Reference

> **Note**: The Slack MCP server is at `https://mcp.slack.com/mcp`. Tool names are prefixed with `mcp__slack__` when accessed via Claude Code MCP integration.

## List Channels

**Tool**: `mcp__slack__list_channels`

List public channels in the workspace. Use this to resolve channel names to IDs.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Maximum number of channels to return (default: 100) |
| `cursor` | string | No | Pagination cursor for next page |

### Response Fields

- `channels[]` - array of channel objects
  - `id` - channel ID (e.g., `C01ABCDEF`)
  - `name` - channel name (without `#` prefix)
  - `topic.value` - channel topic
  - `purpose.value` - channel purpose
  - `num_members` - member count

---

## Search Messages

**Tool**: `mcp__slack__search_messages`

Search for messages matching a query across the workspace.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Slack search query (supports `in:#channel`, `from:@user`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`) |
| `count` | number | No | Number of results per page (default: 20, max: 100) |
| `page` | number | No | Page number for pagination (default: 1) |
| `sort` | string | No | Sort by: `score` or `timestamp` (default: `score`) |
| `sort_dir` | string | No | Sort direction: `asc` or `desc` (default: `desc`) |

### Response Fields

- `messages.total` - total number of matching messages
- `messages.matches[]` - array of message objects
  - `ts` - message timestamp (also serves as unique ID)
  - `text` - message text content
  - `user` - user ID of the author
  - `username` - display name of the author
  - `channel.id` - channel ID
  - `channel.name` - channel name
  - `permalink` - direct link to the message
  - `reply_count` - number of thread replies (if any)

### Query Syntax

```
in:#channel-name after:YYYY-MM-DD before:YYYY-MM-DD from:@username
```

- `in:#channel` — restrict to a specific channel
- `after:YYYY-MM-DD` — messages after this date
- `before:YYYY-MM-DD` — messages before this date
- `from:@user` — messages from a specific user
- Combine multiple filters with spaces (AND logic)

---

## Read Channel Messages

**Tool**: `mcp__slack__read_channel_messages`

Read recent messages from a specific channel.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel_id` | string | Yes | Channel ID (e.g., `C01ABCDEF`) |
| `limit` | number | No | Number of messages to return (default: 100) |
| `oldest` | string | No | Only messages after this Unix timestamp |
| `latest` | string | No | Only messages before this Unix timestamp |

### Response Fields

- `messages[]` - array of message objects
  - `ts` - message timestamp
  - `text` - message text
  - `user` - user ID
  - `reply_count` - number of thread replies
  - `thread_ts` - thread parent timestamp (if part of a thread)

---

## Read Thread

**Tool**: `mcp__slack__read_thread`

Read all replies in a message thread.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel_id` | string | Yes | Channel ID where the thread exists |
| `thread_ts` | string | Yes | Timestamp of the thread's parent message |

### Response Fields

- `messages[]` - array of messages in the thread (including the parent)
  - `ts` - message timestamp
  - `text` - message text
  - `user` - user ID
  - `parent_user_id` - user ID of the thread starter (on replies)

---

## Get User Info

**Tool**: `mcp__slack__get_user_info`

Get profile information for a Slack user by ID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Slack user ID (e.g., `U01ABCDEF`) |

### Response Fields

- `user` - user object
  - `id` - user ID
  - `name` - username
  - `real_name` - display name
  - `profile.display_name` - preferred display name
