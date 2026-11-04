/*
 * Blueprint v2 — the Markdown decision-block parser (spec A2) and the vault-path → unit map (A1).
 *
 * The Markdown is the single source of a decision. Every decision is a level-3 heading
 * `### <id> — <question>` followed by a bullet list with fixed keys (Choice, Reversibility,
 * Decided by, Why, Rejected, Depends on, Used by, Facts — Italian aliases accepted). This module
 * turns that text into atoms (the JSON shape the checks compare) and into a list of problems,
 * so a block written wrong is reported instead of silently disappearing.
 *
 * Used by: hooks/file-watcher.js (derives atoms.json), hooks/one-way-guard.js (the floor on
 * Markdown writes), hooks/step-close.js and hooks/orientation.js (via the compiled index).
 */

const DECIDED_BY_STATUS = {
  user: 'ratified',
  claude: 'agent-approved',
  rule: 'locked',
  discovery: 'inferito',
  inherited: 'ereditato-ignoto',
};

// Italian values of "Deciso da", for a vault written in Italian → the canonical English value.
// `claude` is the same word in both languages.
const DECIDED_BY_ALIASES = {
  utente: 'user',
  regola: 'rule',
  scoperta: 'discovery',
  ereditata: 'inherited',
};

// normalized key text → canonical field
const KEY_ALIASES = {
  choice: 'choice',
  scelta: 'choice',
  reversibility: 'reversibility',
  'reversibilità': 'reversibility',
  reversibilita: 'reversibility',
  'decided by': 'decided_by',
  'deciso da': 'decided_by',
  rejected: 'rejected',
  'alternative scartate': 'rejected',
  why: 'why',
  'perché': 'why',
  perche: 'why',
  'perchè': 'why',
  'depends on': 'depends_on',
  'dipende da': 'depends_on',
  'used by': 'used_by',
  'usata da': 'used_by',
  'usato da': 'used_by',
  facts: 'facts',
  fatti: 'facts',
};

const LIST_FIELDS = new Set(['rejected', 'depends_on', 'used_by']);
const REQUIRED = [
  ['choice', 'Choice'],
  ['reversibility', 'Reversibility'],
  ['decided_by', 'Decided by'],
  ['why', 'Why'],
];
const EMPTY_VALUES = new Set(['', '-', '—', '–', 'none', 'n/a', 'na', 'nessuna', 'nessuno']);
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------- line-level helpers

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;
const TITLE_RE = /^(\S+)\s+(?:—|–|-{1,2})\s+(.+)$/;
const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const KEY_VALUE_RE = /^\*{0,2}([^*:]+?)\*{0,2}\s*:\s*\*{0,2}\s*(.*?)\s*$/;

function normalizeKey(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanValue(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function splitList(field, value) {
  const separator = field === 'rejected' ? /;/ : /[,;]/;
  return value
    .split(separator)
    .map((v) => v.trim())
    .filter((v) => !EMPTY_VALUES.has(v.toLowerCase()));
}

/** Split text into sections that start at a level-3 heading, skipping fenced code. */
function headingSections(lines) {
  const sections = [];
  let current = null;
  let inFence = false;

  lines.forEach((line, index) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      if (current) current.body.push({ text: '', line: index + 1 }); // a fence ends nothing, but its content is ignored
      return;
    }
    if (inFence) return;

    const heading = line.match(HEADING_RE);
    if (heading) {
      if (current) sections.push(current);
      current = heading[1].length === 3 ? { title: heading[2], line: index + 1, body: [] } : null;
      return;
    }
    if (current) current.body.push({ text: line, line: index + 1 });
  });
  if (current) sections.push(current);
  return sections;
}

/** Read the bullet list under one heading into { field: rawValue | [items] }. */
function readFields(body) {
  const fields = {};
  let last = null;        // { field, indent }
  for (const { text } of body) {
    if (!text.trim()) continue;
    const bullet = text.match(BULLET_RE);
    if (bullet) {
      const indent = bullet[1].length;
      const kv = bullet[2].match(KEY_VALUE_RE);
      const field = kv ? KEY_ALIASES[normalizeKey(kv[1])] : undefined;
      if (field && (!last || indent <= last.indent)) {
        fields[field] = { value: kv[2], items: [] };
        last = { field, indent };
        continue;
      }
      if (last && indent > last.indent) {
        fields[last.field].items.push(cleanValue(bullet[2]));
        continue;
      }
      last = null;        // an unrelated bullet ends the current key
      continue;
    }
    if (last && /^\s{2,}\S/.test(text)) {
      fields[last.field].value += ' ' + text.trim();   // a wrapped continuation line
    }
  }
  return fields;
}

// ---------------------------------------------------------------- the parser

function problem(problems, source, line, id, message) {
  problems.push({ source: source || '', line, id, message });
}

/**
 * Parse every decision block in a Markdown text.
 * @returns {{ atoms: object[], problems: {source,line,id,message}[] }}
 */
function parseDecisionBlocks(markdown, { source = '' } = {}) {
  const text = String(markdown || '').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);
  const atoms = [];
  const problems = [];
  const seen = new Set();

  for (const section of headingSections(lines)) {
    const fields = readFields(section.body);
    if (!Object.keys(fields).length) continue;      // a heading with no decision keys is just prose

    const title = section.title.match(TITLE_RE);
    if (!title) {
      problem(problems, source, section.line, section.title,
        'has decision keys but the heading is not `### <id> — <question>`');
      continue;
    }
    const id = title[1];
    const question = title[2].trim();
    const where = section.line;

    if (!ID_RE.test(id)) problem(problems, source, where, id, 'the id must be lowercase kebab-case (e.g. `db-engine`)');
    if (seen.has(id)) problem(problems, source, where, id, 'this id appears more than once in the same place');
    seen.add(id);

    const value = (field) => {
      const f = fields[field];
      if (!f) return '';
      if (LIST_FIELDS.has(field)) return f;            // handled separately
      return cleanValue([f.value, ...f.items].filter(Boolean).join(' '));
    };
    const list = (field) => {
      const f = fields[field];
      if (!f) return [];
      return [...splitList(field, f.value), ...f.items.filter((v) => !EMPTY_VALUES.has(v.toLowerCase()))];
    };

    for (const [field, label] of REQUIRED) {
      if (!value(field)) problem(problems, source, where, id, `missing **${label}**`);
    }

    const choice = value('choice');
    const rawReversibility = value('reversibility');
    const reversibility = rawReversibility.toLowerCase().replace(/[\s_]+/g, '-');
    if (rawReversibility && reversibility !== 'one-way' && reversibility !== 'two-way') {
      problem(problems, source, where, id, `**Reversibility** must be \`one-way\` or \`two-way\` (found \`${rawReversibility}\`)`);
    }

    const rawDecidedBy = value('decided_by');
    const decidedMatch = rawDecidedBy.match(/^`?([A-Za-z-]+)`?\s*(?:\(([^)]*)\))?/);
    const decidedRaw = decidedMatch ? decidedMatch[1].toLowerCase() : '';
    const decidedBy = DECIDED_BY_ALIASES[decidedRaw] || decidedRaw;
    const status = DECIDED_BY_STATUS[decidedBy];
    if (rawDecidedBy && !status) {
      problem(problems, source, where, id,
        `**Decided by** must be one of ${Object.keys(DECIDED_BY_STATUS).map((k) => `\`${k}\``).join(', ')} (found \`${rawDecidedBy}\`)`);
    }

    const rejected = list('rejected');
    if (reversibility === 'one-way' && !rejected.length) {
      problem(problems, source, where, id, 'a one-way decision needs **Rejected** (the alternatives it beat)');
    }
    if (reversibility === 'one-way' && decidedBy === 'claude') {
      problem(problems, source, where, id,
        'a one-way decision cannot be decided by claude — ask the user, then write `Decided by: user` (`Deciso da: utente`)');
    }

    if (!choice) continue;                              // nothing to compare without a choice

    const atom = {
      id,
      axis: id,
      question,
      choice,
      rejected,
      rationale: value('why'),
      reversibility: reversibility || undefined,
      decided_by: decidedBy || undefined,
      status,
      depends_on: list('depends_on'),
      used_by: list('used_by'),
      source,
    };
    if (decidedMatch && decidedMatch[2]) atom.decided_on = decidedMatch[2].trim();
    const facts = value('facts');
    if (facts) atom.facts = facts;
    atoms.push(atom);
  }

  return { atoms, problems };
}

// ---------------------------------------------------------------- vault paths → units

/**
 * Map a vault-relative POSIX path (a .md or atoms.json) to the unit it belongs to.
 * Returns null for files that hold no decisions (index files, stray files).
 *   foundations/<AREA>/*.md          → unit foundations/<AREA>
 *   foundations/INTEGRATIONS/<S>.md  → unit foundations/INTEGRATIONS/<S> (one per system)
 *   contracts/<NAME>.md              → unit contracts/<NAME>, folder contracts
 *   contracts/<NAME>/*.md            → unit contracts/<NAME>
 *   sections/<SEC>/*.md              → unit sections/<SEC>
 *   features/<F>/*                   → legacy v1 unit <F>
 */
function unitOf(rel) {
  const parts = String(rel || '').split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const file = parts[parts.length - 1];
  const isMd = file.toLowerCase().endsWith('.md');
  if (!isMd && file !== 'atoms.json') return null;
  // A details file joins its main file's unit (ORDERS-API--details.md → ORDERS-API).
  const stem = file.replace(/\.md$/i, '').replace(/--details$/i, '');

  const [top] = parts;
  if (top === 'foundations' && parts.length === 3) {
    const folder = `foundations/${parts[1]}`;
    if (parts[1] === 'INTEGRATIONS' && isMd) return { scope: 'foundation', folder, unit: `${folder}/${stem}` };
    return { scope: 'foundation', folder, unit: folder };
  }
  if (top === 'contracts' && parts.length === 2) {
    return { scope: 'contract', folder: 'contracts', unit: isMd ? `contracts/${stem}` : 'contracts' };
  }
  if (top === 'contracts' && parts.length === 3) {
    const folder = `contracts/${parts[1]}`;
    return { scope: 'contract', folder, unit: folder };
  }
  if (top === 'sections' && parts.length === 3) {
    const folder = `sections/${parts[1]}`;
    return { scope: 'section', folder, unit: folder };
  }
  if (top === 'features' && parts.length === 3) {
    return { scope: 'feature', folder: `features/${parts[1]}`, unit: parts[1] };
  }
  return null;
}

/** H3: which atoms the Review checks look at. */
function isCheckable(atom) {
  if (!atom) return false;
  if (atom.scope === 'section') return atom.reversibility === 'one-way';
  return true;   // foundation, contract, legacy feature
}

module.exports = { parseDecisionBlocks, unitOf, isCheckable, DECIDED_BY_STATUS };
