/*
 * Integration tests for hooks/orientation.js (SessionStart, H10): a short orientation (≤ 1.5 KB)
 * with the current and next step of the path, the open discussion to resume, five essential
 * rules and a capped digest of confirmed one-way decisions. Never fails a session.
 *
 * Run: node --test hooks/tests/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { makeProject, write, runHook, contextOf, cleanup } = require('./helpers');

test.after(cleanup);

const start = (dir) => ({ session_id: 's', hook_event_name: 'SessionStart', source: 'startup', cwd: dir });

function bigIndex(n) {
  const atoms = Array.from({ length: n }, (_, i) => ({
    id: `decision-number-${i}`, axis: `decision-number-${i}`, choice: `a fairly long choice value ${i}`,
    reversibility: 'one-way', status: 'ratified', scope: 'foundation',
  }));
  return { features: { 'foundations/DB': { scope: 'foundation', atoms } } };
}

test('shows the current and next step, the discussion to resume and the rules, within 1.5 KB', () => {
  const { dir, vault } = makeProject();
  write(path.join(vault, '_queue.json'), JSON.stringify({
    mode: 'B',
    entries: [
      { id: 'db', kind: 'discuss', scope: 'foundation', target: 'DB', description: 'Database choices', status: 'done' },
      { id: 'cloud', kind: 'discuss', scope: 'foundation', target: 'CLOUD', description: 'Cloud and hosting', status: 'in-progress' },
      { id: 'be', kind: 'build', scope: 'section', target: 'SIGNUP', description: 'Build the signup flow', status: 'pending' },
    ],
  }));
  write(path.join(vault, '_current-task.md'), '---\ntags: [index]\n---\n# Now discussing — CLOUD\nhalf way\n');
  write(path.join(vault, '_index', 'decisions.json'), JSON.stringify(bigIndex(60)));

  const res = runHook('orientation.js', start(dir));
  assert.equal(res.status, 0);
  const ctx = contextOf(res);
  assert.equal(res.json.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.ok(ctx.length <= 1500, `length ${ctx.length}`);
  assert.match(ctx, /CLOUD/);
  assert.match(ctx, /SIGNUP/);
  assert.match(ctx, /_current-task\.md/);
  assert.match(ctx, /blueprint:using-blueprint/);
  assert.match(ctx, /decision-number-0/);
  assert.match(ctx, /more/);
});

test('without a vault it says one short line', () => {
  const { dir } = makeProject({ vault: null });
  const ctx = contextOf(runHook('orientation.js', start(dir)));
  assert.match(ctx, /\/blueprint/);
  assert.ok(ctx.length < 400, `length ${ctx.length}`);
});

test('reads a v1 queue and survives broken files', () => {
  const { dir, vault } = makeProject();
  write(path.join(vault, '_queue.json'), JSON.stringify({ entries: [{ id: 'app', description: 'The app', shape_hint: 'feature' }] }));
  write(path.join(vault, '_index', 'decisions.json'), '{ broken');
  const res = runHook('orientation.js', start(dir));
  assert.equal(res.status, 0);
  assert.match(contextOf(res), /The app/);

  write(path.join(vault, '_queue.json'), 'not json');
  const res2 = runHook('orientation.js', start(dir));
  assert.equal(res2.status, 0);
  assert.ok(contextOf(res2).startsWith('[Blueprint]'));
});
