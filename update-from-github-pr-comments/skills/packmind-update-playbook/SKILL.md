---
name: packmind-update-playbook
description: >-
  Use when updating, adding, fixing, changing, or deprecating Packmind playbook
  artifacts (standards, commands, skills). Triggers on explicit phrases like
  "update packmind standard", "add a packmind skill", "fix packmind command",
  "change packmind playbook", "deprecate a standard". Also triggers when the
  conversation reveals an opportunity to update the playbook — e.g., a convention
  was established, a pattern emerged, a workflow changed, or an artifact is stale.
  This skill defines a mandatory workflow: do NOT edit artifact files directly —
  follow all phases (0→4) regardless of change size. Supports non-interactive
  mode via `CI=true` or `--non-interactive` for automated playbook updates from
  PR review findings.
---

# Update Playbook

Evaluate the user's intent against existing Packmind artifacts (standards, commands, skills) to identify what needs creating, updating, or deprecating. Produce a structured change report, then apply approved changes.

**⚠️ MANDATORY WORKFLOW — This skill defines a strict phase sequence (0→1→2→3→4, plus Phase 5 in non-interactive mode). Do NOT skip phases or edit artifact files directly. Even for a single-line change, follow every phase. The workflow ensures changes are reviewed, approved, submitted, and propagated correctly.**

## Execution Mode Detection

Determine the execution mode **before** starting the workflow:

1. **Check `CI` env var**: run `echo $CI`. If the value is `true`, set `non_interactive = true`.
2. **Check skill arguments**: if the skill was invoked with `--non-interactive`, set `non_interactive = true`.
3. **Inherit from caller**: if invoked by another skill (e.g., `github-pr-review`) that is already running in non-interactive mode, inherit `non_interactive = true`.

If neither condition is met, `non_interactive = false` (interactive mode — original behavior).

## **Phase 0: Intent Validation**

**STOP. This phase runs FIRST, before anything else. No file reads, no CLI commands, no subagents until this gate passes.**

Analyze the user's input and conversation context to determine intent:

**Non-interactive mode**: Only Case B applies. The caller (e.g., `github-pr-review`) always provides explicit intent with the findings report. If no intent is found, abort with error: "Non-interactive mode requires explicit intent. Provide a findings report or specify the changes."

**Interactive mode** (original behavior):

#### Case A: No prior conversation / empty input

The skill was invoked standalone with no context. Ask:

"What Packmind artifact do you want to modify? For example: a **standard** (coding rule/convention), a **command** (multi-step workflow), or a **skill** (specialized capability). Please describe what you'd like to change."

**BLOCK** — do not proceed until the user responds.

#### Case B: Explicit intent found

The user explicitly asked to update, add, fix, change, or deprecate a Packmind artifact. Extract an **intent summary**:
- **Target artifact(s)**: which standard(s), command(s), or skill(s) to modify (or "new")
- **Kind of change**: create, update, deprecate, fix
- **Specifics**: any details the user provided about the change

Proceed to Phase 1 with this validated intent.

#### Case C: Opportunity detected from conversation

The conversation reveals a playbook update opportunity — e.g., a convention was established, a pattern emerged, a workflow was changed, or a known artifact is now stale — but the user did not explicitly ask for a playbook update. Summarize the opportunity and ask:

"I noticed an opportunity to update the Packmind playbook: **<brief description>**. Would you like me to run the update workflow?"

**BLOCK** — do not proceed until the user confirms.

#### Case D: No intent and no opportunity

If the conversation contains no references to modifying Packmind artifacts and no detectable update opportunity, tell the user:

"I didn't detect any intent or opportunity to modify the Packmind playbook. What artifact would you like to update — a standard, command, or skill? Please describe the change."

**BLOCK** — do not proceed until the user responds.

### Phase 1: Intent Summary

> Only proceed after Phase 0 validates intent (explicit request or confirmed opportunity).

Summarize the validated intent before launching any subagents. Extract:
- Which artifact(s) the user wants to modify and what kind of change
- Any specifics the user provided about the desired change
- If prior conversation exists, relevant context that supports the intent (patterns observed, decisions made, problems encountered)

This intent summary is passed as input to all subagents.

### Phase 2: Domain Analysis (parallel)

> **No subagent support?** If the `Task` tool is unavailable, perform all three domain analyses sequentially in the current session — run each `references/domain-*.md` analysis one after another before proceeding to Phase 3.

Launch all three as `Task(general-purpose)` subagents **simultaneously** — do not wait for one before starting the others. Each subagent handles its own listing, filtering, and deep analysis in one pass.

Construct each prompt as:

```
## Validated Intent

<the intent summary from Phase 1>

## Analysis Task

<full contents of the corresponding references/domain-*.md file>
```

| Subagent | Reference File | Output |
|----------|----------------|--------|
| Standards | `references/domain-standards.md` | Standards change report |
| Commands | `references/domain-commands.md` | Commands change report |
| Skills | `references/domain-skills.md` | Skills change report |

For each domain, decide whether to launch or skip based on the validated intent's **target artifact type**:
- **Launch** if the intent mentions or affects that artifact type (standard, command, or skill)
- **Always launch skills** — skill accuracy must be checked against any behavioral change
- **Skip** if the intent exclusively targets a different artifact type (e.g., "update standard X" → skip commands and skills)

### Phase 3: Consolidated Report

**Non-interactive mode**: After consolidating the report, log the full report for CI output, then auto-approve **all** changes. Skip the user approval prompt and proceed directly to Phase 4.

**Interactive mode** (original behavior):

After all subagents complete, consolidate their reports. **Number every change sequentially** so the user can selectively approve:

```
## Playbook Change Report

<!-- Only include sections that have changes. Omit empty sections entirely. -->
<!-- Ordering reflects priority: skill accuracy first, then standards, then commands. -->
<!-- New commands have a high bar — see domain-commands.md for criteria. -->

### Skill Updates
1. [skill] <name>: <what changed and why>

### New Skills
2. [skill] <name>: <reason>

### Standard Updates
3. [standard] <name>: <what changed and why>

### New Standards
4. [standard] <name>: <reason>

### New Commands
5. [command] <name>: <reason>

### Command Updates
6. [command] <name>: <what changed and why>

### Deprecations
6. [standard|skill] <name>: <reason>
```

**Only include sections that have actual changes** — omit empty sections entirely. Order by priority: skills first, then standards, then commands.

Present this report and ask the user for approval:
- **Single change**: ask "Do you accept this change?"
- **Multiple changes**: ask "Which changes to apply?" and accept:
  - **All**: apply every numbered change
  - **Inclusion list**: "1, 3, 5" or "only 2 and 6"
  - **Exclusion list**: "all but 4" or "everything except 2, 7"

### Phase 4: Apply Changes

#### Step 1: Group approved changes by topic

Cluster all approved changes (new + update + deprecate) into semantic topic groups:

- Each change belongs to exactly **one** topic
- If one finding produces multiple artifact changes (e.g., a standard + a skill), they share the same topic
- Name each topic concisely (e.g., "Error handling conventions", "Logging format")

#### Step 2: Apply and submit per topic

For **each** topic group, execute the following steps in order. Complete the full cycle (2a→2d) for one topic before starting the next.

##### 2a. Write new artifacts (scoped to this topic)

For each approved **new** artifact in this topic, read the corresponding creation procedure from `references/`, then write the file(s) at the specified location:

| Artifact Type | Creation Procedure | Write Path |
|---|---|---|
| Standard | [create-standard-procedure.md](references/create-standard-procedure.md) | `.packmind/standards/<slug>.md` |
| Command | [create-command-procedure.md](references/create-command-procedure.md) | `.packmind/commands/<slug>.md` |
| Skill | [create-skill-procedure.md](references/create-skill-procedure.md) | `<agent-skills-dir>/<skill-name>/SKILL.md` |

For skills: check which agent skills directory exists at the project root (`.claude/skills/`, `.cursor/skills/`, `.github/skills/`) — pick the first found in that priority order. If none exist, create `.claude/skills/`.

After writing each new artifact, run `packmind-cli diff add <path> -m "<description>"` to stage it.

##### 2b. Edit existing artifacts (scoped to this topic)

For each approved **update** to an existing artifact in this topic, edit the local installed files directly. Search the project root **and all subdirectories** (e.g. `src/backend/.cursor/skills/`, `packages/api/.packmind/standards/`):

- **Standards**: `**/.packmind/standards/<slug>.md` (source of truth). Installed copies also exist in:
  - Claude Code: `**/.claude/rules/packmind/`
  - Cursor: `**/.cursor/rules/packmind/`
  - GitHub Copilot: `**/.github/instructions/packmind-*`
- **Commands**: `**/.packmind/commands/<slug>.md` (source of truth). Installed copies also exist in:
  - Claude Code: `**/.claude/commands/`
  - Cursor: `**/.cursor/commands/`
  - GitHub Copilot: `**/.github/prompts/`
- **Skills**: no `.packmind/` source — skills live directly in agent directories:
  - Claude Code: `**/.claude/skills/<skill-name>/`
  - Cursor: `**/.cursor/skills/<skill-name>/`
  - GitHub Copilot: `**/.github/skills/<skill-name>/`

If a same artifact exists in multiple agent directories, pick one to edit.

##### 2c. Preview (scoped to this topic)

Run `packmind-cli diff` and verify only this topic's changes appear.

**Non-interactive mode**: Log the output. Proceed without waiting for confirmation.

**Interactive mode**: Present the output. If unrelated changes appear, inform the user before proceeding.

##### 2d. Submit with source attribution

Run `packmind-cli diff --submit -m "<message>"` where `<message>` follows this format:

```
<topic>: <summary> (source: PR review comments from <owner/repo>, PRs #N, #M, ...)
```

- Extract `owner/repo` from the report header
- Extract PR numbers from the findings tables, scoped to PRs relevant to this topic when possible
- **Truncation rule**: if the source reference list exceeds ~200 chars, show the first 3 items and append `and N more`
- **Max message length**: 1024 characters

##### Post-submit verification

After submitting, run `packmind-cli diff` and verify it returns empty before starting the next topic. This prevents cross-topic contamination.

**Repeat steps 2a→2d for each remaining topic group.**

#### Step 3: Propagate

**Non-interactive mode**: Skip this step entirely. Changes are submitted as proposals for human review on Packmind — propagation requires human validation and will happen in a subsequent interactive session or CI step.

**Interactive mode** (original behavior):

Ask the user whether they have validated the submitted changes in the **Review Changes** module in Packmind and wish to propagate them locally. If yes, run:

```bash
packmind-cli install --recursive
```

### Phase 5: Log Report (non-interactive only)

**Interactive mode**: Skip this phase entirely.

**Non-interactive mode**: After Phase 4 completes, write a structured log report to `.claude/reports/playbook-update-YYYY-MM-DD.md` (using today's date). Create the directory if needed.

#### Report Structure

```markdown
# Playbook Update Report

**Date**: YYYY-MM-DD
**Mode**: non-interactive
**Triggered by**: <caller skill name, e.g., github-pr-review>

---

## Intent Summary

<the validated intent from Phase 1>

## Changes Applied

| # | Type | Artifact | Action | Status |
|---|------|----------|--------|--------|
| 1 | standard | <name> | create | success/failed |
| 2 | skill | <name> | update | success/failed |
| ... | ... | ... | ... | ... |

## Details

### <Artifact name> (<action>)

**Status**: success/failed
**CLI output**:
\`\`\`
<packmind-cli output or creation skill output>
\`\`\`

---

## Summary

- **Total changes**: N
- **Succeeded**: N
- **Failed**: N
```

Log the final output path:
> "Playbook update report written to `.claude/reports/playbook-update-YYYY-MM-DD.md`."
