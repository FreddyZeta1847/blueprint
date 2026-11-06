/*
 * Integration tests for hooks/file-watcher.js (PostToolUse): Markdown → in-memory atoms and the
 * compiled index, with no atoms.json on disk (H1), unreadable-block reports (H2), scoped Review
 * checks (H3), audit without the old profile flag (H4), Used-by check (H5), module-map ignore
 * list (H6), no _full-context.md mirror any more, the cheap Bash path (H8), the v3 Stage check
 * and the blueprint/vault/ location. Each test builds a temp project and runs the real hook.
 *
 * Run: node --test hooks/tests/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeProject, write, read, touchFuture, runHook, contextOf, cleanup } = require('./helpers');

test.after(cleanup);

const block = ({ id, q = 'Question?', choice, rev = 'two-way', by = 'user', rejected, why = 'because', deps, usedBy }) =>
  [
    `### ${id} — ${q}`,
    `- **Choice:** ${choice}`,
    `- **Reversibility:** ${rev}`,
    `- **Decided by:** ${by}`,
    rejected ? `- **Rejected:** ${rejected}` : null,
    `- **Why:** ${why}`,
    deps ? `- **Depends on:** ${deps}` : null,
    usedBy ? `- **Used by:** ${usedBy}` : null,
    '',
  ].filter((l) => l !== null).join('\n');

function writePayload(dir, file, tool = 'Write') {
  return { session_id: 's1', hook_event_name: 'PostToolUse', tool_name: tool, tool_input: { file_path: file }, cwd: dir };
}

function registry(vault, ids) {
  write(path.join(vault, 'Vocabulary', 'registry.json'), JSON.stringify({ entries: ids.map((id) => ({ id, question: id })) }));
}

test('reads the Markdown in memory (no atoms.json), compiles the index, audits, no profile flag', () => {
  const { dir, vault } = makeProject();
  registry(vault, ['db-engine', 'backup-window']);
  const md = write(path.join(vault, 'foundations', 'DB', 'DB.md'),
    '---\ntags: [foundation]\n---\n# DB\n\n' +
    block({ id: 'db-engine', choice: 'PostgreSQL', rev: 'one-way', rejected: 'MySQL — less familiar' }) +
    block({ id: 'backup-window', choice: 'nightly' }));

  const res = runHook('file-watcher.js', writePayload(dir, md));
  assert.equal(res.status, 0);

  assert.equal(read(path.join(vault, 'foundations', 'DB', 'atoms.json')), null);
  const index = JSON.parse(read(path.join(vault, '_index', 'decisions.json')));
  const atoms = index.features['foundations/DB'].atoms;
  assert.deepEqual(atoms.map((a) => a.id), ['db-engine', 'backup-window']);
  assert.equal(atoms[0].unit, 'foundations/DB');
  assert.equal(atoms[0].scope, 'foundation');

  assert.match(read(path.join(vault, '_audit.md')), /db-engine/);
  assert.doesNotMatch(contextOf(res), /PROFILE/);
});

test('details file decisions join the same unit; removing a block removes the atom', () => {
  const { dir, vault } = makeProject();
  registry(vault, ['db-engine', 'pool-size']);
  write(path.join(vault, 'foundations', 'DB', 'DB.md'), block({ id: 'db-engine', choice: 'PostgreSQL' }));
  const details = write(path.join(vault, 'foundations', 'DB', 'DB--details.md'), block({ id: 'pool-size', choice: '20', by: 'claude' }));
  const indexAtoms = () => JSON.parse(read(path.join(vault, '_index', 'decisions.json'))).features['foundations/DB'].atoms;
  runHook('file-watcher.js', writePayload(dir, details));
  let atoms = indexAtoms();
  assert.deepEqual(atoms.map((a) => a.id).sort(), ['db-engine', 'pool-size']);

  write(details, '# nothing decided here anymore\n');
  runHook('file-watcher.js', writePayload(dir, details));
  atoms = indexAtoms();
  assert.deepEqual(atoms.map((a) => a.id), ['db-engine']);
  assert.match(read(path.join(vault, '_audit.md')), /removed/);
});

test('reports unreadable blocks with file and line', () => {
  const { dir, vault } = makeProject();
  const md = write(path.join(vault, 'foundations', 'AUTH', 'AUTH.md'),
    '### auth-model — How do users log in?\n- **Choice:** OAuth\n- **Reversibility:** two-way\n- **Decided by:** user\n');
  const ctx = contextOf(runHook('file-watcher.js', writePayload(dir, md)));
  assert.match(ctx, /foundations\/AUTH\/AUTH\.md/);
  assert.match(ctx, /missing \*\*Why\*\*/);
});

test('a section that re-decides a foundation question differently is a conflict, even two-way', () => {
  const { dir, vault } = makeProject();
  registry(vault, ['ui-lib', 'db-engine']);
  write(path.join(vault, 'foundations', 'FRONT', 'FRONT.md'), block({ id: 'ui-lib', choice: 'Vue' }));
  write(path.join(vault, 'foundations', 'DB', 'DB.md'),
    block({ id: 'db-engine', choice: 'PostgreSQL', rev: 'one-way', rejected: 'x — y' }));
  const sec = write(path.join(vault, 'sections', 'SIGNUP', 'SIGNUP--details.md'), block({ id: 'ui-lib', choice: 'React', by: 'claude' }));
  let ctx = contextOf(runHook('file-watcher.js', writePayload(dir, sec)));
  assert.match(ctx, /CONFLICT CHECK/);
  assert.match(ctx, /ui-lib/);

  write(path.join(vault, 'sections', 'SIGNUP', 'SIGNUP.md'),
    block({ id: 'db-engine', choice: 'MySQL', rev: 'one-way', rejected: 'x — y' }));
  ctx = contextOf(runHook('file-watcher.js', writePayload(dir, path.join(vault, 'sections', 'SIGNUP', 'SIGNUP.md'))));
  assert.match(ctx, /CONFLICT CHECK/);
  assert.match(ctx, /db-engine/);
});

test('two sections answering the same detail question differently stay quiet (no noise)', () => {
  const { dir, vault } = makeProject();
  registry(vault, ['button-style']);
  write(path.join(vault, 'sections', 'SIGNUP', 'SIGNUP--details.md'), block({ id: 'button-style', choice: 'rounded', by: 'claude' }));
  const other = write(path.join(vault, 'sections', 'ORDERS', 'ORDERS--details.md'), block({ id: 'button-style', choice: 'square', by: 'claude' }));
  const ctx = contextOf(runHook('file-watcher.js', writePayload(dir, other)));
  assert.doesNotMatch(ctx, /CONFLICT/);
});

test('Used by must name an existing section', () => {
  const { dir, vault } = makeProject();
  registry(vault, ['db-engine']);
  fs.mkdirSync(path.join(vault, 'sections', 'SIGNUP'), { recursive: true });
  const md = write(path.join(vault, 'foundations', 'DB', 'DB.md'), block({ id: 'db-engine', choice: 'PG', usedBy: 'SIGNUP, CHECKOUT' }));
  const ctx = contextOf(runHook('file-watcher.js', writePayload(dir, md)));
  assert.match(ctx, /CHECKOUT/);
  assert.doesNotMatch(ctx, /`SIGNUP`/);
});

test('a hand-written atoms.json outside legacy features/ is flagged as unused', () => {
  const { dir, vault } = makeProject();
  const file = write(path.join(vault, 'foundations', 'DB', 'atoms.json'), '{"atoms":[{"id":"x","axis":"x","choice":"y"}]}');
  const ctx = contextOf(runHook('file-watcher.js', writePayload(dir, file)));
  assert.match(ctx, /not used/i);
  write(path.join(vault, 'foundations', 'DB', 'DB.md'), block({ id: 'db-engine', choice: 'PG' }));
  runHook('file-watcher.js', writePayload(dir, path.join(vault, 'foundations', 'DB', 'DB.md')));
  const index = JSON.parse(read(path.join(vault, '_index', 'decisions.json')));
  assert.deepEqual(index.features['foundations/DB'].atoms.map((a) => a.id), ['db-engine']);   // the stray file is ignored
});

test('legacy v1 vaults still compile and prose never overwrites a hand-written atoms.json', () => {
  const { dir, vault } = makeProject();
  const handAtoms = { atoms: [{ id: 'a1', axis: 'storage', choice: 'sqlite', status: 'ratified', reversibility: 'two-way' }] };
  const atomsFile = write(path.join(vault, 'features', 'APP', 'atoms.json'), JSON.stringify(handAtoms));
  runHook('file-watcher.js', writePayload(dir, atomsFile));
  const index = JSON.parse(read(path.join(vault, '_index', 'decisions.json')));
  assert.equal(index.features.APP.atoms[0].choice, 'sqlite');

  const prose = write(path.join(vault, 'features', 'APP', 'APP.md'), '# APP\n\nJust prose, no blocks.\n');
  runHook('file-watcher.js', writePayload(dir, prose));
  assert.deepEqual(JSON.parse(read(atomsFile)), handAtoms);
});

test('module map ignores docs, Markdown, lock files and tool folders', () => {
  const { dir, vault } = makeProject();
  for (const rel of ['docs/superpowers/specs/plan.md', 'tree.md', 'package-lock.json', '.superpowers/x.js', 'node_modules/a/b.js', 'prototypes/mock.html']) {
    const res = runHook('file-watcher.js', writePayload(dir, write(path.join(dir, rel), 'x')));
    assert.equal(contextOf(res), '', rel);
  }
  assert.equal(read(path.join(vault, '_index', 'unassigned.json')), null);
});

test('real source files are recorded; the reminder only speaks once ownership maps are in use', () => {
  const { dir, vault } = makeProject();
  let res = runHook('file-watcher.js', writePayload(dir, write(path.join(dir, 'src', 'app.js'), 'x')));
  assert.equal(contextOf(res), '');
  assert.deepEqual(JSON.parse(read(path.join(vault, '_index', 'unassigned.json'))).files, ['src/app.js']);

  write(path.join(vault, 'sections', 'SIGNUP', 'modules.json'), JSON.stringify({ files: ['src/signup/'] }));
  res = runHook('file-watcher.js', writePayload(dir, write(path.join(dir, 'src', 'signup', 'form.js'), 'x')));
  assert.equal(contextOf(res), '');                       // owned by SIGNUP via the prefix
  res = runHook('file-watcher.js', writePayload(dir, write(path.join(dir, 'src', 'other.js'), 'x')));
  assert.match(contextOf(res), /belong to no part/);
});

test('_current-task.md writes are not mirrored any more (no _full-context.md)', () => {
  const { dir, vault } = makeProject();
  const task = write(path.join(vault, '_current-task.md'), '# Now discussing — DB\nwe chose Postgres\n');
  const res = runHook('file-watcher.js', writePayload(dir, task));
  assert.equal(res.stdout, '');
  assert.equal(read(path.join(vault, '_full-context.md')), null);
});

test('a Bash write to a decision file is caught by the cheap mtime path', () => {
  const { dir, vault } = makeProject();
  const bash = { session_id: 's1', hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'sed -i s/Azure/AWS/ CLOUD.md' }, cwd: dir };
  const md = write(path.join(vault, 'foundations', 'CLOUD', 'CLOUD.md'), block({ id: 'cloud-provider', choice: 'Azure' }));
  runHook('file-watcher.js', writePayload(dir, md));
  assert.equal(runHook('file-watcher.js', bash).stdout, '');          // nothing changed since: silent
  write(md, block({ id: 'cloud-provider', choice: 'AWS' }));
  touchFuture(md);
  runHook('file-watcher.js', bash);
  const atoms = JSON.parse(read(path.join(vault, '_index', 'decisions.json'))).features['foundations/CLOUD'].atoms;
  assert.equal(atoms[0].choice, 'AWS');
  assert.equal(read(path.join(vault, 'foundations', 'CLOUD', 'atoms.json')), null);
});

test('Windows-style payload paths (backslashes, lower-case drive letter) are understood', { skip: process.platform !== 'win32' }, () => {
  const { dir, vault } = makeProject();
  const md = write(path.join(vault, 'foundations', 'DB', 'DB.md'), block({ id: 'db-engine', choice: 'PG' }));
  const odd = md.replace(/^([A-Z]):/, (m, d) => d.toLowerCase() + ':').replace(/\//g, '\\');
  runHook('file-watcher.js', writePayload(dir.toUpperCase(), odd));
  assert.ok(read(path.join(vault, '_index', 'decisions.json')));
});

test('the v3 vault lives in blueprint/vault/ and wins over a legacy vault-*/ folder', () => {
  const { dir } = makeProject({ vault: null });
  const legacy = path.join(dir, 'vault-old');
  fs.mkdirSync(legacy, { recursive: true });
  const vault = path.join(dir, 'blueprint', 'vault');
  const md = write(path.join(vault, 'foundations', 'DB', 'DB.md'), block({ id: 'db-engine', choice: 'PG' }));
  runHook('file-watcher.js', writePayload(dir, md));
  assert.ok(read(path.join(vault, '_index', 'decisions.json')));
  assert.equal(read(path.join(legacy, '_index', 'decisions.json')), null);
  // blueprint/ files outside the vault are never source files for the module map
  runHook('file-watcher.js', writePayload(dir, write(path.join(dir, 'blueprint', 'plan.json'), '{}')));
  assert.equal(read(path.join(vault, '_index', 'unassigned.json')), null);
});

test('with a plan, new or changed decisions must name an existing plan stage', () => {
  const { dir, vault } = makeProject();
  registry(vault, ['db-engine', 'cache']);
  write(path.join(dir, 'blueprint', 'plan.json'), JSON.stringify({ version: 3, project: 'P', stages: [{ id: 'foundations', name: 'F', type: 'discussion', status: 'in_progress', topics: [{ name: 'Stack', done: false }] }] }));
  const md = path.join(vault, 'foundations', 'DB', 'DB.md');
  write(md, block({ id: 'db-engine', choice: 'PG' }));
  let ctx = contextOf(runHook('file-watcher.js', writePayload(dir, md)));
  assert.match(ctx, /STAGE CHECK/);
  assert.match(ctx, /no \*\*Stage\*\*/);

  write(md, block({ id: 'db-engine', choice: 'PG' }) + '- **Stage:** foundations\n' + block({ id: 'cache', choice: 'redis' }) + '- **Tappa:** nowhere\n');
  ctx = contextOf(runHook('file-watcher.js', writePayload(dir, md)));
  assert.match(ctx, /`nowhere`/);
  assert.doesNotMatch(ctx, /db-engine` has no/);
});

test('malformed or empty stdin never breaks the session', () => {
  for (const raw of ['', 'not json', '﻿{"tool_input":']) {
    const res = runHook('file-watcher.js', null, { raw });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, '');
  }
});
