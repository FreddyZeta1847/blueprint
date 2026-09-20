/*
 * SessionStart hook — Orientation for Blueprint-managed sessions
 *
 * Injected at session start to: (1) inject the using-blueprint routing skill,
 * (2) surface the current project's live state (_current-task.md, _index.md, _queue.json),
 * (3) inject the constraints digest (locked/one-way atoms, axis+choice only),
 * (4) run staleness check (git-diff or file-hash fallback) to flag code changes outside Blueprint.
 *
 * Triggers: SessionStart hook, always runs when Claude opens a Blueprint-managed project.
 *
 * References: hooks/hooks.json (wiring), skills/using-blueprint/SKILL.md (routing content),
 * vault-<project>/(_current-task.md, _index.md, _queue.json, _index/decisions.json).
 */

const fs = require('fs');
const path = require('path');

// Get project and plugin roots; use CLAUDE env vars if available (running as a plugin)
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');

try {
  // Build output: start with routing skill
  let out = fs.readFileSync(path.join(pluginRoot, 'skills/using-blueprint/SKILL.md'), 'utf8') + '\n\n---\n\n';

  // Find vault folder (vault-<project-name>)
  const vaultFolderName = fs.readdirSync(projectDir).find(e => e.startsWith('vault-'));

  if (!vaultFolderName) {
    out += '**No Blueprint vault found in this repository.** Run `/blueprint` to initialize one.\n';
  } else {
    const vaultPath = path.join(projectDir, vaultFolderName);

    // Inject the three live-state files if they exist
    const liveStateFiles = ['_current-task.md', '_index.md', '_queue.json'];
    for (const filename of liveStateFiles) {
      const filePath = path.join(vaultPath, filename);
      if (fs.existsSync(filePath)) {
        out += `\n## ${vaultFolderName}/${filename}\n`;
        out += fs.readFileSync(filePath, 'utf8');
        out += '\n';
      }
    }

    // Inject constraints digest (every locked/one-way atom, axis+choice only)
    const decisionsIndexPath = path.join(vaultPath, '_index', 'decisions.json');
    if (fs.existsSync(decisionsIndexPath)) {
      const decisionsIndex = JSON.parse(fs.readFileSync(decisionsIndexPath, 'utf8'));

      // Collect all locked/one-way atoms, axis+choice only
      const constraints = [];
      for (const featureName in decisionsIndex.features) {
        const feature = decisionsIndex.features[featureName];
        if (feature.atoms) {
          for (const atom of feature.atoms) {
            if (atom.status === 'locked' || atom.reversibility === 'one-way') {
              constraints.push(`- **${atom.axis}** → ${atom.choice}`);
            }
          }
        }
      }

      if (constraints.length > 0) {
        out += '\n## Constraints Digest (Locked & One-Way Atoms)\n';
        out += 'These decisions cannot be silently overridden:\n\n';
        out += constraints.join('\n');
        out += '\n';
      }
    }

    // Run staleness check: git-diff fast path or file-hash fallback
    out += '\n## Staleness Check\n';
    try {
      const { execSync } = require('child_process');
      const lastIndexedCommit = fs.existsSync(path.join(vaultPath, '.last-indexed-commit'))
        ? fs.readFileSync(path.join(vaultPath, '.last-indexed-commit'), 'utf8').trim()
        : null;

      let isDirty = false;
      if (lastIndexedCommit) {
        try {
          const diff = execSync(`git diff --quiet ${lastIndexedCommit} HEAD`, {
            cwd: projectDir,
            stdio: 'pipe'
          });
          isDirty = false;
        } catch (e) {
          // Non-zero exit means there is a diff
          isDirty = true;
        }
      }

      if (isDirty) {
        out += '⚠️ **Code changed since last Blueprint index.** Run a full discovery pass or selective review before proceeding.\n';
      } else {
        out += '✓ No code changes since last index.\n';
      }
    } catch (e) {
      out += '(Staleness check unavailable; git or exec failed)\n';
    }
  }

  console.log(out);
} catch (e) {
  // Graceful fallback if hook fails
  console.error(`Blueprint SessionStart hook error: ${e.message}`);
  process.exit(1);
}
