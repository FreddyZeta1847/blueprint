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

// ---------------------------------------------------------------- child sessions (3.5.1)

const { makeWorktree } = require('./helpers');
const { worktreeOf } = require('../lib/common');

const BUILD = { id: 'raccolta-e-pannello', name: 'Costruzione', type: 'implementation', status: 'in_progress', phase: 'build',
  independent_parts: ['Raccolta', 'Pannello'], topics: [{ name: 'Raccolta', done: false }, { name: 'Pannello', done: false }] };

function child(stage = BUILD) {
  const { dir } = makeProject({ vault: null });
  if (stage) writePlan(dir, [stage]);
  return { main: dir, wt: makeWorktree(dir, 'raccolta') };
}

test('worktreeOf: a child folder points home; a normal checkout, no .git or a garbage .git is not a child', () => {
  const { main, wt } = child();
  assert.deepEqual(worktreeOf(wt), { main: path.resolve(main), name: 'raccolta', root: path.resolve(wt) });
  const { dir: repo } = makeProject({ vault: null, git: true });
  assert.equal(worktreeOf(repo), null);
  assert.equal(worktreeOf(main), null);
  write(path.join(wt, '.git'), 'nonsense');
  assert.equal(worktreeOf(wt), null);
});

test('a child with no plan of its own reads the main folder\'s plan, never «No plan here»', () => {
  const { wt } = child();
  const ctx = contextOf(runHook('orientation.js', start(wt)));
  assert.match(ctx, /«Costruzione»/);
  assert.match(ctx, /Child session «raccolta»/);
  assert.doesNotMatch(ctx, /No plan here/);
});

test('a child without the copy of the plain plan is told to warn the main session', () => {
  const { wt } = child();
  const ctx = contextOf(runHook('orientation.js', start(wt)));
  assert.match(ctx, /No copy of the plain plan in this folder \(blueprint\/plans\/raccolta-e-pannello\.md\)/);
  assert.match(ctx, /main session/);
  assert.ok(ctx.length <= 1500, `context is ${ctx.length} characters`);
});

test('with the copy, or outside the build phase, the warning is silent', () => {
  const { wt } = child();
  write(path.join(wt, 'blueprint', 'plans', 'raccolta-e-pannello.md'), '# Piano\n');
  assert.doesNotMatch(contextOf(runHook('orientation.js', start(wt))), /No copy/);
  const other = child({ ...BUILD, phase: 'plan' });
  assert.doesNotMatch(contextOf(runHook('orientation.js', start(other.wt))), /No copy/);
});

test('the main session sees no child line and no warning', () => {
  const { main } = child();
  const ctx = contextOf(runHook('orientation.js', start(main)));
  assert.match(ctx, /«Costruzione»/);
  assert.doesNotMatch(ctx, /Child session|No copy/);
});

test('a child of a project with no plan keeps the old line; a garbage .git never fails the session', () => {
  const { wt } = child(null);
  const res = runHook('orientation.js', start(wt));
  assert.equal(res.status, 0);
  assert.match(contextOf(res), /No plan here/);
  const broken = child();
  write(path.join(broken.wt, '.git'), 'nonsense');
  const again = runHook('orientation.js', start(broken.wt));
  assert.equal(again.status, 0);
  assert.doesNotMatch(contextOf(again), /No copy/);
});

// ---------------------------------------------------------------- review round 1 of 3.5.1

test('two stages in progress: the child of the parallel one is warned, not only of the first (review round 1)', () => {
  const { main, wt } = child();
  writePlan(main, [{ id: 'prima', name: 'Prima', type: 'implementation', status: 'in_progress', phase: 'integrate' }, BUILD]);
  const ctx = contextOf(runHook('orientation.js', start(wt)));
  assert.match(ctx, /No copy of the plain plan in this folder \(blueprint\/plans\/raccolta-e-pannello\.md\)/);
});

test('a worktree that is no part of the parallel stage (the main session in a worktree) is not told it is a child (review round 1)', () => {
  const { main } = child();
  const other = makeWorktree(main, 'altro');
  const ctx = contextOf(runHook('orientation.js', start(other)));
  assert.match(ctx, /«Costruzione»/);
  assert.match(ctx, /Worktree of /);
  assert.doesNotMatch(ctx, /Child session|No copy|write only inside/);
});

test('a relative gitdir is read from the worktree folder, not from where the hook runs (review round 1)', () => {
  const { main, wt } = child();
  write(path.join(wt, '.git'), 'gitdir: ../../../.git/worktrees/raccolta\n');
  assert.deepEqual(worktreeOf(wt), { main: path.resolve(main), name: 'raccolta', root: path.resolve(wt) });
});

test('in a folder without its own plan, the Plan line names the main folder\'s plan (first use)', () => {
  const { main, wt } = child();
  const ctx = contextOf(runHook('orientation.js', start(wt)));
  assert.ok(ctx.includes(`Plan: ${main.split(path.sep).join('/')}/blueprint/plan.json`), ctx);
});

// ---------------------------------------------------------------- review round 2 of 3.5.1

test('in a worktree with its own committed plan, the main folder\'s live plan wins (review round 2)', () => {
  const { wt } = child();
  write(path.join(wt, 'blueprint', 'plan.json'), JSON.stringify({ version: 3, project: 'Gym bookings', stages: [{ ...BUILD, phase: 'plan' }] }));
  const ctx = contextOf(runHook('orientation.js', start(wt)));
  assert.match(ctx, /phase build/);
  assert.match(ctx, /No copy of the plain plan/);
});

test('an unreadable main plan is named by its real path in a worktree (review round 2)', () => {
  const { main, wt } = child();
  write(path.join(main, 'blueprint', 'plan.json'), '{ not json');
  const ctx = contextOf(runHook('orientation.js', start(wt)));
  assert.ok(ctx.includes(`${main.split(path.sep).join('/')}/blueprint/plan.json is unreadable`), ctx);
});

test('a child is shown the stage built in parallel, not the first running one (review round 2)', () => {
  const { main, wt } = child();
  writePlan(main, [{ id: 'prima', name: 'Prima', type: 'implementation', status: 'in_progress', phase: 'integrate' }, BUILD]);
  const ctx = contextOf(runHook('orientation.js', start(wt)));
  assert.match(ctx, /stage 2\/2 «Costruzione»/);
  assert.doesNotMatch(ctx, /«Prima»/);
});

test('a child started in a subfolder of its worktree is still a child (review round 2)', () => {
  const { wt } = child();
  const sub = path.join(wt, 'app');
  write(path.join(sub, 'x.txt'), 'x');
  const ctx = contextOf(runHook('orientation.js', start(sub)));
  assert.match(ctx, /Child session «raccolta»/);
  assert.match(ctx, /No copy of the plain plan in this folder/);
});
