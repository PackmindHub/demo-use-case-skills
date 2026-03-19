#!/usr/bin/env node

/**
 * Artifact Inventory Scanner
 *
 * Zero external dependencies — uses only Node.js built-ins.
 * Globs for instructions, commands, skills across all agent directories,
 * parses YAML frontmatter, detects structural issues, and outputs
 * structured markdown matching Phase 1 inventory format.
 *
 * Usage:
 *   node .claude/skills/ai-context-issues/scripts/inventory.mjs [root-dir]
 *   node .claude/skills/ai-context-issues/scripts/inventory.mjs --detect [root-dir]
 *   node .claude/skills/ai-context-issues/scripts/inventory.mjs --agent claude|copilot|cursor [root-dir]
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';

// --- Agent configuration ---------------------------------------------------

const AGENT_CONFIG = {
  claude: {
    label: 'Claude Code',
    instructions: { glob: '**/.claude/rules/**/*.md', scopeField: 'paths', nameInFrontmatter: true, fileSuffix: '.md' },
    commands: { glob: '**/.claude/commands/**/*.md', fileSuffix: '.md' },
    skills: { glob: '**/.claude/skills/*/SKILL.md' },
  },
  copilot: {
    label: 'GitHub Copilot',
    instructions: { glob: '**/.github/instructions/**/*.instructions.md', scopeField: 'applyTo', nameInFrontmatter: false, fileSuffix: '.instructions.md' },
    commands: { glob: '**/.github/prompts/**/*.prompt.md', fileSuffix: '.prompt.md' },
    skills: { glob: '**/.github/skills/*/SKILL.md' },
  },
  cursor: {
    label: 'Cursor',
    instructions: { glob: '**/.cursor/rules/**/*.mdc', scopeField: 'paths', nameInFrontmatter: false, fileSuffix: '.mdc' },
    commands: { glob: '**/.cursor/commands/**/*.md', fileSuffix: '.md' },
    skills: { glob: '**/.cursor/skills/*/SKILL.md' },
  },
};

// --- CLI arg parsing -------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let agent = null;
  let detect = false;
  let root = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--detect') {
      detect = true;
    } else if (args[i] === '--agent') {
      agent = args[++i];
      if (!agent || !AGENT_CONFIG[agent]) {
        console.error(`Error: --agent must be one of: ${Object.keys(AGENT_CONFIG).join(', ')}`);
        process.exit(1);
      }
    } else if (!args[i].startsWith('--')) {
      root = args[i];
    }
  }

  return { agent, detect, root: root || process.cwd() };
}

const { agent: requestedAgent, detect: detectMode, root: ROOT } = parseArgs(process.argv);

// Only process text-based files (skip images, binaries, etc.)
const TEXT_EXTENSIONS = new Set([
  '.md', '.mdc', '.txt', '.yaml', '.yml', '.json', '.js', '.mjs', '.cjs', '.ts', '.mts',
  '.sh', '.bash', '.zsh', '.toml', '.ini', '.cfg', '.conf', '.xml', '.html', '.css',
]);

function isTextFile(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

// Simple recursive glob
async function glob(dir, pattern) {
  const results = [];
  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch (err) {
      if (err.code !== 'EACCES' && err.code !== 'ENOENT') {
        console.error(`Warning: failed to read directory ${d}: ${err.message}`);
      }
      return;
    }
    for (const entry of entries) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        await walk(full);
      } else if (entry.isFile() && matchPattern(relative(ROOT, full), pattern)) {
        results.push(full);
      }
    }
  }
  await walk(dir);
  return results.sort();
}

function matchPattern(relPath, pattern) {
  // Convert glob pattern to regex
  // Handle **/ at the start: match zero or more directory segments (including empty)
  let regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '{{GLOBSTAR_SLASH}}')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR_SLASH\}\}/g, '(.+/)?')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${regex}$`).test(relPath);
}

// Parse YAML frontmatter (simple key: value parser, no deps)
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { fields: {}, body: content.trim(), malformed: false };

  const yamlBlock = match[1];
  const body = content.slice(match[0].length).trim();
  const fields = {};

  const yamlLines = yamlBlock.split('\n');
  let currentKey = null;
  let currentArrayValues = [];

  for (const line of yamlLines) {
    // Array item (continuation of a key)
    const arrayItem = line.match(/^\s+-\s+(.+)$/);
    if (arrayItem && currentKey) {
      currentArrayValues.push(arrayItem[1].trim());
      continue;
    }

    // Flush previous array key if any
    if (currentKey && currentArrayValues.length > 0) {
      fields[currentKey] = currentArrayValues.join(', ');
      currentKey = null;
      currentArrayValues = [];
    }

    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (kv) {
      let val = kv[2].trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val) {
        fields[kv[1]] = val;
      } else {
        // Empty value — might be followed by array items
        currentKey = kv[1];
        currentArrayValues = [];
      }
    }
  }
  // Flush trailing array key
  if (currentKey && currentArrayValues.length > 0) {
    fields[currentKey] = currentArrayValues.join(', ');
  }

  // Check for double frontmatter blocks
  const secondFrontmatter = body.match(/^---\n[\s\S]*?\n---/);
  const malformed = !!secondFrontmatter;

  return { fields, body, malformed };
}

function contentHash(text) {
  return createHash('sha256').update(text.trim()).digest('hex').slice(0, 16);
}

function firstNLines(text, n = 5) {
  return text.split('\n').slice(0, n).join('\n');
}

function isGibberish(text) {
  if (!text || text.trim().length === 0) return false;
  // High ratio of control characters or encoding corruption markers (not Unicode text)
  const nonPrintable = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]/g) || []).length;
  return nonPrintable / text.length > 0.3;
}

function isPlaceholder(name, description, body) {
  const placeholderNames = /^(example|my-first|sample|todo|temp|placeholder|untitled|test-?\d*)$/i;
  const placeholderDescriptions = /^(test command|example|placeholder|todo|my first|untitled)/i;
  // Short body is a strong signal; substantial content (>200 chars) is likely real
  const hasSubstantialBody = body && body.trim().length > 200;
  if (placeholderNames.test(name) && !hasSubstantialBody) return true;
  if (description && placeholderDescriptions.test(description)) return true;
  if (body && body.trim().length < 20) return true;
  return false;
}

function scopeFromPath(relPath) {
  if (relPath.startsWith('apps/')) return relPath.split('/')[1];
  if (relPath.startsWith('packages/')) {
    const parts = relPath.split('/');
    // packages/.claude/ or packages/.github/ → "packages" scope
    if (parts[1] === '.claude' || parts[1] === '.github' || parts[1] === '.cursor') return 'packages';
    return parts[1];
  }
  return 'root';
}

// --- Agent detection -------------------------------------------------------

async function detectAgents() {
  const result = {};
  for (const [name, config] of Object.entries(AGENT_CONFIG)) {
    // Quick check: try to find at least one file for any artifact type
    const globs = [config.instructions.glob, config.commands.glob, config.skills.glob];
    let found = false;
    for (const g of globs) {
      const files = await glob(ROOT, g);
      if (files.length > 0) {
        found = true;
        break;
      }
    }
    result[name] = found;
  }
  return result;
}

// --- Parameterized scanning ------------------------------------------------

async function scanInstructions(config) {
  const files = await glob(ROOT, config.instructions.glob);
  const instructions = [];
  for (const f of files) {
    const relPath = relative(ROOT, f);
    const content = await readFile(f, 'utf-8');
    const { fields, body, malformed } = parseFrontmatter(content);

    // Name: from frontmatter if supported, otherwise from filename
    const name = config.instructions.nameInFrontmatter && fields.name
      ? fields.name
      : basename(f, config.instructions.fileSuffix);

    // Scope normalization: read the agent-specific scope field
    const scopeField = config.instructions.scopeField;
    const rawScope = fields[scopeField] || '';

    // alwaysApply normalization
    let alwaysApply;
    if (scopeField === 'applyTo') {
      // Copilot: '**' or missing → true, specific glob → false
      alwaysApply = (!rawScope || rawScope === '**') ? 'true' : 'false';
    } else {
      // Claude: use the explicit field
      alwaysApply = fields.alwaysApply || 'false';
    }

    // Normalize paths output
    let paths;
    if (scopeField === 'applyTo') {
      paths = (!rawScope || rawScope === '**') ? '' : rawScope;
    } else {
      paths = fields.paths || '';
    }

    instructions.push({
      type: 'instruction',
      name,
      path: relPath,
      scope: scopeFromPath(relPath),
      alwaysApply,
      description: fields.description || '',
      paths,
      body,
      bodyPreview: firstNLines(body),
      hash: contentHash(body),
      malformed,
      empty: !body || body.trim().length === 0,
      gibberish: isGibberish(body),
      placeholder: isPlaceholder(name, fields.description, body),
    });
  }
  return instructions;
}

async function scanCommands(config) {
  const files = await glob(ROOT, config.commands.glob);
  const commands = [];
  for (const f of files) {
    const relPath = relative(ROOT, f);
    const content = await readFile(f, 'utf-8');
    const { fields, body, malformed } = parseFrontmatter(content);
    const name = fields.name || basename(f, config.commands.fileSuffix);
    commands.push({
      type: 'command',
      name,
      path: relPath,
      description: fields.description || '',
      body,
      bodyPreview: firstNLines(body),
      hash: contentHash(body),
      malformed,
      empty: !body || body.trim().length === 0,
      gibberish: isGibberish(body),
      placeholder: isPlaceholder(name, fields.description, body),
    });
  }
  return commands;
}

async function scanSkills(config) {
  const skillFiles = await glob(ROOT, config.skills.glob);
  const skills = [];
  for (const f of skillFiles) {
    const skillDir = dirname(f);
    const skillName = basename(skillDir);

    const relPath = relative(ROOT, f);
    const content = await readFile(f, 'utf-8');
    const { fields, body, malformed } = parseFrontmatter(content);

    // Scan references
    const refsDir = join(skillDir, 'references');
    let refs = [];
    try {
      const refEntries = await readdir(refsDir);
      refs = refEntries.filter((e) => isTextFile(e));
    } catch {
      // no references dir
    }

    // Scan scripts
    const scriptsDir = join(skillDir, 'scripts');
    let scripts = [];
    try {
      const scriptEntries = await readdir(scriptsDir);
      scripts = scriptEntries.filter((e) => isTextFile(e));
    } catch {
      // no scripts dir
    }

    skills.push({
      type: 'skill',
      name: fields.name || skillName,
      path: relPath,
      description: fields.description || '',
      body,
      bodyPreview: firstNLines(body),
      hash: contentHash(body),
      malformed,
      empty: !body || body.trim().length === 0,
      gibberish: isGibberish(body),
      placeholder: isPlaceholder(fields.name || skillName, fields.description, body),
      references: refs,
      scripts,
    });
  }
  return skills;
}

function detectStructuralIssues(artifacts) {
  const issues = [];

  for (const a of artifacts) {
    if (a.malformed) {
      issues.push(`[STRUCTURAL] [WARNING] **${a.path}**: Malformed frontmatter (double --- blocks or parsing error)`);
    }
    if (a.empty) {
      issues.push(`[STRUCTURAL] [INFO] **${a.path}**: Empty body content`);
    }
    if (a.gibberish) {
      issues.push(`[STRUCTURAL] [WARNING] **${a.path}**: Gibberish/garbled content detected`);
    }
    if (a.placeholder) {
      issues.push(`[STRUCTURAL] [WARNING] **${a.path}**: Appears to be a placeholder/test artifact (name: "${a.name}", description: "${a.description}")`);
    }
  }

  // Detect identical multi-scope deployments
  const byHash = new Map();
  for (const a of artifacts) {
    if (a.gibberish || a.body.trim().length < 30) continue;
    const existing = byHash.get(a.hash) || [];
    existing.push(a);
    byHash.set(a.hash, existing);
  }
  for (const [, group] of byHash) {
    if (group.length > 1) {
      const paths = group.map((a) => `**${a.path}**`).join(', ');
      issues.push(`[STRUCTURAL] [WARNING] Identical content deployed at multiple paths: ${paths}`);
    }
  }

  return issues;
}

function formatInventory(instructions, commands, skills, structuralIssues, agentLabel) {
  const lines = [];
  lines.push(`## Artifact Inventory (Agent: ${agentLabel})\n`);

  lines.push(`### Instructions (${instructions.length} found)\n`);
  for (const s of instructions) {
    lines.push(`**${s.name}** — \`${s.path}\` — scope: ${s.scope} — alwaysApply: ${s.alwaysApply}`);
    lines.push(`> ${s.bodyPreview.split('\n').slice(0, 3).join('\n> ')}\n`);
  }

  lines.push(`### Commands (${commands.length} found)\n`);
  for (const c of commands) {
    lines.push(`**${c.name}** — \`${c.path}\``);
    lines.push(`> ${c.bodyPreview.split('\n').slice(0, 3).join('\n> ')}\n`);
  }

  lines.push(`### Skills (${skills.length} found)\n`);
  for (const s of skills) {
    const refs = s.references.length > 0 ? s.references.join(', ') : 'none';
    const scr = s.scripts.length > 0 ? s.scripts.join(', ') : 'none';
    lines.push(`**${s.name}** — \`${s.path}\` — references: ${refs} — scripts: ${scr}`);
    lines.push(`> ${s.bodyPreview.split('\n').slice(0, 3).join('\n> ')}\n`);
  }

  if (structuralIssues.length > 0) {
    lines.push(`### Structural Issues (${structuralIssues.length} found)\n`);
    for (const issue of structuralIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
  }

  // Content hashes for duplicate detection
  lines.push('### Content Hashes (for duplicate detection)\n');
  const allArtifacts = [...instructions, ...commands, ...skills];
  for (const a of allArtifacts) {
    lines.push(`- \`${a.hash}\` — ${a.path}`);
  }
  lines.push('');

  return lines.join('\n');
}

// --- Main ------------------------------------------------------------------

async function main() {
  // --detect mode: print JSON and exit
  if (detectMode) {
    const detected = await detectAgents();
    process.stdout.write(JSON.stringify(detected) + '\n');
    return;
  }

  // Resolve which agent to scan
  let agentKey = requestedAgent;

  if (!agentKey) {
    // Auto-detect
    const detected = await detectAgents();
    const found = Object.entries(detected).filter(([, v]) => v).map(([k]) => k);

    if (found.length === 0) {
      console.error('Error: No agent artifacts found. Looked for Claude Code (.claude/), GitHub Copilot (.github/instructions/, .github/prompts/, .github/skills/), and Cursor (.cursor/rules/, .cursor/commands/, .cursor/skills/) directories.');
      process.exit(1);
    }
    if (found.length > 1) {
      console.error(`Error: Multiple agents detected (${found.join(', ')}). Use --agent <name> to select one.`);
      process.exit(2);
    }
    agentKey = found[0];
  }

  const config = AGENT_CONFIG[agentKey];

  const [instructions, commands, skills] = await Promise.all([
    scanInstructions(config),
    scanCommands(config),
    scanSkills(config),
  ]);

  const allArtifacts = [...instructions, ...commands, ...skills];
  const structuralIssues = detectStructuralIssues(allArtifacts);

  const output = formatInventory(instructions, commands, skills, structuralIssues, config.label);
  process.stdout.write(output);
}

main().catch((err) => {
  console.error('Inventory scan failed:', err.message);
  process.exit(1);
});
