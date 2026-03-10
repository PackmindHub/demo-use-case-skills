---
name: slack-channel-review
description: Manually triggered skill that analyzes Slack channel discussions using MCP tools, classifies them for playbook relevance, and auto-invokes packmind-update-playbook with structured findings. Use when wanting to mine Slack conversations for recurring patterns, conventions, decisions, or action items that should be captured in the Packmind playbook. Supports non-interactive mode via `CI=true` or `--non-interactive` for scheduled GitHub Actions runs.
---

# Slack Channel Review Mining

Analyze Slack channel discussions from a configurable time window, classify messages for playbook relevance, and feed actionable findings into the `packmind-update-playbook` workflow.

**Workflow: Phase 0 → 1 → 2 → 3 → 4 → 5. Follow every phase in order.**

> **Prerequisite**: The Slack MCP server must be available. Load `references/slack-mcp-tools.md` for tool signatures and parameters.

## Phase 0: Collect Parameters

Gather the required inputs before fetching any data.

### Execution Mode Detection

Determine the execution mode **before** collecting any parameters:

1. **Check `CI` env var**: run `echo $CI`. If the value is `true`, set `non_interactive = true`.
2. **Check skill arguments**: if the skill was invoked with `--non-interactive`, set `non_interactive = true`.
3. **Parse optional arguments**:
   - `--days N` — override the default time period (default: 7 days)
   - `--channels channel1,channel2` — comma-separated list of channel names to analyze (default: `general`)

If neither condition is met, `non_interactive = false` (interactive mode — original behavior).

### Collect Parameters

1. **Gather `channels`**:
   - **Interactive**: Ask the user which channels to analyze (default: `general`).
   - **Non-interactive**: Use `--channels` value if provided, otherwise default to `general` silently.

2. **Gather `time_period`**:
   - **Interactive**: Ask the user how far back to look (default: 7 days, max: 30 days).
   - **Non-interactive**: Use `--days` value if provided, otherwise default to 7 days silently.

   Compute the cutoff date as `today - time_period` in `YYYY-MM-DD` format.

3. **Resolve channel IDs**: Use `mcp__slack__list_channels` to map channel names to IDs. If a channel name is not found, report it and skip it.

4. **Confirm** before proceeding:
   - **Interactive**: Display and **BLOCK** until the user confirms:
     > "Analyzing Slack channels **[channel list]** for the last **N days** (since YYYY-MM-DD). Proceed?"
   - **Non-interactive**: Log the parameters and proceed automatically:
     > "Non-interactive mode: analyzing Slack channels **[channel list]** for the last **N days** (since YYYY-MM-DD)."

## Phase 1: Fetch Channel Messages

For each resolved channel, use `mcp__slack__search_messages` to find messages within the time window.

- Use query: `in:#channel-name after:YYYY-MM-DD`
- Paginate to collect all matching messages.
- If no messages are found across all channels, inform the user and stop.
- Display progress: "Found **N** messages across **M** channels to analyze."

## Phase 2: Fetch Thread Context

For messages that have thread replies (indicated by `reply_count > 0` or thread metadata), use `mcp__slack__read_thread` to fetch the full thread context.

### Filtering

Apply these filters to discard noise:

**Low-value filtering** — discard messages that:
- Are shorter than 15 characters (excluding emoji reactions)
- Match low-value patterns: consists only of emoji reactions, "ok", "thanks", "+1", "done", "ack"
- Are bot-generated status messages (deploy notifications, CI results) unless they triggered a substantive discussion

**Thread deduplication** — for threads, keep the root message plus replies that add substantive content. Discard simple acknowledgments within threads.

Display progress: "Retained **N** substantive messages (after filtering)."

If no messages remain after filtering, inform the user and stop.

## Phase 3: Classify Discussions

Categorize each remaining message/thread by playbook relevance:

### High relevance (keep)
- **convention** — Establishes or references a naming, structure, or organizational pattern (e.g., "we should always name our hooks useXxx")
- **decision** — Records an architectural or technical decision (e.g., "we're going with Option B for the auth system")
- **best-practice** — Recommends or discusses a better approach for correctness, performance, or maintainability
- **recurring-pattern** — Same topic/question appears across multiple discussions or channels
- **action-item** — Commits to a specific change that affects team workflows or coding practices

### Low relevance (discard)
- **social** — General chat, greetings, off-topic
- **status-update** — Simple progress updates without technical substance
- **question-only** — Asks a question without reaching a conclusion or decision
- **troubleshooting** — One-off debugging help that doesn't generalize

Retain only High-relevance discussions.

### Recurring Theme Detection

Group retained discussions by semantic similarity. A **recurring theme** is 2+ discussions across different channels or days that address the same underlying pattern. For each theme:
- Assign a short descriptive label
- List all contributing messages/threads
- Note the occurrence count

### Codebase Relevance Gate

After classification, apply a strict codebase relevance filter to all high-relevance findings.

**Litmus test**: "Would an AI coding agent need to know this when writing, reviewing, or shipping code in this repository?" — if no, discard the signal.

| Signal | Verdict | Why |
|--------|---------|-----|
| "Always name hooks `useXxx`" | KEEP | Coding convention → standard |
| "Going with Option B for auth" | KEEP | Architecture decision → affects code structure |
| "Run `nx test` before pushing" | KEEP | Dev workflow → command |
| "PRs need one approval before merge" | KEEP | Affects how agent ships code |
| "Standup at 10am" | DISCARD | Meeting scheduling |
| "Retros bi-weekly" | DISCARD | Team ritual |
| "Use Jira instead of Linear" | DISCARD | Project management tooling |
| "Vacation via BambooHR" | DISCARD | HR process |

**Edge cases**: When a signal straddles both worlds (e.g., "use Linear labels X, Y, Z for PRs"), apply the litmus test strictly — does it change how an AI agent writes or ships code? If not, discard.

Display progress: "Retained **N** codebase-relevant findings (discarded **M** team-life signals)."

## Phase 4: Build Findings Report

Choose the output path based on execution mode:
- **Interactive**: `.claude/tmp/slack-review-findings.md`
- **Non-interactive**: `.claude/reports/slack-review-findings-YYYY-MM-DD.md` (using today's date, timestamped for CI artifact upload)

Create the target directory if needed.

### Report Structure

```markdown
# Slack Channel Review Findings Report

**Channels**: #channel1, #channel2
**Period**: YYYY-MM-DD to YYYY-MM-DD
**Messages analyzed**: N (after filtering)
**Actionable findings**: N
**Codebase-relevant findings**: N (of M high-relevance signals)

---

## Recurring Themes

### Theme: <label>
**Occurrences**: N across N channels/days

| Channel | Date | Author | Summary |
|---------|------|--------|---------|
| #channel | YYYY-MM-DD | @author | Summary of message/thread |
| #channel | YYYY-MM-DD | @author | Summary of message/thread |

**Suggested playbook action**: <Create standard | Update standard X | Create skill | Create command | ...>
**Rationale**: <Why this theme warrants a playbook change>

---

## Individual Findings

### Finding: <short description>
- **Channel**: #channel-name
- **Date**: YYYY-MM-DD
- **Author**: @author
- **Thread link**: (if available)
- **Summary**: Condensed description of the discussion
- **Key quotes**: Relevant excerpts from the conversation
- **Category**: convention | decision | best-practice | recurring-pattern | action-item
- **Suggested playbook action**: <action>

---

## Discarded Signals (team-life)

> Optional section for transparency. Lists signals that passed high-relevance classification but were filtered by the Codebase Relevance Gate.

| Signal summary | Reason discarded |
|---------------|-----------------|
| <one-line summary> | <meeting scheduling / team ritual / HR process / project management tooling / ...> |
```

## Phase 5: Present and Hand Off

### Interactive mode

1. Display a summary to the user:
   - Number of recurring themes found
   - Number of individual findings
   - List of suggested playbook actions

2. Ask the user:
   > "Found **N recurring themes** and **M individual findings**. Review the full report at `.claude/tmp/slack-review-findings.md`. Proceed to update the playbook with these findings?"

3. **On confirm**: Invoke the `packmind-update-playbook` skill with the full report content as the intent. This maps to **Case B (explicit intent)** of that skill's Phase 0. Frame the intent as:
   > "Update the Packmind playbook based on the following Slack channel review findings report: <full report content>"

4. **On decline**: Inform the user the report is available at `.claude/tmp/slack-review-findings.md` for manual review.

### Non-interactive mode

1. Display a summary (same as interactive: themes count, findings count, suggested actions).
2. Log the report output path:
   > "Report written to `.claude/reports/slack-review-findings-YYYY-MM-DD.md`."
3. **Invoke `packmind-update-playbook`** with the full report content as the intent, passing along non-interactive mode. Frame the intent as:
   > "Update the Packmind playbook based on the following Slack channel review findings report: <full report content>"

   The `packmind-update-playbook` skill will auto-approve all changes and delegate creation of new artifacts to the corresponding creation skills (`packmind-create-standard`, `packmind-create-command`, `packmind-create-skill`), all running in non-interactive mode.

## Resources

### references/
- `slack-mcp-tools.md` — Slack MCP tool signatures and parameters used by this skill
