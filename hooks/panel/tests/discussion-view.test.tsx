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
const DECISIONS = '# Decisioni\n\n## Database: scelte\n\n### Dove stanno i dati\n\n- **PostgreSQL gestito** — i dati sono relazionali. Scartati: SQLite, un solo server. Difficile da cambiare; Federico; 2026-11-20\n- **Backup ogni notte** — facile da cambiare; Claude; 2026-11-20\n'

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

test('the decisions as cards: the hard ones by default, the first open with why, rejected, topic and date; filters', async ($, on) => {
  const p = JSON.parse(plan())
  p.stages[1].status = 'done'
  for (const t of p.stages[1].topics) { t.done = true; t.phase = 'recap' }
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': JSON.stringify(p), 'blueprint/decisions.md': DECISIONS } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'stage:db' }) // done: it opens on its recap
  const has = async (re: RegExp) => (await ui.find({ text: re })) !== undefined
  expect(await has(/^Decisioni della tappa · 2 scritte · 1 difficili da cambiare$/)).toBe(true)
  expect([await has(/^Tutte 2$/), await has(/^Difficili 1$/), await has(/^Tue 1$/), await has(/^Di Claude 1$/)]).toEqual([true, true, true, true])
  // the hard one, open: its words, what was rejected, the topic and the date
  expect([await has(/^PostgreSQL gestito$/), await has(/^ tu $/), await has(/^i dati sono relazionali\.$/)]).toEqual([true, true, true])
  expect([await has(/^Scartati: SQLite, un solo server$/), await has(/^Dove stanno i dati · decisa da te il 20 nov$/)]).toEqual([true, true])
  // the easy one is hidden by the filter, with «mostrale»
  expect([await has(/^Backup ogni notte$/), await has(/^Altre 1 non sono in questo filtro:$/)]).toEqual([false, true])
  await ui.press({ key: 'decshowall:db' })
  expect([await has(/^Backup ogni notte$/), await has(/^ C $/)]).toEqual([true, true])
  await ui.press({ key: 'decopen:db:Dove stanno i dati:PostgreSQL gestito' }) // shut the first card
  expect(await has(/^i dati sono relazionali\.$/)).toBe(false)
  await ui.press({ key: 'decfilter:db:claude' })
  expect([await has(/^PostgreSQL gestito$/), await has(/^Backup ogni notte$/)]).toEqual([false, true])
  await ui.unmount()
})

test('who decided, from a bullet or a block', async () => {
  expect(decisionsFromFile(DECISIONS, 'Database: scelte').map(d => d.by)).toEqual(['user', 'claude'])
  const block = '### db — Quale database?\n- **Reversibility:** one-way\n- **Decided by:** user (2026-11-20)\n- **Why:** relazionali\n- **Rejected:** MongoDB\n- **Stage:** db\n'
  expect(decisionsFromBlocks(block, 'db')).toEqual([{ text: 'Quale database?', oneWay: true, by: 'user', why: 'relazionali', rejected: 'MongoDB', date: '2026-11-20' }])
  // review round 1: the documented «; decided by Claude; date», and decisions found in code, are never «tu»
  expect(decisionsFromFile('## X\n- **a** — r; decided by Claude; 2026-11-20\n- **b** — r; one-way; 2026-11-20\n', 'X').map(d => d.by)).toEqual(['claude', undefined])
  expect(decisionsFromBlocks('### a — Q?\n- **Decided by:** discovery\n- **Stage:** db\n', 'db')[0]!.by).toBeUndefined()
})

test('review round 2: the real ways the decisions file is written', async () => {
  const file = '## X\n' +
    '- **Nella fase test due cose insieme** — l\'elenco e la frazione («A. Ambiente · 14 di 14»). Federico, guardando il pannello di Mote; 2026-11-23\n' +
    '- **Nomi più chiari** — «convergenza» si mostra come «scelta» (non si confonde con la revisione del codice); i nomi interni restano. Claude; 2026-11-24\n' +
    '- **La scelta passa dalla chat** — «Scelgo B» manda il messaggio. Scartati: il pulsante che scrive nel file. Claude, approvato da Federico; 2026-11-24\n' +
    '- **Le proposte valgono anche altrove** (mockup 4, 5, 6). Federico; 2026-11-24\n' +
    '- **Dettagli** — barra di stato; tasti dentro il pannello. Facili da cambiare; Claude; 2026-11-16\n'
  const d = decisionsFromFile(file, 'X')
  expect(d.map(x => x.by)).toEqual(['user', 'claude', 'claude', 'user', 'claude'])
  expect(d[1]!.why).toBe('«convergenza» si mostra come «scelta» (non si confonde con la revisione del codice); i nomi interni restano.')
  expect(d[2]!.rejected).toBe('il pulsante che scrive nel file')
  expect(d[3]!.why).toBe('(mockup 4, 5, 6).')
  expect(d[4]!.why).toBe('barra di stato; tasti dentro il pannello.')
  const block = '### a — Q?\n- **Alternative scartate:** MongoDB — dati relazionali\n- **Deciso da:** scoperta (2026-11-20)\n- **Tappa:** db\n'
  expect(decisionsFromBlocks(block, 'db')[0]).toMatchObject({ rejected: 'MongoDB — dati relazionali', date: '2026-11-20' })
  expect(decisionsFromBlocks(block, 'db')[0]!.by).toBeUndefined()
})

test('review round 3: a short why is no author; a note after the date; same titles in different topics', async () => {
  const d = decisionsFromFile('## X\n- **Backup** — ogni notte alle 3; 2026-11-20\n- **Cerchio** — x. Federico, guardando; 2026-11-16 (all\'apertura della Costruzione)\n', 'X')
  expect(d[0]).toMatchObject({ why: 'ogni notte alle 3', date: '2026-11-20' })
  expect(d[0]!.by).toBeUndefined()
  expect(d[1]).toMatchObject({ by: 'user', date: '2026-11-16', why: 'x.' })
})
