/*
 * Blueprint hooks — vault-level operations shared by the file-watcher, the Stop hook and
 * orientation: listing the folders that hold decisions, deriving each folder's atoms.json from
 * its Markdown (H1), compiling _index/decisions.json, the deterministic Review checks scoped to
 * what matters (H3, H5), the audit diff (H4) and the file-ownership maps (modules.json).
 *
 * Layout (spec A1): foundations/<AREA>/, contracts/ (+ contracts/<NAME>/), sections/<SEC>/,
 * legacy v1 features/<F>/, plus management-info.md (rules, `Decided by: rule`).
 * Derived atoms.json files carry `"derived": true`; a hand-written v1 atoms.json is never
 * overwritten.
 */

const fs = require('fs');
const path = require('path');
const { readText, readJson, writeJson, toPosix, auditWho, nowStamp, appendAudit } = require('./common');
const { parseDecisionBlocks, unitOf, isCheckable } = require('./decisions');

const MANAGEMENT_INFO = 'management-info.md';
const MANAGEMENT_ATOMS = '_index/management-info.atoms.json';

// ---------------------------------------------------------------- folders

function subdirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Every folder that can hold decisions, as vault-relative POSIX paths with their scope. */
function listUnitFolders(vaultRoot) {
  const out = [];
  for (const name of subdirs(path.join(vaultRoot, 'foundations'))) out.push({ scope: 'foundation', folder: `foundations/${name}` });
  if (fs.existsSync(path.join(vaultRoot, 'contracts'))) out.push({ scope: 'contract', folder: 'contracts' });
  for (const name of subdirs(path.join(vaultRoot, 'contracts'))) out.push({ scope: 'contract', folder: `contracts/${name}` });
  for (const name of subdirs(path.join(vaultRoot, 'sections'))) out.push({ scope: 'section', folder: `sections/${name}` });
  for (const name of subdirs(path.join(vaultRoot, 'features'))) out.push({ scope: 'feature', folder: `features/${name}` });
  return out;
}

function mdFilesIn(vaultRoot, folder) {
  try {
    return fs
      .readdirSync(path.join(vaultRoot, folder), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function atomsFileOf(vaultRoot, folder) {
  return folder === '' ? path.join(vaultRoot, MANAGEMENT_ATOMS) : path.join(vaultRoot, folder, 'atoms.json');
}

function atomsOf(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.atoms)) return parsed.atoms;
  return [];
}

// ---------------------------------------------------------------- deriving atoms.json (H1, H2)

/**
 * Parse every .md of one folder and write its derived atoms.json.
 * `folder === ''` means management-info.md (rules), derived into _index/.
 * Returns { folder, atoms, problems, wrote }.
 */
function deriveFolder(vaultRoot, folder) {
  const files = folder === '' ? (fs.existsSync(path.join(vaultRoot, MANAGEMENT_INFO)) ? [MANAGEMENT_INFO] : []) : mdFilesIn(vaultRoot, folder);
  const atoms = [];
  const problems = [];
  const byUnit = new Map();

  for (const name of files) {
    const rel = folder === '' ? name : `${folder}/${name}`;
    const meta = folder === '' ? { scope: 'foundation', unit: 'management-info' } : unitOf(rel);
    if (!meta) continue;
    const parsed = parseDecisionBlocks(readText(path.join(vaultRoot, rel)) || '', { source: rel });
    problems.push(...parsed.problems);
    for (const atom of parsed.atoms) {
      const seenIn = byUnit.get(`${meta.unit}::${atom.id}`);
      if (seenIn && seenIn !== rel) {
        problems.push({ source: rel, line: 0, id: atom.id, message: `also decided in \`${seenIn}\` — one decision, one place` });
      }
      byUnit.set(`${meta.unit}::${atom.id}`, rel);
      atoms.push({ ...atom, unit: meta.unit, scope: meta.scope });
    }
  }

  const target = atomsFileOf(vaultRoot, folder);
  const existing = readJson(target, null);
  const isLegacy = folder.startsWith('features/');
  const handWritten = existing && !existing.derived;
  let wrote = false;
  if (isLegacy) {
    // v1: only derive when the prose actually holds blocks, and never over a hand-written file.
    if (atoms.length && !handWritten) wrote = true;
  } else if (folder === '') {
    wrote = atoms.length > 0 || Boolean(existing);
  } else {
    wrote = true;
  }
  if (wrote) {
    writeJson(target, { derived: true, generated_from: files.map((f) => (folder ? `${folder}/${f}` : f)), atoms });
    // keep atoms.json at least as new as its newest source, so the mtime fast path stays quiet
    const newest = files.reduce((m, f) => Math.max(m, mtime(path.join(vaultRoot, folder, f))), 0);
    if (newest > mtime(target)) {
      const t = new Date(newest);
      try { fs.utimesSync(target, t, t); } catch { /* best effort */ }
    }
  }
  return { folder, atoms, problems, wrote };
}

function mtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

/** Folders whose Markdown changed after their atoms.json (a Bash write, H8). */
function staleFolders(vaultRoot) {
  const out = [];
  const candidates = listUnitFolders(vaultRoot).map((f) => f.folder);
  if (fs.existsSync(path.join(vaultRoot, MANAGEMENT_INFO))) candidates.push('');
  for (const folder of candidates) {
    const files = folder === '' ? [MANAGEMENT_INFO] : mdFilesIn(vaultRoot, folder);
    if (!files.length) continue;
    const newestMd = files.reduce((m, f) => Math.max(m, mtime(path.join(vaultRoot, folder, f))), 0);
    const atomsTime = mtime(atomsFileOf(vaultRoot, folder));
    if (folder.startsWith('features/') && !atomsTime) continue;   // v1 prose-only folder
    if (newestMd > atomsTime) out.push(folder);
  }
  return out;
}

// ---------------------------------------------------------------- the compiled index

/** { features: { <unit>: { scope, atoms } } } — the v1 shape, keyed by unit. */
function compileIndex(vaultRoot) {
  const compiled = { features: {} };
  const add = (unit, scope, atom) => {
    if (!compiled.features[unit]) compiled.features[unit] = { scope, atoms: [] };
    compiled.features[unit].atoms.push({ ...atom, unit, scope });
  };
  for (const { scope, folder } of listUnitFolders(vaultRoot)) {
    const file = atomsFileOf(vaultRoot, folder);
    if (!fs.existsSync(file)) continue;
    const folderUnit = scope === 'feature' ? folder.slice('features/'.length) : folder;
    for (const atom of atomsOf(readJson(file, null))) {
      if (!atom || typeof atom !== 'object') continue;
      add(atom.unit || folderUnit, atom.scope || scope, atom);
    }
  }
  for (const atom of atomsOf(readJson(path.join(vaultRoot, MANAGEMENT_ATOMS), null))) {
    if (atom && typeof atom === 'object') add('management-info', 'foundation', atom);
  }
  return compiled;
}

function flattenIndex(index) {
  const out = [];
  for (const [unit, body] of Object.entries((index && index.features) || {})) {
    for (const atom of (body && body.atoms) || []) {
      out.push({ unit, atom: { ...atom, scope: atom.scope || body.scope || 'feature' } });
    }
  }
  return out;
}

// ---------------------------------------------------------------- Review checks (H3, H5)

function registryIdsOf(vaultRoot) {
  const registry = readJson(path.join(vaultRoot, 'Vocabulary', 'registry.json'), { entries: [] });
  return new Set((Array.isArray(registry) ? registry : registry.entries || []).map((e) => e && e.id).filter(Boolean));
}

function ignoredValuesOf(vaultRoot) {
  const raw = readJson(path.join(vaultRoot, 'Vocabulary', 'ignored-values.json'), null);
  return new Set((Array.isArray(raw) ? raw : (raw && raw.values) || []).map((v) => String(v).trim().toLowerCase()));
}

function dismissedTitlesOf(vaultRoot) {
  const raw = readJson(path.join(vaultRoot, 'Vocabulary', 'dismissed.json'), null);
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.entries) ? raw.entries : []);
  return new Set(list.map((e) => e && e.title).filter(Boolean));
}

function vocabularyCheck(entries, registryIds) {
  return entries
    .filter(({ atom }) => atom.axis && !registryIds.has(atom.axis))
    .map(({ unit, atom }) => `${unit} — \`${atom.axis}\` is not registered in Vocabulary/registry.json`);
}

function conflictCheck(entries) {
  const byAxis = new Map();
  for (const { unit, atom } of entries) {
    if (!atom.axis) continue;
    if (!byAxis.has(atom.axis)) byAxis.set(atom.axis, new Map());
    const choices = byAxis.get(atom.axis);
    const key = JSON.stringify(atom.choice);
    if (!choices.has(key)) choices.set(key, new Set());
    choices.get(key).add(unit);
  }
  const findings = [];
  for (const [axis, choices] of byAxis) {
    if (choices.size < 2) continue;
    const parts = [...choices.entries()].map(([c, units]) => `${[...units].join('+')} → ${JSON.parse(c)}`);
    findings.push(`\`${axis}\` is answered differently in different places: ${parts.join('  vs  ')}`);
  }
  return findings;
}

function valueInversionCheck(entries, ignoredValues) {
  const byValue = new Map();
  for (const { unit, atom } of entries) {
    if (!atom.axis || typeof atom.choice !== 'string') continue;
    const key = atom.choice.trim().toLowerCase();
    if (!key || ignoredValues.has(key)) continue;
    if (!byValue.has(key)) byValue.set(key, new Map());
    byValue.get(key).set(atom.axis, unit);
  }
  const findings = [];
  for (const [value, axes] of byValue) {
    if (axes.size < 2) continue;
    const where = [...axes.entries()].map(([axis, unit]) => `${axis} (${unit})`);
    findings.push(`value \`${value}\` answers more than one question: ${where.join(', ')} — the same decision written twice, or two real decisions?`);
  }
  return findings;
}

function orphanCheck(checked, allEntries) {
  const ids = new Set(allEntries.map(({ atom }) => atom.id).filter(Boolean));
  const findings = [];
  for (const { unit, atom } of checked) {
    for (const dep of Array.isArray(atom.depends_on) ? atom.depends_on : []) {
      if (!ids.has(dep)) findings.push(`${unit} — \`${atom.id || '?'}\` depends on \`${dep}\`, which does not exist`);
    }
  }
  return findings;
}

function usedByCheck(entries, vaultRoot) {
  const sections = new Set(subdirs(path.join(vaultRoot, 'sections')).map((s) => s.toLowerCase()));
  const findings = [];
  for (const { unit, atom } of entries) {
    for (const name of Array.isArray(atom.used_by) ? atom.used_by : []) {
      if (!sections.has(String(name).toLowerCase())) {
        findings.push(`${unit} — \`${atom.id}\` is used by \`${name}\`, but there is no sections/${name}/ folder`);
      }
    }
  }
  return findings;
}

function registryOrphanCheck(entries, registryIds) {
  const used = new Set(entries.map(({ atom }) => atom.axis).filter(Boolean));
  return [...used]
    .filter((axis) => !registryIds.has(axis))
    .map((axis) => `\`${axis}\` is still used by a decision but has no registry entry — renamed or removed?`);
}

// ---------------------------------------------------------------- audit diff (H4)

function diffAtoms(oldIndex, newIndex) {
  const key = (unit, atom) => `${unit}::${atom.id}`;
  const strip = (atom) => {
    const { source, ...rest } = atom;   // moving a block between files is not a decision change
    return JSON.stringify(rest);
  };
  const before = new Map(flattenIndex(oldIndex).map((e) => [key(e.unit, e.atom), e]));
  const after = new Map(flattenIndex(newIndex).map((e) => [key(e.unit, e.atom), e]));
  const changes = [];
  for (const [k, entry] of after) {
    if (!before.has(k)) changes.push({ type: 'added', ...entry });
    else if (strip(before.get(k).atom) !== strip(entry.atom)) changes.push({ type: 'changed', previous: before.get(k).atom, ...entry });
  }
  for (const [k, entry] of before) if (!after.has(k)) changes.push({ type: 'removed', ...entry });
  return changes;
}

function auditChanges(vaultRoot, projectDir, sessionId, changes) {
  if (!changes.length) return;
  const who = auditWho(projectDir);
  const when = nowStamp();
  const lines = [];
  for (const change of changes) {
    const atom = change.atom;
    lines.push('', `## ${when} — ${change.unit} / ${atom.axis || '?'}`);
    lines.push(`- **what:** ${change.type}${atom.choice !== undefined ? ` — choice \`${atom.choice}\`` : ''}`);
    if (change.type === 'changed' && change.previous && change.previous.choice !== atom.choice) {
      lines.push(`- **was:** \`${change.previous.choice}\``);
    }
    lines.push(`- **why:** ${atom.rationale || '(no rationale recorded)'}`);
    lines.push(`- **who:** ${who} · **decided by:** ${atom.decided_by || '?'}`);
    lines.push(`- **status:** ${atom.status || '?'} · **reversibility:** ${atom.reversibility || '?'}`);
    lines.push(`- **source:** \`${atom.source || '?'}\` · **session:** \`${sessionId || 'unknown'}\``);
  }
  appendAudit(vaultRoot, lines);
}

// ---------------------------------------------------------------- the cascade after a change

/**
 * Re-derive the given folders, recompile the index, run the scoped checks, audit, flag the
 * profile. Returns the finding lines (without the [Blueprint] prefix).
 */
function processDecisionChange(vaultRoot, projectDir, sessionId, folders, extraNotes = []) {
  const findings = [...extraNotes];
  const problems = [];
  // Also re-derive any folder whose Markdown is newer than its atoms (written before the hook ran,
  // or by a shell command), so the index is never missing a part of the vault.
  const todo = [...new Set([...folders, ...staleFolders(vaultRoot)])];
  for (const folder of todo) problems.push(...deriveFolder(vaultRoot, folder).problems);

  const indexFile = path.join(vaultRoot, '_index', 'decisions.json');
  const oldIndex = readJson(indexFile, { features: {} });
  const newIndex = compileIndex(vaultRoot);
  writeJson(indexFile, newIndex);

  const all = flattenIndex(newIndex);
  const checked = all.filter(({ atom }) => isCheckable(atom));
  // The conflict check also sees any decision that answers a question already settled in a
  // foundation or contract: a section must not re-decide the foundations, even with a two-way
  // detail. Two-way details that only clash with each other stay out (no noise).
  const checkedAxes = new Set(checked.map(({ atom }) => atom.axis).filter(Boolean));
  const conflictInput = all.filter(({ atom }) => isCheckable(atom) || checkedAxes.has(atom.axis));
  const dismissed = dismissedTitlesOf(vaultRoot);
  const keep = (list) => list.filter((f) => !dismissed.has(f));

  if (problems.length) {
    findings.push('UNREADABLE DECISION BLOCKS (fix the Markdown — these are not saved as decisions until they read correctly):');
    for (const p of problems) findings.push(`  - \`${p.source}\`${p.line ? ` line ${p.line}` : ''} — \`${p.id}\`: ${p.message}`);
  }
  const groups = [
    ['CONFLICT CHECK', keep(conflictCheck(conflictInput))],
    ['VOCABULARY CHECK', keep(vocabularyCheck(checked, registryIdsOf(vaultRoot)))],
    ['VALUE-INVERSION CHECK', keep(valueInversionCheck(checked, ignoredValuesOf(vaultRoot)))],
    ['ORPHAN CHECK', keep(orphanCheck(checked, all))],
    ['USED-BY CHECK', keep(usedByCheck(all, vaultRoot))],
  ];
  for (const [title, list] of groups) if (list.length) findings.push(`${title}:`, ...list.map((f) => `  - ${f}`));

  const changes = diffAtoms(oldIndex, newIndex);
  auditChanges(vaultRoot, projectDir, sessionId, changes);
  const ratified = changes.filter((c) => c.type === 'added' && c.atom && c.atom.status === 'ratified');
  if (ratified.length) {
    findings.push(`PROFILE: ${ratified.length} newly confirmed decision(s) by the user. Dispatch \`blueprint:profile-updater\` to judge whether this reveals a tendency — and show the user before it saves. (Decisions made by Claude never feed learning.)`);
  }
  if (findings.length > extraNotes.length) {
    findings.push('Explain these to the user in plain words and let them decide before changing anything. A dismissal is recorded in Vocabulary/dismissed.json with its reason.');
  }
  return findings;
}

// ---------------------------------------------------------------- ownership (modules.json)

/** [{ unit, entries }] from every modules.json under a unit folder. */
function loadOwnership(vaultRoot) {
  const maps = [];
  for (const { scope, folder } of listUnitFolders(vaultRoot)) {
    const map = readJson(path.join(vaultRoot, folder, 'modules.json'), null);
    if (!map) continue;
    const entries = (Array.isArray(map) ? map : map.files || []).map((e) => toPosix(String(e)).replace(/^\.\//, ''));
    const unit = scope === 'feature' ? folder.slice('features/'.length) : folder;
    maps.push({ unit, entries });
  }
  return maps;
}

function matchesEntry(rel, entry) {
  const r = rel.toLowerCase();
  const e = entry.toLowerCase();
  if (e.endsWith('/**')) return r.startsWith(e.slice(0, -2));
  if (e.endsWith('/')) return r.startsWith(e);
  if (e.includes('*')) {
    const re = new RegExp('^' + e.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
    return re.test(r);
  }
  return r === e;
}

function ownerOf(rel, ownership) {
  for (const { unit, entries } of ownership) if (entries.some((e) => matchesEntry(rel, e))) return unit;
  return null;
}

module.exports = {
  MANAGEMENT_INFO,
  listUnitFolders,
  deriveFolder,
  staleFolders,
  compileIndex,
  flattenIndex,
  processDecisionChange,
  loadOwnership,
  ownerOf,
  atomsOf,
};
