/*
 * Blueprint hooks — reading the context card (blueprint/context.md) written by get-context.
 *
 * The card is a draft until get-context adds the `Confirmed: <date>` line after the user's yes.
 * While it is a draft, points not yet known are written with the source `open` (Italian `aperto`):
 *   - **timing** · open — no deadline mentioned yet
 * readCard() reports whether the card exists, whether it is confirmed, and which points are open,
 * so the orientation hook (SessionStart) and step-close (Stop) can bring Claude back to
 * get-context after a Discovery, a long search, a compaction or a new session.
 *
 * Used by: hooks/orientation.js, hooks/step-close.js.
 */

const path = require('path');
const { readText, blueprintDirOf } = require('./common');

const CONFIRMED = /^\s*(Confirmed|Confermat[ao])\s*:/im;
const POINT = /^\s*-\s*\*\*([a-z0-9][a-z0-9_-]*)\*\*\s*·\s*(open|aperto|aperta)\b/gim;

/** null without a card; otherwise { text, confirmed, open: [point ids still open] }. */
function readCard(projectDir) {
  const text = readText(path.join(blueprintDirOf(projectDir), 'context.md'));
  if (text === null || text === undefined || !String(text).trim()) return null;
  const open = [];
  for (const m of String(text).matchAll(POINT)) open.push(m[1]);
  return { text: String(text), confirmed: CONFIRMED.test(text), open };
}

/** "timing, roles" (at most `max` ids, then "…"), or '' when nothing is open. */
function openList(card, max = 5) {
  if (!card || !card.open.length) return '';
  const shown = card.open.slice(0, max).join(', ');
  return card.open.length > max ? `${shown}, …` : shown;
}

module.exports = { readCard, openList };
