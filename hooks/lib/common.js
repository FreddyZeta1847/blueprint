/*
 * Blueprint hooks — shared plumbing: reading the hook payload, finding the decisions folder
 * (blueprint/decisions/ first, legacy vault-<project>/ second) and blueprint/plan.json, path helpers
 * that behave on native Windows (backslashes, any drive-letter case), JSON/text I/O, the audit
 * identity and the `_audit.md` writer.
 *
 * Every hook in hooks/ requires this file. Nothing here may throw past its caller's try/catch in
 * a way that breaks a session: helpers return null/fallbacks instead.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** Read the hook payload from stdin. Returns null on no input or unparseable JSON. */
function readStdinJson() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    return null;
  }
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, '').trim());
  } catch {
    return null;
  }
}

function projectDirOf(input) {
  return (input && input.cwd) || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * The decisions folder, or null when the project has none.
 * Blueprint 3 keeps it in `blueprint/decisions/`; a legacy v1/v2 `vault-<project>/` folder at the
 * project root is still accepted when the new one does not exist. (In the code it is still
 * called the "vault", its v1/v2 name: vaultRoot, findVaultRoot, lib/vault.js.)
 */
function findVaultRoot(projectDir) {
  try {
    const modern = path.join(projectDir, 'blueprint', 'decisions');
    if (fs.statSync(modern).isDirectory()) return modern;
  } catch { /* not there: try the legacy folder */ }
  try {
    const entry = fs
      .readdirSync(projectDir, { withFileTypes: true })
      .find((e) => e.isDirectory() && e.name.startsWith('vault-'));
    return entry ? path.join(projectDir, entry.name) : null;
  } catch {
    return null;
  }
}

/** `<project>/blueprint/` — the folder holding context.md, plan.json, notes.json and decisions/. */
function blueprintDirOf(projectDir) {
  return path.join(projectDir, 'blueprint');
}

/** blueprint/plan.json parsed, null when absent, or { unreadable: true } when it is not valid JSON. */
function readPlan(projectDir) {
  const text = readText(path.join(blueprintDirOf(projectDir), 'plan.json'));
  if (text === null) return null;
  try {
    const plan = JSON.parse(text);
    return plan && typeof plan === 'object' && Array.isArray(plan.stages) ? plan : { unreadable: true };
  } catch {
    return { unreadable: true };
  }
}

function toPosix(p) {
  return String(p).split(path.sep).join('/').replace(/\\/g, '/');
}

/**
 * The POSIX path of `abs` relative to `root`, or null when it lies outside.
 * path.relative on win32 already compares case-insensitively, so `c:\x` and `C:\x` match.
 */
function relInside(root, abs) {
  if (!root || !abs) return null;
  const rel = path.relative(path.resolve(root), path.resolve(abs));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return rel === '' ? '' : null;
  return toPosix(rel);
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

function readJson(file, fallback) {
  const text = readText(file);
  if (text === null) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/** Git config name, then HEAD's author, then the OS user — config is empty on some real machines. */
function auditWho(projectDir) {
  const tryGit = (args) => {
    try {
      const out = execFileSync('git', args, { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return out || null;
    } catch {
      return null;
    }
  };
  let osUser = 'unknown';
  try { osUser = require('os').userInfo().username; } catch { /* keep 'unknown' */ }
  return tryGit(['config', 'user.name']) || tryGit(['log', '-1', '--format=%an']) || osUser;
}

function nowStamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 16);
}

/** Append lines to `_audit.md`, creating it with its header the first time. */
function appendAudit(vaultRoot, lines) {
  if (!lines.length) return;
  const auditFile = path.join(vaultRoot, '_audit.md');
  if (!fs.existsSync(auditFile)) {
    fs.writeFileSync(
      auditFile,
      '# Decision Audit\n\nAuto-generated, append-only. Who changed which decision, when, and why.\nNever hand-edited.\n',
      'utf8'
    );
  }
  fs.appendFileSync(auditFile, lines.join('\n') + '\n', 'utf8');
}

module.exports = {
  readStdinJson,
  projectDirOf,
  findVaultRoot,
  blueprintDirOf,
  readPlan,
  toPosix,
  relInside,
  readText,
  readJson,
  writeJson,
  auditWho,
  nowStamp,
  appendAudit,
};
