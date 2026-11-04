/*
 * PostToolUse hook — Blueprint's file-watcher (v2).
 *
 * One script, dispatched by WHICH file was just written:
 *
 *   foundations/ contracts/ sections/ *.md -> derive that folder's atoms.json from the decision
 *     (and legacy features/ *.md with blocks)  blocks (Markdown is the only source), recompile
 *                                            _index/decisions.json, report unreadable blocks,
 *                                            run the scoped Review checks, audit, flag the profile
 *   management-info.md                    -> same cascade for `Decided by: rule` blocks
 *   <folder>/atoms.json written by hand   -> compile + checks (v1); in a v2 folder, a reminder
 *                                            that atoms.json is derived
 *   Vocabulary/registry.json              -> orphan-check (registry direction)
 *   _current-task.md                      -> append only the NEW lines to _full-context.md,
 *                                            using a shadow copy to diff old vs new
 *   any other project file                -> module map: unowned source files are recorded;
 *                                            docs, Markdown, lock files, tool folders ignored
 *   Bash / PowerShell (no file_path)      -> cheap mtime check: mirror _current-task.md and
 *                                            re-derive decision folders changed by a shell write
 *
 * Findings reach Claude only as JSON hookSpecificOutput.additionalContext, prefixed [Blueprint].
 * The writer is the main session (Blueprint v2), so the messages land where the user is.
 * Every check is real code; none asks a model to compare anything. Errors never break a session.
 *
 * Usage: PostToolUse hook in hooks/hooks.json, matcher "Write|Edit|MultiEdit|Bash|PowerShell".
 */

const fs = require('fs');
const path = require('path');
const { readStdinJson, projectDirOf, findVaultRoot, relInside, readText, readJson, writeJson, nowStamp } = require('./lib/common');
const { unitOf } = require('./lib/decisions');
const { isIgnoredSourcePath } = require('./lib/ignore');
const vault = require('./lib/vault');

const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const SHADOW = '_index/current-task.shadow.md';

function emit(lines) {
  if (!lines.length) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: ['[Blueprint]', ...lines].join('\n') },
  }));
}

// ---------------------------------------------------------------- _full-context.md (H7)

/** Lines of `next` that are not part of the longest common subsequence with `prev`. */
function addedLines(prev, next) {
  const a = prev.split(/\r?\n/);
  const b = next.split(/\r?\n/);
  if (a.length * b.length > 4000000) {
    const pool = new Map();
    for (const l of a) pool.set(l, (pool.get(l) || 0) + 1);
    return b.filter((l) => {
      const n = pool.get(l) || 0;
      if (n) { pool.set(l, n - 1); return false; }
      return true;
    });
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) { i++; j++; }
    else if (i < a.length && dp[i + 1][j] >= dp[i][j + 1]) i++;
    else { out.push(b[j]); j++; }
  }
  return out;
}

function trimBlank(lines) {
  let s = 0;
  let e = lines.length;
  while (s < e && !lines[s].trim()) s++;
  while (e > s && !lines[e - 1].trim()) e--;
  return lines.slice(s, e);
}

function mirrorCurrentTask(vaultRoot) {
  const task = path.join(vaultRoot, '_current-task.md');
  const shadow = path.join(vaultRoot, SHADOW);
  const mirror = path.join(vaultRoot, '_full-context.md');
  const now = readText(task);
  if (now === null) return;
  const prev = readText(shadow) || '';
  const added = trimBlank(addedLines(prev, now));
  if (added.length) {
    if (!fs.existsSync(mirror)) {
      fs.writeFileSync(mirror, '# Full Context (machine-read fallback)\n\nAppend-only record of every line ever written to _current-task.md. Never cleared, never hand-edited.\n', 'utf8');
    }
    fs.appendFileSync(mirror, `\n<!-- ${nowStamp()} -->\n${added.join('\n')}\n`, 'utf8');
  }
  fs.mkdirSync(path.dirname(shadow), { recursive: true });
  fs.writeFileSync(shadow, now, 'utf8');
}

function mtime(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

// ---------------------------------------------------------------- module map (H6)

function refreshModuleMap(vaultRoot, projectDir, filePath) {
  const rel = relInside(projectDir, filePath);
  if (!rel || isIgnoredSourcePath(rel)) return [];

  const ownership = vault.loadOwnership(vaultRoot);
  if (vault.ownerOf(rel, ownership)) return [];

  const file = path.join(vaultRoot, '_index', 'unassigned.json');
  const unassigned = readJson(file, { files: [] });
  if (!Array.isArray(unassigned.files)) unassigned.files = [];
  if (unassigned.files.includes(rel)) return [];
  unassigned.files.push(rel);
  writeJson(file, unassigned);

  // Only speak when the project actually uses ownership maps; otherwise this is pure noise.
  if (!ownership.length) return [];
  return [`${unassigned.files.length} source file(s) belong to no part of the project yet (latest: \`${rel}\`). Offer to add them to the right modules.json — the hook cannot guess an owner.`];
}

// ---------------------------------------------------------------- dispatch

function handleFileWrite(input, vaultRoot, projectDir) {
  const filePath = path.resolve(input.tool_input.file_path);
  const rel = relInside(vaultRoot, filePath);
  if (rel === null) return refreshModuleMap(vaultRoot, projectDir, filePath);

  const sessionId = input.session_id;
  const base = path.basename(rel);

  if (rel === '_current-task.md') { mirrorCurrentTask(vaultRoot); return []; }

  if (rel === vault.MANAGEMENT_INFO) {
    return vault.processDecisionChange(vaultRoot, projectDir, sessionId, [''], [
      'management-info.md changed. Rules are decision blocks with `Decided by: rule`; preferences stay plain text and never become decisions. Show the user what you understood before relying on it.',
    ]);
  }

  if (rel === 'Vocabulary/registry.json') {
    const entries = vault.flattenIndex(vault.compileIndex(vaultRoot));
    const registry = readJson(path.join(vaultRoot, 'Vocabulary', 'registry.json'), { entries: [] });
    const ids = new Set((Array.isArray(registry) ? registry : registry.entries || []).map((e) => e && e.id).filter(Boolean));
    const used = new Set(entries.map(({ atom }) => atom.axis).filter(Boolean));
    return [...used].filter((a) => !ids.has(a)).map((a) => `ORPHAN CHECK: \`${a}\` is still used by a decision but has no registry entry — renamed or removed?`);
  }

  const meta = unitOf(rel);
  if (!meta) return [];

  if (base === 'atoms.json') {
    const notes = meta.scope === 'feature'
      ? []
      : [`\`${rel}\` is derived from the decision blocks in this folder's Markdown and is rewritten on the next .md change — edit the Markdown instead.`];
    return vault.processDecisionChange(vaultRoot, projectDir, sessionId, [], notes);
  }
  if (base === 'modules.json') return [];
  return vault.processDecisionChange(vaultRoot, projectDir, sessionId, [meta.folder]);
}

/** H8: a shell command may have written vault files without Write/Edit. Cheap mtime checks only. */
function handleShell(input, vaultRoot, projectDir) {
  const task = path.join(vaultRoot, '_current-task.md');
  if (fs.existsSync(task) && mtime(task) > mtime(path.join(vaultRoot, SHADOW))) mirrorCurrentTask(vaultRoot);

  const stale = vault.staleFolders(vaultRoot);
  if (!stale.length) return [];
  return vault.processDecisionChange(vaultRoot, projectDir, input.session_id, stale);
}

function main() {
  const input = readStdinJson();
  if (!input) return;
  const projectDir = projectDirOf(input);
  const vaultRoot = findVaultRoot(projectDir);
  if (!vaultRoot) return;   // not a Blueprint project — stay silent and cheap

  const toolInput = input.tool_input || {};
  if (typeof toolInput.file_path === 'string' && toolInput.file_path) {
    emit(handleFileWrite({ ...input, tool_input: toolInput }, vaultRoot, projectDir));
  } else if (SHELL_TOOLS.has(input.tool_name)) {
    emit(handleShell(input, vaultRoot, projectDir));
  }
}

try {
  main();
} catch (e) {
  // Never let a hook failure interrupt the session. PostToolUse cannot block anyway.
  process.stderr.write(`Blueprint file-watcher error: ${e && e.message}\n`);
}
