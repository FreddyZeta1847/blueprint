/*
 * Tests of the work tree (stage «Albero del lavoro»): a plain plan in four levels is drawn as
 * session → letter → Task → sub-task in the build phase; the sub-task in progress colours its
 * Task, letter and session (blue, or «!» when the session waits for the user); the plain words show
 * only on that path; the Task in progress is open, the others open and shut with their button; a
 * Task with no sub-task has no button; the old format keeps its column.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, PANE, defaultFiles, sessionsWorld } from './harness'

const FOUR = '# Piano\n### A. Lettore\nLegge il piano.\n- Test (a.test.tsx): legge.\n#### A1. Livelli\nOgni livello ha un nome.\n- [x] A1.1 Titoli\n  I titoli con il nome.\n- [ ] A1.2 Spiegazioni\n  Le righe sotto i titoli.\n#### A2. Stato\nLo stato risale.\n- [ ] A2.1 Risale\n### B. Albero\n#### B1. Righe\n#### B2. Vuoto\n- [ ] B2.1 Qualcosa\n'

function single(): string {
  const plan = JSON.parse(defaultFiles()['blueprint/plan.json']!)
  plan.stages[2].independent_parts = []
  return JSON.stringify(plan)
}

test('one session: the tree, the path in progress in blue, plain words only on it', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': single(), 'blueprint/plans/fb.md': FOUR } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  expect(await has(/^Passi · 1 di 4$/)).toBe(true)
  expect([await has(/^● Sessione principale$/), await has(/^1 di 4$/)]).toEqual([true, true])
  expect([await has(/^● A Lettore$/), await has(/^▾ 0\/2$/), await has(/^Legge il piano\.$/)]).toEqual([true, true, true])
  expect([await has(/^● A1 Livelli$/), await has(/^Ogni livello ha un nome\.$/)]).toEqual([true, true])
  expect([await has(/^✓ A1\.1 Titoli$/), await has(/^I titoli con il nome\.$/)]).toEqual([true, false]) // done: no words
  expect([await has(/^● A1\.2 Spiegazioni$/), await has(/^Le righe sotto i titoli\.$/)]).toEqual([true, true])
  expect([await has(/^○ A2 Stato$/), await has(/^Lo stato risale\.$/), await has(/A2\.1 Risale/)]).toEqual([true, false, false]) // shut
  expect([await has(/^○ B Albero$/), await has(/^○ B1 Righe$/)]).toEqual([true, true])
  expect(await ui.find({ key: 'task:fb::B1' })).toBeUndefined() // no sub-task, no button
  expect(await has(/^Test/)).toBe(false)
  await ui.unmount()
})

test('a Task\'s button opens and shuts its sub-tasks', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': single(), 'blueprint/plans/fb.md': FOUR } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  expect([await has(/^▾ 2$/), await has(/^▸ 1$/)]).toEqual([true, true])
  await ui.press({ key: 'task:fb::A2' })
  expect(await has(/^○ A2\.1 Risale$/)).toBe(true)
  await ui.press({ key: 'task:fb::A1' })
  expect(await has(/^● A1\.2 Spiegazioni$/)).toBe(false)
  await ui.press({ key: 'task:fb::A1' })
  expect(await has(/^● A1\.2 Spiegazioni$/)).toBe(true)
  // a letter is open by default; its button shuts it and opens it again
  await ui.press({ key: 'task:fb::letter:A. Lettore' })
  expect([await has(/^● A Lettore$/), await has(/^▸ 0\/2$/), await has(/A1 Livelli/)]).toEqual([true, true, false])
  await ui.press({ key: 'task:fb::letter:A. Lettore' })
  expect(await has(/^● A1 Livelli$/)).toBe(true)
  await ui.unmount()
})

test('children: the one waiting for the user is «!» up to its session, the plain words on its path', async ($, on) => {
  const plan = '# Piano\n## Area admin\n### A. Corsi\n#### A1. Elenco\n- [x] A1.1 Elenco\n## Area clienti\n### C. Calendario\n#### C1. Settimana\nLa settimana del socio.\n- [ ] C1.1 Settimana\n  Sette colonne.\n## Madre\n### M. Unione\n#### M1. Unione\n- [ ] M1.1 Unione\n'
  const world = sessionsWorld()
  engine(on, { ...world, files: { ...world.files, 'blueprint/plans/fb.md': plan } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  expect([await has(/^✓ Area admin$/), await has(/^✓ A Corsi$/)]).toEqual([true, true])
  expect([await has(/^! Area clienti$/), await has(/^! C Calendario$/), await has(/^! C1 Settimana$/), await has(/^! C1\.1 Settimana$/)]).toEqual([true, true, true, true])
  expect([await has(/^La settimana del socio\.$/), await has(/^Sette colonne\.$/)]).toEqual([true, true])
  expect([await has(/^○ Madre$/), await has(/^○ M1 Unione$/)]).toEqual([true, true]) // the mother waits for the children
  await ui.unmount()
  const desktop = await $.ui.mount(PANE('desktop'))
  expect(JSON.stringify(await desktop.find({ key: 'tree:fb' }))).toContain('#E5AC52') // the amber mark
  await desktop.unmount()
})

test('the plan phase shows the same tree, nothing in progress', async ($, on) => {
  const plan = JSON.parse(single())
  plan.stages[2].phase = 'plan'
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': JSON.stringify(plan), 'blueprint/plans/fb.md': FOUR } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /^○ A1 Livelli$/ })).toBeDefined()
  expect(await ui.find({ text: /^● (Sessione principale|A |A1 |A1.2 )/ })).toBeUndefined()
  await ui.unmount()
})
