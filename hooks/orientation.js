/*
 * SessionStart hook — Blueprint orientation (v2, short on purpose).
 *
 * Injects at most ~1.5 KB, because every byte here is paid in every session and an oversized
 * injection gets truncated to a preview (TEST-FINDINGS R1-04). It carries only:
 *   1. one line saying this is a Blueprint project and which skill to load;
 *   2. where the work stands: the current and the next step of the path (_queue.json), and an
 *      open discussion to resume (_current-task.md);
 *   3. five essential rules (the full rules live in skills/using-blueprint);
 *   4. a capped digest of confirmed one-way decisions (id → choice), so they are not silently
 *      overridden.
 * Without a vault it says one line. Errors never fail the session (exit 0).
 *
 * Usage: SessionStart hook in hooks/hooks.json. Reads the payload's `cwd` (or
 * CLAUDE_PROJECT_DIR) to find the project. Output: JSON hookSpecificOutput.additionalContext.
 */

const path = require('path');
const { readStdinJson, projectDirOf, findVaultRoot, readText, readJson } = require('./lib/common');

const BUDGET = 1500;

const RULES = [
  'Rules:',
  '1. Any request that changes what the code does starts with one question: does it touch the foundations?',
  '2. Specialists only inside a foundation-area or section discussion; never in brainstorming.',
  '3. Talk in plain words: never say atom, axis, status or field names; end with a one-way / two-way summary.',
  '4. No production code while discussing; prototypes and mockups only in prototypes/ or proto/* branches.',
  '5. You write the vault yourself (decision blocks); say "✓ Locked" only after reading the [Blueprint] hook messages.',
];

function stepLabel(e) {
  if (!e) return '';
  const kind = e.kind || 'discuss';
  const target = e.target ? ` ${e.target}` : '';
  const desc = e.description ? ` — ${e.description}` : '';
  return `${kind}${target}${desc}`.slice(0, 140);
}

function pathState(vaultRoot) {
  const queue = readJson(path.join(vaultRoot, '_queue.json'), null);
  const entries = queue && Array.isArray(queue.entries) ? queue.entries : [];
  const open = entries.filter((e) => e && e.status !== 'done');
  if (!open.length) return entries.length ? ['Path: every step is done. Wait for the user.'] : [];
  const current = open.find((e) => e.status === 'in-progress') || open[0];
  const next = open.find((e) => e !== current);
  const lines = [`Path (mode ${queue.mode || 'B'}): now → ${stepLabel(current)}`];
  if (next) lines.push(`Next → ${stepLabel(next)}`);
  return lines;
}

function resumeHint(vaultRoot, vaultName) {
  const text = readText(path.join(vaultRoot, '_current-task.md'));
  if (!text) return [];
  const body = text.replace(/^---[\s\S]*?---\s*/, '').trim();
  if (!body) return [];
  const heading = (body.match(/^#+\s*(.+)$/m) || [])[1];
  return [`Open discussion to resume: ${vaultName}/_current-task.md${heading ? ` (${heading.slice(0, 80)})` : ''}`];
}

function digestLines(vaultRoot, room) {
  const index = readJson(path.join(vaultRoot, '_index', 'decisions.json'), null);
  const items = [];
  for (const body of Object.values((index && index.features) || {})) {
    for (const a of (body && body.atoms) || []) {
      if (!a || !a.axis) continue;
      const confirmed = a.status === 'ratified' || a.status === 'locked';
      if (confirmed && a.reversibility === 'one-way') items.push(`${a.axis} → ${String(a.choice).slice(0, 60)}`);
      else if (a.status === 'locked') items.push(`${a.axis} → ${String(a.choice).slice(0, 60)}`);
    }
  }
  if (!items.length) return [];
  const header = 'Confirmed one-way decisions (internal — never show raw):';
  const lines = [header];
  let used = header.length + 1;
  let shown = 0;
  for (const item of items) {
    const line = `- ${item}`;
    if (used + line.length + 1 + 40 > room) break;
    lines.push(line);
    used += line.length + 1;
    shown++;
  }
  if (shown < items.length) lines.push(`(+${items.length - shown} more in _index/decisions.json)`);
  return shown ? lines : [];
}

function buildContext(projectDir) {
  const vaultRoot = findVaultRoot(projectDir);
  if (!vaultRoot) {
    return '[Blueprint] No Blueprint vault in this project. If the user wants to plan with Blueprint, run /blueprint.';
  }
  const vaultName = path.basename(vaultRoot);
  const head = [`[Blueprint] This project is planned with Blueprint (${vaultName}/). Load \`blueprint:using-blueprint\` before any Blueprint step.`];
  let state = [];
  try { state = [...pathState(vaultRoot), ...resumeHint(vaultRoot, vaultName)]; } catch { state = []; }
  const fixed = [...head, ...state, ...RULES].join('\n');
  let digest = [];
  try { digest = digestLines(vaultRoot, BUDGET - fixed.length - 1); } catch { digest = []; }
  const out = [fixed, ...digest].join('\n');
  return out.length <= BUDGET ? out : out.slice(0, BUDGET - 1) + '…';
}

try {
  const input = readStdinJson();
  const projectDir = projectDirOf(input);
  const additionalContext = buildContext(projectDir);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }));
} catch (e) {
  process.stderr.write(`Blueprint SessionStart hook error: ${e && e.message}\n`);
}
