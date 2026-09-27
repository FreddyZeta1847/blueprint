/*
 * SessionStart hook — Orientation for Blueprint-managed sessions
 *
 * Injected at session start to: (1) inject Blueprint's hard rules and pipeline (a compact
 * excerpt of skills/using-blueprint/SKILL.md, not the whole file), (2) surface the current
 * project's live state (_current-task.md, _index.md, _queue.json — each capped), (3) inject the
 * constraints digest (locked/one-way decisions, axis+choice only), (4) run a staleness check.
 *
 * Output is kept compact on purpose: Claude Code persists large hook output to a file and shows
 * the model only a short preview, so an oversized injection silently loses its most important
 * lines. Delivered as JSON hookSpecificOutput.additionalContext.
 *
 * Triggers: SessionStart hook, always runs when Claude opens a project with this plugin enabled.
 *
 * References: hooks/hooks.json (wiring), skills/using-blueprint/SKILL.md (source of the rules),
 * vault-<project>/(_current-task.md, _index.md, _queue.json, _index/decisions.json).
 */

const fs = require('fs');
const path = require('path');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');

const LIVE_FILE_CAP = 1500;

function extractSection(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  if (start === -1) return '';
  const end = markdown.indexOf(endHeading, start + startHeading.length);
  return markdown.slice(start, end === -1 ? undefined : end).trim();
}

function buildRulesExcerpt() {
  const skill = fs.readFileSync(path.join(pluginRoot, 'skills/using-blueprint/SKILL.md'), 'utf8');
  const rules = extractSection(skill, '## Hard rules', '## The pipeline');
  const pipeline = extractSection(skill, '## The pipeline', '## Routing');
  return [
    '# Blueprint project',
    'This project uses the Blueprint plugin. Before any Blueprint step, load the `blueprint:using-blueprint` skill for the routing table and core concepts.',
    rules,
    pipeline,
  ].join('\n\n');
}

function capped(text, filename) {
  if (text.length <= LIVE_FILE_CAP) return text;
  return text.slice(0, LIVE_FILE_CAP) + `\n… (truncated — read ${filename} for the rest)`;
}

function liveState(vaultPath, vaultFolderName) {
  let out = '';
  for (const filename of ['_current-task.md', '_index.md', '_queue.json']) {
    const filePath = path.join(vaultPath, filename);
    if (fs.existsSync(filePath)) {
      const rel = `${vaultFolderName}/${filename}`;
      out += `\n## ${rel}\n${capped(fs.readFileSync(filePath, 'utf8'), rel)}\n`;
    }
  }
  return out;
}

function constraintsDigest(vaultPath) {
  const decisionsIndexPath = path.join(vaultPath, '_index', 'decisions.json');
  if (!fs.existsSync(decisionsIndexPath)) return '';
  const decisionsIndex = JSON.parse(fs.readFileSync(decisionsIndexPath, 'utf8'));
  const constraints = [];
  for (const featureName in decisionsIndex.features || {}) {
    for (const atom of decisionsIndex.features[featureName].atoms || []) {
      if (atom.status === 'locked' || atom.reversibility === 'one-way') {
        constraints.push(`- ${atom.axis} → ${atom.choice}`);
      }
    }
  }
  if (constraints.length === 0) return '';
  return '\n## Locked decisions that must not be silently overridden (internal — never show this list raw to the user)\n'
    + constraints.join('\n') + '\n';
}

function stalenessCheck(vaultPath) {
  try {
    const { execSync } = require('child_process');
    const markerPath = path.join(vaultPath, '.last-indexed-commit');
    if (!fs.existsSync(markerPath)) return '';
    const lastIndexedCommit = fs.readFileSync(markerPath, 'utf8').trim();
    try {
      execSync(`git diff --quiet ${lastIndexedCommit} HEAD`, { cwd: projectDir, stdio: 'pipe' });
      return '\n✓ No code changes since last Blueprint index.\n';
    } catch (e) {
      return '\n⚠️ Code changed since last Blueprint index. Consider a discovery pass before proceeding.\n';
    }
  } catch (e) {
    return '';
  }
}

function buildContext() {
  let out = buildRulesExcerpt() + '\n\n---\n';
  const vaultFolderName = fs.readdirSync(projectDir).find(e => e.startsWith('vault-'));
  if (!vaultFolderName) {
    return out + '\n**No Blueprint vault in this repository yet.** When the user wants to start, run `/blueprint`.\n';
  }
  const vaultPath = path.join(projectDir, vaultFolderName);
  out += liveState(vaultPath, vaultFolderName);
  out += constraintsDigest(vaultPath);
  out += stalenessCheck(vaultPath);
  return out;
}

try {
  const additionalContext = buildContext();
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext },
  }));
} catch (e) {
  console.error(`Blueprint SessionStart hook error: ${e.message}`);
  process.exit(1);
}
