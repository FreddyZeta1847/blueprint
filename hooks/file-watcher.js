/*
 * PostToolUse hook — Blueprint's file-watcher (v3).
 *
 * One script, dispatched by WHICH file was just written:
 *
 *   foundations/ contracts/ sections/ *.md -> read the decision blocks of the whole vault in
 *     (and legacy features/ *.md with blocks)  memory (Markdown is the only source), recompile
 *                                            _index/decisions.json, report unreadable blocks in
 *                                            the written folder, run the scoped Review checks
 *                                            and the Stage check, audit
 *   management-info.md (legacy)           -> same cascade for `Decided by: rule` blocks
 *   <folder>/atoms.json                   -> v1 features/: compile + checks; anywhere else, a
 *                                            reminder that atoms.json is no longer used
 *   Vocabulary/registry.json              -> orphan-check (registry direction)
 *   any other project file                -> module map: unowned source files are recorded;
 *                                            blueprint/, docs, Markdown, lock files and tool
 *                                            folders ignored
 *   Bash / PowerShell (no file_path)      -> cheap mtime check: re-read the vault when a shell
 *                                            command changed decision files
 *
 * The decisions folder (the "vault" in the code) is blueprint/decisions/ (legacy: vault-<project>/ at the root). No atoms.json and no
 * _full-context.md are written any more: the atoms live only in memory and in the index, and
 * git + _current-task.md keep the conversation record.
 *
 * Findings reach Claude only as JSON hookSpecificOutput.additionalContext, prefixed [Blueprint].
 * Every check is real code; none asks a model to compare anything. Errors never break a session.
 *
 * Usage: PostToolUse hook in hooks/hooks.json, matcher "Write|Edit|MultiEdit|Bash|PowerShell".
 */

const path = require('path');
const { readStdinJson, projectDirOf, findVaultRoot, relInside, readJson, writeJson } = require('./lib/common');
const { unitOf } = require('./lib/decisions');
const { isIgnoredSourcePath } = require('./lib/ignore');
const vault = require('./lib/vault');

const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

function emit(lines) {
  if (!lines.length) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: ['[Blueprint]', ...lines].join('\n') },
  }));
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

function registryOrphans(vaultRoot) {
  const entries = vault.flattenIndex(vault.compileIndex(vaultRoot));
  return vault.registryOrphanCheck(entries, vault.registryIdsOf(vaultRoot)).map((f) => `ORPHAN CHECK: ${f}`);
}

function handleAtomsJson(input, vaultRoot, projectDir, rel, meta) {
  if (meta.scope === 'feature') return vault.processDecisionChange(vaultRoot, projectDir, input.session_id, [meta.folder]);
  return [`\`${rel}\` is not used: decisions live only in the Markdown decision blocks of this folder. Delete this file and edit the Markdown instead.`];
}

function handleFileWrite(input, vaultRoot, projectDir) {
  const filePath = path.resolve(input.tool_input.file_path);
  const rel = relInside(vaultRoot, filePath);
  if (rel === null) return refreshModuleMap(vaultRoot, projectDir, filePath);

  const sessionId = input.session_id;
  if (rel === vault.MANAGEMENT_INFO) {
    return vault.processDecisionChange(vaultRoot, projectDir, sessionId, [''], [
      'management-info.md changed. Rules are decision blocks with `Decided by: rule`; preferences stay plain text and never become decisions. Show the user what you understood before relying on it.',
    ]);
  }
  if (rel === 'Vocabulary/registry.json') return registryOrphans(vaultRoot);

  const meta = unitOf(rel);
  if (!meta) return [];
  const base = path.basename(rel);
  if (base === 'atoms.json') return handleAtomsJson(input, vaultRoot, projectDir, rel, meta);
  if (base === 'modules.json') return [];
  return vault.processDecisionChange(vaultRoot, projectDir, sessionId, [meta.folder]);
}

/** H8: a shell command may have written vault files without Write/Edit. Cheap mtime checks only. */
function handleShell(input, vaultRoot, projectDir) {
  const stale = vault.staleFolders(vaultRoot);
  if (!stale.length) return [];
  return vault.processDecisionChange(vaultRoot, projectDir, input.session_id, stale);
}

function main() {
  const input = readStdinJson();
  if (!input) return;
  const projectDir = projectDirOf(input);
  const vaultRoot = findVaultRoot(projectDir);
  if (!vaultRoot) return;   // no vault — stay silent and cheap

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
