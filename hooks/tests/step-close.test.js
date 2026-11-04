/*
 * Integration tests for hooks/step-close.js (Stop, H11): the end-of-step question "did this work
 * change the foundations?". Asked once per set of changed source files, only when the changes
 * touch parts with recorded decisions (via modules.json, or any decision when there is no map),
 * never when stop_hook_active is set, never for docs / Markdown / vault-only changes.
 *
 * Run: node --test hooks/tests/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { makeProject, write, runHook, cleanup } = require('./helpers');

test.after(cleanup);

const BLOCK = (id, choice) =>
  `### ${id} — Q?\n- **Choice:** ${choice}\n- **Reversibility:** two-way\n- **Decided by:** user\n- **Why:** w\n`;

function projectWithDecisions(extra = {}) {
  const p = makeProject({ git: true });
  const md = write(path.join(p.vault, 'foundations', 'DB', 'DB.md'), BLOCK('db-engine', 'PostgreSQL'));
  runHook('file-watcher.js', { tool_name: 'Write', tool_input: { file_path: md }, cwd: p.dir, session_id: 's' });
  if (extra.section) {
    const sec = write(path.join(p.vault, 'sections', 'SIGNUP', 'SIGNUP.md'), BLOCK('signup-flow', 'email link'));
    runHook('file-watcher.js', { tool_name: 'Write', tool_input: { file_path: sec }, cwd: p.dir, session_id: 's' });
    write(path.join(p.vault, 'sections', 'SIGNUP', 'modules.json'), JSON.stringify({ files: ['src/signup/'] }));
  }
  return p;
}

const stop = (dir, active = false) => ({
  session_id: 's', hook_event_name: 'Stop', stop_hook_active: active, cwd: dir, transcript_path: path.join(dir, 't.jsonl'),
});

function blocked(res) {
  return res.json && res.json.decision === 'block' ? res.json.reason : null;
}

test('asks once per set of changed source files', () => {
  const { dir } = projectWithDecisions();
  write(path.join(dir, 'src', 'app.js'), 'x');
  const reason = blocked(runHook('step-close.js', stop(dir)));
  assert.ok(reason);
  assert.ok(reason.startsWith('[Blueprint]'), reason);
  assert.match(reason, /src\/app\.js/);
  assert.match(reason, /foundations/);

  assert.equal(runHook('step-close.js', stop(dir)).stdout, '');      // same set: never twice

  write(path.join(dir, 'src', 'b.js'), 'y');                         // a new set: ask again
  assert.ok(blocked(runHook('step-close.js', stop(dir))));
});

test('never blocks when stop_hook_active is set', () => {
  const { dir } = projectWithDecisions();
  write(path.join(dir, 'src', 'app.js'), 'x');
  assert.equal(runHook('step-close.js', stop(dir, true)).stdout, '');
});

test('docs, Markdown and vault-only changes do not trigger it', () => {
  const { dir, vault } = projectWithDecisions();
  write(path.join(dir, 'docs', 'plan.txt'), 'x');
  write(path.join(dir, 'tree.md'), 'x');
  write(path.join(vault, 'foundations', 'DB', 'DB--details.md'), BLOCK('pool', '20'));
  assert.equal(runHook('step-close.js', stop(dir)).stdout, '');
});

test('a vault with no decisions never asks', () => {
  const { dir } = makeProject({ git: true });
  write(path.join(dir, 'src', 'app.js'), 'x');
  assert.equal(runHook('step-close.js', stop(dir)).stdout, '');
});

test('with ownership maps, only files owned by a part with decisions trigger it', () => {
  const { dir } = projectWithDecisions({ section: true });
  write(path.join(dir, 'src', 'other.js'), 'x');                     // owned by nobody
  assert.equal(runHook('step-close.js', stop(dir)).stdout, '');
  write(path.join(dir, 'src', 'signup', 'form.js'), 'x');             // owned by SIGNUP
  const reason = blocked(runHook('step-close.js', stop(dir)));
  assert.ok(reason);
  assert.match(reason, /src\/signup\/form\.js/);
});

test('outside a git repository, or with bad input, it stays silent', () => {
  const { dir, vault } = makeProject({ git: false });
  write(path.join(vault, 'foundations', 'DB', 'DB.md'), BLOCK('db-engine', 'PG'));
  write(path.join(dir, 'src', 'app.js'), 'x');
  assert.equal(runHook('step-close.js', stop(dir)).stdout, '');
  for (const raw of ['', 'nope']) {
    const res = runHook('step-close.js', null, { raw });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, '');
  }
});
