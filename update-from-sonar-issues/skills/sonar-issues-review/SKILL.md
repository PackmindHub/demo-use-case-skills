---
name: sonar-issues-review
description: 'Analyze SonarQube issues for the current repository, identify the most violated coding rules, fetch their details, and propose Packmind playbook updates (standards, commands, skills) based on the findings. Use this skill when the user wants to set up coding context from SonarQube, import SonarQube rules into Packmind, or bridge static analysis findings with team coding standards. Triggers on requests like "setup context from sonar", "import sonar rules", "sync sonar issues to packmind", "analyze sonar issues".'
---

# Setup Context from SonarQube Issues

Fetch the most violated SonarQube rules for the current repository, retrieve detailed rule descriptions, and invoke the Packmind update-playbook workflow to propose new or updated coding standards based on the findings.

**Prerequisites**: The `user-sonarqube` MCP server must be configured and accessible.

---

## Phase 0: Confirm Parameters with User

Before starting the analysis, confirm two parameters with the user:

### Minimum severity filter

Ask the user which minimum severity level to use for filtering issues. Default is `MINOR`.

Available levels (from most to least severe): `BLOCKER`, `HIGH`, `MEDIUM`, `LOW`, `MINOR`.

If the user does not specify a severity filter, ask:

> "I'll filter SonarQube issues with a minimum severity of **MINOR**. Would you like to use a different minimum severity? (BLOCKER / HIGH / MEDIUM / LOW / MINOR)"

Only fetch issues at or above the chosen minimum severity. For example, if the minimum is `MEDIUM`, fetch `BLOCKER`, `HIGH`, and `MEDIUM` tiers only.

### Number of top rules to analyze

Ask the user how many of the most violated rules to include. Default is **30**.

> "I'll analyze the **30** most violated rules. Would you like more or fewer?"

**BLOCK** — do not proceed until the user confirms or adjusts both parameters.

---

## Phase 1: Discover the SonarQube Project Key

Try both approaches in order:

### Option A — Read from repository

Look for `sonar-project.properties` at the repository root and extract the `sonar.projectKey` value.

### Option B — Query SonarQube

If no properties file is found, call the MCP tool to search for the project:

```
server: user-sonarqube
tool: search_my_sonarqube_projects
arguments: {}
```

Present the list of projects to the user and ask them to confirm which project to analyze. If only one project is found, confirm it with the user before proceeding.

If no project is found, stop and inform the user.

---

## Phase 2: Fetch Issues and Identify the Most Violated Rules

Collect up to **2,000** OPEN issues ordered by severity to identify the top N most violated rules (N = user-confirmed count from Phase 0).

### Severity tiers (fetch in this order, stop at the minimum severity threshold)

1. `BLOCKER`
2. `HIGH`
3. `MEDIUM`
4. `LOW`
5. `MINOR`

Only fetch tiers that are **at or above** the minimum severity chosen in Phase 0. Skip any tier below the threshold.

### Procedure

For each applicable severity tier, call:

```
server: user-sonarqube
tool: search_sonar_issues_in_projects
arguments:
  projects: ["<projectKey>"]
  issueStatuses: ["OPEN"]
  severities: ["<SEVERITY>"]
  ps: 500
  p: 1
```

If `paging.total` exceeds 500, fetch subsequent pages (`p: 2`, `p: 3`, `p: 4`) up to the 500-per-page limit.

Accumulate issues across severity tiers. Stop once **2,000** total issues have been collected or all applicable tiers are exhausted.

### Aggregate by rule

Group all collected issues by the `rule` field. For each unique rule, track:
- Total occurrence count
- Severity distribution (how many BLOCKER, HIGH, MEDIUM, etc.)
- 1-2 sample `message` values
- Sample file paths from `component`

Sort rules by occurrence count descending. **Keep only the top N rules** (as confirmed by the user in Phase 0).

---

## Phase 3: Fetch Rule Details

Fetch rule details **in parallel** for all top N unique rule keys to reduce latency. For each rule key, call:

```
server: user-sonarqube
tool: show_rule
arguments:
  key: "<rule_key>"
```

Extract from each response:
- `name`: Human-readable rule name
- `severity`: Rule severity level
- `type`: BUG, VULNERABILITY, or CODE_SMELL
- `impacts`: Software quality impacts
- `htmlDesc` or `descriptionSections`: Full description with why it matters, noncompliant/compliant examples

---

## Phase 4: Build Findings Report

Write the findings report to `.claude/tmp/sonar-review-findings.md`. Create the target directory if needed.

### Report Structure

```markdown
# SonarQube Findings Report

**Repository**: owner/repo
**SonarQube project**: <projectKey>
**SonarQube dashboard**: <project dashboard URL or organization URL>
**Issues analyzed**: N (after filtering)
**Minimum severity**: <threshold>
**Top rules analyzed**: N

---

## Ranked Rules Summary

| Rank | Rule | Name | Count | Severity | Type | Impact | Example Message |
|------|------|------|------:|----------|------|--------|-----------------
| 1    | `lang:SXXXX` | Rule name | N | Sev | Type | Quality LEVEL | Sample message |
| ...  | ...  | ...  | ...   | ...      | ...  | ...    | ...             |

---

## Rule Details

### Rule: <rule name> (`<rule key>`)
**Occurrences**: N
**Severity**: X | **Type**: Y | **Impact**: Quality LEVEL
**Sample files**: path/to/file.ts, path/to/other.ts

<Rule description extracted from htmlDesc>

**Noncompliant example:**
<code example>

**Compliant example:**
<code example>

**Suggested playbook action**: <Create standard | Update standard X | ...>
**Rationale**: <Why this rule warrants a playbook change>
```

### URL Requirements

**The report MUST include the SonarQube project dashboard URL** (e.g., `https://sonarqube.example.com/dashboard?id=<projectKey>`) or at minimum the SonarQube organization base URL. This is critical because `packmind-update-playbook` extracts source URLs from the findings report for its `packmind-cli diff --submit -m` source attribution. The expected attribution format is:

```
<topic>: <summary> (source: SonarQube <rule key> <dashboard URL>)
```

If the exact dashboard URL is not available from the MCP tools, construct it from the SonarQube base URL and project key, or ask the user for their SonarQube instance URL.

---

## Phase 5: Invoke Packmind Update Playbook

1. Display a summary:
   - Number of rules analyzed
   - Top 3 most violated rules
   - List of suggested playbook actions

2. Ask the user:
   > "Found **N rules** with actionable findings. Review the full report at `.claude/tmp/sonar-review-findings.md`. Proceed to update the playbook with these findings?"

3. **On confirm**: Invoke the `packmind-update-playbook` skill with the full report content as the intent. This maps to **Case B (explicit intent)** of that skill's Phase 0. Frame the intent as:
   > "Update the Packmind playbook based on the following SonarQube findings report: <full report content>"

4. **On decline**: Inform the user the report is available at `.claude/tmp/sonar-review-findings.md` for manual review.
