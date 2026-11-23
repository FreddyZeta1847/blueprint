/*
 * Tests of the plain plan's steps (blueprint/plans/<stage id>.md): the parser, the column in the
 * open stage, and a child's ticks read from its own worktree copy.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { parseSteps } from '../plan-steps'
import { engine, MAIN, PANE, defaultFiles } from './harness'

const PLAN = '# Piano — Frontend e backend\n\n## Area admin\n- [x] 1. Corsi e iscritti.\n- [ ] 2. Chiusure.\n- Test: un corso chiuso non si prenota.\n\n## Area clienti\n- [ ] 1. Calendario.\n- [ ] 2. Prenotazione.\n\n## Madre\n- [ ] Unione, test d\'integrazione, prova, PR.\n'
// the child «Area clienti» has ticked its first step in its own worktree copy
const CHILD = PLAN.replace('- [ ] 1. Calendario.', '- [x] 1. Calendario.')

test('parseSteps: sections, their ### groups, checkbox lines, and the «Test:» / «Finita quando:» lines', async () => {
  const s = parseSteps(PLAN)
  expect(s.map(x => x.name)).toEqual(['Area admin', 'Area clienti', 'Madre'])
  expect(s[0]!.groups).toEqual([{ steps: [{ text: '1. Corsi e iscritti.', done: true }, { text: '2. Chiusure.', done: false }], test: 'un corso chiuso non si prenota.' }])
  const grouped = parseSteps('## Area admin\n### A. Corsi\n- [x] 1. Elenco.\n- Finita quando: la reception vede i corsi.\n### B. Chiusure\n- [ ] 2. Chiusura.\n- Done when: closed.\n')
  expect(grouped[0]!.groups).toEqual([
    { title: 'A. Corsi', steps: [{ text: '1. Elenco.', done: true }], doneWhen: 'la reception vede i corsi.' },
    { title: 'B. Chiusure', steps: [{ text: '2. Chiusura.', done: false }], doneWhen: 'closed.' },
  ])
  // a short plan in one session needs no heading: its steps are one nameless section
  expect(parseSteps('# Piano\n- [ ] 1. uno\n- [x] 2. due\n')).toEqual([{ name: '', groups: [{ steps: [{ text: '1. uno', done: false }, { text: '2. due', done: true }] }] }])
  expect(parseSteps('# Piano\n### A\n- [ ] uno\n')[0]!.groups[0]!.title).toBe('A')
  expect(parseSteps('# nothing here\n')).toEqual([])
  // a «Test:» line before the first ### keeps its place, even with no step of its own
  expect(parseSteps('## Area admin\n- Test: tutto.\n### A\n- [ ] uno\n')[0]!.groups[0]).toEqual({ steps: [], test: 'tutto.' })
  const marked = parseSteps('## G. Azure — *con te, prossimo passo*\n- [ ] **Review**: `differential-review` e 2*3 casi, _vedi_ __qui__ [la guida](docs/x.md).\n')
  expect(marked[0]!.name).toBe('G. Azure — con te, prossimo passo')
  expect(marked[0]!.groups[0]!.steps[0]!.text).toBe('Review: differential-review e 2*3 casi, vedi qui la guida.')
})

// a stage built in one session (no independent parts) whose plan has several ## sections: they are
// groups of that one session, not sessions
function singleSession(): string {
  const plan = JSON.parse(defaultFiles()['blueprint/plan.json']!)
  plan.stages[2].independent_parts = []
  return JSON.stringify(plan)
}
const GROUPS = '# Piano\n\n## A. Ambiente ✓\n- [x] Ubuntu con Python.\n- [x] Preprocessore p1.\n\n## B. Dati in ingresso\n- [x] Lettura WAV.\n- [ ] Divisione per sessione.\n- [ ] Alterazioni ripetibili.\n'

test('one session: several ## sections are its groups, one column with one running step, no titles', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': singleSession(), 'blueprint/plans/fb.md': GROUPS } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /^A\. Ambiente ✓$/ })).toBeUndefined() // the groups are in the file, not in the panel
  expect(await ui.find({ text: /^B\. Dati in ingresso$/ })).toBeUndefined()
  expect(await ui.find({ text: /^│ ✓ Ubuntu con Python\.$/ })).toBeDefined()
  expect((await ui.findAll({ text: /^│ ● / })).length).toBe(1)
  expect(await ui.find({ text: /^│ ● Divisione per sessione\.$/ })).toBeDefined()
  await ui.unmount()
})

test('in parallel, ### groups stay inside their session: one column per session, no group titles', async ($, on) => {
  const plan = PLAN.replace('## Area admin\n', '## Area admin\n### Corsi\n').replace('- [ ] 2. Chiusure.', '### Chiusure\n- [ ] 2. Chiusure.')
  engine(on, { files: { ...defaultFiles(), 'blueprint/plans/fb.md': plan } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect((await ui.findAll({ text: /^Area admin · \d+ di \d+$/ })).length).toBe(1) // the session's name with how far it is
  expect(await ui.find({ text: /^Corsi$/ })).toBeUndefined()
  expect(await ui.find({ text: /^│ ● 2\. Chiusure\.$/ })).toBeDefined()
  await ui.unmount()
  const desktop = await $.ui.mount(PANE('desktop'))
  expect(JSON.stringify(await desktop.find({ key: 'steps:fb:0' }))).toContain('2. Chiusure.') // both groups in one column
  await desktop.unmount()
})

test('desktop: each step is real text that wraps to the pane, beside a drawn mark on the session line', async ($, on) => {
  const long = '1. Calendario della settimana e prenotazione dal telefono, sul contratto della tappa quattro.'
  engine(on, { files: { ...defaultFiles(), 'blueprint/plans/fb.md': PLAN.replace('1. Calendario.', long) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop'))
  const text = await ui.find({ type: 'Text', text: long })
  expect(text?.type).toBe('Text') // whole, not cut into lines of a fixed width
  expect(text?.props?.wrap).toBe('wrap')
  expect(JSON.stringify(await ui.find({ key: 'steps:fb:1' }))).toContain('#4FB8A8') // the child's line is teal
  await ui.unmount()
})

test('the open stage shows one column of steps per session; a child\'s ticks come from its worktree', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plans/fb.md': PLAN, '.claude/worktrees/area-clienti/blueprint/plans/fb.md': CHILD } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const terminal = await $.ui.mount(PANE('terminal'))
  expect(await terminal.find({ text: /^Passi$/ })).toBeDefined()
  expect(await terminal.find({ text: /^│ ✓ 1\. Corsi e iscritti\.$/ })).toBeDefined()
  expect(await terminal.find({ text: /^│ ● 2\. Chiusure\.$/ })).toBeDefined() // the first open step is in progress
  expect(await terminal.find({ text: /^│ ✓ 1\. Calendario\.$/ })).toBeDefined() // ticked in the child's own copy
  expect(await terminal.find({ text: /^│ ○ Unione/ })).toBeDefined() // the mother starts only after the children
  expect(await terminal.find({ text: /^│ ● Unione/ })).toBeUndefined()
  expect(await terminal.find({ text: /Test: un corso chiuso/ })).toBeUndefined()
  await terminal.unmount()
  const desktop = await $.ui.mount(PANE('desktop'))
  const child = JSON.stringify(await desktop.find({ key: 'steps:fb:1' }))
  expect(child).toContain('#4FB8A8') // a child's line is teal
  expect(child).toContain('2. Prenotazione.')
  expect(JSON.stringify(await desktop.find({ key: 'steps:fb:2' }))).not.toContain('#4FB8A8') // the mother's is not
  await desktop.unmount()
})

test('no plain plan: no steps part', async ($, on) => {
  engine(on, {})
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /^Passi$/ })).toBeUndefined()
  await ui.unmount()
})

test('once every child has finished its section, the mother\'s first step is in progress', async ($, on) => {
  const all = PLAN.replace(/- \[ \] (1\. Calendario|2\. Prenotazione|2\. Chiusure)/g, '- [x] $1')
  engine(on, { files: { ...defaultFiles(), 'blueprint/plans/fb.md': all } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /^│ ● Unione/ })).toBeDefined()
  await ui.unmount()
})

test('a short plan with no heading still shows its steps in the build phase', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': singleSession(), 'blueprint/plans/fb.md': '# Piano\n- [x] 1. Uno.\n- [ ] 2. Due.\n' } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /^│ ● 2\. Due\.$/ })).toBeDefined()
  await ui.unmount()
})
