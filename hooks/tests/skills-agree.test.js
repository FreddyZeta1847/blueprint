/*
 * The skills and the README agree with the implementation loop (data/loops.json), 3.6.0.
 *
 * The loop's last phases are data; the skills explain them in words. When the loop changes and a
 * skill is not updated, Claude reads two different rules. This test pins the key sentences of
 * 3.6.0 (Claude's simulated first use, the user's «check and publish», corrections in the same
 * stage) and refuses the old ones that would bring the old behaviour back.
 *
 * Run: node --test hooks/tests/skills-agree.test.js   (from the repository root)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

const TEXTS = {
  createPlan: read('skills/create-plan/SKILL.md'),
  getContext: read('skills/get-context/SKILL.md'),
  docs: read('skills/docs-management/SKILL.md'),
  readme: read('README.md'),
  panel: read('hooks/panel/text.ts'),
};

/** Sentences that described the loop before 3.6.0: none may come back. */
const OLD = [
  ['readme', 'first use (you'],
  ['readme', '*integrate* (you)'],
  ['docs', "as the user's checklist"],
  ['createPlan', 'at most 3 rounds, then the user'],
  ['createPlan', 'on round 3 with findings still open, stop and ask the user'],
  ['createPlan', 'first use (started with your own instructions'],
  ['createPlan', 'with sub-tasks such as understand, fix, test'],
  ['createPlan', 'only when the correction came from the check'],
  ['readme', 'At most 3 rounds.'],
  ['readme', 'a stop after 3 rounds'],
  ['readme', 'Until you say publish, a<br/>problem goes back to build'],
  ['panel', "phd_test: 'test verdi; se no si torna a costruire.'"],
  ['panel', "phd_review: 'revisione del lavoro; se no si torna a costruire.'"],
  ['panel', "phd_test: 'green tests; if not, back to build.'"],
  ['createPlan', 'anything that is not right — a red test, a review'],
  ['createPlan', 'test phase goes back to `build`'],
];

/** Where an old sentence is still written, as «file: sentence» lines. */
function oldLeft(texts) {
  return OLD.filter(([file, sentence]) => texts[file].includes(sentence)).map(([file, sentence]) => `${file}: ${sentence}`);
}

test('the implementation loop ends with the user\'s check and publish; the first use is Claude\'s', () => {
  const phases = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'loops.json'), 'utf8')).types.implementation.phases;
  const last = phases[phases.length - 1];
  assert.equal(last.id, 'integrate');
  assert.equal(last.user, true);
  assert.notEqual(last.optional, true);
  assert.equal(last.back_to, 'build');
  // test and review fix in place: no going back from them (3.6.0)
  assert.equal(phases.find((p) => p.id === 'test').back_to, undefined);
  assert.equal(phases.find((p) => p.id === 'review').back_to, undefined);
  assert.equal(phases.find((p) => p.id === 'first_use').back_to, 'build');
  assert.notEqual(phases.find((p) => p.id === 'first_use').user, true);
});

test('the skills and the README say what the loop says (3.6.0)', () => {
  assert.ok(TEXTS.createPlan.includes('**Corrections.**'), 'create-plan: the Corrections bullet');
  assert.ok(TEXTS.createPlan.includes('check and publish'), 'create-plan: check and publish');
  assert.ok(TEXTS.getContext.includes('is no re-planning'), 'get-context: a correction is no re-planning');
  assert.ok(TEXTS.docs.includes("as Claude's checklist"), "docs-management: the first-use lines are Claude's checklist");
  assert.ok(TEXTS.readme.includes('check and publish (you)'), 'README: the loop ends with check and publish (you)');
  assert.ok(TEXTS.createPlan.includes('then sample data, the real clock'), 'create-plan: an app is tried empty, then with data, with the real clock');
  assert.ok(TEXTS.readme.includes('when the project has versions'), 'README: a release only when the project has versions');
  assert.ok(TEXTS.getContext.includes('**Not for corrections.**'), 'get-context: corrections skip it');
  assert.ok(TEXTS.createPlan.includes('Three rounds in a row with the problem still there'), 'create-plan: one stop rule');
  assert.ok(TEXTS.readme.includes('Three rounds in a row with problems still open'), 'README: the same stop rule');
  assert.ok(TEXTS.createPlan.includes('A red test or a review finding is fixed inside its own phase'), 'create-plan: tests and reviews keep their own loop');
  assert.ok(TEXTS.createPlan.includes('A stage in `test` or `review` does not go back'), 'create-plan: re-planning from test or review is built in place');
  assert.ok(TEXTS.docs.includes('`build`, `test` or `review` phase'), 'docs-management: test runs count in review too');
  assert.ok(TEXTS.readme.includes('red tests and review findings are fixed inside their own phase'), 'README: the same');
});

test('no sentence of the loop before 3.6.0 is left', () => {
  assert.deepEqual(oldLeft(TEXTS), []);
});

test('the check catches an old sentence put back', () => {
  const back = { ...TEXTS, readme: `${TEXTS.readme} review, first use (you see it working)` };
  assert.deepEqual(oldLeft(back), ['readme: first use (you']);
});
