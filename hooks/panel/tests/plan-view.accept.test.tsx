/*
 * Acceptance tests of the Piano view (Tasks A1–A3 of the panel plan), written by the mother
 * before the child «vista-piano» starts: the child makes them pass and does not edit them.
 * Contract of element keys: Button `stage:<id>` per stage row; a Box wrapping each Svg (Svg takes no key): `bar:<id>`, `rail:<id>`,
 * `pill:turn:<id>`; Input `note:<id>`. The open stage's phase is also a Text line
 * («Fase: …»), so it reads on every surface. Checked on the terminal and the desktop.
 * The «N figlie» pill needs the sessions part too: it is in integration.accept.test.tsx.
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, PANE, planJson, LONG_NAME, defaultFiles } from './harness'

const SURFACES = ['terminal', 'desktop'] as const

async function open($: any, on: any, world: Parameters<typeof engine>[1] = {}) {
  const seen = engine(on, world)
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  return seen
}

test('A1: one row per stage with its glyph; done stages ticked, no word «fatta»', async ($, on) => {
  await open($, on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(PANE(surface))
    for (const id of ['repo', 'db', 'fb', 'sec', 'end']) expect(await ui.find({ key: `stage:${id}` })).toBeDefined()
    expect((await ui.find({ key: 'stage:repo' }))?.text).toMatch(/✓\s*1\. Repository e struttura/)
    expect((await ui.find({ key: 'stage:fb' }))?.text).toMatch(/●\s*3\. Frontend e backend in parallelo/)
    expect((await ui.find({ key: 'stage:sec' }))?.text).toMatch(/○\s*4\. Controllo di sicurezza/)
    expect(await ui.find({ text: /\bfatta\b/ })).toBeUndefined()
    if (surface === 'desktop') {
      expect(JSON.stringify(await ui.find({ key: 'bar:repo' }))).toContain('<path') // ticked circle
      expect(JSON.stringify(await ui.find({ key: 'bar:sec' }))).not.toContain('<path') // to do: no tick
    }
    await ui.unmount()
  }
})

test('A1: the deadline pill on «Chiusura»; no «tocca a te» while nothing waits', async ($, on) => {
  await open($, on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(PANE(surface))
    if (surface === 'desktop') expect(String((await ui.find({ key: 'stage:end' }))?.text) + JSON.stringify(await ui.findAll({ type: 'Svg' }))).toMatch(/20 nov|2026-11-20/)
    else expect(await ui.find({ text: /20 nov|2026-11-20/ })).toBeDefined()
    expect(await ui.find({ key: 'pill:turn:fb' })).toBeUndefined()
    expect(await ui.find({ text: /tocca a te/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('A1: a very long stage name is cut with «…» on one row', async ($, on) => {
  await open($, on, { files: { ...defaultFiles(), 'blueprint/plan.json': planJson({ longName: true }) } })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(PANE(surface))
    const row = await ui.find({ key: 'stage:sec' })
    expect(row?.text).toContain('…')
    expect(row?.text.includes(LONG_NAME)).toBe(false)
    await ui.unmount()
  }
})

test('A2: the current stage starts open; a press toggles a stage', async ($, on) => {
  await open($, on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(PANE(surface))
    expect(await ui.find({ text: /^Contenuto$/ })).toBeDefined()
    expect(await ui.find({ text: /Area clienti/ })).toBeDefined()
    expect(await ui.find({ text: /costruzione/ })).toBeDefined()
    if (surface === 'desktop') expect(await ui.find({ key: 'rail:fb' })).toBeDefined()
    expect(await ui.find({ text: /git init e repository privato/ })).toBeUndefined()
    await ui.press({ key: 'stage:repo' })
    expect(await ui.find({ text: /git init e repository privato/ })).toBeDefined()
    await ui.press({ key: 'stage:repo' })
    expect(await ui.find({ text: /git init e repository privato/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('A2: an open implementation stage shows how and notes, and no decisions part', async ($, on) => {
  await open($, on)
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /I file che contengono le decisioni/ })).toBeUndefined() // only discussion stages have it
  expect(await ui.find({ text: /Grafica: direzione «salone chiaro»/ })).toBeUndefined() // no list of decisions any more
  expect(await ui.find({ text: /madre \+ 2 figlie/ })).toBeDefined()
  expect(await ui.find({ text: /Provarlo anche sul telefono/ })).toBeDefined()
  await ui.unmount()
})

test('A2: a discussion stage lists the files holding its decisions; a press copies the full path', async ($, on) => {
  const block = '### db-engine — Quale database usa il sito?\n- **Scelta:** SQLite\n- **Stage:** db\n'
  const other = '### porte — Quali porte?\n- **Scelta:** 3001\n- **Stage:** fb\n'
  const seen = await open($, on, { files: { ...defaultFiles(), 'blueprint/decisions.md': undefined, 'blueprint/decisions/foundations/DB/DB.md': block, 'blueprint/decisions/contracts/API.md': other } })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'stage:db' })
  expect(await ui.find({ text: /^I file che contengono le decisioni di questa tappa sono:$/ })).toBeDefined()
  expect((await ui.find({ key: 'decfile:db:0' }))?.text).toContain('blueprint/decisions/foundations/DB/DB.md')
  expect(await ui.find({ key: 'decfile:db:1' })).toBeUndefined() // the other file holds another stage's decision
  await ui.press({ key: 'decfile:db:0' })
  expect(seen.copies).toContain(`${MAIN}/blueprint/decisions/foundations/DB/DB.md`)
  await ui.unmount()
})

test('A2: a discussion stage with no decision yet says where they will go', async ($, on) => {
  await open($, on)
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'stage:db' })
  expect(await ui.find({ text: /nessuno ancora: le decisioni andranno in blueprint\/decisions\.md/ })).toBeDefined()
  await ui.unmount()
})

test('A2: stopped at a phase that needs the user — «… · ferma» and «tocca a te»', async ($, on) => {
  await open($, on, { files: { ...defaultFiles(), 'blueprint/plan.json': planJson({ phase: 'first_use' }) } })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(PANE(surface))
    expect(await ui.find({ text: /prova primo utente · ferma/ })).toBeDefined()
    if (surface === 'desktop') expect(JSON.stringify(await ui.find({ key: 'pill:turn:fb' }))).toContain('tocca a te')
    else expect(await ui.find({ text: /tocca a te/ })).toBeDefined()
    await ui.unmount()
  }
})

test('A2: no card, no decisions, no notes — no summary line, no decisions heading, «Note» stays', async ($, on) => {
  await open($, on, { files: { ...defaultFiles(), 'blueprint/context.md': undefined, 'blueprint/decisions.md': undefined, 'blueprint/notes.json': undefined } })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /I file che contengono le decisioni/ })).toBeUndefined()
  expect(await ui.find({ text: /ritmo|calma|Progetto ·/ })).toBeUndefined()
  expect(await ui.find({ text: /Contenuto/ })).toBeDefined()
  expect(await ui.find({ text: /^Note$/ })).toBeDefined()
  await ui.unmount()
})

test('A2: English labels when the language setting is English', async ($, on) => {
  await open($, on, { language: 'en' })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /^Content$/ })).toBeDefined()
  expect(await ui.find({ text: /^Contenuto$/ })).toBeUndefined()
  await ui.unmount()
})

test('A3: a note typed in the open stage is saved and shown at once', async ($, on) => {
  const seen = await open($, on)
  const ui = await $.ui.mount(PANE('desktop'))
  await ui.input({ key: 'note:fb', text: 'Controllare il login sul telefono' })
  const write = seen.writes.filter(w => w.path === `${MAIN}/blueprint/notes.json`).pop()
  expect(write).toBeDefined()
  const notes = JSON.parse(write!.text).notes
  expect(notes).toContainEqual({ stage: 'fb', text: 'Controllare il login sul telefono', read: false })
  expect(notes).toContainEqual({ stage: 'fb', text: 'Provarlo anche sul telefono', read: false })
  expect(seen.toasts).toContain('nota salvata')
  expect(await ui.find({ text: /Controllare il login sul telefono/ })).toBeDefined()
  await ui.input({ key: 'note:fb', text: '   ' })
  expect(seen.writes.filter(w => w.path === `${MAIN}/blueprint/notes.json`).length).toBe(1)
  await ui.unmount()
})

test('A3: without notes.json the first note creates it', async ($, on) => {
  const seen = await open($, on, { files: { ...defaultFiles(), 'blueprint/notes.json': undefined } })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.input({ key: 'note:fb', text: 'Prima nota' })
  const write = seen.writes.filter(w => w.path === `${MAIN}/blueprint/notes.json`).pop()
  expect(JSON.parse(write!.text)).toEqual({ notes: [{ stage: 'fb', text: 'Prima nota', read: false }] })
  await ui.unmount()
})

test('every stage shows its phases when opened — done, current and to do', async ($, on) => {
  await open($, on)
  const desktop = await $.ui.mount(PANE('desktop'))
  for (const id of ['repo', 'sec']) await desktop.press({ key: `stage:${id}` })
  for (const id of ['repo', 'fb', 'sec']) expect(await desktop.find({ key: `rail:${id}` })).toBeDefined()
  expect(JSON.stringify(await desktop.find({ key: 'rail:repo' }))).toContain('tappa completata')
  expect(JSON.stringify(await desktop.find({ key: 'rail:sec' }))).toContain('da fare')
  await desktop.unmount()
  const terminal = await $.ui.mount(PANE('terminal')) // the open stages are shared with the desktop: «sec» is open here too
  expect(await terminal.find({ text: /^Fasi$/ })).toBeDefined()
  expect(await terminal.find({ text: /○ resoconto/ })).toBeDefined() // the quick task's last phase, still to do
  await terminal.unmount()
})

test('a stage without topics still has content: a line saying what its type is for', async ($, on) => {
  await open($, on)
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'stage:sec' }) // a quick task with no topics
  expect(await ui.find({ text: /Nessun elenco: la tappa è un lavoro unico\. Serve a un lavoro breve/ })).toBeDefined()
  await ui.unmount()
})

test('Legenda: the third tab lists every stage type with its phases, and explains Sessioni', async ($, on) => {
  await open($, on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(PANE(surface))
    await ui.press({ key: 'tab:legenda' })
    expect(await ui.find({ text: /^Le tappe e le loro fasi$/ })).toBeDefined()
    for (const type of ['discussione', 'implementazione', 'consegna', 'attività breve']) expect(await ui.find({ text: new RegExp(`^${type} — `) })).toBeDefined()
    expect(await ui.find({ text: /3\. convergenza · tocca a te — / })).toBeDefined() // a phase that needs the user, read from loops.json
    expect(await ui.find({ text: /3\. prova generale · facoltativa — / })).toBeDefined() // an optional one (in the test's loops it does not need the user)
    expect(await ui.find({ text: /5\. revisione · tocca a te — Claude ti rilegge domanda, scelta e opzioni scartate/ })).toBeDefined()
    expect(await ui.find({ text: /Come funziona Sessioni/ })).toBeDefined()
    expect(await ui.find({ text: /Le fasi si ripetono per ogni argomento/ })).toBeDefined()
    await ui.press({ key: 'tab:piano' })
    await ui.unmount()
  }
})
