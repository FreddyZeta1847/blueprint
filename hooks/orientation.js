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
 *   - with a decisions folder (blueprint/decisions/, or a legacy vault-<project>/): the discussion to resume
 *     (_current-task.md) and a capped digest of confirmed one-way decisions;
 *   - the context card (blueprint/context.md, lib/card.js): a draft (no `Confirmed:` line) → resume
 *     get-context, with its open points; confirmed but no plan yet → go on with create-plan;
 *   - no plan and no card: one line — every new request starts with get-context (a tiny one: one
 *     line of confirmation, no files). Blueprint is the start of every piece of work, so this line
 *     appears in every project where the plugin is enabled.
 *   - in a linked worktree (lib/common.js worktreeOf): a child always reads the main folder's live
 *     plan; any other worktree its own plan, else the main folder's. A child session is a worktree named after a part of the
 *     stage built in parallel: one line says so and, while it builds without its copy of the plain
 *     plan, one line tells it to warn the main session (it cannot write outside its folder). Any
 *     other worktree (the main session opened in one) only learns where the plan is;
 * The current stage is the first `in_progress` one, else the first `todo` one.
 * Errors never fail the session (exit 0).
 *
 * Usage: SessionStart hook in hooks/hooks.json. Reads the payload's `cwd` (or
 * CLAUDE_PROJECT_DIR) to find the project. Output: JSON hookSpecificOutput.additionalContext.
 */

const fs = require('fs');
const path = require('path');
const { readStdinJson, projectDirOf, findVaultRoot, blueprintDirOf, worktreeOf, slug, readPlan, relInside, readText, readJson, toPosix } = require('./lib/common');
const { loadLoops, currentStage } = require('./lib/plan');
const { readCard, openList } = require('./lib/card');

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

/** `where` names the plan file as this session reaches it; `focus` is a child's own stage. */
function planLines(projectDir, plan, where = 'blueprint/plan.json', focus = null) {
  if (plan.unreadable) {
    return [`[Blueprint] ${where} is unreadable (not valid JSON, or no "stages"). Fix it before relying on the plan.`, LOAD_SKILL];
  }
  const project = plan.project || 'This project';
  const notes = unreadNotes(projectDir);
  const noteLine = notes ? [`${notes} new note${notes > 1 ? 's' : ''} (${where.replace(/plan\.json$/, 'notes.json')})`] : [];
  const current = focus ? { stage: focus, index: plan.stages.indexOf(focus), total: plan.stages.length } : currentStage(plan);
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
  const lines = [first, `Plan: ${where} (written only by the main session, checked by the plan-guard). ${LOAD_SKILL}`];
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

// ---------------------------------------------------------------- the context card

const NEW_REQUEST = '[Blueprint] No plan here: every new request starts with `blueprint:get-context` (a tiny one: one line of confirmation, no files).';

function cardLines(projectDir, hasPlan, hasHead) {
  const card = readCard(projectDir);
  const load = hasHead ? '' : ` ${LOAD_SKILL}`;
  if (card && !card.confirmed) {
    const open = openList(card);
    return [`[Blueprint] Context in progress: blueprint/context.md is a draft. Resume \`blueprint:get-context\`${open ? ` (open points: ${open})` : ' (draw the conclusions and ask for the confirmation)'}.${load}`];
  }
  if (hasPlan) return [];
  if (card) return [`[Blueprint] Context confirmed, no plan yet: go on with \`blueprint:create-plan\`.${load}`];
  return [`${NEW_REQUEST}${load}`];
}

// ---------------------------------------------------------------- child sessions

/** The stage built in parallel: the first running one with independent parts (as the panel's). */
function parallelStage(plan) {
  const stages = plan && !plan.unreadable && Array.isArray(plan.stages) ? plan.stages : [];
  return stages.find((s) => s && s.status === 'in_progress' && Array.isArray(s.independent_parts) && s.independent_parts.length > 0) || null;
}

/** A child is a worktree named after a part of the parallel stage («Area admin» → area-admin). */
function isChild(wt, plan) {
  const stage = parallelStage(plan);
  return Boolean(wt && stage && stage.independent_parts.some((p) => slug(p) === wt.name));
}

/**
 * In a worktree: who it is and where the plan lives. Only a child is told to write inside its
 * folder alone; another worktree (the main session opened in one) only learns where the plan is.
 */
function worktreeLines(wt, own, plan) {
  if (!wt) return [];
  const where = own ? 'this folder' : `${toPosix(wt.main)}/blueprint`;
  if (isChild(wt, plan)) return [`[Blueprint] Child session «${wt.name}»: the plan lives in ${where} (read it; write only inside this folder).`];
  return own ? [] : [`[Blueprint] Worktree of ${toPosix(wt.main)}: the plan lives in ${where}.`];
}

/**
 * A child building a parallel stage needs its own copy of the plain plan to tick: it cannot write
 * outside its folder, and a worktree has no copy when blueprint/ is not committed.
 */
function copyLines(wt, plan) {
  if (!isChild(wt, plan)) return [];
  const stage = parallelStage(plan);
  if (stage.type !== 'implementation' || stage.phase !== 'build') return [];
  const rel = `blueprint/plans/${stage.id}.md`;
  if (fs.existsSync(path.join(wt.root, rel))) return [];
  return [`[Blueprint] No copy of the plain plan in this folder (${rel}): you cannot tick your sub-tasks and must not write outside this folder. Tell the main session now (SendMessage), keep building, and write your report inside this folder.`];
}

// ---------------------------------------------------------------- assembly

function buildContext(projectDir) {
  // a child reads the main folder's live plan (only the main session writes it; its own copy, if
  // blueprint/ is committed, is as old as its first commit). Any other worktree (the main session
  // opened in one) keeps its own plan, and falls back to the main folder's when it has none.
  const wt = worktreeOf(projectDir);
  const mainPlan = wt ? readPlan(wt.main) : null;
  const ownPlan = readPlan(projectDir);
  const plan = isChild(wt, mainPlan) ? mainPlan : ownPlan || mainPlan;
  const own = Boolean(plan) && plan === ownPlan;
  const planDir = plan && !own ? wt.main : projectDir;
  const vaultRoot = findVaultRoot(projectDir);
  let lines = [];
  const where = planDir === projectDir ? undefined : `${toPosix(planDir)}/blueprint/plan.json`;
  const focus = isChild(wt, plan) ? parallelStage(plan) : null;
  try { if (plan) lines = [...worktreeLines(wt, own, plan), ...planLines(planDir, plan, where, focus), ...copyLines(wt, plan)]; } catch { lines = []; }
  if (vaultRoot) lines.push(...vaultLines(projectDir, vaultRoot, Boolean(plan)));
  try { lines.push(...cardLines(projectDir, Boolean(plan), Boolean(plan || vaultRoot))); } catch { /* never fail the session */ }
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
