/*
 * Tests of the «Adesso» card (letter A of stage «Il pannello come cruscotto»): Claude at work on a
 * sub-task, your turn with what to do, failed tests and open review findings as buttons that open
 * the right phase, nothing to say with every stage done, English labels, a long line cut, a
 * discussion and a quick task with no topics. The main session's activity lives in the engine's
 * copy of activity.ts, which a test cannot reach while a tool call runs: it is checked in the app.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, PANE, defaultFiles, planJson } from './harness'

const FOUR = '# Piano\n### A. Corsi\n- Test (npm test -- corsi): corsi.\n#### A1. Elenco\n- [x] A1.1 Elenco dei corsi\n- [ ] A1.2 Posti liberi su ogni corso\n'

function plan(change: (p: any) => void = () => {}): string {
  const p = JSON.parse(planJson())
  p.stages[2].independent_parts = []
  change(p)
  return JSON.stringify(p)
}
async function mount($: any, on: any, files: Record<string, string>, extra: object = {}) {
  const seen = engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': plan(), 'blueprint/plans/fb.md': FOUR, ...files }, ...extra })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  return { seen, ui, has }
}

test('Claude at work: «Adesso» and the sub-task in progress', async ($, on) => {
  const { ui, has } = await mount($, on, {})
  expect([await has(/^Adesso$/), await has(/^Sessione principale · A1\.2 Posti liberi su ogni corso/)]).toEqual([true, true])
  expect(await has(/^Tocca a te$/)).toBe(false)
  await ui.unmount()
})

test('your turn: «Tocca a te» with what to do', async ($, on) => {
  const { ui, has } = await mount($, on, { 'blueprint/plan.json': plan(p => { p.stages[2].phase = 'integrate' }) })
  expect([await has(/^Tocca a te$/), await has(/^Tocca a te: controllo e pubblicazione$/)]).toEqual([true, true])
  await ui.unmount()
})

test('a failed test group and open findings are buttons that open the right phase', async ($, on) => {
  const checks = JSON.stringify({ v: 1, groups: { 'A. Corsi': { passed: 2, total: 3, failed: ['x'], source: 'seen', at: '2026-11-16T09:00:00.000Z' } } })
  const reviews = JSON.stringify({ v: 1, round: 1, foundAt: '2026-11-16T09:00:00.000Z', findings: [{ id: 'f1', tool: 't', severity: 'low', text: 'x', status: 'open' }, { id: 'f2', tool: 't', severity: 'low', text: 'y', status: 'open' }] })
  const { ui, has } = await mount($, on, { 'blueprint/checks/fb--main.json': checks, 'blueprint/reviews/fb.json': reviews })
  expect([await has(/^✕ 1 test fallito in A$/), await has(/^! 2 problemi della revisione$/)]).toEqual([true, true])
  await ui.press({ key: 'now:fb:test:A. Corsi' })
  expect(await has(/^test · da fare$/)).toBe(true) // the stage looks at its test phase
  await ui.unmount()
})

test('every stage done: no card', async ($, on) => {
  const { ui, has } = await mount($, on, { 'blueprint/plan.json': plan(p => { for (const s of p.stages) { s.status = 'done'; s.phase = undefined } }) })
  expect([await has(/^Adesso$/), await has(/^Tocca a te$/)]).toEqual([false, false])
  await ui.unmount()
})

test('English labels, and a very long sub-task cut with «…»', async ($, on) => {
  const long = FOUR.replace('Posti liberi su ogni corso', 'x'.repeat(200))
  const { ui, has } = await mount($, on, { 'blueprint/plans/fb.md': long }, { language: 'en' })
  expect(await has(/^Now$/)).toBe(true)
  expect(await has(/^Main session · A1\.2 x+…$/)).toBe(true)
  await ui.unmount()
})

test('a discussion says which topic and phase; a quick task with no topics still one line', async ($, on) => {
  const discussion = plan(p => {
    p.stages[2] = { id: 'fb', name: 'Basi', type: 'discussion', status: 'in_progress', topics: [{ name: 'Hosting', done: true, phase: 'recap' }, { name: 'Database', done: false, phase: 'proposal' }] }
  })
  let m = await mount($, on, { 'blueprint/plan.json': discussion })
  expect(await m.has(/^Sessione principale · argomento 2 di 2 · Database · proposta/)).toBe(true)
  await m.ui.unmount()
  const quick = plan(p => { p.stages[2] = { id: 'fb', name: 'Controllo', type: 'quick_task', status: 'in_progress', phase: 'check' } })
  m.seen.files['blueprint/plan.json'] = quick
  await m.seen.clock.advance(5000)
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /^Sessione principale · controllo/ })).toBeDefined()
  await ui.unmount()
})
