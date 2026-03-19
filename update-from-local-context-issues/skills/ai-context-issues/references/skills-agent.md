# Skills vs Skills Audit Instructions

You are auditing AI agent context artifacts for issues between **skills**.

## Context

- **Skills** are capability packages with detailed instructions, references, and scripts. They are typically triggered automatically by context or invoked via skill names. Each skill has a SKILL.md entry point and may include `references/` and `scripts/` directories.

Conflicts arise when two skills define conflicting workflows for the same task, or when one references another that doesn't exist.

## Golden Rule

**Only flag issues where you can point to specific passages in BOTH artifacts.** Do not flag stylistic differences, vague overlaps, or things that "might" conflict. Every finding must cite concrete evidence from both files.

## Detection Categories

### [CONTRADICTION] — Two skills prescribe conflicting workflows for the same task

Two skills address the same task or domain but instruct Claude to follow different or incompatible workflows.

**Examples:**
- Skill A says "always create a new branch" but Skill B says "commit directly to main" for the same kind of change
- Skill A requires "run tests before committing" but Skill B requires "commit first, test in CI"
- Skill A instructs "use TypeORM query builder" but Skill B instructs "use raw SQL" for the same operation type

**Verification:** Read BOTH skills fully, including their `references/` files. The skills must address the same task or overlapping domains. Different skills for different tasks are not contradictions. Quote the specific conflicting instructions.

### [GAP] — Cross-reference to non-existent skill

A skill references another skill that doesn't exist in the inventory.

**Examples:**
- Skill says "delegate to the deployment skill" but no deployment skill exists
- Skill says "this works with the code-review skill" but no such skill exists
- Skill references another skill by name that doesn't match any existing skill

**Verification:** Search the artifact inventory for the referenced skill. Check both exact name matches and path matches.

## Verification Protocol

For every potential finding:

1. **Read both skills' SKILL.md files completely** — locate the specific passages
2. **Read relevant `references/` files** in both skills if the finding involves content in those files
   - Check skill reference files (references/*.md) provided in the artifact contents — rules or anti-patterns stated there carry the same weight as those in SKILL.md
3. **Determine if both skills address the same task** — compare their descriptions and workflows
4. **Quote both passages** in your finding
5. **Confirm the conflict is real** — could both skills coexist without contradiction? If yes, it's not a finding.

## Output Format

Return findings in this exact format, one per finding:

```
[CATEGORY] [SKL-SKL] **{skill-1-path}** vs **{skill-2-path}**: {description}
- Evidence-1: "{quoted passage from skill 1}"
- Evidence-2: "{quoted passage from skill 2}"
- Rationale: {why this is a real issue}
```

Where `CATEGORY` is one of: `CONTRADICTION`, `GAP`

If you find **no issues**, return:

```
NO_ISSUES_FOUND
```

## Important Reminders

- Read each skill's SKILL.md and relevant reference files **completely** — don't skip content or rely on summaries
- Skills that cover different domains will naturally have different workflows — only flag when two skills address the same task with conflicting instructions
- A skill that delegates to or invokes another skill is complementary, not duplicative or contradictory
- Skills with overlapping triggers but different scopes (e.g., one for "create" and one for "update") are by design
- Be thorough but precise — false positives waste reviewer time
- Do NOT suggest fixes — this is detection only
