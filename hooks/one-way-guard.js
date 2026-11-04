/*
 * PreToolUse hook — Blueprint's one-way floor (v2).
 *
 * Blocks exactly one thing: a decision that is hard to undo (`Reversibility: one-way`) being
 * saved as decided by Claude (`Decided by: claude`) instead of by the user. This is the safety
 * net behind "the user picks which areas the user agent handles": even in an area handed to
 * Claude, a one-way decision always comes back to the user.
 *
 * v2 (Markdown is the source): for a .md inside foundations/, contracts/, sections/ or legacy
 * features/, the hook rebuilds the file as it will be AFTER this tool call — Write = the new
 * content; Edit / MultiEdit = the current file with the replacements applied — parses the
 * decision blocks and denies the call if any block is one-way + claude. Rebuilding the whole
 * file means a one-line edit cannot slip past the floor.
 * v1 (kept for old vaults): an atoms.json write carrying `one-way` + `agent-approved`.
 *
 * Every block is appended to the vault's _audit.md. PreToolUse fires before any permission
 * mode check, so no mode can outrun it. Bad or unexpected input fails open (exit 0, no output).
 *
 * Usage: PreToolUse hook in hooks/hooks.json, matcher "Write|Edit|MultiEdit".
 */

const path = require('path');
const { readStdinJson, projectDirOf, findVaultRoot, relInside, readText, readJson, auditWho, nowStamp, appendAudit } = require('./lib/common');
const { parseDecisionBlocks, unitOf } = require('./lib/decisions');

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
}

// ---------------------------------------------------------------- v2: Markdown blocks

function applyEdit(text, oldString, newString, replaceAll) {
  if (typeof oldString !== 'string' || typeof newString !== 'string' || !oldString) return text;
  if (replaceAll) return text.split(oldString).join(newString);
  const at = text.indexOf(oldString);
  return at === -1 ? text : text.slice(0, at) + newString + text.slice(at + oldString.length);
}

/** The file's content as it will be after this tool call, or null when we can't tell. */
function contentAfter(toolName, toolInput, absPath) {
  if (toolName === 'Write') return typeof toolInput.content === 'string' ? toolInput.content : null;
  const current = readText(absPath);
  if (toolName === 'Edit') {
    if (current === null) return typeof toolInput.new_string === 'string' ? toolInput.new_string : null;
    return applyEdit(current, toolInput.old_string, toolInput.new_string, toolInput.replace_all);
  }
  if (toolName === 'MultiEdit' && Array.isArray(toolInput.edits)) {
    let text = current === null ? '' : current;
    for (const e of toolInput.edits) text = applyEdit(text, e && e.old_string, e && e.new_string, e && e.replace_all);
    return text;
  }
  return null;
}

function oneWayByClaude(markdown, source) {
  // Any block with a choice counts, even if other fields are missing: it would be saved as a decision.
  const { atoms } = parseDecisionBlocks(markdown, { source });
  return atoms.filter((a) => a.reversibility === 'one-way' && a.decided_by === 'claude').map((a) => a.id);
}

function blockMarkdown(input, vaultRoot, projectDir, rel, ids) {
  audit(vaultRoot, projectDir, input.session_id, rel, ids);
  const list = ids.map((id) => `\`${id}\``).join(', ');
  deny(
    `[Blueprint] One-way floor: blocked saving ${list} in \`${rel}\` as decided by Claude. ` +
    'A decision that is hard to change later (Reversibility: one-way) always needs the user\'s clear OK — ' +
    'even in an area the user handed to Claude, and in every permission mode.\n\n' +
    'Nothing in this write was saved. Ask the user about this decision in plain words (what it is, why it is hard to undo, ' +
    'what you recommend). When they agree, write the block again with `Decided by: user` (`Deciso da: utente` in an Italian vault). If it is really easy to change ' +
    'later, correct `Reversibility` as its own explained decision — never relabel it just to get past this check.'
  );
}

// ---------------------------------------------------------------- v1: atoms.json fragments

function scanFragments(text) {
  const findField = (field) => {
    const hits = [];
    const re = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) hits.push(m[1]);
    return hits;
  };
  return { statuses: findField('status'), reversibilities: findField('reversibility'), ids: findField('id'), axes: findField('axis') };
}

function storedReversibility(vaultRoot, ids) {
  const index = readJson(path.join(vaultRoot, '_index', 'decisions.json'), null);
  for (const body of Object.values((index && index.features) || {})) {
    for (const atom of (body && body.atoms) || []) if (atom && ids.includes(atom.id) && atom.reversibility) return atom.reversibility;
  }
  return null;
}

function checkLegacyAtoms(input, vaultRoot, projectDir, rel) {
  const t = input.tool_input;
  const text = input.tool_name === 'Write' ? t.content : input.tool_name === 'Edit' ? t.new_string : null;
  if (typeof text !== 'string') return;
  const { statuses, reversibilities, ids, axes } = scanFragments(text);
  if (!statuses.includes('agent-approved')) return;
  const oneWay = reversibilities.includes('one-way')
    || (reversibilities.length === 0 && storedReversibility(vaultRoot, ids) === 'one-way');
  if (!oneWay) return;
  const subjects = axes.length ? axes : ids;
  audit(vaultRoot, projectDir, input.session_id, rel, subjects);
  deny(
    `[Blueprint] One-way floor: blocked an agent-assist lock on ${subjects.map((s) => `\`${s}\``).join(', ') || 'this decision'}. ` +
    'A one-way decision can never be saved as `agent-approved` — it needs the user\'s confirmation first. Nothing was saved. ' +
    'Ask the user in plain words, then save it again as `ratified`.'
  );
}

// ---------------------------------------------------------------- audit + entry point

function audit(vaultRoot, projectDir, sessionId, rel, subjects) {
  try {
    appendAudit(vaultRoot, [
      '',
      `## ${nowStamp()} — ${rel} / ${subjects.join(', ') || '?'}`,
      '- **what:** BLOCKED by the one-way floor — a one-way decision saved as decided by Claude (not saved)',
      `- **who:** ${auditWho(projectDir)}`,
      `- **session:** \`${sessionId || 'unknown'}\``,
    ]);
  } catch (e) {
    process.stderr.write(`Blueprint one-way guard: could not write _audit.md (${e && e.message})\n`);
  }
}

function main() {
  const input = readStdinJson();
  if (!input || !input.tool_input || typeof input.tool_input.file_path !== 'string') return;
  const projectDir = projectDirOf(input);
  const vaultRoot = findVaultRoot(projectDir);
  if (!vaultRoot) return;

  const abs = path.resolve(input.tool_input.file_path);
  const rel = relInside(vaultRoot, abs);
  if (!rel) return;
  const meta = unitOf(rel);
  if (!meta) return;

  if (path.basename(rel) === 'atoms.json') return checkLegacyAtoms(input, vaultRoot, projectDir, rel);

  const after = contentAfter(input.tool_name, input.tool_input, abs);
  if (after === null) return;
  const ids = oneWayByClaude(after, rel);
  if (ids.length) blockMarkdown(input, vaultRoot, projectDir, rel, ids);
}

try {
  main();
} catch (e) {
  // Fail open rather than wedging the session: a crashed guard must not block every write.
  process.stderr.write(`Blueprint one-way guard error: ${e && e.message}\n`);
}
