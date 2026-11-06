/*
 * Integration tests for hooks/orientation.js (SessionStart, v3): with blueprint/plan.json, a few
 * short lines (current stage i/n, type, phase and/or topics done — no counter without topics —,
 * deadline and "overdue", new notes, the "not opened yet" instruction for a todo stage); the context card (a draft → resume get-context; confirmed without a plan → create-plan; none and no plan → get-context); with a vault, the open discussion to resume
 * and a capped digest of confirmed one-way decisions (≤ 1.5 KB); with neither, silence.
 * Never fails a session.
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

function writePlan(dir, stages) {
  write(path.join(dir, 'blueprint', 'plan.json'), JSON.stringify({ version: 3, project: 'Gym bookings', stages }));
}

const FOUNDATIONS = { id: 'foundations', name: 'Foundations', type: 'discussion', status: 'done', topics: [{ name: 'Stack', done: true, phase: 'decision' }] };

test('an in_progress per_stage stage: position, phase, topics, overdue deadline, new notes', () => {
  const { dir } = makeProject({ vault: null });
  writePlan(dir, [
    FOUNDATIONS,
    { id: 'demo-frontend', name: 'Demo frontend', type: 'implementation', status: 'in_progress', phase: 'build', deadline: '2000-01-01',
      topics: [{ name: 'Calendar', done: true }, { name: 'Booking', done: false }] },
    { id: 'demo', name: 'Demo', type: 'delivery', status: 'todo' },
  ]);
  write(path.join(dir, 'blueprint', 'notes.json'), JSON.stringify({ notes: [
    { stage: 'demo', text: 'a', read: false }, { stage: 'demo', text: 'b', read: true }, { stage: 'demo', text: 'c', read: false },
  ] }));
  const res = runHook('orientation.js', start(dir));
  assert.equal(res.status, 0);
  assert.equal(res.json.hookSpecificOutput.hookEventName, 'SessionStart');
  const ctx = contextOf(res);
  const first = ctx.split('\n')[0];
  assert.match(first, /^\[Blueprint\] Gym bookings · stage 2\/3 «Demo frontend» \(implementation\) · phase build · topics 1\/2/);
  assert.match(first, /deadline 2000-01-01 \(overdue\)/);
  assert.match(first, /2 new notes/);
  assert.doesNotMatch(ctx, /Not opened yet/);
  assert.ok(ctx.split('\n').length <= 3, ctx);
});

test('a todo current stage gets the "not opened yet" line; per_step shows topics, a future deadline is not overdue', () => {
  const { dir } = makeProject({ vault: null });
  writePlan(dir, [
    FOUNDATIONS,
    { id: 'admin-design', name: 'Admin design', type: 'discussion', status: 'todo', deadline: '2999-12-31',
      topics: [{ name: 'Look of the admin area', done: false }] },
  ]);
  const ctx = contextOf(runHook('orientation.js', start(dir)));
  assert.match(ctx, /stage 2\/2 «Admin design» \(discussion\) · topics 0\/1 · deadline 2999-12-31/);
  assert.doesNotMatch(ctx, /overdue/);
  assert.doesNotMatch(ctx.split('\n')[0], /phase/);
  assert.match(ctx, /Not opened yet: before starting, tell the user its topics \(if any\), phases and how you would do it, and wait for the OK\./);
});

test('a per_stage stage without topics shows its phase and no topic counter', () => {
  const { dir } = makeProject({ vault: null });
  writePlan(dir, [
    FOUNDATIONS,
    { id: 'publish', name: 'Publish', type: 'implementation', status: 'in_progress', phase: 'build' },
  ]);
  const first = contextOf(runHook('orientation.js', start(dir))).split('\n')[0];
  assert.match(first, /stage 2\/2 «Publish» \(implementation\) · phase build$/);
  assert.doesNotMatch(first, /topics/);
});

test('every stage done: says so; an unreadable plan is reported', () => {
  const { dir } = makeProject({ vault: null });
  writePlan(dir, [FOUNDATIONS]);
  assert.match(contextOf(runHook('orientation.js', start(dir))), /every stage is done or postponed/);
  write(path.join(dir, 'blueprint', 'plan.json'), '{ broken');
  const res = runHook('orientation.js', start(dir));
  assert.equal(res.status, 0);
  assert.match(contextOf(res), /plan\.json is unreadable/);
});

test('a decisions folder (blueprint/decisions/) adds the discussion to resume and the one-way digest, within 1.5 KB', () => {
  const { dir } = makeProject({ vault: null });
  const vault = path.join(dir, 'blueprint', 'decisions');
  writePlan(dir, [{ id: 'foundations', name: 'Foundations', type: 'discussion', status: 'in_progress', topics: [{ name: 'Stack', done: false }] }]);
  write(path.join(vault, '_current-task.md'), '---\ntags: [index]\n---\n# Now discussing — CLOUD\nhalf way\n');
  write(path.join(vault, '_index', 'decisions.json'), JSON.stringify(bigIndex(60)));
  write(path.join(vault, '_queue.json'), JSON.stringify({ entries: [{ id: 'old', description: 'OLD QUEUE ENTRY' }] }));

  const ctx = contextOf(runHook('orientation.js', start(dir)));
  assert.ok(ctx.length <= 1500, `length ${ctx.length}`);
  assert.match(ctx, /stage 1\/1 «Foundations»/);
  assert.match(ctx, /blueprint\/decisions\/_current-task\.md \(Now discussing — CLOUD\)/);
  assert.match(ctx, /decision-number-0/);
  assert.match(ctx, /more/);
  assert.doesNotMatch(ctx, /OLD QUEUE ENTRY/);
});

test('a legacy vault-*/ folder without a plan still orients', () => {
  const { dir, vault } = makeProject();
  write(path.join(vault, '_current-task.md'), '# Now discussing — DB\n');
  write(path.join(vault, '_index', 'decisions.json'), '{ broken');
  const res = runHook('orientation.js', start(dir));
  assert.equal(res.status, 0);
  const ctx = contextOf(res);
  assert.ok(ctx.startsWith('[Blueprint] This project keeps its decisions in vault-demo/'), ctx);
  assert.match(ctx, /blueprint:using-blueprint/);
  assert.match(ctx, /vault-demo\/_current-task\.md/);
});

test('no plan, no card, no decisions: one line — every new request starts with get-context', () => {
  const { dir } = makeProject({ vault: null });
  const res = runHook('orientation.js', start(dir));
  assert.equal(res.status, 0);
  const ctx = contextOf(res);
  assert.match(ctx, /^\[Blueprint\] No plan here: every new request starts with `blueprint:get-context` \(a tiny one: one line of confirmation, no files\)\./);
  assert.match(ctx, /blueprint:using-blueprint/);
  assert.equal(ctx.split('\n').length, 1);
});

const CARD = (confirmed, points) =>
  ['# Context — Gym bookings', ...(confirmed ? ['Confirmed: 2026-11-06'] : []), 'Pace: calm', '', '## Answers', ...points, ''].join('\n');

test('a draft context card: resume get-context, with the open points (also with a plan)', () => {
  const { dir } = makeProject({ vault: null });
  write(path.join(dir, 'blueprint', 'context.md'), CARD(false, [
    '- **goal** · user — booking site',
    '- **timing** · open — no deadline yet',
    '- **roles** · aperto — who decides hosting',
  ]));
  let ctx = contextOf(runHook('orientation.js', start(dir)));
  assert.match(ctx, /Context in progress: blueprint\/context\.md is a draft\. Resume `blueprint:get-context` \(open points: timing, roles\)\./);
  assert.doesNotMatch(ctx, /No plan here/);
  writePlan(dir, [FOUNDATIONS, { id: 'demo', name: 'Demo', type: 'delivery', status: 'todo' }]);
  ctx = contextOf(runHook('orientation.js', start(dir)));
  assert.match(ctx, /stage 2\/2 «Demo»/);
  assert.match(ctx, /Context in progress/);
  assert.equal((ctx.match(/using-blueprint/g) || []).length, 1);
});

test('a confirmed card without a plan: go on with create-plan; with a plan: nothing about the card', () => {
  const { dir } = makeProject({ vault: null });
  write(path.join(dir, 'blueprint', 'context.md'), CARD(true, ['- **goal** · user — booking site']));
  let ctx = contextOf(runHook('orientation.js', start(dir)));
  assert.match(ctx, /Context confirmed, no plan yet: go on with `blueprint:create-plan`\./);
  writePlan(dir, [FOUNDATIONS, { id: 'demo', name: 'Demo', type: 'delivery', status: 'todo' }]);
  ctx = contextOf(runHook('orientation.js', start(dir)));
  assert.doesNotMatch(ctx, /Context (confirmed|in progress)|No plan here/);
});
