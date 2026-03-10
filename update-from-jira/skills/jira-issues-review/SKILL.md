---
name: jira-issues-review
description: Manually triggered skill that analyzes recently resolved Jira issues using Atlassian MCP tools, classifies them for playbook relevance, and auto-invokes packmind-update-playbook with structured findings. Use when wanting to mine resolved Jira issues for recurring patterns, conventions, decisions, or action items that should be captured in the Packmind playbook. Supports non-interactive mode via `CI=true` or `--non-interactive` for scheduled runs.
---

# Jira Issues Review Mining

Analyze recently resolved Jira issues from a configurable time window, classify them for playbook relevance, and feed actionable findings into the `packmind-update-playbook` workflow.

**Workflow: Phase 0 → 1 → 2 → 3 → 4 → 5. Follow every phase in order.**

> **Prerequisite**: The Atlassian Rovo MCP server must be available. Load `references/jira-mcp-tools.md` for tool signatures and parameters.

## Phase 0: Collect Parameters

Gather the required inputs before fetching any data.

### Execution Mode Detection

Determine the execution mode **before** collecting any parameters:

1. **Check `CI` env var**: run `echo $CI`. If the value is `true`, set `non_interactive = true`.
2. **Check skill arguments**: if the skill was invoked with `--non-interactive`, set `non_interactive = true`.
3. **Parse optional arguments**:
   - `--days N` — override the default time period (default: 7 days, max: 90 days)
   - `--project PROJECT_KEY` — restrict analysis to a specific Jira project

If neither condition is met, `non_interactive = false` (interactive mode — original behavior).

### Collect Parameters

1. **Gather `project`**:
   - **Interactive**: Ask the user which project to analyze. If they don't specify one, use `mcp__atlassian__getVisibleJiraProjects` to list available projects and let the user choose. If the user wants to analyze all projects, omit the project filter from JQL.
   - **Non-interactive**: Use `--project` value if provided. If not provided, analyze all projects (no project filter in JQL).

2. **Gather `time_period`**:
   - **Interactive**: Ask the user how far back to look (default: 7 days, max: 90 days).
   - **Non-interactive**: Use `--days` value if provided, otherwise default to 7 days silently.

   Compute the cutoff date as `today - time_period` in `YYYY-MM-DD` format.

3. **Confirm** before proceeding:
   - **Interactive**: Display and **BLOCK** until the user confirms:
     > "Analyzing resolved Jira issues **[in project KEY]** for the last **N days** (since YYYY-MM-DD). Proceed?"
   - **Non-interactive**: Log the parameters and proceed automatically:
     > "Non-interactive mode: analyzing resolved Jira issues **[in project KEY]** for the last **N days** (since YYYY-MM-DD)."

## Phase 1: Fetch Resolved Issues

Use `mcp__atlassian__searchJiraIssuesUsingJql` with JQL:

```
project = KEY AND resolved >= -Nd ORDER BY resolved DESC
```

Or without project filter:

```
resolved >= -Nd ORDER BY resolved DESC
```

- Paginate using `startAt` and `maxResults` to collect all matching issues.
- Cap at **200 issues** maximum. If more exist, log a warning and process only the first 200.
- If no issues are found, inform the user and stop.
- Display progress: "Found **N** resolved issues to analyze."

## Phase 2: Fetch Details & Filter

For each issue, use `mcp__atlassian__getJiraIssue` to fetch the full description and comments.

### Filtering

Apply these filters to discard noise:

**Low-value filtering** — discard issues that:
- Have no description AND no comments
- Have a description shorter than 30 characters AND no comments
- Are sub-tasks (`issuetype.name == "Sub-task"`) with no substantial description or comments (less than 30 chars combined)
- Are bot-created and auto-resolved issues with no human comments (check if reporter is a bot/automation account and no human comments exist)

**Duplicate deduplication** — for issues linked as duplicates (via `issuelinks` with type "Duplicate"), keep only the primary issue (the one that is not marked as duplicate of another). Discard the duplicated issues.

Display progress: "Retained **N** substantive issues (after filtering)."

If no issues remain after filtering, inform the user and stop.

## Phase 3: Classify Issues

Categorize each remaining issue by playbook relevance:

### High relevance (keep)
- **convention** — Establishes or references a naming, structure, or organizational pattern (e.g., "All API endpoints must validate with Zod")
- **decision** — Records an architectural or technical decision (e.g., "Decided to use event sourcing for orders")
- **best-practice** — Recommends or discusses a better approach for correctness, performance, or maintainability (e.g., "Always add migration scripts for schema changes")
- **recurring-pattern** — Same type of issue or fix appears across multiple issues
- **action-item** — Commits to a specific change that affects team workflows or coding practices

### Low relevance (discard)
- **routine-bugfix** — Standard bug fix with no generalizable lesson
- **maintenance** — Dependency updates, version bumps, or routine housekeeping
- **one-off** — Unique, non-recurring issue that doesn't generalize
- **external-dependency** — Issue caused by external service or third-party, no internal learning

Retain only High-relevance issues.

### Recurring Theme Detection

Group retained issues by semantic similarity. A **recurring theme** is 2+ issues that address the same underlying pattern. For each theme:
- Assign a short descriptive label
- List all contributing issues
- Note the occurrence count

### Codebase Relevance Gate

After classification, apply a strict codebase relevance filter to all high-relevance findings.

**Litmus test**: "Would an AI coding agent need to know this when writing, reviewing, or shipping code in this repository?" — if no, discard the signal.

| Signal | Verdict | Why |
|--------|---------|-----|
| "All API endpoints must validate with Zod" | KEEP | Coding convention |
| "Decided event sourcing for orders" | KEEP | Architecture decision |
| "Always add migration scripts" | KEEP | Dev workflow |
| "Run integration tests before merge" | KEEP | Affects how agent ships code |
| "Sprint velocity was 42 points" | DISCARD | Project metrics |
| "Move ticket to QA column after dev" | DISCARD | Process tooling |
| "Use Jira instead of Linear" | DISCARD | Project management tooling |
| "Retro action: more pair programming" | DISCARD | Team ritual |

**Edge cases**: When a signal straddles both worlds (e.g., "label PRs with Jira ticket number"), apply the litmus test strictly — does it change how an AI agent writes or ships code? If not, discard.

Display progress: "Retained **N** codebase-relevant findings (discarded **M** non-relevant signals)."

## Phase 4: Build Findings Report

Choose the output path based on execution mode:
- **Interactive**: `.claude/tmp/jira-review-findings.md`
- **Non-interactive**: `.claude/reports/jira-review-findings-YYYY-MM-DD.md` (using today's date, timestamped for CI artifact upload)

Create the target directory if needed.

### Report Structure

```markdown
# Jira Issues Review Findings Report

**Project**: KEY (or "All projects")
**Period**: YYYY-MM-DD to YYYY-MM-DD
**Issues analyzed**: N (after filtering)
**Actionable findings**: N
**Codebase-relevant findings**: N (of M high-relevance signals)

---

## Recurring Themes

### Theme: <label>
**Occurrences**: N issues

| Issue | Type | Reporter | Resolution Date | Summary |
|-------|------|----------|-----------------|---------|
| [PROJ-123](url) | Story | @reporter | YYYY-MM-DD | Summary of issue |
| [PROJ-456](url) | Bug | @reporter | YYYY-MM-DD | Summary of issue |

**Suggested playbook action**: <Create standard | Update standard X | Create skill | Create command | ...>
**Rationale**: <Why this theme warrants a playbook change>

---

## Individual Findings

### Finding: <short description>
- **Issue**: [PROJ-123](url)
- **Type**: Story | Bug | Task | Epic
- **Reporter**: @reporter
- **Resolution date**: YYYY-MM-DD
- **Labels**: label1, label2
- **Summary**: Condensed description of the issue and its resolution
- **Key discussion**: Relevant excerpts from comments
- **Category**: convention | decision | best-practice | recurring-pattern | action-item
- **Suggested playbook action**: <action>

---

## Discarded Signals (non-relevant)

> Optional section for transparency. Lists signals that passed high-relevance classification but were filtered by the Codebase Relevance Gate.

| Signal summary | Reason discarded |
|---------------|-----------------|
| <one-line summary> | <project metrics / process tooling / team ritual / ...> |
```

## Phase 5: Present and Hand Off

### Interactive mode

1. Display a summary to the user:
   - Number of recurring themes found
   - Number of individual findings
   - List of suggested playbook actions

2. Ask the user:
   > "Found **N recurring themes** and **M individual findings**. Review the full report at `.claude/tmp/jira-review-findings.md`. Proceed to update the playbook with these findings?"

3. **On confirm**: Invoke the `packmind-update-playbook` skill with the full report content as the intent. This maps to **Case B (explicit intent)** of that skill's Phase 0. Frame the intent as:
   > "Update the Packmind playbook based on the following Jira issues review findings report: <full report content>"

4. **On decline**: Inform the user the report is available at `.claude/tmp/jira-review-findings.md` for manual review.

### Non-interactive mode

1. Display a summary (same as interactive: themes count, findings count, suggested actions).
2. Log the report output path:
   > "Report written to `.claude/reports/jira-review-findings-YYYY-MM-DD.md`."
3. **Invoke `packmind-update-playbook`** with the full report content as the intent, passing along non-interactive mode. Frame the intent as:
   > "Update the Packmind playbook based on the following Jira issues review findings report: <full report content>"

   The `packmind-update-playbook` skill will auto-approve all changes and delegate creation of new artifacts to the corresponding creation skills (`packmind-create-standard`, `packmind-create-command`, `packmind-create-skill`), all running in non-interactive mode.

## Resources

### references/
- `jira-mcp-tools.md` — Atlassian Jira MCP tool signatures and parameters used by this skill
