/*
 * Integration tests for hooks/plan-guard.js (PreToolUse on blueprint/plan.json, v3): the plan's
 * shape, known types and phases, topics (required in per_step types, optional in per_stage ones,
 * never a phase name, independent parts among them), phases moving in order (optional ones
 * skipped only with a reason, back only to `back_to`), `done` only after the last mandatory phase, done stages
 * asked about, no stage born done, the Edit/MultiEdit result computed from the file on disk,
 * other files ignored and bad input failing open. Each test runs the real hook script.
 *
 * Run: node --test hooks/tests/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { makeProject, write, runHook, cleanup } = require('./helpers');

test.after(cleanup);

const planOf = (stages) => ({ version: 3, project: 'Gym bookings', context: 'blueprint/context.md', stages });

const impl = (extra = {}) => ({
  id: 'demo-frontend', name: 'Demo frontend', type: 'implementation', status: 'todo',
  topics: [{ name: 'Calendar', done: false }, { name: 'Booking', done: false }], ...extra,
});
const disc = (topics, extra = {}) => ({ id: 'foundations', name: 'Foundations', type: 'discussion', status: 'in_progress', topics, ...extra });

function setup(onDisk) {
  const { dir } = makeProject({ vault: null });
  const file = path.join(dir, 'blueprint', 'plan.json');
  if (onDisk) write(file, JSON.stringify(onDisk, null, 2));
  return { dir, file };
}

function writePlan({ dir, file }, plan) {
  return runHook('plan-guard.js', { tool_name: 'Write', tool_input: { file_path: file, content: JSON.stringify(plan, null, 2) }, cwd: dir });
}

function decision(res) {
  const out = res.json && res.json.hookSpecificOutput;
  return out ? { kind: out.permissionDecision, reason: out.permissionDecisionReason } : { kind: 'allow', reason: '' };
}

function expectDecision(res, kind, pattern) {
  assert.equal(res.status, 0);
  const d = decision(res);
  assert.equal(d.kind, kind, d.reason);
  if (pattern) assert.match(d.reason, pattern);
  if (kind !== 'allow') assert.equal(res.json.hookSpecificOutput.hookEventName, 'PreToolUse');
}

test('a valid new plan is allowed', () => {
  const p = setup();
  expectDecision(writePlan(p, planOf([disc([{ name: 'Stack', done: false }], { status: 'todo' }), impl({ deadline: '2026-11-13', independent_parts: ['Calendar', 'Booking'] })])), 'allow');
});

test('shape errors are denied: unknown type, bad status, bad topic, duplicate id, invalid JSON', () => {
  const p = setup();
  expectDecision(writePlan(p, planOf([impl({ type: 'research' })])), 'deny', /type "research" does not exist/);
  expectDecision(writePlan(p, planOf([impl({ status: 'started' })])), 'deny', /status/);
  expectDecision(writePlan(p, planOf([impl({ topics: [{ name: 'x' }] })])), 'deny', /boolean "done"/);
  expectDecision(writePlan(p, planOf([impl(), impl()])), 'deny', /used twice/);
  expectDecision(writePlan(p, planOf([impl({ phase: 'deploy', status: 'in_progress' })])), 'deny', /not a implementation phase/);
  const res = runHook('plan-guard.js', { tool_name: 'Write', tool_input: { file_path: p.file, content: '{ nope' }, cwd: p.dir });
  expectDecision(res, 'deny', /not valid JSON/);
});

test('topics: optional in per_stage types, required in per_step types', () => {
  const p = setup();
  const single = { id: 'publish', name: 'Publish', type: 'implementation', status: 'todo' };
  expectDecision(writePlan(p, planOf([single])), 'allow');
  expectDecision(writePlan(p, planOf([{ id: 'demo', name: 'Demo', type: 'delivery', status: 'todo', topics: [] }])), 'allow');
  expectDecision(writePlan(p, planOf([disc(undefined, { status: 'todo' })])), 'deny', /list at least one topic/);
  expectDecision(writePlan(p, planOf([disc([], { status: 'todo' })])), 'deny', /list at least one topic/);
});

test('v3 types: verification is gone (the end of implementation covers it); delivery may skip its rehearsal', () => {
  const p = setup();
  expectDecision(writePlan(p, planOf([{ id: 'ux', name: 'UX check', type: 'verification', status: 'todo', topics: [{ name: 'Test', done: false }] }])), 'deny', /verification/);
  const mockup = (extra) => ({ id: 'mockup', name: 'Admin mockup', type: 'delivery', status: 'in_progress', ...extra });
  const q = setup(planOf([mockup({ phase: 'prepare' })]));
  expectDecision(writePlan(q, planOf([mockup({ phase: 'deliver' })])), 'deny', /optional phase "rehearse"/);
  expectDecision(writePlan(q, planOf([mockup({ phase: 'deliver', skipped: [{ id: 'rehearse', reason: 'only the user looks at it' }] })])), 'allow');
});

test('discussion: a proposal can go back to clarify (the context was misunderstood), convergence cannot', () => {
  const p = setup(planOf([disc([{ name: 'Stack', done: false, phase: 'proposal' }])]));
  expectDecision(writePlan(p, planOf([disc([{ name: 'Stack', done: false, phase: 'clarify' }])])), 'allow');
  const q = setup(planOf([disc([{ name: 'Stack', done: false, phase: 'convergence' }])]));
  expectDecision(writePlan(q, planOf([disc([{ name: 'Stack', done: false, phase: 'clarify' }])])), 'deny', /can go back to no phase/);
});

test('clarify (the context check) is mandatory in every type: it can never be skipped', () => {
  const firstAfter = { implementation: 'plan', delivery: 'prepare', quick_task: 'do' };
  for (const type of ['discussion', 'implementation', 'delivery', 'quick_task']) {
    const skipped = [{ id: 'clarify', reason: 'clear enough' }];
    const stage = type === 'discussion'
      ? disc([{ name: 'Stack', done: false, phase: 'proposal' }], { skipped })
      : { id: 'x', name: 'X', type, status: 'in_progress', phase: firstAfter[type], skipped };
    expectDecision(writePlan(setup(), planOf([stage])), 'deny', /"clarify" is mandatory and cannot be skipped/);
  }
});

test('topics: the old "steps" field, phase names as topics, empty postponed, independent parts not among topics', () => {
  const p = setup();
  expectDecision(writePlan(p, planOf([{ ...impl(), topics: undefined, steps: [{ name: 'Calendar', done: false }] }])), 'deny', /"steps" is now called "topics"/);
  const demo = (topics) => ({ id: 'demo', name: 'Demo', type: 'delivery', status: 'todo', topics });
  expectDecision(writePlan(p, planOf([demo([{ name: 'Rehearse', done: false }, { name: 'Show the calendar', done: false }])])), 'deny', /"Rehearse" is a delivery phase, not a topic/);
  expectDecision(writePlan(p, planOf([disc([{ name: 'Stack', done: false, postponed: ' ' }], { status: 'todo' })])), 'deny', /"postponed" must be the reason/);
  expectDecision(writePlan(p, planOf([impl({ independent_parts: ['Calendar', 'Admin area'] })])), 'deny', /"Admin area" are not topics/);
  expectDecision(writePlan(p, planOf([{ id: 'publish', name: 'Publish', type: 'implementation', status: 'todo', independent_parts: ['A', 'B'] }])), 'deny', /not topics of the stage/);
});

test('a per_step stage is done only when every topic is done or postponed with a reason', () => {
  const p = setup(planOf([disc([{ name: 'Stack', done: false }, { name: 'Hosting', done: false }], { status: 'todo' })]));
  expectDecision(writePlan(p, planOf([disc([{ name: 'Stack', done: false }, { name: 'Hosting', done: false }], { status: 'done' })])), 'deny', /neither done nor postponed/);
  const onDisk = planOf([disc([{ name: 'Stack', done: false, phase: 'convergence' }, { name: 'Hosting', done: false, phase: 'proposal' }])]);
  const q = setup(onDisk);
  expectDecision(writePlan(q, planOf([disc([{ name: 'Stack', done: true, phase: 'decision' }, { name: 'Hosting', done: false, phase: 'proposal', postponed: 'needs the price list' }], { status: 'done' })])), 'allow');
});

test('opening a stage: it starts at clarify; jumping a mandatory phase is denied', () => {
  const p = setup(planOf([impl()]));
  expectDecision(writePlan(p, planOf([impl({ status: 'in_progress', phase: 'clarify' })])), 'allow');
  expectDecision(writePlan(p, planOf([impl({ status: 'in_progress', phase: 'plan' })])), 'deny', /mandatory phase "clarify"/);
});

test('an optional phase skipped without a reason is denied, with a reason it is allowed', () => {
  const demo = (extra) => ({ id: 'demo', name: 'Demo', type: 'delivery', status: 'in_progress', ...extra });
  const p = setup(planOf([demo({ phase: 'prepare' })]));
  expectDecision(writePlan(p, planOf([demo({ phase: 'deliver' })])), 'deny', /optional phase "rehearse".*without a reason/);
  expectDecision(writePlan(p, planOf([demo({ phase: 'deliver', skipped: [{ id: 'rehearse', reason: '' }] })])), 'deny', /reason/);
  expectDecision(writePlan(p, planOf([demo({ phase: 'deliver', skipped: [{ id: 'rehearse', reason: 'only the user looks at it' }] })])), 'allow');
  expectDecision(writePlan(p, planOf([demo({ phase: 'prepare', skipped: [{ id: 'feedback', reason: 'x' }] })])), 'deny', /mandatory and cannot be skipped/);
});

test('an in_progress per_stage stage needs a phase; phases move one at a time', () => {
  const p = setup(planOf([impl({ status: 'in_progress', phase: 'plan' })]));
  const at = (phase) => planOf([impl({ status: 'in_progress', phase })]);
  expectDecision(writePlan(p, planOf([impl({ status: 'in_progress' })])), 'deny', /phase/);
  expectDecision(writePlan(p, at('build')), 'allow');
  expectDecision(writePlan(p, at('test')), 'deny', /mandatory phase "build"/);
});

test('going back only to back_to', () => {
  const p = setup(planOf([impl({ status: 'in_progress', phase: 'review' })]));
  const at = (phase) => planOf([impl({ status: 'in_progress', phase })]);
  expectDecision(writePlan(p, at('build')), 'allow');
  expectDecision(writePlan(p, at('test')), 'deny', /only to "build"/);
  expectDecision(writePlan(p, at('plan')), 'deny', /only to "build"/);
});

test('a per_stage stage cannot be done before the last mandatory phase, nor with open topics', () => {
  const sk = undefined;
  const p = setup(planOf([impl({ status: 'in_progress', phase: 'test', skipped: sk })]));
  const doneTopics = [{ name: 'Calendar', done: true }, { name: 'Booking', done: true }];
  expectDecision(writePlan(p, planOf([impl({ status: 'done', phase: 'test', skipped: sk, topics: doneTopics })])), 'deny', /done before the phase "review"/);

  const q = setup(planOf([impl({ status: 'in_progress', phase: 'review', skipped: sk })]));
  expectDecision(writePlan(q, planOf([impl({ status: 'done', phase: 'review', skipped: sk })])), 'deny', /some topics are not/);
  expectDecision(writePlan(q, planOf([impl({ status: 'done', phase: 'review', skipped: sk, topics: doneTopics })])), 'allow');
});

test('per_step: a topic done before the decision phase is denied; a new topic starts at clarify', () => {
  const sk = undefined;
  const p = setup(planOf([disc([{ name: 'Stack', done: false, phase: 'convergence' }], { skipped: sk })]));
  expectDecision(writePlan(p, planOf([disc([{ name: 'Stack', done: true, phase: 'convergence' }], { skipped: sk })])), 'deny', /topic "Stack".*done before the phase "decision"/);
  expectDecision(writePlan(p, planOf([disc([{ name: 'Stack', done: true, phase: 'decision' }], { skipped: sk })])), 'allow');
  // a new topic cannot start past the context check
  expectDecision(writePlan(p, planOf([disc([{ name: 'Stack', done: false, phase: 'convergence' }, { name: 'Hosting', done: false, phase: 'proposal' }])])), 'deny', /mandatory phase "clarify"/);
  expectDecision(writePlan(p, planOf([disc([{ name: 'Stack', done: false, phase: 'convergence' }, { name: 'Hosting', done: false, phase: 'clarify' }])])), 'allow');
  expectDecision(writePlan(p, planOf([disc([{ name: 'Stack', done: false }], { skipped: sk, phase: 'proposal' })])), 'deny', /put "phase" on each topic/);
});

test('editing or removing a done stage asks; a new stage created done is denied', () => {
  const doneStage = disc([{ name: 'Stack', done: true, phase: 'decision' }], { status: 'done' });
  const p = setup(planOf([doneStage, impl()]));
  expectDecision(writePlan(p, planOf([{ ...doneStage, name: 'Renamed' }, impl()])), 'ask', /done and would be changed/);
  expectDecision(writePlan(p, planOf([impl()])), 'ask', /done and would be removed/);
  // key order or formatting changes are not changes
  const reordered = Object.fromEntries(Object.entries(doneStage).reverse());
  expectDecision(writePlan(p, planOf([reordered, impl()])), 'allow');
  // adding a stage after a done one is fine; adding one already done is not
  expectDecision(writePlan(p, planOf([doneStage, impl(), { id: 'demo', name: 'Demo', type: 'delivery', status: 'todo' }])), 'allow');
  expectDecision(writePlan(p, planOf([doneStage, impl(), { id: 'demo', name: 'Demo', type: 'quick_task', status: 'done', phase: 'report' }])), 'deny', /rule 6/);
});

test('Edit and MultiEdit are checked on the resulting file', () => {
  const p = setup(planOf([impl({ status: 'in_progress', phase: 'plan' })]));
  const edit = (old_string, new_string) => runHook('plan-guard.js', { tool_name: 'Edit', tool_input: { file_path: p.file, old_string, new_string }, cwd: p.dir });
  expectDecision(edit('"phase": "plan"', '"phase": "build"'), 'allow');
  expectDecision(edit('"phase": "plan"', '"phase": "review"'), 'deny', /mandatory phase "build"/);
  const multi = runHook('plan-guard.js', { tool_name: 'MultiEdit', tool_input: { file_path: p.file, edits: [
    { old_string: '"phase": "plan"', new_string: '"phase": "build"' },
    { old_string: '"type": "implementation"', new_string: '"type": "nope"' },
  ] }, cwd: p.dir });
  expectDecision(multi, 'deny', /type "nope"/);
});

test('other files, Windows paths and bad input', () => {
  const p = setup(planOf([impl()]));
  const other = runHook('plan-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(p.dir, 'src', 'plan.json'), content: '{ nope' }, cwd: p.dir });
  expectDecision(other, 'allow');
  if (process.platform === 'win32') {
    const odd = p.file.replace(/\//g, '\\').replace(/^([A-Z]):/, (m, d) => d.toLowerCase() + ':').replace('plan.json', 'PLAN.json');
    const res = runHook('plan-guard.js', { tool_name: 'Write', tool_input: { file_path: odd, content: '{ nope' }, cwd: p.dir });
    expectDecision(res, 'deny', /not valid JSON/);
  }
  for (const raw of ['', 'not json', '{"tool_input": {}}']) {
    const res = runHook('plan-guard.js', null, { raw });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, '');
  }
});
