/*
 * Tests of the test phase view (group D of stage «Test e revisione», mockup 2 «Barre»): the total,
 * the failed tests by name, every group with its fraction and words, no session names, «*» for a
 * number Claude wrote, «—» for a group with no result, and the newest result winning per group.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, PANE, defaultFiles, planJson } from './harness'

const STEPS = '# Piano\n\n## Area admin\n### A. Corsi\n- [x] 1. Elenco.\n- Test (npm test -- corsi): un corso chiuso non si prenota.\n### B. Disdetta\n- [x] 2. Disdetta.\n- Test (disdetta.test.ts): disdetta a 1 ora rifiutata.\n\n## Area clienti\n### C. Calendario\n- [x] 1. Calendario.\n- Test (calendario.test.ts): settimana che cambia.\n\n## Madre\n### D. Integrazione\n- [ ] Unione.\n- Test (npm run e2e): le due parti insieme.\n'
const r = (passed: number, total: number, at: string, extra: object = {}) => ({ passed, total, failed: [], source: 'seen', at: `2026-11-16T${at}:00.000Z`, ...extra })
const MAIN_RUN = JSON.stringify({ v: 1, groups: {
  'A. Corsi': r(14, 14, '09:50'),
  'B. Disdetta': r(9, 10, '09:51', { failed: ['il secondo in lista prende il posto'] }),
} })
// a child ran its groups earlier: its older A loses to the main session's, its C stays, told
const CHILD_RUN = JSON.stringify({ v: 1, groups: { 'A. Corsi': r(3, 14, '08:00'), 'C. Calendario': r(4, 4, '08:10', { source: 'told' }) } })

async function open($: any, on: any, files: Record<string, string> = {}) {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': planJson({ phase: 'test' }), 'blueprint/plans/fb.md': STEPS, ...files } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
}

test('the test phase: total, failed tests by name, each group with its fraction; no sessions', async ($, on) => {
  await open($, on, { 'blueprint/checks/fb--main.json': MAIN_RUN, 'blueprint/checks/fb--area-clienti.json': CHILD_RUN })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount(PANE(surface))
    expect(await ui.find({ text: /^ · ultima esecuzione alle \d\d:\d\d$/ })).toBeDefined()
    expect(await ui.find({ text: /^27 di 28$/ })).toBeDefined()
    expect(await ui.find({ text: /^1 fallito in B\. Disdetta: «il secondo in lista prende il posto»$/ })).toBeDefined()
    expect(await ui.find({ text: /^14\/14$/ })).toBeDefined() // the main session's newer A wins over the child's 3/14
    expect(await ui.find({ text: /^9\/10$/ })).toBeDefined()
    expect(await ui.find({ text: /^4\/4 \*$/ })).toBeDefined()
    expect(await ui.find({ text: /^—$/ })).toBeDefined() // D has not run
    expect(await ui.find({ text: /^disdetta a 1 ora rifiutata\.$/ })).toBeDefined()
    expect(await ui.find({ text: /^\* dichiarato: / })).toBeDefined()
    expect(await ui.find({ text: /Area admin|Area clienti|Madre/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('the test phase with no results yet: every group with «—», no total', async ($, on) => {
  await open($, on)
  const ui = await $.ui.mount(PANE('desktop'))
  expect((await ui.findAll({ text: /^—$/ })).length).toBe(4)
  expect(await ui.find({ type: 'Text', text: /^\d+ di \d+$/ })).toBeUndefined()
  await ui.unmount()
})
