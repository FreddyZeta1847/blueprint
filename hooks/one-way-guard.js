/*
 * PreToolUse hook — Blueprint's one-way floor.
 *
 * Blocks exactly one thing: agent-assist mode locking a decision that cannot be undone.
 * It fires only when `reversibility: one-way` and `status: agent-approved` appear together
 * on the same atom. A manual-mode lock is `ratified`, so the condition can never be met —
 * this hook is NOT a second safety net for manual mode, which already stops for everything.
 *
 * Why a PreToolUse hook and not the constraints digest: the digest checks CONTENT correctness
 * (does Claude know what's locked). This checks PROCESS legitimacy (did a real human confirm).
 * Verified against the hooks docs: PreToolUse fires before any permission-mode check, in every
 * mode including acceptEdits and bypassPermissions — so agent-assist cannot outrun it.
 *
 * Partial-edit hardening: an `Edit` payload is a diff fragment, so it may carry `status`
 * without `reversibility` (or the reverse). When only one half is present, the atom's other
 * half is looked up by id in the compiled index rather than assumed safe — otherwise a
 * one-field edit would walk straight through the floor.
 *
 * Every block is also appended to the vault's _audit.md, as the audit spec requires
 * (docs-management: "one-way-guard blocked-write events").
 *
 * Usage: wired as the PreToolUse hook in hooks/hooks.json, matcher "Write|Edit".
 *        Receives the hook payload as JSON on stdin.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function readStdin() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    return null;   // no stdin at all
  }
  try {
    // Strip a leading BOM: some shells prepend one when piping, and JSON.parse rejects it.
    return JSON.parse(raw.replace(/^﻿/, '').trim());
  } catch (e) {
    // Fail open (never block a write because the payload was odd), but say so.
    process.stderr.write(`Blueprint one-way guard: unparseable hook payload (${e.message})\n`);
    return null;
  }
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
}

function findVaultRoot(projectDir) {
  try {
    const entry = fs.readdirSync(projectDir).find((e) => e.startsWith('vault-'));
    return entry ? path.join(projectDir, entry) : null;
  } catch {
    return null;
  }
}

/** The text this tool call is about to put on disk. */
function writtenText(toolName, toolInput) {
  if (toolName === 'Write' && typeof toolInput.content === 'string') return toolInput.content;
  if (toolName === 'Edit' && typeof toolInput.new_string === 'string') return toolInput.new_string;
  return null;
}

/**
 * Pull atom-shaped fragments out of the text. Deliberately regex-based rather than
 * JSON.parse: an Edit fragment is usually not valid JSON on its own.
 */
function scanFragments(text) {
  const findField = (field) => {
    const hits = [];
    const re = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) hits.push(m[1]);
    return hits;
  };
  return {
    statuses: findField('status'),
    reversibilities: findField('reversibility'),
    ids: findField('id'),
    axes: findField('axis'),
  };
}

/** Look an atom's stored reversibility up by id, for the partial-edit case. */
function storedReversibility(vaultRoot, ids) {
  if (!ids.length) return null;
  try {
    const index = JSON.parse(fs.readFileSync(path.join(vaultRoot, '_index', 'decisions.json'), 'utf8'));
    for (const body of Object.values((index && index.features) || {})) {
      for (const atom of (body && body.atoms) || []) {
        if (atom && ids.includes(atom.id) && atom.reversibility) return atom.reversibility;
      }
    }
  } catch {
    /* no index yet — nothing to look up */
  }
  return null;
}

/** Same identity tiers as file-watcher's auditWho: git config, then HEAD's author, then the OS user. */
function auditWho(projectDir) {
  const tryGit = (args) => {
    try {
      return execFileSync('git', args, { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
    } catch {
      return null;
    }
  };
  let osUser = 'unknown';
  try { osUser = require('os').userInfo().username; } catch { /* keep 'unknown' */ }
  return tryGit(['config', 'user.name']) || tryGit(['log', '-1', '--format=%an']) || osUser;
}

/** Log the blocked write. Never throws — a logging failure must not change the deny decision. */
function appendBlockedAudit(vaultRoot, projectDir, sessionId, feature, axes, ids) {
  try {
    const when = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const subject = axes.length ? axes.join(', ') : (ids.join(', ') || '?');
    const lines = [
      '',
      `## ${when} — ${feature} / ${subject}`,
      '- **what:** BLOCKED by the one-way guard — an agent-assist lock on a one-way decision (not saved)',
      `- **who:** ${auditWho(projectDir)}`,
      `- **session:** \`${sessionId || 'unknown'}\``,
    ];
    const auditFile = path.join(vaultRoot, '_audit.md');
    if (!fs.existsSync(auditFile)) {
      fs.writeFileSync(
        auditFile,
        '# Decision Audit\n\nAuto-generated, append-only. Who changed which decision, when, and why.\nNever hand-edited.\n',
        'utf8'
      );
    }
    fs.appendFileSync(auditFile, lines.join('\n') + '\n', 'utf8');
  } catch (e) {
    process.stderr.write(`Blueprint one-way guard: could not write _audit.md (${e && e.message})\n`);
  }
}

function main() {
  const input = readStdin();
  if (!input) return;

  const toolInput = input.tool_input || {};
  const filePath = toolInput.file_path;
  if (!filePath) return;

  // Scope: only atom writes inside a Blueprint vault. Everything else is none of this hook's business.
  if (path.basename(filePath) !== 'atoms.json') return;

  const projectDir = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const vaultRoot = findVaultRoot(projectDir);
  if (!vaultRoot) return;
  if (path.relative(vaultRoot, path.resolve(filePath)).startsWith('..')) return;

  const text = writtenText(input.tool_name, toolInput);
  if (!text) return;

  const { statuses, reversibilities, ids, axes } = scanFragments(text);
  if (!statuses.includes('agent-approved')) return;   // nothing autonomous here — let it through

  const oneWayInPayload = reversibilities.includes('one-way');
  const oneWayStored = !oneWayInPayload && reversibilities.length === 0
    ? storedReversibility(vaultRoot, ids) === 'one-way'
    : false;

  if (!oneWayInPayload && !oneWayStored) return;

  const subject = axes.length ? `\`${axes[0]}\`` : (ids.length ? `atom \`${ids[0]}\`` : 'this decision');
  const via = oneWayStored ? ' (its one-way reversibility was read from the compiled index, not this edit)' : '';
  const feature = path.basename(path.dirname(path.resolve(filePath)));
  appendBlockedAudit(vaultRoot, projectDir, input.session_id, feature, axes, ids);

  deny(
    `Blueprint one-way floor: blocked an agent-assist lock on ${subject}${via}. ` +
      `A decision marked \`reversibility: one-way\` can never be locked with \`status: agent-approved\` — ` +
      `it needs a real human confirmation first. Agent-assist mode cannot switch this off, in any permission mode.\n\n` +
      `NOTHING in this write was saved. If you are vault-architect: do not retry with a different status — ` +
      `report this as BLOCKED in your final report. The main conversation must ask the user about this ` +
      `decision in plain words, then re-send the whole save with it marked \`confirmed\` (status \`ratified\`). ` +
      `If it turns out to be reversible after all, correct \`reversibility\` as its own explained decision — ` +
      `don't relabel it just to get past this hook.`
  );
}

try {
  main();
} catch (e) {
  // Fail open rather than wedging the session: a crashed guard must not block every write.
  process.stderr.write(`Blueprint one-way guard error: ${e && e.message}\n`);
}
