# Remediation Question Templates & Logic

This reference defines how Phase 6.2 questions should be constructed, grouped, and presented.

## Question Templates by Finding Category

### CONTRADICTION

When two artifacts make conflicting statements about the same topic:

```
Artifact A (`{path_a}`) says:
> "{quote from A}"

Artifact B (`{path_b}`) says:
> "{quote from B}"

These statements contradict each other. Which version should we keep?
1. Keep A's version (update B to match)
2. Keep B's version (update A to match)
3. Merge into a new version (describe what it should say)
{4. Skip / leave as-is  ← only for WARNING severity}
```

### DUPLICATION

When the same rule or content appears in multiple artifacts:

```
This rule appears in multiple places:
- `{path_a}`: "{quote or summary}"
- `{path_b}`: "{quote or summary}"
{- `{path_c}`: "..." — if more than 2}

Where should this rule live?
1. Keep only in `{path_a}` (remove from others)
2. Keep only in `{path_b}` (remove from others)
{3. Keep only in `{path_c}` (remove from others)  ← if applicable}
{N. Keep in all locations as-is}
{N+1. Skip / leave as-is  ← only for WARNING severity}
```

### GAP / Missing Reference

When an artifact references something that doesn't exist:

```
Artifact `{path}` references '{name}' which doesn't exist.

What should we do?
1. Create the missing artifact (I'll ask for details)
2. Remove the reference from `{path}`
3. Replace the reference with an existing artifact (I'll show options)
{4. Skip / leave as-is  ← only for WARNING severity}
```

### STRUCTURAL

When an artifact has structural problems (malformed frontmatter, empty content, placeholder):

```
Artifact `{path}` has a structural issue: {description}.

What should we do?
1. Fix the issue (I'll propose the correction)
2. Delete the artifact (it's not needed)
{3. Skip / leave as-is  ← only for WARNING severity}
```

## Grouping Rules

### Same Artifact Pair → Single Question

If two or more findings involve the exact same pair of artifacts (regardless of finding type), combine them into a single question:

```
I found multiple issues between `{path_a}` and `{path_b}`:

1. [CONTRADICTION] {description}
   - A says: "{quote}"
   - B says: "{quote}"

2. [DUPLICATION] {description}
   - Duplicated content: "{summary}"

For issue 1, which version should we keep? (A / B / merge)
For issue 2, where should the rule live? (A / B / both)
{Skip all / leave as-is  ← only for WARNING severity}
```

### Shared Resolution → Batch Question

If 3+ findings share an obvious resolution pattern (e.g., multiple duplications all pointing to the same source artifact, or multiple gaps all referencing the same missing artifact), batch into one question:

```
I found {N} duplicated rules that all originate from `{source_path}`:
- "{rule 1 summary}" (also in `{path_a}`, `{path_b}`)
- "{rule 2 summary}" (also in `{path_c}`)
- "{rule 3 summary}" (also in `{path_a}`, `{path_d}`)

Should we consolidate all of these into `{source_path}` and remove the duplicates?
1. Yes, consolidate all into `{source_path}`
2. No, let me decide individually for each
{3. Skip / leave as-is  ← only for WARNING severity}
```

If the user chooses option 2, fall back to individual questions for each finding.

## Presentation Rules

1. **Read artifact content first** — Before asking any question, read the actual file content of every artifact referenced in the finding. Use concrete quotes in the question, not paraphrased summaries.

2. **One question at a time** — Use `AskUserQuestion` for each question. Wait for the answer before asking the next.

3. **Order by severity** — Ask about CRITICAL findings first, then WARNING findings.

4. **Order by impact** — Within the same severity, ask about findings affecting more artifacts first.

5. **Always include "skip" for warnings** — Every WARNING-severity question must have a "skip / leave as-is" option. CRITICAL findings should not have a skip option unless explicitly requested by the user.

6. **Keep questions concise** — Include enough context to make an informed decision, but don't dump entire file contents into the question. Use 1-3 line quotes, not full paragraphs.

7. **Number all options** — Use numbered options (1, 2, 3...) so the user can respond with just a number.

8. **Track answers** — Maintain a running list of user decisions. Each answer maps to a remediation entry that will be appended to the corresponding finding in the report (Phase 6.3).

## Output: How Answers Map to Report Updates

Each user answer produces a `> **Remediation:**` block appended to the finding in `ai-context-issues-report.md`. The question logic here drives the interactive phase; the SKILL.md Phase 6.3 defines the exact format written into the report.
