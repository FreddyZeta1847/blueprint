/*
 * SessionStart hook — Blueprint orientation (v3, short on purpose).
 *
 * Injects at most ~1.5 KB, because every byte here is paid in every session and an oversized
 * injection gets truncated to a preview (TEST-FINDINGS R1-04). Claude must never have to
 * remember where the work stands: it reads it from blueprint/plan.json here.
 *
 *   - with blueprint/plan.json (at most ~3 lines): project · stage i/n «name» (type) · phase and/or
 *     topics done (no counter when the stage has no topics) · deadline (overdue?) · new notes from blueprint/notes.json; then where the plan
 *     lives; and, when the current stage is still `todo`, the "not opened yet" instruction;
 *   - with a vault (blueprint/vault/, or a legacy vault-<project>/): the discussion to resume
 *     (_current-task.md) and a capped digest of confirmed one-way decisions;
 *   - with neither: silent.
 * The current stage is the first `in_progress` one, else the first `todo` one.
 * Errors never fail the session (exit 0).
 *
 * Usage: SessionStart hook in hooks/hooks.json. Reads the payload's `cwd` (or
 * CLAUDE_PROJECT_DIR) to find the project. Output: JSON hookSpecificOutput.additionalContext.
 */

const path = require('path');
const { readStdinJson, projectDirOf, findVaultRoot, blueprintDirOf, readPlan, relInside, readText, readJson } = require('./lib/common');
const { loadLoops, currentStage } = require('./lib/plan');

const BUDGET = 1500;
const LOAD_SKILL = 'Load `blueprint:using-blueprint` before any Blueprint step.';
const NOT_OPENED = 'Not opened yet: before starting, tell the user its topics (if any), phases and how you would do it, and wait for the OK.';

// ---------------------------------------------------------------- the plan

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function unreadNotes(projectDir) {
  const notes = readJson(path.join(blueprintDirOf(projectDir), 'notes.json'), null);
  const list = notes && Array.isArray(notes.notes) ? notes.notes : [];
  return list.filter((n) => n && n.read !== true).length;
}

function progressOf(stage, loops) {
  const topics = Array.isArray(stage.topics) ? stage.topics : [];
  const done = topics.filter((t) => t && t.done === true).length;
  const loop = loops && loops.types && loops.types[stage.type];
  const perStep = loop ? loop.cycle === 'per_step' : stage.phase === undefined;
  const parts = [];
  if (!perStep && stage.phase) parts.push(`phase ${stage.phase}`);
  if (topics.length) parts.push(`topics ${done}/${topics.length}`);
  return parts;
}

function deadlineOf(stage) {
  if (typeof stage.deadline !== 'string' || !stage.deadline) return [];
  const overdue = stage.status !== 'done' && stage.deadline < today();
  return [`deadline ${stage.deadline}${overdue ? ' (overdue)' : ''}`];
}

function planLines(projectDir, plan) {
  if (plan.unreadable) {
    return ['[Blueprint] blueprint/plan.json is unreadable (not valid JSON, or no "stages"). Fix it before relying on the plan.', LOAD_SKILL];
  }
  const project = plan.project || 'This project';
  const notes = unreadNotes(projectDir);
  const noteLine = notes ? [`${notes} new note${notes > 1 ? 's' : ''} (blueprint/notes.json)`] : [];
  const current = currentStage(plan);
  if (!current) {
    return [[`[Blueprint] ${project} · every stage is done or postponed: ask the user what comes next`, ...noteLine].join(' · '), LOAD_SKILL];
  }
  const { stage, index, total } = current;
  const first = [
    `[Blueprint] ${project}`,
    `stage ${index + 1}/${total} «${stage.name || stage.id}» (${stage.type})`,
    ...progressOf(stage, loadLoops()),
    ...deadlineOf(stage),
    ...noteLine,
  ].join(' · ');
  const lines = [first, `Plan: blueprint/plan.json (written only by the main session, checked by the plan-guard). ${LOAD_SKILL}`];
  if (stage.status === 'todo') lines.push(NOT_OPENED);
  return lines;
}

// ---------------------------------------------------------------- the vault

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
      if ((confirmed && a.reversibility === 'one-way') || a.status === 'locked') items.push(`${a.axis} → ${String(a.choice).slice(0, 60)}`);
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

function vaultLines(projectDir, vaultRoot, hasPlan) {
  const vaultName = relInside(projectDir, vaultRoot) || path.basename(vaultRoot);
  const head = hasPlan ? [] : [`[Blueprint] This project keeps its decisions in ${vaultName}/. ${LOAD_SKILL}`];
  let resume = [];
  try { resume = resumeHint(vaultRoot, vaultName); } catch { resume = []; }
  return [...head, ...resume];
}

// ---------------------------------------------------------------- assembly

function buildContext(projectDir) {
  const plan = readPlan(projectDir);
  const vaultRoot = findVaultRoot(projectDir);
  if (!plan && !vaultRoot) return '';
  let lines = [];
  try { if (plan) lines = planLines(projectDir, plan); } catch { lines = []; }
  if (vaultRoot) lines.push(...vaultLines(projectDir, vaultRoot, Boolean(plan)));
  const fixed = lines.join('\n');
  let digest = [];
  try { if (vaultRoot) digest = digestLines(vaultRoot, BUDGET - fixed.length - 1); } catch { digest = []; }
  const out = [fixed, ...digest].filter(Boolean).join('\n');
  return out.length <= BUDGET ? out : out.slice(0, BUDGET - 1) + '…';
}

try {
  const input = readStdinJson();
  const projectDir = projectDirOf(input);
  const additionalContext = buildContext(projectDir);
  if (additionalContext) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }));
  }
} catch (e) {
  process.stderr.write(`Blueprint SessionStart hook error: ${e && e.message}\n`);
}
