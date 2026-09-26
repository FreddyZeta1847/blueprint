/*
 * PostToolUse hook — Blueprint's merged file-watcher.
 *
 * One script, one hook, dispatched by WHICH file was just written. Not every write
 * triggers every check — see the dispatch table in
 * vault-blueprint/features/DECISION-ATOMS/DECISION-ATOMS.md, which this implements:
 *
 *   feature/sub-feature .md      -> sync-check only
 *   features/<name>/atoms.json  -> sync-check + recompile _index/decisions.json
 *                                  + the 3 deterministic Review checks
 *                                  + orphan-check (depends_on direction)
 *                                  + append the _audit.md entry
 *                                  + flag a new `ratified` atom for profile-updater
 *   Vocabulary/registry.json    -> orphan-check (registry direction)
 *   management-info.md          -> trigger only; hands the conversion to vault-architect
 *   _current-task.md            -> append the written text VERBATIM to _full-context.md
 *   _queue.json                 -> nothing
 *   any other source file       -> refresh that file's module-map node
 *
 * DELIVERY IS LOAD-BEARING: a PostToolUse hook cannot block anything — the write already
 * happened — so findings only reach Claude via JSON on stdout carrying
 * hookSpecificOutput.additionalContext. Plain text on a normal exit lands in a transcript
 * nobody opens. Every reminder below depends on that.
 *
 * All checks are real code. None of them ask a model to compare anything.
 *
 * Usage: wired as the PostToolUse hook in hooks/hooks.json, matcher "Write|Edit".
 *        Receives the hook payload as JSON on stdin.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------- plumbing

function readStdin() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    return null;   // no stdin at all — nothing to do, stay quiet
  }
  try {
    // Strip a leading BOM: some shells prepend one when piping, and JSON.parse rejects it.
    return JSON.parse(raw.replace(/^﻿/, '').trim());
  } catch (e) {
    // Don't fail silently on a payload we were given but couldn't read — that hides real breakage.
    process.stderr.write(`Blueprint file-watcher: unparseable hook payload (${e.message})\n`);
    return null;
  }
}

/** Emit findings the only way PostToolUse can actually reach Claude. */
function emit(lines) {
  if (!lines.length) return;
  const payload = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ['[Blueprint]', ...lines].join('\n'),
    },
  };
  process.stdout.write(JSON.stringify(payload));
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/** atoms.json may be a bare array or { atoms: [...] } — accept both, always return an array. */
function atomsOf(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.atoms)) return parsed.atoms;
  return [];
}

// ---------------------------------------------------------------- locating the vault

function findVaultRoot(projectDir) {
  try {
    const entry = fs.readdirSync(projectDir).find((e) => e.startsWith('vault-'));
    return entry ? path.join(projectDir, entry) : null;
  } catch {
    return null;
  }
}

/** Classify the written path relative to the vault. Returns null when it isn't a vault file. */
function classify(vaultRoot, filePath) {
  const rel = path.relative(vaultRoot, filePath).split(path.sep).join('/');
  if (rel.startsWith('..')) return null;

  const base = path.basename(rel);
  const featureMatch = rel.match(/^features\/([^/]+)\//);

  if (featureMatch && base === 'atoms.json') return { kind: 'atoms', feature: featureMatch[1], rel };
  if (featureMatch && base === 'modules.json') return { kind: 'ignore', rel };
  if (featureMatch && base.endsWith('.md')) return { kind: 'featureMd', feature: featureMatch[1], rel };
  if (rel === 'Vocabulary/registry.json') return { kind: 'registry', rel };
  if (rel === 'management-info.md') return { kind: 'managementInfo', rel };
  if (rel === '_current-task.md') return { kind: 'currentTask', rel };
  if (rel === '_queue.json') return { kind: 'ignore', rel };
  return { kind: 'ignore', rel };
}

// ---------------------------------------------------------------- the compiled index

function listFeatureDirs(vaultRoot) {
  const featuresDir = path.join(vaultRoot, 'features');
  try {
    return fs
      .readdirSync(featuresDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Rebuild _index/decisions.json from every feature's atoms.json.
 * Shape matches what hooks/orientation.js already reads: { features: { NAME: { atoms: [...] } } }
 */
function compileIndex(vaultRoot) {
  const compiled = { features: {} };
  for (const feature of listFeatureDirs(vaultRoot)) {
    const atomsFile = path.join(vaultRoot, 'features', feature, 'atoms.json');
    if (!fs.existsSync(atomsFile)) continue;
    compiled.features[feature] = { atoms: atomsOf(readJson(atomsFile, null)) };
  }
  return compiled;
}

function flattenIndex(index) {
  const out = [];
  for (const [feature, body] of Object.entries((index && index.features) || {})) {
    for (const atom of (body && body.atoms) || []) out.push({ feature, atom });
  }
  return out;
}

// ---------------------------------------------------------------- the three Review checks

/** Vocabulary check — exact id membership. Never compares question text. */
function vocabularyCheck(entries, registryIds) {
  const findings = [];
  for (const { feature, atom } of entries) {
    if (!atom.axis) continue;
    if (!registryIds.has(atom.axis)) {
      findings.push(`${feature} — axis \`${atom.axis}\` (atom \`${atom.id || '?'}\`) is not registered in Vocabulary/registry.json`);
    }
  }
  return findings;
}

/** Conflict check — same axis, different choice, across two DIFFERENT features. */
function conflictCheck(entries) {
  const byAxis = new Map();
  for (const { feature, atom } of entries) {
    if (!atom.axis) continue;
    if (!byAxis.has(atom.axis)) byAxis.set(atom.axis, []);
    byAxis.get(atom.axis).push({ feature, atom });
  }

  const findings = [];
  for (const [axis, group] of byAxis) {
    const seen = new Map();
    for (const { feature, atom } of group) {
      const choice = JSON.stringify(atom.choice);
      if (!seen.has(choice)) seen.set(choice, new Set());
      seen.get(choice).add(feature);
    }
    if (seen.size < 2) continue;
    const parts = [...seen.entries()].map(
      ([choice, features]) => `${[...features].join('+')} → ${JSON.parse(choice)}`
    );
    findings.push(`axis \`${axis}\` is answered differently in different features: ${parts.join('  vs  ')}`);
  }
  return findings;
}

/**
 * Value-inversion check — the same literal choice under two DIFFERENT axes.
 * Skips absent-answer values from Vocabulary/ignored-values.json, which otherwise
 * bury every real finding (`none` under caching, retry and rate-limiting is three
 * correct atoms, not a duplicate). `yes`/`no` are deliberately NOT ignorable —
 * a yes/no choice means the axis itself was authored wrong.
 */
function valueInversionCheck(entries, ignoredValues) {
  const byValue = new Map();
  for (const { feature, atom } of entries) {
    if (!atom.axis || atom.choice === undefined || atom.choice === null) continue;
    if (typeof atom.choice !== 'string') continue;
    const key = atom.choice.trim().toLowerCase();
    if (!key || ignoredValues.has(key)) continue;
    if (!byValue.has(key)) byValue.set(key, new Map());
    byValue.get(key).set(atom.axis, feature);
  }

  const findings = [];
  for (const [value, axes] of byValue) {
    if (axes.size < 2) continue;
    const where = [...axes.entries()].map(([axis, feature]) => `${axis} (${feature})`);
    findings.push(`value \`${value}\` is the answer to more than one question: ${where.join(', ')} — the same decision written twice, or genuinely two decisions?`);
  }
  return findings;
}

// ---------------------------------------------------------------- orphan-check, both directions

function orphanCheckDependsOn(entries) {
  const ids = new Set(entries.map(({ atom }) => atom.id).filter(Boolean));
  const findings = [];
  for (const { feature, atom } of entries) {
    const deps = Array.isArray(atom.depends_on) ? atom.depends_on : [];
    for (const dep of deps) {
      if (!ids.has(dep)) {
        findings.push(`${feature} — atom \`${atom.id || '?'}\` depends_on \`${dep}\`, which no longer exists`);
      }
    }
  }
  return findings;
}

function orphanCheckRegistry(entries, registryIds) {
  const used = new Set(entries.map(({ atom }) => atom.axis).filter(Boolean));
  const findings = [];
  for (const axis of used) {
    if (!registryIds.has(axis)) {
      findings.push(`axis \`${axis}\` is still used by an atom but has no registry entry — renamed or removed?`);
    }
  }
  return findings;
}

// ---------------------------------------------------------------- sync-check

/**
 * Purely mechanical: did the feature's .md and its atoms.json move together?
 * It never reads WHAT changed — only whether both sides moved.
 */
function syncCheck(vaultRoot, feature) {
  const dir = path.join(vaultRoot, 'features', feature);
  const atomsFile = path.join(dir, 'atoms.json');
  if (!fs.existsSync(atomsFile)) return [];

  let markdownNewest = 0;
  try {
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.md')) continue;
      const mtime = fs.statSync(path.join(dir, entry)).mtimeMs;
      if (mtime > markdownNewest) markdownNewest = mtime;
    }
  } catch {
    return [];
  }
  if (!markdownNewest) return [];

  const atomsMtime = fs.statSync(atomsFile).mtimeMs;
  const driftMinutes = Math.abs(atomsMtime - markdownNewest) / 60000;
  if (driftMinutes < 10) return [];

  const behind = atomsMtime < markdownNewest ? 'atoms.json' : 'the prose';
  return [`${feature} — ${behind} did not move with the other side (${Math.round(driftMinutes)} min apart). They are meant to change together.`];
}

// ---------------------------------------------------------------- _audit.md

/**
 * Three tiers, in order. The middle one exists because the first is NOT as reliable as the
 * design assumed: on a real machine `git config user.name` came back empty at every scope
 * while commits still carried a proper author name, because the tooling supplies identity
 * per-commit rather than through config. Reading HEAD's author catches that case; without it
 * the audit trail silently records an OS account name instead of a person.
 */
function auditWho(projectDir) {
  const tryGit = (args) => {
    try {
      const out = execFileSync('git', args, { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return out || null;
    } catch {
      return null;
    }
  };

  return (
    tryGit(['config', 'user.name']) ||
    tryGit(['log', '-1', '--format=%an']) ||
    (() => {
      try {
        return require('os').userInfo().username;
      } catch {
        return 'unknown';
      }
    })()
  );
}

/** Diff the previous compiled index against the new one — that's where added/changed/removed comes from. */
function diffAtoms(oldIndex, newIndex) {
  const key = (feature, atom) => `${feature}::${atom.id}`;
  const before = new Map(flattenIndex(oldIndex).map((e) => [key(e.feature, e.atom), e]));
  const after = new Map(flattenIndex(newIndex).map((e) => [key(e.feature, e.atom), e]));

  const changes = [];
  for (const [k, entry] of after) {
    if (!before.has(k)) {
      changes.push({ type: 'added', ...entry });
    } else if (JSON.stringify(before.get(k).atom) !== JSON.stringify(entry.atom)) {
      changes.push({ type: 'changed', previous: before.get(k).atom, ...entry });
    }
  }
  for (const [k, entry] of before) {
    if (!after.has(k)) changes.push({ type: 'removed', ...entry });
  }
  return changes;
}

function appendAudit(vaultRoot, projectDir, sessionId, changes) {
  if (!changes.length) return;

  const who = auditWho(projectDir);
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const lines = [];

  for (const change of changes) {
    const atom = change.atom;
    lines.push('');
    lines.push(`## ${when} — ${change.feature} / ${atom.axis || '?'}`);
    lines.push(`- **what:** ${change.type}${atom.choice !== undefined ? ` — choice \`${atom.choice}\`` : ''}`);
    if (change.type === 'changed' && change.previous && change.previous.choice !== atom.choice) {
      lines.push(`- **was:** \`${change.previous.choice}\``);
    }
    lines.push(`- **why:** ${atom.rationale || '(no rationale recorded)'}`);
    lines.push(`- **who:** ${who}`);
    lines.push(`- **status:** ${atom.status || '?'} · **reversibility:** ${atom.reversibility || '?'}`);
    lines.push(`- **atom:** \`${atom.id || '?'}\` · **session:** \`${sessionId || 'unknown'}\``);
  }

  const auditFile = path.join(vaultRoot, '_audit.md');
  if (!fs.existsSync(auditFile)) {
    fs.writeFileSync(
      auditFile,
      '# Decision Audit\n\nAuto-generated, append-only. Who changed which decision, when, and why.\nNever hand-edited.\n',
      'utf8'
    );
  }
  fs.appendFileSync(auditFile, lines.join('\n') + '\n', 'utf8');
}

// ---------------------------------------------------------------- _full-context.md

/**
 * Append whatever was just written to _current-task.md into _full-context.md, verbatim.
 * No marker, no filtering, no id — everything in the scratchpad is worth preserving.
 * Edit  → tool_input.new_string IS the newly added text.
 * Write → tool_input.content is the WHOLE file, so appending duplicates everything already
 *         mirrored. A Write here happens twice in the file's life: first creation, and the
 *         clear at the end of a feature. So: append only when the mirror is still empty.
 */
function mirrorCurrentTask(vaultRoot, toolName, toolInput) {
  const mirror = path.join(vaultRoot, '_full-context.md');
  const mirrorExists = fs.existsSync(mirror);
  const mirrorEmpty = !mirrorExists || fs.statSync(mirror).size === 0;

  let text = null;
  if (toolName === 'Edit' && typeof toolInput.new_string === 'string') {
    text = toolInput.new_string;
  } else if (toolName === 'Write' && typeof toolInput.content === 'string') {
    if (!mirrorEmpty) return [];        // this is the clear — a clear adds no new reasoning
    text = toolInput.content;
  }
  if (!text || !text.trim()) return [];

  if (!mirrorExists) {
    fs.writeFileSync(mirror, '# Full Context (machine-read fallback)\n\nAppend-only mirror of _current-task.md. Never cleared, never hand-edited.\n', 'utf8');
  }
  fs.appendFileSync(mirror, '\n' + text.replace(/\s+$/, '') + '\n', 'utf8');
  return [];
}

// ---------------------------------------------------------------- module map

function refreshModuleMap(vaultRoot, projectDir, filePath) {
  const rel = path.relative(projectDir, filePath).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) return [];

  for (const feature of listFeatureDirs(vaultRoot)) {
    const mapFile = path.join(vaultRoot, 'features', feature, 'modules.json');
    const map = readJson(mapFile, null);
    const owned = (map && Array.isArray(map.files) ? map.files : []);
    if (owned.includes(rel)) return [];   // already owned — nothing to do
  }

  // Owned by nobody. The hook must NOT guess an owner — it has no inference, by design.
  const unassignedFile = path.join(vaultRoot, '_index', 'unassigned.json');
  const unassigned = readJson(unassignedFile, { files: [] });
  if (!Array.isArray(unassigned.files)) unassigned.files = [];
  if (unassigned.files.includes(rel)) return [];

  unassigned.files.push(rel);
  writeJson(unassignedFile, unassigned);
  return [`${unassigned.files.length} source file(s) belong to no feature yet (latest: \`${rel}\`). Offer to assign owners — the hook cannot guess.`];
}

// ---------------------------------------------------------------- the atoms.json cascade

function handleAtomsWrite(vaultRoot, projectDir, sessionId, feature) {
  const findings = [];

  const oldIndex = readJson(path.join(vaultRoot, '_index', 'decisions.json'), { features: {} });
  const newIndex = compileIndex(vaultRoot);
  writeJson(path.join(vaultRoot, '_index', 'decisions.json'), newIndex);

  const entries = flattenIndex(newIndex);
  const registry = readJson(path.join(vaultRoot, 'Vocabulary', 'registry.json'), { entries: [] });
  const registryIds = new Set(
    (Array.isArray(registry) ? registry : registry.entries || []).map((e) => e && e.id).filter(Boolean)
  );
  const ignoredRaw = readJson(path.join(vaultRoot, 'Vocabulary', 'ignored-values.json'), null);
  const ignoredValues = new Set(
    (Array.isArray(ignoredRaw) ? ignoredRaw : (ignoredRaw && ignoredRaw.values) || [])
      .map((v) => String(v).trim().toLowerCase())
  );

  // Accept both the documented wrapper and a bare array. A wrong-shaped file must never
  // silently disable dismissal — that would resurface a finding the user already ruled out.
  const dismissedRaw = readJson(path.join(vaultRoot, 'Vocabulary', 'dismissed.json'), null);
  const dismissedList = Array.isArray(dismissedRaw)
    ? dismissedRaw
    : (dismissedRaw && Array.isArray(dismissedRaw.entries) ? dismissedRaw.entries : []);
  const dismissedTitles = new Set(dismissedList.map((e) => e && e.title).filter(Boolean));
  const keep = (list) => list.filter((f) => !dismissedTitles.has(f));

  // Grouped by check type, conflicts first — the most likely to actually break something.
  const conflicts = keep(conflictCheck(entries));
  const vocabulary = keep(vocabularyCheck(entries, registryIds));
  const inversions = keep(valueInversionCheck(entries, ignoredValues));
  const orphans = keep(orphanCheckDependsOn(entries));

  if (conflicts.length) findings.push('CONFLICT CHECK:', ...conflicts.map((f) => `  - ${f}`));
  if (vocabulary.length) findings.push('VOCABULARY CHECK:', ...vocabulary.map((f) => `  - ${f}`));
  if (inversions.length) findings.push('VALUE-INVERSION CHECK:', ...inversions.map((f) => `  - ${f}`));
  if (orphans.length) findings.push('ORPHAN CHECK:', ...orphans.map((f) => `  - ${f}`));

  findings.push(...syncCheck(vaultRoot, feature).map((f) => `SYNC CHECK: ${f}`));

  const changes = diffAtoms(oldIndex, newIndex);
  appendAudit(vaultRoot, projectDir, sessionId, changes);

  // The hook cannot dispatch an agent — it can only say a dispatch is due.
  const ratified = changes.filter((c) => c.type === 'added' && c.atom && c.atom.status === 'ratified');
  if (ratified.length) {
    findings.push(
      `PROFILE: ${ratified.length} newly ratified decision(s). Dispatch \`profile-updater\` to judge whether this reveals a tendency — and show the user before it saves. (agent-approved atoms never feed learning.)`
    );
  }

  if (findings.length) {
    findings.push('Present these, never resolve them unilaterally. A dismissal goes through vault-architect into Vocabulary/dismissed.json.');
  }
  return findings;
}

// ---------------------------------------------------------------- entry point

function main() {
  const input = readStdin();
  if (!input) return;

  const toolInput = input.tool_input || {};
  const filePath = toolInput.file_path;
  if (!filePath) return;

  const projectDir = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const vaultRoot = findVaultRoot(projectDir);
  if (!vaultRoot) return;   // not a Blueprint project — stay silent and cheap

  const target = classify(vaultRoot, path.resolve(filePath));
  const findings = [];

  if (target === null) {
    findings.push(...refreshModuleMap(vaultRoot, projectDir, path.resolve(filePath)));
  } else {
    switch (target.kind) {
      case 'atoms':
        findings.push(...handleAtomsWrite(vaultRoot, projectDir, input.session_id, target.feature));
        break;
      case 'featureMd':
        findings.push(...syncCheck(vaultRoot, target.feature).map((f) => `SYNC CHECK: ${f}`));
        break;
      case 'registry': {
        const entries = flattenIndex(compileIndex(vaultRoot));
        const registry = readJson(path.join(vaultRoot, 'Vocabulary', 'registry.json'), { entries: [] });
        const ids = new Set(
          (Array.isArray(registry) ? registry : registry.entries || []).map((e) => e && e.id).filter(Boolean)
        );
        findings.push(...orphanCheckRegistry(entries, ids).map((f) => `ORPHAN CHECK: ${f}`));
        break;
      }
      case 'managementInfo':
        findings.push(
          'management-info.md changed. Run the Rules/Preferences conversion through `vault-architect`: Rules become `status: locked` atoms, Preferences stay plain reference text and NEVER become atoms. Show the user what you understood BEFORE saving — a misread rule silently poisons every later discussion.'
        );
        break;
      case 'currentTask':
        findings.push(...mirrorCurrentTask(vaultRoot, input.tool_name, toolInput));
        break;
      default:
        break;   // _queue.json and anything else in-vault: nothing fires
    }
  }

  emit(findings);
}

try {
  main();
} catch (e) {
  // Never let a hook failure interrupt the session. PostToolUse cannot block anyway.
  process.stderr.write(`Blueprint file-watcher error: ${e && e.message}\n`);
}
