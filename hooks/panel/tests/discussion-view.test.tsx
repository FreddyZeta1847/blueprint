/*
 * Tests of the discussion stage (letter C of stage «Il pannello come cruscotto»): each topic with
 * its own small rail of the discussion's phases, the closed stage's caption «argomento 2 di 3:
 * scelta», and the stage's decisions as a list with a padlock or two arrows and who decided.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, PANE, defaultFiles, planJson } from './harness'
import { decisionsFromBlocks, decisionsFromFile } from '../plan-extras'

/** The «db» discussion in progress, before the implementation stage. */
function plan(): string {
  const p = JSON.parse(planJson())
  p.stages[1] = { id: 'db', name: 'Database: scelte', type: 'discussion', status: 'in_progress', topics: [
    { name: 'Tabelle e campi', done: true, phase: 'recap' },
    { name: 'Login cifrato', done: false, phase: 'convergence' },
    { name: 'Backup', done: false },
  ] }
  return JSON.stringify(p)
}
const DECISIONS = '# Decisioni\n\n## Database: scelte\n\n- **PostgreSQL gestito** — difficile da cambiare; Federico; 2026-11-20\n- **Backup ogni notte** — facile da cambiare; Claude; 2026-11-20\n'

test('each topic has its own small rail of the discussion\'s phases', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': plan() } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  // the choice needs the user: the topic waiting there is «!» on its rail
  expect([await has(/^✓✓✓✓✓$/), await has(/^✓✓!○○$/), await has(/^○○○○○$/)]).toEqual([true, true, true])
  await ui.unmount()
  const desktop = await $.ui.mount(PANE('desktop'))
  expect((await desktop.find({ key: 'topic:db:1' })) !== undefined).toBe(true)
  await desktop.unmount()
})

test('the closed discussion says which topic and phase', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': plan() } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'stage:db' }) // the current stage starts open: close it
  expect(await ui.find({ text: /^discussione · argomento 2 di 3: scelta$/ })).toBeDefined()
  await ui.unmount()
})

test('the decisions as a list: padlock or arrows, and who decided', async ($, on) => {
  const p = JSON.parse(plan())
  p.stages[1].status = 'done'
  for (const t of p.stages[1].topics) { t.done = true; t.phase = 'recap' }
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': JSON.stringify(p), 'blueprint/decisions.md': DECISIONS } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'stage:db' }) // done: it opens on its recap
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  expect(await has(/^Decisioni della tappa · 2 scritte · 1 difficili da cambiare$/)).toBe(true)
  expect([await has(/^\[difficile da cambiare\] PostgreSQL gestito$/), await has(/^\[facile da cambiare\] Backup ogni notte$/)]).toEqual([true, true])
  expect([await has(/^tu$/), await has(/^Claude$/)]).toEqual([true, true])
  await ui.unmount()
})

test('who decided, from a bullet or a block', async () => {
  expect(decisionsFromFile(DECISIONS, 'Database: scelte').map(d => d.by)).toEqual(['user', 'claude'])
  const block = '### db — Quale database?\n- **Reversibility:** one-way\n- **Decided by:** user (2026-11-20)\n- **Stage:** db\n'
  expect(decisionsFromBlocks(block, 'db')).toEqual([{ text: 'Quale database?', oneWay: true, by: 'user' }])
})
