---
name: notion-docs-review
description: Manually triggered skill that browses Notion documentation using Notion MCP tools, extracts coding practices and technical knowledge, classifies them for playbook relevance, and auto-invokes packmind-update-playbook with structured findings. Use when wanting to mine Notion pages for conventions, architectural decisions, best practices, or technical knowledge that should be captured in the Packmind playbook. Supports non-interactive mode via `CI=true` or `--non-interactive` for scheduled runs.
---

# Notion Documentation Review

Browse Notion documentation to extract coding practices, technical knowledge, and conventions, classify them for playbook relevance, and feed actionable findings into the `packmind-update-playbook` workflow.

**Workflow: Phase 0 → 1 → 2 → 3 → 4 → 5. Follow every phase in order.**

> **Prerequisite**: The Notion MCP server must be available (`https://mcp.notion.com/mcp`). Load `references/notion-mcp-tools.md` for tool signatures and parameters.

## Phase 0: Collect Parameters

Gather the required inputs before fetching any data.

### Execution Mode Detection

Determine the execution mode **before** collecting any parameters:

1. **Check `CI` env var**: run `echo $CI`. If the value is `true`, set `non_interactive = true`.
2. **Check skill arguments**: if the skill was invoked with `--non-interactive`, set `non_interactive = true`.
3. **Parse optional arguments**:
   - `--url PAGE_URL` — fetch a specific Notion page by URL
   - `--database DATABASE_URL` — browse pages within a specific Notion database
   - `--query SEARCH_TERMS` — search Notion for pages matching these terms

If neither condition is met, `non_interactive = false` (interactive mode — original behavior).

### Collect Parameters

1. **Gather search input**:
   - **Interactive**: Check if the user provided a URL, database, or query as arguments. If not, ask:
     > "How would you like to browse Notion? You can:
     > 1. Provide a **page URL** to analyze a specific page
     > 2. Specify a **database URL** to browse pages within it
     > 3. Enter **search keywords** to find relevant pages
     >
     > What would you like to search for?"

     If the user provides a Notion URL, use it directly with `notion-fetch`. Common URL formats:
     - `https://www.notion.so/<workspace>/<Page-Title>-<page-id>`
     - `https://<workspace>.notion.site/<Page-Title>-<page-id>`

   - **Non-interactive**: Use `--url`, `--database`, or `--query` value if provided. If **none** are provided, log a warning and exit gracefully:
     > "Non-interactive mode: no --url, --database, or --query provided. Exiting. Provide at least one parameter to specify what to search."

2. **Confirm** before proceeding:
   - **Interactive**: Display and **BLOCK** until the user confirms:
     - URL mode: > "Fetching Notion page at **URL**. Proceed?"
     - Database mode: > "Browsing pages in database **DATABASE_URL**. Proceed?"
     - Query mode: > "Searching Notion for **'SEARCH_TERMS'**. Proceed?"
   - **Non-interactive**: Log the parameters and proceed automatically:
     > "Non-interactive mode: <mode description>."

## Phase 1: Fetch Pages

Fetch pages based on the input mode determined in Phase 0.

### URL Mode (specific page)

Use `notion-fetch` with the page URL as the `id` parameter to fetch the page content directly.

- If the page is not found or inaccessible, inform the user and stop.
- Result: a single page to analyze.

### Database Mode (browse database)

1. Use `notion-fetch` with the database URL as the `id` parameter to retrieve the database structure, including data sources and view URLs.
2. From the response, extract view URLs (format: `https://www.notion.so/workspace/db-id?v=view-id`).
3. Use `notion-query-database-view` with the first (default) view URL to list pages in the database.
4. **Interactive**: Display the page list and ask the user to select which pages to analyze (or "all").
5. **Non-interactive**: Take all pages (capped at 50).
6. For each selected page, use `notion-fetch` with the page URL or ID to fetch full content.

### Query Mode (search)

1. Use `notion-search` with `query_type: "internal"` and the user's query to find relevant pages.
2. From the results, identify Notion page references (filter out non-page results).
3. Use `notion-fetch` to retrieve full content for each matched page.
4. Cap at **50 pages** maximum. If more results exist, log a warning and process only the first 50.

### Progress

- If no pages are found, inform the user and stop.
- Display progress: "Found **N** pages to analyze."

## Phase 2: Extract & Filter Content

For each fetched page, extract and clean the content.

### Content Extraction

- Use the enhanced Markdown body content from each page.
- Record metadata for each page:
  - **Page title**
  - **Page ID**
  - **Parent** (database name or parent page)
  - **Last edited date**
  - **Full Notion URL** (mandatory) — use the URL from the `notion-fetch` response. If the URL was provided as input, use it directly. For pages fetched via search or database query, construct from `https://www.notion.so/<page-id>`. **Every page in the report MUST have a navigable URL** — this is critical for source attribution in `packmind-update-playbook`.

### Filtering

Apply these filters to discard noise:

**Low-value filtering** — discard pages that:
- Have empty or negligible content (less than 50 characters of text after stripping formatting)
- Are clearly non-technical based on title and content heuristics (e.g., meeting notes, HR policies, team events, vacation calendars, org charts)
- Are archived or marked as deprecated/outdated in their content

**Title-based heuristics for non-technical content** — discard pages whose titles strongly indicate non-coding content:
- Meeting minutes, standup notes, retrospective notes
- Onboarding checklists (unless coding-specific)
- Team directory, org charts, holiday calendars
- Budget, procurement, travel policies

Display progress: "Retained **N** substantive pages (after filtering)."

If no pages remain after filtering, inform the user and stop.

## Phase 3: Classify for Relevance

Categorize each remaining page by playbook relevance.

### High relevance (keep)
- **convention** — Documents a naming, structure, or organizational pattern (e.g., "API naming conventions", "folder structure guide")
- **decision** — Records an architectural or technical decision (e.g., "ADR: chose PostgreSQL over MongoDB")
- **best-practice** — Recommends a better approach for correctness, performance, or maintainability (e.g., "Error handling guidelines")
- **recurring-pattern** — Pattern or approach documented across multiple pages
- **action-item** — Commits to a specific change that affects coding practices or workflows

### Low relevance (discard)
- **non-technical** — Content unrelated to software development
- **process-only** — Describes project management processes without coding implications
- **outdated** — Explicitly marked as deprecated or superseded by newer documentation

Retain only High-relevance pages.

### Recurring Theme Detection

Group retained pages by semantic similarity. A **recurring theme** is 2+ pages that address the same underlying pattern. For each theme:
- Assign a short descriptive label
- List all contributing pages
- Note the occurrence count

### Codebase Relevance Gate

After classification, apply a strict codebase relevance filter to all high-relevance findings.

**Litmus test**: "Would an AI coding agent need to know this when writing, reviewing, or shipping code in this repository?" — if no, discard the signal.

| Signal | Verdict | Why |
|--------|---------|-----|
| "All API endpoints must validate input with Zod" | KEEP | Coding convention |
| "Use feature flags for gradual rollouts" | KEEP | Architecture pattern |
| "Error handling: always wrap async calls in try-catch" | KEEP | Best practice |
| "Git branching strategy: trunk-based development" | KEEP | Dev workflow |
| "Team OKRs for Q1 2026" | DISCARD | Business metrics |
| "How to request PTO" | DISCARD | HR process |
| "Notion workspace organization guide" | DISCARD | Tooling documentation |
| "Sprint planning process" | DISCARD | Project management |

**Edge cases**: When a signal straddles both worlds (e.g., "How to set up your local dev environment"), apply the litmus test strictly — does it change how an AI agent writes or ships code? If it documents required environment variables, local setup commands, or build steps, KEEP. If it only describes how to install Slack or set up email, DISCARD.

Display progress: "Retained **N** codebase-relevant findings (discarded **M** non-relevant signals)."

## Phase 4: Build Findings Report

Choose the output path based on execution mode:
- **Interactive**: `.claude/tmp/notion-review-findings.md`
- **Non-interactive**: `.claude/reports/notion-review-findings-YYYY-MM-DD.md` (using today's date, timestamped for CI artifact upload)

Create the target directory if needed.

### Report Structure

```markdown
# Notion Documentation Review Findings Report

**Source**: <URL | Database URL | Search "query">
**Pages analyzed**: N (after filtering)
**Actionable findings**: N
**Codebase-relevant findings**: N (of M high-relevance signals)

---

## Recurring Themes

### Theme: <label>
**Occurrences**: N pages

| Page | Parent | Last Modified | Summary |
|------|--------|---------------|---------|
| [Page Title](url) | PARENT | YYYY-MM-DD | Summary of page content |
| [Page Title](url) | PARENT | YYYY-MM-DD | Summary of page content |

**Suggested playbook action**: <Create standard | Update standard X | Create skill | Create command | ...>
**Rationale**: <Why this theme warrants a playbook change>

---

## Individual Findings

### Finding: <short description>
- **Page**: [Page Title](url)
- **Parent**: PARENT
- **Last modified**: YYYY-MM-DD
- **Summary**: Condensed description of the coding practice or knowledge
- **Key excerpts**: Relevant excerpts from the page content
- **Category**: convention | decision | best-practice | recurring-pattern | action-item
- **Suggested playbook action**: <action>

---

## Discarded Signals (non-relevant)

> Optional section for transparency. Lists signals that passed high-relevance classification but were filtered by the Codebase Relevance Gate.

| Signal summary | Reason discarded |
|---------------|-----------------|
| <one-line summary> | <non-technical / process-only / business metrics / ...> |
```

### URL Requirements

**Every page reference in the report MUST include the full, navigable Notion URL** (e.g., `https://www.notion.so/workspace/Page-Title-abc123def456`). This is critical because `packmind-update-playbook` extracts source URLs from the findings report for its `packmind-cli diff --submit -m` source attribution. The expected attribution format is:

```
<topic>: <summary> (source: Notion <Page Title> https://www.notion.so/workspace/Page-Title-abc123def456)
```

If a URL cannot be constructed from the API response, fall back to `https://www.notion.so/<page-id>`.

## Phase 5: Present and Hand Off

### Interactive mode

1. Display a summary to the user:
   - Number of recurring themes found
   - Number of individual findings
   - List of suggested playbook actions

2. Ask the user:
   > "Found **N recurring themes** and **M individual findings**. Review the full report at `.claude/tmp/notion-review-findings.md`. Proceed to update the playbook with these findings?"

3. **On confirm**: Invoke the `packmind-update-playbook` skill with the full report content as the intent. This maps to **Case B (explicit intent)** of that skill's Phase 0. Frame the intent as:
   > "Update the Packmind playbook based on the following Notion documentation review findings report: <full report content>"

4. **On decline**: Inform the user the report is available at `.claude/tmp/notion-review-findings.md` for manual review.

### Non-interactive mode

1. Display a summary (same as interactive: themes count, findings count, suggested actions).
2. Log the report output path:
   > "Report written to `.claude/reports/notion-review-findings-YYYY-MM-DD.md`."
3. **Invoke `packmind-update-playbook`** with the full report content as the intent, passing along non-interactive mode. Frame the intent as:
   > "Update the Packmind playbook based on the following Notion documentation review findings report: <full report content>"

   The `packmind-update-playbook` skill will auto-approve all changes and delegate creation of new artifacts to the corresponding creation skills (`packmind-create-standard`, `packmind-create-command`, `packmind-create-skill`), all running in non-interactive mode.

## Resources

### references/
- `notion-mcp-tools.md` — Notion MCP tool signatures and parameters used by this skill
