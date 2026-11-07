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
 *      "did this work change a written decision?" and record the correction if yes.
 *      With ownership maps (modules.json in foundations/ / sections/ folders) only files owned
 *      by a part with at least one decision count; without any map, any changed source file
 *      counts as long as the vault holds at least one decision.
 * Before both: a draft context card (no `Confirmed:` line) → remind once per version of the card
 * that get-context is not finished (lib/card.js) — but not when Claude's last message already ends
 * with a question to the user (it is waiting; the reminder would only cause a duplicate message).
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
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readStdinJson, projectDirOf, findVaultRoot, readPlan, relInside, readJson, writeJson } = require('./lib/common');
const { isIgnoredSourcePath } = require('./lib/ignore');
const vault = require('./lib/vault');
const { readCard, openList } = require('./lib/card');
const os = require('os');

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
    'Ask the user, in plain words: "Did this work change something we decided — a shared choice, a contract or the architecture?" ' +
    'If yes, write the correction in the decisions folder (foundations/, contracts/ or sections/) before ending; only the user can make a one-way correction. ' +
    'If no, say so briefly and end your turn.'
  );
}

/** Where the "asked once" memory lives: the decisions folder's index, else the git dir, else a temp file. */
function stateFileFor(projectDir, vaultRoot) {
  if (vaultRoot) return path.join(vaultRoot, '_index', 'step-close.json');
  try {
    return path.join(git(['rev-parse', '--absolute-git-dir'], projectDir).trim(), 'blueprint-step-close.json');
  } catch {
    const id = crypto.createHash('sha1').update(path.resolve(projectDir)).digest('hex').slice(0, 12);
    return path.join(os.tmpdir(), `blueprint-step-close-${id}.json`);
  }
}

/** Claude's last text in this turn: `last_assistant_message` when the host sends it, else the transcript's tail. */
function lastAssistantText(input) {
  if (typeof input.last_assistant_message === 'string') return input.last_assistant_message;
  if (!input.transcript_path) return '';
  try {
    const lines = fs.readFileSync(input.transcript_path, 'utf8').trimEnd().split('\n').slice(-200).reverse();
    for (const line of lines) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      const content = entry && entry.type === 'assistant' && entry.message && entry.message.content;
      const texts = Array.isArray(content) ? content.filter((b) => b && b.type === 'text' && b.text.trim()) : [];
      if (texts.length) return texts[texts.length - 1].text;
    }
  } catch { /* unreadable transcript: no text */ }
  return '';
}

/** True when the text ends by asking the user something (markdown and closing quotes ignored). */
function endsWithQuestion(text) {
  return /\?\s*$/.test(String(text).replace(/[\s*_`»”"')\]]+$/u, ''));
}

/**
 * A draft context card means get-context is not finished. After a Discovery, a search or a long
 * detour Claude may forget it: remind once per version of the card. Not while Claude has just asked
 * the user something (it is waiting, the reminder would only produce a duplicate message): in that
 * case nothing is remembered, so the reminder can still come on a later turn. Returns true when it spoke.
 */
function draftCardReminder(projectDir, vaultRoot, input = {}) {
  const card = readCard(projectDir);
  if (!card || card.confirmed) return false;
  if (endsWithQuestion(lastAssistantText(input))) return false;
  const hash = crypto.createHash('sha1').update(`card:\n${card.text}`).digest('hex');
  if (alreadyAsked(stateFileFor(projectDir, vaultRoot), hash)) return false;
  const open = openList(card);
  const reason =
    '[Blueprint] Before you finish: get-context is not finished — blueprint/context.md is still a draft' +
    `${open ? ` (open points: ${open})` : ''}. If you just came back from Discovery, a search or another detour, ` +
    'go back to `blueprint:get-context` now: fill the points the results answer, ask what is still missing, then draw the conclusions and ask for the confirmation. ' +
    "If you are already waiting for the user's answer, just end your turn. This reminder appears only once for this version of the card.";
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  return true;
}

function main() {
  const input = readStdinJson();
  if (!input || input.stop_hook_active) return;
  const projectDir = projectDirOf(input);
  const vaultRoot = findVaultRoot(projectDir);
  if (draftCardReminder(projectDir, vaultRoot, input)) return;
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
