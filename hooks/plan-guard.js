/*
 * PreToolUse hook — Blueprint's plan-guard (v3).
 *
 * Acts only on writes to `.../blueprint/plan.json`. It rebuilds the plan as it will be after this
 * tool call (Write = the new content; Edit / MultiEdit = the current file with the replacements
 * applied), compares it with the plan on disk and enforces the stage loops of data/loops.json:
 * valid shape, known types and phases, phases that move in order (optional ones skipped only
 * with a written reason, going back only to `back_to`), `done` only after the last mandatory
 * phase, done stages untouched, no stage born done. The rules live in hooks/lib/plan.js.
 *
 * Output (stdout, PreToolUse JSON): permissionDecision "deny" with the broken rules and how to
 * fix them; or "ask" when only a done stage would change (the user may have asked for it);
 * nothing when the plan is fine. Bad input, a missing loops.json or any crash → exit 0 silently.
 *
 * Usage: PreToolUse hook in hooks/hooks.json, matcher "Write|Edit|MultiEdit".
 */

const path = require('path');
const { readStdinJson, toPosix, readText } = require('./lib/common');
const { contentAfter } = require('./lib/edits');
const { loadLoops, validatePlan } = require('./lib/plan');

const MAX_LISTED = 4;

function isPlanFile(filePath) {
  return toPosix(path.resolve(filePath)).toLowerCase().endsWith('/blueprint/plan.json');
}

function decide(permissionDecision, lines) {
  const shown = lines.slice(0, MAX_LISTED);
  if (lines.length > MAX_LISTED) shown.push(`(+${lines.length - MAX_LISTED} more)`);
  const permissionDecisionReason = ['[Blueprint] plan-guard — blueprint/plan.json:', ...shown.map((l) => `- ${l}`)].join('\n');
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason },
  }));
}

function parse(text) {
  try {
    return { value: JSON.parse(String(text).replace(/^﻿/, '')) };
  } catch (e) {
    return { error: e && e.message };
  }
}

function main() {
  const input = readStdinJson();
  if (!input || !input.tool_input || typeof input.tool_input.file_path !== 'string') return;
  if (!isPlanFile(input.tool_input.file_path)) return;
  const loops = loadLoops();
  if (!loops) return;

  const abs = path.resolve(input.tool_input.file_path);
  const after = contentAfter(input.tool_name, input.tool_input, abs);
  if (after === null) return;
  const next = parse(after);
  if (next.error) return decide('deny', [`rule 1: the result is not valid JSON (${next.error}). Write the whole plan as valid JSON.`]);

  const onDisk = readText(abs);
  const previous = onDisk === null ? null : parse(onDisk).value || null;
  const { deny, ask } = validatePlan(next.value, previous, loops);
  if (deny.length) return decide('deny', deny);
  if (ask.length) return decide('ask', ask);
  return undefined;
}

try {
  main();
} catch (e) {
  // Fail open: a crashed guard must not block every write.
  process.stderr.write(`Blueprint plan-guard error: ${e && e.message}\n`);
}
