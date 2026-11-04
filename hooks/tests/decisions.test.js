/*
 * Unit tests for hooks/lib/decisions.js — the Markdown decision-block parser (spec A2) and the
 * vault-path → unit mapping (spec A1).
 *
 * Covers: the canonical block, the ` - ` separator, Italian key aliases, CRLF + BOM input,
 * nested list values, non-decision headings, fenced code, every validation problem, and the
 * Decided-by → status mapping.
 *
 * Run: node --test hooks/tests/
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDecisionBlocks, unitOf, isCheckable } = require('../lib/decisions');

const CANONICAL = [
  '---',
  'tags: [foundation]',
  '---',
  '',
  '# DB',
  '',
  'Some prose about the database.',
  '',
  '### db-engine — Which database engine does the system use?',
  '- **Choice:** PostgreSQL (Azure Flexible Server)',
  '- **Reversibility:** one-way',
  '- **Decided by:** user (2026-11-04)',
  '- **Rejected:** Cosmos DB — cost and relational queries; SQLite — no concurrent access',
  '- **Why:** the data is relational (orders, users) and queries are standard SQL',
  '- **Depends on:** cloud-provider',
  '- **Used by:** SIGNUP, ORDER-HISTORY',
  '',
  '### backup-window — When do backups run?',
  '- **Choice:** nightly at 02:00 UTC',
  '- **Reversibility:** two-way',
  '- **Decided by:** claude',
  '- **Why:** lowest traffic',
].join('\n');

test('parses the canonical block into an atom', () => {
  const { atoms, problems } = parseDecisionBlocks(CANONICAL, { source: 'foundations/DB/DB.md' });
  assert.deepEqual(problems, []);
  assert.equal(atoms.length, 2);
  const db = atoms[0];
  assert.equal(db.id, 'db-engine');
  assert.equal(db.axis, 'db-engine');
  assert.equal(db.question, 'Which database engine does the system use?');
  assert.equal(db.choice, 'PostgreSQL (Azure Flexible Server)');
  assert.equal(db.reversibility, 'one-way');
  assert.equal(db.decided_by, 'user');
  assert.equal(db.decided_on, '2026-11-04');
  assert.equal(db.status, 'ratified');
  assert.deepEqual(db.rejected, ['Cosmos DB — cost and relational queries', 'SQLite — no concurrent access']);
  assert.equal(db.rationale, 'the data is relational (orders, users) and queries are standard SQL');
  assert.deepEqual(db.depends_on, ['cloud-provider']);
  assert.deepEqual(db.used_by, ['SIGNUP', 'ORDER-HISTORY']);
  assert.equal(db.source, 'foundations/DB/DB.md');
  assert.equal(atoms[1].status, 'agent-approved');
  assert.deepEqual(atoms[1].rejected, []);
});

test('maps every Decided-by value to its status', () => {
  const block = (who) => `### x — q?\n- **Choice:** a\n- **Reversibility:** two-way\n- **Decided by:** ${who}\n- **Why:** w\n`;
  const expect = { user: 'ratified', claude: 'agent-approved', rule: 'locked', discovery: 'inferito', inherited: 'ereditato-ignoto' };
  for (const [who, status] of Object.entries(expect)) {
    const { atoms, problems } = parseDecisionBlocks(block(who));
    assert.deepEqual(problems, [], who);
    assert.equal(atoms[0].status, status, who);
  }
  // case-insensitive, with a date
  assert.equal(parseDecisionBlocks(block('User (2026-01-02)')).atoms[0].status, 'ratified');
});

test('maps the Italian Decided-by values (vault written in Italian) to the same statuses', () => {
  const block = (who) => `### x — q?\n- **Scelta:** a\n- **Reversibilità:** two-way\n- **Deciso da:** ${who}\n- **Perché:** w\n`;
  const expect = {
    utente: ['user', 'ratified'],
    regola: ['rule', 'locked'],
    scoperta: ['discovery', 'inferito'],
    ereditata: ['inherited', 'ereditato-ignoto'],
  };
  for (const [who, [canonical, status]] of Object.entries(expect)) {
    const { atoms, problems } = parseDecisionBlocks(block(who));
    assert.deepEqual(problems, [], who);
    assert.equal(atoms[0].status, status, who);
    assert.equal(atoms[0].decided_by, canonical, who);
  }
  assert.equal(parseDecisionBlocks(block('Utente (2026-11-05)')).atoms[0].status, 'ratified');
});

test('a contract or integration details file belongs to the same unit as its main file', () => {
  assert.deepEqual(unitOf('contracts/ORDERS-API--details.md'), { scope: 'contract', folder: 'contracts', unit: 'contracts/ORDERS-API' });
  assert.deepEqual(unitOf('foundations/INTEGRATIONS/STRIPE--details.md'), { scope: 'foundation', folder: 'foundations/INTEGRATIONS', unit: 'foundations/INTEGRATIONS/STRIPE' });
});

test('accepts the " - " separator, Italian aliases, CRLF and a BOM', () => {
  const text = '﻿### api-style - Quale stile per le API?\r\n' +
    '- **Scelta:** REST\r\n' +
    '- **Reversibilità:** two-way\r\n' +
    '- **Deciso da:** user\r\n' +
    '- **Perché:** semplice\r\n' +
    '- **Dipende da:** db-engine, auth-model\r\n' +
    '- **Usata da:** SIGNUP\r\n';
  const { atoms, problems } = parseDecisionBlocks(text);
  assert.deepEqual(problems, []);
  assert.equal(atoms[0].id, 'api-style');
  assert.equal(atoms[0].question, 'Quale stile per le API?');
  assert.equal(atoms[0].choice, 'REST');
  assert.deepEqual(atoms[0].depends_on, ['db-engine', 'auth-model']);
});

test('accepts "**Key**:" and plain "Key:" bullets and nested list values', () => {
  const text = [
    '### cache — Which cache?',
    '- **Choice**: Redis',
    '- Reversibility: one-way',
    '- **Decided by:** user',
    '- **Rejected:**',
    '  - Memcached — no persistence',
    '  - none at all — too slow',
    '- **Why:** sessions',
    '  and rate limiting',
  ].join('\n');
  const { atoms, problems } = parseDecisionBlocks(text);
  assert.deepEqual(problems, []);
  assert.equal(atoms[0].choice, 'Redis');
  assert.deepEqual(atoms[0].rejected, ['Memcached — no persistence', 'none at all — too slow']);
  assert.equal(atoms[0].rationale, 'sessions and rate limiting');
});

test('ignores headings that are not decisions and anything inside fenced code', () => {
  const text = [
    '### Overview',
    'Just prose.',
    '### Notes - misc',
    '- a plain bullet',
    '```markdown',
    '### example-id — An example inside a code fence',
    '- **Choice:** nope',
    '- **Reversibility:** one-way',
    '- **Decided by:** claude',
    '- **Why:** example',
    '```',
  ].join('\n');
  const { atoms, problems } = parseDecisionBlocks(text);
  assert.deepEqual(atoms, []);
  assert.deepEqual(problems, []);
});

test('reports, never drops, a block with missing or invalid fields', () => {
  const text = [
    '### auth-model — How do users log in?',
    '- **Choice:** OAuth with Entra ID',
    '- **Reversibility:** maybe',
    '- **Decided by:** someone',
    '',
    '### region — Which cloud region?',
    '- **Choice:** westeurope',
    '- **Reversibility:** one-way',
    '- **Decided by:** user',
    '- **Why:** latency',
    '',
    '### Bad_ID — Wrong id format?',
    '- **Choice:** x',
    '- **Reversibility:** two-way',
    '- **Decided by:** user',
    '- **Why:** y',
    '',
    '### no-choice — Missing choice?',
    '- **Reversibility:** two-way',
    '- **Decided by:** user',
    '- **Why:** y',
  ].join('\n');
  const { atoms, problems } = parseDecisionBlocks(text, { source: 'foundations/AUTH/AUTH.md' });
  const msgs = problems.map((p) => `${p.id}: ${p.message}`);
  assert.ok(msgs.some((m) => m.startsWith('auth-model:') && /Why/.test(m)), msgs.join('\n'));
  assert.ok(msgs.some((m) => m.startsWith('auth-model:') && /Reversibility/.test(m)), msgs.join('\n'));
  assert.ok(msgs.some((m) => m.startsWith('auth-model:') && /Decided by/.test(m)), msgs.join('\n'));
  assert.ok(msgs.some((m) => m.startsWith('region:') && /Rejected/.test(m)), msgs.join('\n'));
  assert.ok(msgs.some((m) => m.startsWith('Bad_ID:') && /id/.test(m)), msgs.join('\n'));
  assert.ok(msgs.some((m) => m.startsWith('no-choice:') && /Choice/.test(m)), msgs.join('\n'));
  // every problem carries its source and a 1-based line number
  assert.ok(problems.every((p) => p.source === 'foundations/AUTH/AUTH.md' && p.line >= 1));
  // a block with a choice still becomes an atom; one without a choice does not
  assert.deepEqual(atoms.map((a) => a.id).sort(), ['Bad_ID', 'auth-model', 'region'].sort());
});

test('flags a one-way decision decided by claude (the one-way floor)', () => {
  const text = [
    '### db-engine — Which DB?',
    '- **Choice:** Postgres',
    '- **Reversibility:** one-way',
    '- **Decided by:** claude',
    '- **Rejected:** MySQL — less familiar',
    '- **Why:** x',
  ].join('\n');
  const { problems } = parseDecisionBlocks(text);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /one-way/);
  assert.match(problems[0].message, /user/);
});

test('flags a duplicate id inside the same text', () => {
  const block = '### dup — Q?\n- **Choice:** a\n- **Reversibility:** two-way\n- **Decided by:** user\n- **Why:** w\n\n';
  const { problems } = parseDecisionBlocks(block + block);
  assert.ok(problems.some((p) => /more than once/.test(p.message)));
});

test('a heading without the separator but with decision keys is a problem', () => {
  const text = '### db-engine\n- **Choice:** Postgres\n- **Reversibility:** two-way\n- **Decided by:** user\n- **Why:** x\n';
  const { atoms, problems } = parseDecisionBlocks(text);
  assert.equal(atoms.length, 0);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /### <id> — <question>/);
});

test('unitOf maps vault-relative paths to scope, folder and unit', () => {
  assert.deepEqual(unitOf('foundations/DB/DB.md'), { scope: 'foundation', folder: 'foundations/DB', unit: 'foundations/DB' });
  assert.deepEqual(unitOf('foundations/DB/DB--details.md'), { scope: 'foundation', folder: 'foundations/DB', unit: 'foundations/DB' });
  assert.deepEqual(unitOf('foundations/INTEGRATIONS/STRIPE.md'), { scope: 'foundation', folder: 'foundations/INTEGRATIONS', unit: 'foundations/INTEGRATIONS/STRIPE' });
  assert.deepEqual(unitOf('contracts/ORDERS-API.md'), { scope: 'contract', folder: 'contracts', unit: 'contracts/ORDERS-API' });
  assert.deepEqual(unitOf('contracts/ORDERS-API/ORDERS-API.md'), { scope: 'contract', folder: 'contracts/ORDERS-API', unit: 'contracts/ORDERS-API' });
  assert.deepEqual(unitOf('sections/SIGNUP/SIGNUP--details.md'), { scope: 'section', folder: 'sections/SIGNUP', unit: 'sections/SIGNUP' });
  assert.deepEqual(unitOf('features/APP/APP.md'), { scope: 'feature', folder: 'features/APP', unit: 'APP' });
  assert.equal(unitOf('_architecture.md'), null);
  assert.equal(unitOf('foundations/README.md'), null);
  assert.equal(unitOf('sections/SIGNUP/notes.txt'), null);
});

test('isCheckable keeps foundations, contracts, legacy features and one-way section decisions', () => {
  assert.equal(isCheckable({ scope: 'foundation', reversibility: 'two-way' }), true);
  assert.equal(isCheckable({ scope: 'contract', reversibility: 'two-way' }), true);
  assert.equal(isCheckable({ scope: 'feature', reversibility: 'two-way' }), true);
  assert.equal(isCheckable({ scope: 'section', reversibility: 'one-way' }), true);
  assert.equal(isCheckable({ scope: 'section', reversibility: 'two-way' }), false);
});
