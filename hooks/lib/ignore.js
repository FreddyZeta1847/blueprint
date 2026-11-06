/*
 * Blueprint hooks — which project files are NOT source code for the module map (H6) and the
 * end-of-step question (H11).
 *
 * Blueprint's own folder (blueprint/: context, plan, notes, vault), planning documents, tool
 * folders, dependencies, prototypes and lock files are never "code a decision covers".
 * Counting them as unowned source files was the B-03 false alarm.
 * Input is a project-relative POSIX path; the vault itself is excluded by the callers.
 */

const IGNORED_DIRS = ['blueprint', 'docs', '.superpowers', '.claude', 'node_modules', 'prototypes', '.git', '.github-cache'];

const LOCK_FILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
  'poetry.lock',
  'pipfile.lock',
  'uv.lock',
  'cargo.lock',
  'composer.lock',
  'gemfile.lock',
  'go.sum',
  'packages.lock.json',
]);

function isIgnoredSourcePath(rel) {
  const posix = String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!posix || posix.startsWith('../')) return true;
  const parts = posix.split('/').filter(Boolean);
  const lowerParts = parts.map((p) => p.toLowerCase());
  if (IGNORED_DIRS.includes(lowerParts[0])) return true;
  if (lowerParts.includes('node_modules')) return true;
  if (lowerParts[0].startsWith('vault-')) return true;   // legacy v1/v2 vault
  const file = lowerParts[lowerParts.length - 1];
  if (file.endsWith('.md')) return true;          // Markdown outside the vault is documentation
  if (LOCK_FILES.has(file)) return true;
  return false;
}

module.exports = { isIgnoredSourcePath };
