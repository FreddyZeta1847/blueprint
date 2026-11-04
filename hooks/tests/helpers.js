/*
 * Test helpers for the Blueprint hooks: build a throw-away project with a vault under the OS temp
 * folder, run a hook script exactly as Claude Code does (JSON payload on stdin), parse its stdout.
 *
 * Safety (known issue 003): cleanup only ever deletes folders this module created, inside
 * os.tmpdir(), whose name carries our prefix. Anything else is refused.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const HOOKS_DIR = path.join(__dirname, '..');
const PREFIX = 'bp-hooks-test-';
const created = new Set();

function makeProject({ vault = 'vault-demo', git = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
  created.add(dir);
  if (vault) fs.mkdirSync(path.join(dir, vault), { recursive: true });
  if (git) {
    const run = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    run('init', '-q');
    run('config', 'user.email', 'test@example.com');
    run('config', 'user.name', 'Test');
    run('config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'README.txt'), 'seed\n');
    run('add', '-A');
    run('commit', '-q', '-m', 'seed');
  }
  return { dir, vault: vault ? path.join(dir, vault) : null };
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Push a file's mtime into the future, so mtime comparisons are deterministic. */
function touchFuture(file, seconds = 5) {
  const t = new Date(Date.now() + seconds * 1000);
  fs.utimesSync(file, t, t);
}

/** Run hooks/<script> with `payload` on stdin. Returns { status, stdout, stderr, json }. */
function runHook(script, payload, { raw, env } = {}) {
  const input = raw !== undefined ? raw : JSON.stringify(payload);
  const res = spawnSync(process.execPath, [path.join(HOOKS_DIR, script)], {
    input,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: '', ...(env || {}) },
  });
  let json = null;
  if (res.stdout && res.stdout.trim()) {
    try { json = JSON.parse(res.stdout); } catch { json = null; }
  }
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, json };
}

function contextOf(result) {
  return (result.json && result.json.hookSpecificOutput && result.json.hookSpecificOutput.additionalContext) || '';
}

function cleanup() {
  const tmp = path.resolve(os.tmpdir());
  for (const dir of created) {
    const abs = path.resolve(dir);
    const safe = path.dirname(abs).toLowerCase() === tmp.toLowerCase() && path.basename(abs).startsWith(PREFIX);
    if (!safe) throw new Error(`refusing to delete ${abs}`);
    fs.rmSync(abs, { recursive: true, force: true });
  }
  created.clear();
}

module.exports = { makeProject, write, read, touchFuture, runHook, contextOf, cleanup };
