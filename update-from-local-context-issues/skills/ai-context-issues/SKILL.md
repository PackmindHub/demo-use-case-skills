---
name: ai-context-issues
description: "Audit deployed AI agent context artifacts for contradictions, duplications, and coverage gaps. Supports Claude Code, GitHub Copilot, and Cursor agents. Use proactively when the user says 'audit ai context'. Also use after bulk artifact updates, before onboarding, or on a regular cadence. Produces ai-context-issues-report.md at project root. Optionally transitions to packmind-update-playbook to create change proposals from the findings."
---

# AI Context Issues

Detect contradictions, duplications, and broken cross-references between AI agent context artifacts (instructions, commands, skills) deployed across the entire monorepo. Supports **Claude Code**, **GitHub Copilot**, and **Cursor** agent artifacts. Produces a structured `ai-context-issues-report.md` at the project root.

After detection, the skill offers an **optional remediation workflow** where the agent asks targeted clarifying questions, builds a remediation plan, and applies approved changes. It can then transition to **packmind-update-playbook** to create change proposals from the findings.

## Phase 0: Agent Detection

Before scanning artifacts, determine which agent's artifacts to audit. **Strictly one agent at a time** — no cross-agent auditing.

### Detection Steps

1. If the user specified an agent in their trigger (e.g., "audit context for copilot"), use that directly — skip to Phase 1 with `--agent copilot`, `--agent claude`, or `--agent cursor`.

2. Otherwise, run the detection command:

```bash
node .claude/skills/ai-context-issues/scripts/inventory.mjs --detect
```

This prints JSON to stdout: `{"claude": true, "copilot": false, "cursor": true}` (or similar).

3. Based on the result:
   - **Multiple agents detected** → Ask the user: "I found artifacts for {list detected agent labels, e.g. Claude Code, GitHub Copilot, and Cursor}. Which agent's artifacts should I audit?" Wait for their answer, then proceed with `--agent <chosen>`.
   - **Only one agent detected** → Use it automatically. Inform the user: "Detected {agent label} artifacts. Auditing that agent's artifacts."
   - **No agents detected** → Report "No artifacts found for Claude Code, GitHub Copilot, or Cursor." and stop.

## Phase 1: Discover Artifacts

Before launching any sub-agents, build an artifact inventory by scanning the selected agent's directories across the monorepo.

### Automated Scanning (Preferred)

Run the inventory script with the agent flag:

```bash
node .claude/skills/ai-context-issues/scripts/inventory.mjs --agent {claude|copilot|cursor}
```

This produces the complete inventory with structural issue detection and content hashes. If the script fails or is unavailable, fall back to manual scanning below.

### Manual Scanning (Fallback)

The artifact locations and frontmatter fields differ by agent:

| Artifact Type | Claude Code | GitHub Copilot | Cursor |
|---------------|-------------|----------------|--------|
| Instructions | `**/.claude/rules/**/*.md` | `**/.github/instructions/**/*.instructions.md` | `**/.cursor/rules/**/*.mdc` |
| Commands | `**/.claude/commands/**/*.md` | `**/.github/prompts/**/*.prompt.md` | `**/.cursor/commands/**/*.md` |
| Skills | `**/.claude/skills/*/SKILL.md` | `**/.github/skills/*/SKILL.md` | `**/.cursor/skills/*/SKILL.md` |
| Instruction name | `name` in frontmatter | Derived from filename (strip `.instructions.md`) | Derived from filename (strip `.mdc`) |
| Scope field | `paths` + `alwaysApply` | `applyTo` (`'**'` or missing → alwaysApply: true; specific glob → alwaysApply: false with value as paths) | `alwaysApply` directly in frontmatter (no `paths`/`applyTo`) |

### 1. Instructions

Glob the appropriate pattern for the selected agent to find all instruction files across the entire repository. This includes instructions deployed at the root level as well as those in app-specific and package-specific directories.

For each file:
- Extract YAML frontmatter fields (agent-specific — see table above)
- Extract the body content (everything after the frontmatter closing `---`)
- Note the deployment location (root vs app/package) — this provides scope context for comparisons
- If frontmatter is malformed, log a WARNING and use the filename as the name
- For Copilot: ignore the `agent` field if present — it is not relevant for audit comparisons
- For Cursor: instructions use `.mdc` extension — the filename (minus `.mdc`) is the instruction name

### 2. Commands

Glob the appropriate pattern for the selected agent to find all command/prompt files across the entire repository. For each file:
- Extract YAML frontmatter field: `description`
- Extract the body content
- If frontmatter is malformed, log a WARNING and use the filename as the name
- For Copilot: ignore the `agent` field if present
- For Cursor: commands have no YAML frontmatter — the entire file content is the body. Use the filename (minus `.md`) as the command name.

### 3. Skills

Glob the appropriate pattern for the selected agent to find all skill entry points across the entire repository.

For each skill directory:
- Extract YAML frontmatter fields from SKILL.md: `name`, `description`
- Extract the SKILL.md body content
- For each `references/*.md` file, read the full content and extract any rules, requirements, or anti-patterns stated. Include a condensed summary (2-3 lines) of each reference file's key rules in the inventory.
- Glob `scripts/*` within the skill directory — include a one-line summary of each
- If a skill directory exists but has no SKILL.md, flag as an INFO finding

### 4. Compile Artifact Inventory

Build a markdown document structured as:

```
## Artifact Inventory (Agent: {agent label})

### Instructions ({count} found)
For each: **{name}** — `{path}` — scope: {root|app-name|package-name} — alwaysApply: {yes/no}
> {first 2-3 lines of body or description}

### Commands ({count} found)
For each: **{name}** — `{path}`
> {first 2-3 lines of body or description}

### Skills ({count} found)
For each: **{name}** — `{path}` — references: {list} — scripts: {list}
> {first 2-3 lines of body or description}
```

### Edge Cases

- **Empty directory** (e.g., no instructions found) → skip related comparison agents, note in final report
- **Skill directory without SKILL.md** → flag as INFO finding in the inventory
- **Malformed frontmatter** → log WARNING in the inventory, use filename as artifact name

## Phase 1.5: Structural Health Check

Before launching comparison agents, run structural checks on the already-collected inventory data. No additional file reads are needed — use the content extracted in Phase 1.

**Note:** If the inventory script was used in Phase 1 (the preferred path), structural issues are already included in its output. In that case, skip this phase entirely to avoid duplicate findings.

### Checks to Perform

1. **Malformed Frontmatter** — Artifact has double `---` blocks, missing closing `---`, or unparseable YAML fields
2. **Gibberish/Empty Content** — Body content is empty, contains only whitespace, or contains nonsensical/garbled text (e.g., random characters, encoding artifacts)
3. **Placeholder/Test Artifacts** — Artifacts with generic names (e.g., "test", "example", "my-first-command"), boilerplate-only content, or descriptions like "Add console" that suggest they are not real content
4. **Identical Multi-Scope Deployments** — Two or more artifacts at different paths have identical or near-identical body content (same procedure deployed at root and app/package level without meaningful differences)

### Output Format

For each issue found:

```
[STRUCTURAL] [{severity}] **{path}**: {description}
```

Where severity is:
- **WARNING** — Malformed frontmatter, placeholder/test artifacts, identical deployments
- **INFO** — Empty content, minor structural oddities

### Passing Findings Forward

Structural findings are included alongside comparison agent findings in Phase 3 consolidation. They do not require two-artifact comparison — each is a standalone issue with a single artifact (or set of identical artifacts).

## Phase 2: Launch 3 Parallel Comparison Agents

Launch up to 3 `Agent(general-purpose)` sub-agents in parallel. Each receives:
1. The full artifact inventory from Phase 1
2. The **full file contents** of every artifact of the types it compares (content filtering — see table below). Every artifact must be included in full — do not summarize or truncate any artifact.
3. The full contents of its reference file (read the file and include its contents in the prompt)

| Agent | Reference File | Compares | Artifact Contents to Include |
|-------|---------------|----------|------------------------------|
| 1 — Instructions Agent | `references/instructions-agent.md` | INS↔INS, INS↔CMD, INS↔SKL | All instructions + all commands + all skills |
| 2 — Commands Agent | `references/commands-agent.md` | CMD↔CMD, CMD↔SKL | All commands + all skills (no instructions) |
| 3 — Skills Agent | `references/skills-agent.md` | SKL↔SKL | All skills only (no instructions or commands) |

**Skip rules** (evaluate in order):
1. **Skip agent entirely** if it has 0 of its primary artifact type: Instructions Agent needs ≥1 instruction, Commands Agent needs ≥1 command, Skills Agent needs ≥1 skill.
2. **Skip intra-type comparison** (INS↔INS, CMD↔CMD, SKL↔SKL) if that type has fewer than 2 items.
3. **Skip cross-type comparison** (e.g., INS↔CMD) if either type in the pair has 0 items.
4. **Skip agent entirely** if, after applying rules 2–3, no valid comparisons remain.

### Context Management

If the total content of all artifacts to include in an agent's prompt exceeds ~100K characters, apply truncation to prevent context overflow:
- Truncate individual artifacts longer than 5K characters: keep the first 3K chars + last 1K chars, separated by `\n\n[... truncated {N} chars — use Read tool for full content ...]\n\n`
- Note all truncations in the agent prompt so the agent knows to use the Read tool for full content if needed for a specific finding
- Never omit artifacts entirely — every artifact must appear at least in truncated form so the agent can decide whether to read the full version

### Agent Prompt Template

```
You are auditing AI agent context artifacts for issues. Here is the artifact inventory:

{artifact inventory from Phase 1}

Here are the full contents of every artifact you need to compare:

{full file contents of ONLY the artifact types this agent compares — for skills, include BOTH the SKILL.md body AND the key rules/anti-patterns extracted from references/*.md files}

Here are your detailed instructions:

{full contents of the agent's reference file}

Use the artifact contents provided above for your comparisons. If any artifact content appears truncated or incomplete, use the Read tool to fetch the full file before reporting findings about it.
Return your findings in the exact format specified in the instructions.
If you find no issues for a comparison type, return: NO_ISSUES_FOUND for that type.
```

### Sequential Fallback

If the Agent tool is unavailable, perform the comparisons sequentially: read each artifact pair and apply the same checks from the reference files directly.

## Phase 3: Consolidate Findings

After all sub-agents complete:

1. **Collect** all findings from Phase 1.5 (structural) and the 3 comparison agents
2. **Deduplicate** — remove findings that reference the same artifact pair with the same issue type
3. **Compile** into a single raw findings list, preserving the structured format from each agent

Do **not** write the report yet — pass the raw findings to Phase 4 first.

## Phase 4: Review and Report

Launch a single `Agent(general-purpose)` sub-agent with:
1. The raw findings from Phase 3
2. The artifact inventory from Phase 1
3. The **full file contents** of every artifact directly referenced in a finding. To manage context effectively:
   - Only include artifacts that appear in at least one finding (not all artifacts from Phase 1)
   - For each artifact, include the complete content (as it was passed to comparison agents in Phase 2)
   - If context is tight, prioritize CRITICAL findings' artifacts at full length; for INFO findings, the inventory summary is acceptable
   - Typical count: 5-15 artifact files, not all 30+
4. The full contents of `references/report-agent.md`

This agent acts as a skeptical reviewer — its job is to verify each finding against the actual artifacts and produce the final formatted report. See `references/report-agent.md` for the full prompt template.

### Sequential Fallback

If the Agent tool is unavailable, perform the review yourself: for each finding, read both referenced artifacts and verify the claim before including it in the report.

## Phase 5: Write Report

Using the verified and formatted report from Phase 4:

1. **Write** the report to `ai-context-issues-report.md` at the project root
2. **Print a summary** to the user:
   - Agent audited: {agent label} (e.g., "Claude Code", "GitHub Copilot", or "Cursor")
   - Total issues found per severity (CRITICAL / WARNING / INFO)
   - Top 3 most problematic artifacts (by issue count)
   - The report file path

## Phase 6: Remediation (Optional)

After the report is written, offer an interactive remediation workflow. The agent asks targeted questions about each finding, and the user's decisions are recorded as **remediation entries** appended to each finding in the report. The report file (`ai-context-issues-report.md`) is the single source of truth — remediations are written back into it.

### Phase 6.0: Offer Remediation

Ask the user: **"Do you want to work on remediations?"**

- If **no** → proceed to Phase 7 (Playbook Update).
- If **yes** → proceed to Phase 6.1.

### Phase 6.1: Scope Selection

Ask: **"Should we address critical findings and warnings, or only critical findings?"**

- Filter the report findings from `ai-context-issues-report.md` based on the user's answer.
- Exclude INFO-level findings from remediation regardless of choice — they are informational only.

### Phase 6.2: Interactive Clarifying Questions

Read `ai-context-issues-report.md` and parse the findings within the selected scope. For each finding, read the actual artifact content so questions include concrete quotes.

Follow the question templates and grouping logic defined in `references/remediation-questions.md`.

**Key rules:**
- **Group related findings** — if two findings reference the same artifact pair, ask about them together in a single question.
- **Batch when possible** — if multiple findings share an obvious resolution (e.g., 3 duplications all pointing to the same source), combine into one question.
- Ask questions **one at a time** using `AskUserQuestion` — do not present all questions at once.
- For **WARNING**-severity findings, always include a **"skip / leave as-is"** option.
- **Minimize question count** — fewer, well-crafted questions are better than many granular ones.

### Phase 6.3: Update Report with Remediations

After collecting all user answers, update `ai-context-issues-report.md` by appending a `> **Remediation:**` block to each finding that was addressed. The report is the deliverable — it now contains both the diagnosis and the prescribed fix.

#### Remediation block format

Append directly below the finding's existing content (after the last bullet point):

```markdown
- **{artifact-1-path}** vs **{artifact-2-path}**: {description}
  - Instruction says: "{quoted passage}"
  - But skill/command says: "{quoted passage}"
  - Impact: {why this matters}
  > **Remediation:** {concise description of what to do}
  > - Action: {Edit|Delete|Create} `{file path}`
  > - Detail: {what specifically to change, remove, or add}
```

For findings the user chose to **skip**, append:

```markdown
  > **Remediation:** Skipped — left as-is per user decision.
```

#### Remediation action types

| User Decision | Action |
|---------------|--------|
| Keep version A (contradiction) | `Edit {path_b}` — rewrite the conflicting section to match A's version |
| Keep version B (contradiction) | `Edit {path_a}` — rewrite the conflicting section to match B's version |
| Merge into new version (contradiction) | `Edit {path_a}` and `Edit {path_b}` — describe the merged content |
| Keep in artifact A only (duplication) | `Edit {path_b}` — remove the duplicated section |
| Create missing artifact (gap) | `Create {path}` — describe the content to create |
| Remove broken reference (gap) | `Edit {path}` — remove the reference to the non-existent artifact |
| Delete artifact (structural) | `Delete {path}` |
| Fix structural issue | `Edit {path}` — describe the fix |

#### Update the summary table

Add a `Remediated` column to the summary table:

```markdown
| Severity | Count | Remediated |
|----------|-------|------------|
| CRITICAL | {N}   | {N}        |
| WARNING  | {N}   | {N}        |
| INFO     | {N}   | —          |
```

### Phase 6.4: Confirm

After updating the report, print a summary to the user:
- Number of findings remediated vs total in scope
- Number of findings skipped
- Remind the user that `ai-context-issues-report.md` now contains actionable remediation instructions for each addressed finding
- Proceed to Phase 7 (Playbook Update).

## Phase 7: Invoke Packmind Update Playbook (Optional)

After the report is finalized — either from Phase 5 (detection only) or Phase 6.4 (with remediations) — offer to update the Packmind playbook based on the findings.

### 7.1: Offer Playbook Update

Display a summary:
- Agent audited (e.g., "Claude Code", "GitHub Copilot", or "Cursor")
- Total issues found per severity (CRITICAL / WARNING / INFO)
- Whether remediations were included in the report

Then ask the user:

> "The AI context issues report is ready at `ai-context-issues-report.md`. Proceed to update the Packmind playbook with these findings?"

- If **no** → inform the user the report is available at `ai-context-issues-report.md` for manual review. The skill is complete.
- If **yes** → proceed to 7.2.

### 7.2: Invoke packmind-update-playbook

Invoke the `packmind-update-playbook` skill with the full report content as the intent. This maps to **Case B (explicit intent)** of that skill's Understanding Your Request phase. Frame the intent as:

> "Update the Packmind playbook based on the following AI context issues report: <full report content>"

Where `<full report content>` is the complete contents of `ai-context-issues-report.md` (including remediations if Phase 6 was completed).
