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

test('parseSteps: sections and their checkbox lines; tests and other lines are not steps', async () => {
  const s = parseSteps(PLAN)
  expect(s.map(x => x.name)).toEqual(['Area admin', 'Area clienti', 'Madre'])
  expect(s[0]!.steps).toEqual([{ text: '1. Corsi e iscritti.', done: true }, { text: '2. Chiusure.', done: false }])
  expect(parseSteps('# nothing\n- [ ] orphan\n')).toEqual([])
})

test('the open stage shows one column of steps per session; a child\'s ticks come from its worktree', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plans/fb.md': PLAN, '.claude/worktrees/area-clienti/blueprint/plans/fb.md': CHILD } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const terminal = await $.ui.mount(PANE('terminal'))
  expect(await terminal.find({ text: /^Passi$/ })).toBeDefined()
  expect(await terminal.find({ text: /^│ ✓ 1\. Corsi e iscritti\.$/ })).toBeDefined()
  expect(await terminal.find({ text: /^│ ● 2\. Chiusure\.$/ })).toBeDefined() // the first open step is in progress
  expect(await terminal.find({ text: /^│ ✓ 1\. Calendario\.$/ })).toBeDefined() // ticked in the child's own copy
  expect(await terminal.find({ text: /^│ ○ Unione/ })).toBeUndefined() // the mother's first open step is in progress, not todo
  expect(await terminal.find({ text: /^│ ● Unione/ })).toBeDefined()
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
