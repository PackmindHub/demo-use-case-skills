# AI Context Issues

Detects contradictions, duplications, and broken cross-references between AI agent context artifacts (instructions, commands, skills) deployed in a repository. Supports **Claude Code** and **GitHub Copilot** agent formats. Outputs `ai-context-issues-report.md` at project root.

Supports optional **remediation** (interactive fix planning) and **Packmind playbook updates** (transition to `packmind-update-playbook`).

## How It Works

1. **Discover** — Scans the repo for all artifacts via `scripts/inventory.mjs` (or manual glob fallback)
2. **Structural checks** — Flags malformed frontmatter, empty/gibberish content, placeholder artifacts, identical multi-scope deployments
3. **Cross-artifact comparison** — Launches 3 parallel sub-agents, each with specialized instructions from `references/`:
   - **Instructions Agent** — INS vs INS, INS vs CMD, INS vs SKL
   - **Commands Agent** — CMD vs CMD, CMD vs SKL
   - **Skills Agent** — SKL vs SKL
4. **Review** — A report agent verifies findings, rejects false positives, assigns severity
5. **Report** — Writes the final `ai-context-issues-report.md`
6. **Remediation** *(optional)* — Interactive workflow to plan fixes for detected issues
7. **Playbook update** *(optional)* — Hands findings to `packmind-update-playbook` to create Packmind change proposals

## Issue Types Detected

| Category | Description |
|----------|-------------|
| **CONTRADICTION** | Two artifacts give conflicting instructions for the same situation |
| **DUPLICATION** | Same rule or procedure restated in two places (drift risk) |
| **GAP** | An artifact references another that doesn't exist |
| **STRUCTURAL** | Malformed frontmatter, empty content, placeholder artifacts, identical deployments |

## Files

```
ai-context-issues/
├── SKILL.md              # Main skill instructions (phases 0-7)
├── scripts/
│   └── inventory.mjs     # Zero-dependency artifact scanner
└── references/
    ├── instructions-agent.md # Instructions for INS comparisons
    ├── commands-agent.md     # Instructions for CMD comparisons
    ├── skills-agent.md       # Instructions for SKL comparisons
    └── report-agent.md       # Instructions for review & report formatting
```

## Usage

Prompt `/ai-context-issues`
