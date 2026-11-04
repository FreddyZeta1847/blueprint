/*
 * Integration tests for hooks/one-way-guard.js (PreToolUse, H9): the one-way floor on Markdown
 * decision blocks — Write, Edit (reconstructing the file after the replacement), MultiEdit —
 * plus the legacy v1 atoms.json check, the audit entry of a block, and fail-open on bad input.
 *
 * Run: node --test hooks/tests/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { makeProject, write, read, runHook, cleanup } = require('./helpers');

test.after(cleanup);

const ONE_WAY = (by) => [
  '### db-engine — Which database engine?',
  '- **Choice:** PostgreSQL',
  '- **Reversibility:** one-way',
  `- **Decided by:** ${by}`,
  '- **Rejected:** MySQL — less familiar',
  '- **Why:** relational data',
  '',
].join('\n');

const payload = (dir, file, tool, toolInput) => ({
  session_id: 's1', hook_event_name: 'PreToolUse', tool_name: tool, cwd: dir, tool_input: { file_path: file, ...toolInput },
});

function denied(res) {
  const out = res.json && res.json.hookSpecificOutput;
  return out && out.permissionDecision === 'deny' ? out.permissionDecisionReason : null;
}

test('blocks a Write that saves a one-way decision decided by claude', () => {
  const { dir, vault } = makeProject();
  const file = path.join(vault, 'foundations', 'DB', 'DB.md');
  const res = runHook('one-way-guard.js', payload(dir, file, 'Write', { content: ONE_WAY('claude') }));
  const reason = denied(res);
  assert.ok(reason, res.stdout);
  assert.ok(reason.startsWith('[Blueprint]'), reason);
  assert.match(reason, /db-engine/);
  assert.match(reason, /Decided by: user/);
  assert.match(read(path.join(vault, '_audit.md')), /BLOCKED/);
});

test('blocks the same one-way decision written with Italian keys (vault in Italian)', () => {
  const { dir, vault } = makeProject();
  const file = path.join(vault, 'foundations', 'DB', 'DB.md');
  const italian = (by) => [
    '### db-engine — Quale database usiamo?',
    '- **Scelta:** PostgreSQL',
    '- **Reversibilità:** one-way',
    `- **Deciso da:** ${by}`,
    '- **Alternative scartate:** MySQL — meno conosciuto',
    '- **Perché:** dati relazionali',
    '',
  ].join('\n');
  assert.ok(denied(runHook('one-way-guard.js', payload(dir, file, 'Write', { content: italian('claude') }))));
  assert.equal(runHook('one-way-guard.js', payload(dir, file, 'Write', { content: italian('utente') })).stdout, '');
});

test('lets the same decision through when the user decided it', () => {
  const { dir, vault } = makeProject();
  const file = path.join(vault, 'foundations', 'DB', 'DB.md');
  const res = runHook('one-way-guard.js', payload(dir, file, 'Write', { content: ONE_WAY('user') }));
  assert.equal(res.stdout, '');
});

test('reconstructs the file for an Edit: flipping user → claude on a one-way block is blocked', () => {
  const { dir, vault } = makeProject();
  const file = write(path.join(vault, 'sections', 'SIGNUP', 'SIGNUP.md'), '# SIGNUP\n\n' + ONE_WAY('user'));
  const res = runHook('one-way-guard.js', payload(dir, file, 'Edit', {
    old_string: '- **Decided by:** user', new_string: '- **Decided by:** claude',
  }));
  assert.ok(denied(res));
});

test('an Edit that only touches the claude line of a block whose one-way is stored elsewhere in the block is still blocked', () => {
  const { dir, vault } = makeProject();
  const file = write(path.join(vault, 'foundations', 'DB', 'DB--details.md'), ONE_WAY('user'));
  const res = runHook('one-way-guard.js', payload(dir, file, 'Edit', { old_string: 'user', new_string: 'claude', replace_all: true }));
  assert.ok(denied(res));
});

test('MultiEdit is applied in order before checking', () => {
  const { dir, vault } = makeProject();
  const file = write(path.join(vault, 'contracts', 'ORDERS-API.md'), ONE_WAY('user').replace('one-way', 'two-way'));
  const res = runHook('one-way-guard.js', payload(dir, file, 'MultiEdit', {
    edits: [
      { old_string: 'two-way', new_string: 'one-way' },
      { old_string: 'Decided by:** user', new_string: 'Decided by:** claude' },
    ],
  }));
  assert.ok(denied(res));
});

test('two-way decisions by claude and files outside the decision folders pass', () => {
  const { dir, vault } = makeProject();
  const twoWay = ONE_WAY('claude').replace('one-way', 'two-way');
  assert.equal(runHook('one-way-guard.js', payload(dir, path.join(vault, 'foundations', 'DB', 'DB.md'), 'Write', { content: twoWay })).stdout, '');
  assert.equal(runHook('one-way-guard.js', payload(dir, path.join(vault, '_current-task.md'), 'Write', { content: ONE_WAY('claude') })).stdout, '');
  assert.equal(runHook('one-way-guard.js', payload(dir, path.join(dir, 'docs', 'x.md'), 'Write', { content: ONE_WAY('claude') })).stdout, '');
});

test('legacy v1: an atoms.json with one-way + agent-approved is still blocked', () => {
  const { dir, vault } = makeProject();
  const file = path.join(vault, 'features', 'APP', 'atoms.json');
  const content = JSON.stringify({ atoms: [{ id: 'a1', axis: 'page-structure', choice: 'x', reversibility: 'one-way', status: 'agent-approved' }] });
  assert.ok(denied(runHook('one-way-guard.js', payload(dir, file, 'Write', { content }))));
});

test('fails open on malformed input', () => {
  for (const raw of ['', 'nope', '﻿{']) {
    const res = runHook('one-way-guard.js', null, { raw });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, '');
  }
});
