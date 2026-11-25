/*
 * Tests of the plain plan's steps (blueprint/plans/<stage id>.md): the parser, the column in the
 * open stage, a child's ticks read from its own worktree copy, and the four levels (letter, Task,
 * sub-task) with the state of the sub-task in progress.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { nodeState, parseSteps, splitId } from '../plan-steps'
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

test('parseSteps: a «Test (key):» line keeps its key (a command or a test file); a plain «Test:» has none', async () => {
  const keyed = parseSteps('## A. Uno\n- [ ] 1. x\n- Test (npm test -- uno): corso pieno.\n## B. Due\n- [ ] 2. y\n- Test (`due.test.ts`): disdetta.\n## C. Tre\n- [ ] 3. z\n- Test: niente chiave.\n')
  expect(keyed.map(s => s.groups[0]!.test)).toEqual(['corso pieno.', 'disdetta.', 'niente chiave.'])
  expect(keyed.map(s => s.groups[0]!.testKey)).toEqual(['npm test -- uno', 'due.test.ts', undefined])
})

const FOUR = '# Piano\nIntro che non è di nessuno.\n### A. Lettore\nLegge il piano.\n- Test (a.test.tsx): legge.\nTesto dopo il Test, di nessuno.\n#### A1. Livelli\nOgni livello ha un nome.\n- [x] A1.1 Titoli\n  I titoli con il nome.\n- [ ] A1.2 Spiegazioni\nTesto non rientrato, di nessuno.\n#### A2. Stato\n- [ ] A2.1 Risale\n'

test('parseSteps: four levels — letter, Task, sub-task — with their names and plain words', async () => {
  const g = parseSteps(FOUR)[0]!.groups[0]!
  expect(g.title).toBe('A. Lettore')
  expect(g.expl).toBe('Legge il piano.')
  expect(g.steps.map(s => s.text)).toEqual(['A1.1 Titoli', 'A1.2 Spiegazioni', 'A2.1 Risale']) // still flat for the rest of the panel
  expect(g.tasks).toEqual([
    { title: 'A1. Livelli', expl: 'Ogni livello ha un nome.', steps: [{ text: 'A1.1 Titoli', done: true, expl: 'I titoli con il nome.' }, { text: 'A1.2 Spiegazioni', done: false }] },
    { title: 'A2. Stato', steps: [{ text: 'A2.1 Risale', done: false }] },
  ])
  // steps written before the first Task go to a Task with no title
  expect(parseSteps('### A. X\n- [ ] sciolto\n#### A1. Y\n- [ ] A1.1 dentro\n')[0]!.groups[0]!.tasks!.map(t => [t.title, t.steps.length])).toEqual([[undefined, 1], ['A1. Y', 1]])
  // the old format has no tasks
  expect(parseSteps('### A. X\n- [ ] uno\n')[0]!.groups[0]!.tasks).toBeUndefined()
  expect(splitId('A1.2 Spiegazioni')).toEqual({ id: 'A1.2', title: 'Spiegazioni' })
  expect(splitId('A. Lettore')).toEqual({ id: 'A', title: 'Lettore' })
  expect(splitId('Area admin')).toEqual({ title: 'Area admin' })
  expect(splitId('1. Corsi.')).toEqual({ title: '1. Corsi.' })
})

test('nodeState: in progress or stopped if one child is, done if all are, else to do', async () => {
  expect(nodeState(['done', 'running', 'todo'])).toBe('running')
  expect(nodeState(['done', 'stopped'])).toBe('stopped')
  expect(nodeState(['done', 'done'])).toBe('done')
  expect(nodeState(['done', 'todo'])).toBe('todo')
  expect(nodeState([])).toBe('todo')
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

test('a one-letter word is a name only with its dot (#5)', async () => {
  expect(splitId('I test unitari')).toEqual({ title: 'I test unitari' })
  expect(splitId('A new screen')).toEqual({ title: 'A new screen' })
  expect(splitId('A. Lettore')).toEqual({ id: 'A', title: 'Lettore' })
  expect(splitId('A1.2 Titolo')).toEqual({ id: 'A1.2', title: 'Titolo' })
})

test('the plan phase shows the skeleton: letters with their words and no checkbox yet (#4)', async ($, on) => {
  const skeleton = '# Piano\n### A. Scheda\nIn cima al Piano.\n- Test (a.test.tsx): la scheda.\n### B. Albero\nUna pallina per Task.\n- Test (b.test.tsx): le palline.\n'
  const plan = JSON.parse(singleSession())
  plan.stages[2].phase = 'plan'
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': JSON.stringify(plan), 'blueprint/plans/fb.md': skeleton } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  expect([await has(/^○ A Scheda$/), await has(/^In cima al Piano\.$/), await has(/^○ B Albero$/), await has(/^Una pallina per Task\.$/)]).toEqual([true, true, true, true])
  await ui.unmount()
})

test('a letter shows one short line: its first sentence, cut at 90 characters with «…» (3.5.2)', async ($, on) => {
  const long = 'La mod chiede ad Azure quanto costa questo mese ogni risorsa del progetto, e quanto è costata il mese scorso'
  const skeleton = `# Piano\n### A. Costi\nI costi di ogni risorsa, letti da Azure. Lo fa due volte al giorno e quando premi il bottone.\n- Test (a.test.tsx): i costi.\n### B. Attività\n${long}.\n- Test (b.test.tsx): le attività.\n`
  const plan = JSON.parse(singleSession())
  plan.stages[2].phase = 'plan'
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': JSON.stringify(plan), 'blueprint/plans/fb.md': skeleton } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  expect([await has(/^I costi di ogni risorsa, letti da Azure\.$/), await has(/due volte al giorno/)]).toEqual([true, false])
  const cutLine = `${long.slice(0, 89).trimEnd()}…`
  expect([await has(new RegExp(`^${cutLine}$`)), await has(/mese scorso/)]).toEqual([true, false])
  await ui.unmount()
})
