/*
 * Static test for hooks/hooks.json: valid JSON, the four expected events, the matchers the spec
 * requires (H8: shell tools on PostToolUse; H9: MultiEdit on PreToolUse; H11: Stop; v3: the
 * plan-guard on PreToolUse), and every referenced script exists and starts with a header comment.
 *
 * Run: node --test hooks/tests/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..');

test('hooks.json is valid and wires every v3 hook', () => {
  const config = JSON.parse(fs.readFileSync(path.join(HOOKS_DIR, 'hooks.json'), 'utf8'));
  const h = config.hooks;
  assert.deepEqual(Object.keys(h).sort(), ['PostToolUse', 'PreToolUse', 'SessionStart', 'Stop']);
  assert.match(h.PostToolUse[0].matcher, /Bash/);
  assert.match(h.PostToolUse[0].matcher, /PowerShell/);
  assert.match(h.PreToolUse[0].matcher, /MultiEdit/);
  assert.ok(h.PreToolUse[0].hooks.some((x) => /plan-guard\.js/.test(x.command)), 'plan-guard is registered');

  for (const groups of Object.values(h)) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        const m = hook.command.match(/hooks\/([\w-]+\.js)/);
        assert.ok(m, hook.command);
        const script = path.join(HOOKS_DIR, m[1]);
        assert.ok(fs.existsSync(script), script);
        assert.ok(fs.readFileSync(script, 'utf8').startsWith('/*'), `${m[1]} has no header comment`);
      }
    }
  }
});
