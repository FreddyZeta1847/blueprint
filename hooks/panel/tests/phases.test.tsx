/*
 * Tests of the phases (letter D of stage «Il pannello come cruscotto»): no phase of a delivery or a
 * quick task is empty any more — each shows the topics with ✓ ● ○ and what it waits for; the
 * discussion's phases read «scelta» and «rilettura».
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, PANE, defaultFiles, planJson } from './harness'

function plan(stage: object): string {
  const p = JSON.parse(planJson())
  p.stages[2] = stage
  return JSON.stringify(p)
}

test('a delivery: every phase shows its topics and what it waits for', async ($, on) => {
  const delivery = { id: 'fb', name: 'Demo a Marta', type: 'delivery', status: 'in_progress', phase: 'prepare',
    topics: [{ name: 'Scaletta', done: true }, { name: 'Video di riserva', done: false, current: true }, { name: 'Pagina per Marta', done: false }] }
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': plan(delivery) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  expect([await has(/^✓ Scaletta$/), await has(/^○ Pagina per Marta$/), await has(/^Claude prepara i pezzi da mostrare\.$/)]).toEqual([true, true, true])
  for (const [line] of [[/^Una prova completa insieme a te/], [/^La mostri tu/], [/^Claude raccoglie i pareri/]] as RegExp[][]) {
    await ui.press({ key: 'phase-next:fb' })
    expect(await has(line!)).toBe(true)
  }
  await ui.unmount()
})

test('a quick task with no topics: do, check and report still say something', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': plan({ id: 'fb', name: 'Controllo', type: 'quick_task', status: 'in_progress', phase: 'do' }) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  expect(await has(/^Claude fa il lavoro\.$/)).toBe(true)
  await ui.press({ key: 'phase-next:fb' })
  expect(await has(/^Claude controlla il risultato/)).toBe(true)
  await ui.press({ key: 'phase-next:fb' })
  expect(await has(/^Claude ti dice cosa ha trovato/)).toBe(true)
  await ui.unmount()
})

test('the discussion\'s phases read «scelta» and «rilettura», in English «choice» and «read-back»', async ($, on) => {
  const discussion = { id: 'fb', name: 'Basi', type: 'discussion', status: 'in_progress', topics: [{ name: 'Hosting', done: false, phase: 'convergence' }] }
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': plan(discussion) }, language: 'en' })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /^choice · / })).toBeDefined()
  await ui.unmount()
})

test('an implementation stage at the plan phase is stopped for the user (3.5.1)', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': planJson({ phase: 'plan' }) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /piano · ferma/ })).toBeDefined()
  expect(await ui.find({ text: /tocca a te/ })).toBeDefined()
  await ui.unmount()
})
