/*
 * Blueprint hooks — rebuild a file as it will be AFTER a Write / Edit / MultiEdit tool call.
 *
 * PreToolUse hooks run before the file changes, so a guard that wants to check the result must
 * compute it: Write = the new content; Edit / MultiEdit = the current file with the replacements
 * applied. Checking the whole resulting file means a one-line edit cannot slip past a guard.
 *
 * Used by: hooks/one-way-guard.js (vault Markdown) and hooks/plan-guard.js (blueprint/plan.json).
 */

const { readText } = require('./common');

function applyEdit(text, oldString, newString, replaceAll) {
  if (typeof oldString !== 'string' || typeof newString !== 'string' || !oldString) return text;
  if (replaceAll) return text.split(oldString).join(newString);
  const at = text.indexOf(oldString);
  return at === -1 ? text : text.slice(0, at) + newString + text.slice(at + oldString.length);
}

/** The file's content as it will be after this tool call, or null when we can't tell. */
function contentAfter(toolName, toolInput, absPath) {
  if (toolName === 'Write') return typeof toolInput.content === 'string' ? toolInput.content : null;
  const current = readText(absPath);
  if (toolName === 'Edit') {
    if (current === null) return typeof toolInput.new_string === 'string' ? toolInput.new_string : null;
    return applyEdit(current, toolInput.old_string, toolInput.new_string, toolInput.replace_all);
  }
  if (toolName === 'MultiEdit' && Array.isArray(toolInput.edits)) {
    let text = current === null ? '' : current;
    for (const e of toolInput.edits) text = applyEdit(text, e && e.old_string, e && e.new_string, e && e.replace_all);
    return text;
  }
  return null;
}

module.exports = { applyEdit, contentAfter };
