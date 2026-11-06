/*
 * Stop hook — Blueprint's end-of-step question (D12 / P7, v3).
 *
 * When Claude is about to finish its turn, this hook looks at the source files the session
 * changed (`git status`; blueprint/, the legacy vault, docs, Markdown, lock files and tool folders
 * are ignored) and may block the stop ONCE per set of changes with up to two reminders:
 *   1. plan (v3): blueprint/plan.json has an `in_progress` stage → "if a phase of stage «X» is
 *      finished, record it in blueprint/plan.json (the plan-guard checks the order); tick the
 *      topics that are done";
 *   2. vault: the changes touch parts of the project with recorded decisions → ask the user
 *      "did this work change the foundations?" and update the vault if yes.
 *      With ownership maps (modules.json in foundations/ / sections/ folders) only files owned
 *      by a part with at least one decision count; without any map, any changed source file
 *      counts as long as the vault holds at least one decision.
 * Nothing changed → no reminder. Each asked-about set is remembered by hash (vault:
 * _index/step-close.json; no vault: blueprint-step-close.json inside the git dir), so the same
 * set never blocks twice. `stop_hook_active` always exits.
 *
 * Output: {"decision":"block","reason":"[Blueprint] ..."} on stdout, or nothing. Never breaks a
 * session: any error → exit 0, no output.
 *
 * Usage: Stop hook in hooks/hooks.json.
 */

const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');
const { readStdinJson, projectDirOf, findVaultRoot, readPlan, relInside, readJson, writeJson } = require('./lib/common');
const { isIgnoredSourcePath } = require('./lib/ignore');
const vault = require('./lib/vault');

const MAX_REMEMBERED = 50;
const MAX_LISTED = 5;

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });
}

/** { files, gitDir }: project-relative POSIX paths of every changed source file, or null without git. */
function changedFiles(projectDir) {
  let top;
  let out;
  let gitDir;
  try {
    top = git(['rev-parse', '--show-toplevel'], projectDir).trim();
    gitDir = git(['rev-parse', '--absolute-git-dir'], projectDir).trim();
    out = git(['status', '--porcelain=v1', '-z', '-uall'], top);
  } catch {
    return null;   // not a git repository, or git missing
  }
  const fields = out.split('\0');
  const files = [];
  for (let i = 0; i < fields.length; i++) {
    const rec = fields[i];
    if (!rec || rec.length < 4) continue;
    const xy = rec.slice(0, 2);
    files.push(rec.slice(3));
    if (xy[0] === 'R' || xy[0] === 'C') i++;   // the next field is the original path
  }
  const relevant = files
    .map((p) => relInside(projectDir, path.join(top, p)))
    .filter((rel) => rel && !isIgnoredSourcePath(rel));
  return { files: relevant.sort(), gitDir };
}

function filesWithDecisions(vaultRoot, files) {
  const index = readJson(path.join(vaultRoot, '_index', 'decisions.json'), null) || vault.compileIndex(vaultRoot);
  const counts = {};
  let total = 0;
  for (const [unit, body] of Object.entries(index.features || {})) {
    const n = ((body && body.atoms) || []).length;
    counts[unit] = n;
    total += n;
  }
  if (!total) return [];
  const ownership = vault.loadOwnership(vaultRoot);
  if (!ownership.length) return files;
  return files.filter((f) => {
    const unit = vault.ownerOf(f, ownership);
    return unit && counts[unit] > 0;
  });
}

function activeStage(plan) {
  if (!plan || plan.unreadable) return null;
  return plan.stages.find((s) => s && typeof s === 'object' && s.status === 'in_progress') || null;
}

function alreadyAsked(stateFile, hash) {
  const state = readJson(stateFile, { asked: [] });
  const asked = Array.isArray(state.asked) ? state.asked : [];
  if (asked.includes(hash)) return true;
  writeJson(stateFile, { asked: [...asked, hash].slice(-MAX_REMEMBERED) });
  return false;
}

function planReason(stage) {
  return `If a phase of stage «${stage.name || stage.id}» is finished, record it in blueprint/plan.json (the plan-guard checks the order); tick the topics that are done.`;
}

function vaultReason(files) {
  const listed = files.slice(0, MAX_LISTED).map((f) => `\`${f}\``).join(', ');
  const more = files.length > MAX_LISTED ? ` and ${files.length - MAX_LISTED} more` : '';
  return (
    `This session changed files covered by recorded decisions (${listed}${more}). ` +
    'Ask the user, in plain words: "Did this work change the foundations — a decision, a contract or the architecture?" ' +
    'If yes, update the decision blocks in the vault (foundations/, contracts/ or sections/) before ending. ' +
    'If no, say so briefly and end your turn.'
  );
}

function main() {
  const input = readStdinJson();
  if (!input || input.stop_hook_active) return;
  const projectDir = projectDirOf(input);
  const vaultRoot = findVaultRoot(projectDir);
  const stage = activeStage(readPlan(projectDir));
  if (!vaultRoot && !stage) return;

  const changed = changedFiles(projectDir);
  if (!changed || !changed.files.length) return;
  const covered = vaultRoot ? filesWithDecisions(vaultRoot, changed.files) : [];
  if (!stage && !covered.length) return;

  const key = [stage ? `plan:${stage.id}\n${changed.files.join('\n')}` : '', covered.length ? `vault:\n${covered.join('\n')}` : ''].join('\n');
  const hash = crypto.createHash('sha1').update(key).digest('hex');
  const stateFile = vaultRoot ? path.join(vaultRoot, '_index', 'step-close.json') : path.join(changed.gitDir, 'blueprint-step-close.json');
  if (alreadyAsked(stateFile, hash)) return;

  const parts = [stage ? planReason(stage) : null, covered.length ? vaultReason(covered) : null].filter(Boolean);
  const reason = `[Blueprint] Before you finish: ${parts.join(' ')} This reminder appears only once for this set of changes.`;
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

try {
  main();
} catch (e) {
  process.stderr.write(`Blueprint step-close error: ${e && e.message}\n`);
}
