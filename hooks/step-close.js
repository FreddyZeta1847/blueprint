/*
 * Stop hook — Blueprint's end-of-step question (D12 / P7).
 *
 * When Claude is about to finish its turn, this hook asks: did this session change source files
 * that belong to parts of the project with recorded decisions? If so — and this exact set of
 * changed files has not been asked about before — it blocks the stop once, telling Claude to ask
 * the user "did this work change the foundations?" and to update the vault if the answer is yes.
 *
 * How "belongs to a part with decisions" is decided:
 *   - with ownership maps (modules.json in foundations/ / sections/ folders): only files owned by
 *     a part that has at least one decision;
 *   - without any map: any changed source file, as long as the vault holds at least one decision.
 * Changed files come from `git status`; the vault, docs, Markdown, lock files and tool folders are
 * ignored (same list as the module map). Each asked-about set is remembered by hash in
 * _index/step-close.json, so the same set never blocks twice. `stop_hook_active` always exits.
 *
 * Output: {"decision":"block","reason":"[Blueprint] ..."} on stdout, or nothing. Never breaks a
 * session: any error → exit 0, no output.
 *
 * Usage: Stop hook in hooks/hooks.json.
 */

const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');
const { readStdinJson, projectDirOf, findVaultRoot, relInside, readJson, writeJson } = require('./lib/common');
const { isIgnoredSourcePath } = require('./lib/ignore');
const vault = require('./lib/vault');

const STATE = '_index/step-close.json';
const MAX_REMEMBERED = 50;
const MAX_LISTED = 5;

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });
}

/** Project-relative POSIX paths of every changed (modified, added, untracked, renamed) file. */
function changedFiles(projectDir) {
  let top;
  let out;
  try {
    top = git(['rev-parse', '--show-toplevel'], projectDir).trim();
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
  return files
    .map((p) => relInside(projectDir, path.join(top, p)))
    .filter((rel) => rel && !isIgnoredSourcePath(rel));
}

function relevantFiles(vaultRoot, files) {
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

function alreadyAsked(vaultRoot, hash) {
  const file = path.join(vaultRoot, STATE);
  const state = readJson(file, { asked: [] });
  const asked = Array.isArray(state.asked) ? state.asked : [];
  if (asked.includes(hash)) return true;
  writeJson(file, { asked: [...asked, hash].slice(-MAX_REMEMBERED) });
  return false;
}

function reasonFor(files) {
  const listed = files.slice(0, MAX_LISTED).map((f) => `\`${f}\``).join(', ');
  const more = files.length > MAX_LISTED ? ` and ${files.length - MAX_LISTED} more` : '';
  return (
    `[Blueprint] Before you finish: this session changed files covered by recorded decisions (${listed}${more}). ` +
    'Ask the user, in plain words: "Did this work change the foundations — a decision, a contract or the architecture?" ' +
    'If yes, update the decision blocks in the vault (foundations/, contracts/ or sections/) before ending. ' +
    'If no, say so briefly and end your turn. This reminder appears only once for this set of changes.'
  );
}

function main() {
  const input = readStdinJson();
  if (!input || input.stop_hook_active) return;
  const projectDir = projectDirOf(input);
  const vaultRoot = findVaultRoot(projectDir);
  if (!vaultRoot) return;

  const files = changedFiles(projectDir);
  if (!files || !files.length) return;
  const relevant = relevantFiles(vaultRoot, files).sort();
  if (!relevant.length) return;

  const hash = crypto.createHash('sha1').update(relevant.join('\n')).digest('hex');
  if (alreadyAsked(vaultRoot, hash)) return;
  process.stdout.write(JSON.stringify({ decision: 'block', reason: reasonFor(relevant) }));
}

try {
  main();
} catch (e) {
  process.stderr.write(`Blueprint step-close error: ${e && e.message}\n`);
}
