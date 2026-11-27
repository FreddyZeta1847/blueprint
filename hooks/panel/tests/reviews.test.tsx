/*
 * Tests of the review phase (groups E and F of stage «Test e revisione»): findings grouped by tool
 * with «Correggi» each and «Correggi tutto ora»; a press sends one prompt and marks the findings
 * sent; no open finding, no banner; round 3 with open findings is the user's turn, no button; the
 * 30-second countdown in the banner and the status line, one prompt at 0 and never a second one,
 * only for a round written while the session is open, and from one session only.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, NOW, PANE, defaultFiles, planJson } from './harness'

const reviews = (opts: { round?: number; agoS?: number; status?: string } = {}) => JSON.stringify({
  v: 1, round: opts.round ?? 1, foundAt: new Date(NOW - (opts.agoS ?? 10) * 1000).toISOString(),
  tools: ['/code-review', 'differential-review', 'ponytail-review'],
  findings: [
    { id: 'f1', tool: 'differential-review', severity: 'high', text: 'La disdetta non controlla il socio.', status: opts.status ?? 'open' },
    { id: 'f2', tool: '/code-review', severity: 'medium', text: 'Il posto viene dato due volte.', status: opts.status ?? 'open' },
  ],
})

/** A round with open findings after past rounds, each with one finding (none for the rounds in `clean`). */
const withPast = (round: number, past: number[], clean: number[] = []) => {
  const r = JSON.parse(reviews({ round }))
  r.history = past.map(n => ({ round: n, findings: clean.includes(n) ? [] : [{ id: `p${n}`, tool: '/code-review', severity: 'low', text: `Giro ${n}.`, status: 'fixed' }] }))
  return JSON.stringify(r)
}

async function open($: any, on: any, text: string) {
  const seen = engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': planJson({ phase: 'review' }), 'blueprint/reviews/fb.json': text } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  return seen
}
const saved = (seen: any) => JSON.parse(seen.files['blueprint/reviews/fb.json']).findings.map((f: any) => f.status)

test('findings by tool, each with «Correggi»; one press sends one prompt and marks it sent', async ($, on) => {
  const seen = await open($, on, reviews())
  const ui = await $.ui.mount(PANE('desktop'))
  // already there when the session started: no countdown, it waits for a press
  expect(await ui.find({ text: /^2 problemi · premi «Correggi» o «Correggi tutto ora»$/ })).toBeDefined()
  // one list from the most severe down, «trovato da» under each, the tools that ran at the end
  expect(await ui.find({ text: /^trovato da: differential-review$/ })).toBeDefined()
  // the dashboard: how many in this round, fixed and open, and who found them
  expect([await ui.find({ text: /^2 problemi nel giro 1$/ }), await ui.find({ text: /^0 corretti · 2 aperti$/ }), await ui.find({ text: /^Chi li ha trovati$/ })].every(Boolean)).toBe(true)
  expect([await ui.find({ text: /^ponytail-review$/ }), await ui.find({ text: /^niente$/ })].every(Boolean)).toBe(true) // a tool that found nothing
  expect(await ui.find({ text: /^alta$/ })).toBeDefined()
  const order = JSON.stringify(await ui.find({ type: 'Box', text: /La disdetta[\s\S]*Il posto/ }))
  expect(order.length > 0).toBe(true) // high (the cancel check) comes before medium (the seat)
  const all = JSON.stringify(await ui.findAll({ text: /^(alta|media|bassa)$/ }))
  expect(all.includes('#E5AC52')).toBe(false) // no amber among the severities
  await ui.press({ key: 'fix:f2' })
  expect(seen.prompts.length).toBe(1)
  expect(seen.prompts[0]).toMatch(/Il posto viene dato due volte\. \(f2\)/)
  expect(seen.prompts[0]).not.toMatch(/f1/)
  expect(saved(seen)).toEqual(['open', 'sent'])
  await ui.press({ key: 'fix-all' })
  expect(seen.prompts.length).toBe(2)
  expect(seen.prompts[1]).toMatch(/\(f1\)/)
  expect(saved(seen)).toEqual(['sent', 'sent'])
  await ui.unmount()
})

test('no open finding: no banner, the round line; round 3 with open findings: your turn, no button', async ($, on) => {
  const seen = await open($, on, reviews({ status: 'fixed' }))
  let ui = await $.ui.mount(PANE('desktop'))
  // every finding fixed: say how many were found and fixed, and what each tool found (not «niente»)
  expect(await ui.find({ text: /^2 problemi trovati, tutti corretti · giro 1$/ })).toBeDefined()
  expect(await ui.find({ text: /^2 corretti · 0 aperti$/ })).toBeDefined()
  expect(await ui.find({ key: 'fix-all' })).toBeUndefined()
  expect(await ui.find({ text: /^La disdetta non controlla il socio\.$/ })).toBeUndefined() // fixed ones behind a button
  await ui.press({ key: 'fixed:fb' })
  expect(await ui.find({ text: /^La disdetta non controlla il socio\.$/ })).toBeDefined()
  expect((await ui.findAll({ text: /^✓ corretto$/ })).length).toBe(2)
  expect(await ui.find({ key: 'fix:f1' })).toBeUndefined() // nothing to fix any more
  await ui.unmount()
  seen.files['blueprint/reviews/fb.json'] = withPast(3, [1, 2])
  ui = await $.ui.mount(PANE('desktop'))
  expect(await ui.find({ text: /^Tre giri di fila con problemi ancora aperti: tocca a te\.$/ })).toBeDefined()
  expect(await ui.find({ key: 'fix:f1' })).toBeUndefined()
  await seen.clock.advance(40_000)
  expect(seen.prompts).toEqual([])
  await ui.unmount()
})

test('a round already there when the session starts never fixes itself, whatever its own clock says', async ($, on) => {
  const seen = await open($, on, reviews({ agoS: -3600 })) // a cloned project could write any time
  await seen.clock.advance(120_000)
  expect(seen.prompts).toEqual([])
})

test('the countdown of a round written during the session: status line, one prompt at 30 s, never a second one', async ($, on) => {
  const seen = await open($, on, reviews({ status: 'fixed' }))
  seen.files['blueprint/reviews/fb.json'] = reviews({ round: 2, agoS: 999 }) // its own time does not matter
  await seen.clock.advance(5_000) // the next refresh sees it
  expect(seen.status.at(-1)).toBe('Blueprint · 2 problemi, correzione tra 30 s')
  await seen.clock.advance(20_000)
  expect(seen.prompts).toEqual([])
  await seen.clock.advance(11_000)
  expect(seen.prompts.length).toBe(1)
  expect(seen.prompts[0]).toMatch(/\(f1\)[\s\S]*\(f2\)/)
  expect(saved(seen)).toEqual(['sent', 'sent'])
  await seen.clock.advance(30_000)
  const ui = await $.ui.mount(PANE('desktop'))
  expect(seen.prompts.length).toBe(1)
  expect(await ui.find({ text: /^2 problemi · correzione in corso$/ })).toBeDefined()
  await ui.unmount()
})

test('a round another session has claimed is not sent again from here', async ($, on) => {
  const seen = await open($, on, reviews({ status: 'fixed' }))
  seen.files['blueprint/reviews/fb.r2.sent-by'] = 'another-session'
  seen.files['blueprint/reviews/fb.json'] = reviews({ round: 2 })
  await seen.clock.advance(45_000)
  expect(seen.prompts).toEqual([])
})

test('the ring of the countdown shows only while a countdown runs', async ($, on) => {
  const seen = await open($, on, reviews({ status: 'fixed' }))
  let ui = await $.ui.mount(PANE('desktop'))
  expect(await ui.find({ key: 'ring' })).toBeUndefined()
  await ui.unmount()
  seen.files['blueprint/reviews/fb.json'] = reviews({ round: 2 })
  await seen.clock.advance(5_000)
  ui = await $.ui.mount(PANE('desktop'))
  expect(JSON.stringify(await ui.find({ key: 'ring' }))).toContain('stroke-dasharray')
  await ui.unmount()
})

test('in the review phase with no findings file yet, the tools are at work — not «not started»', async ($, on) => {
  engine(on, { files: { ...defaultFiles(), 'blueprint/plan.json': planJson({ phase: 'review' }) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /^Gli strumenti di revisione stanno lavorando/ })).toBeDefined()
  expect(await ui.find({ text: /^La revisione non è ancora partita/ })).toBeUndefined()
  await ui.unmount()
})

test('past rounds add up: «4 problemi in 2 giri», the fixed ones of round 1 behind the button', async ($, on) => {
  const two = JSON.parse(reviews({ round: 2 }))
  two.history = [{ round: 1, foundAt: '2026-11-16T09:00:00.000Z', tools: ['/code-review'], findings: [
    { id: 'f1', tool: '/code-review', severity: 'medium', text: 'Vecchio problema uno.', status: 'fixed' },
    { id: 'f2', tool: '/code-review', severity: 'low', text: 'Vecchio problema due.', status: 'fixed' },
  ] }]
  await open($, on, JSON.stringify(two))
  const ui = await $.ui.mount(PANE('desktop'))
  expect([await ui.find({ text: /^4 problemi in 2 giri$/ }), await ui.find({ text: /^2 corretti · 2 aperti$/ })].every(Boolean)).toBe(true)
  expect(await ui.find({ text: /^Vecchio problema uno\.$/ })).toBeUndefined()
  await ui.press({ key: 'fixed:fb' })
  expect(await ui.find({ text: /^Vecchio problema uno\.$/ })).toBeDefined()
  expect(JSON.stringify(await ui.find({ key: 'review-tool:/code-review' }))).toContain('#E5AC52') // found again this round: an amber part
  await ui.unmount()
})

test('a past round\'s finding still open is listed (without «Correggi»); one round of findings is titled with its own round', async ($, on) => {
  const r = JSON.parse(reviews({ round: 2, status: 'fixed' }))
  r.findings = []
  r.history = [{ round: 1, findings: [{ id: 'old', tool: '/code-review', severity: 'low', text: 'Rimasto aperto.', status: 'open' }] }]
  await open($, on, JSON.stringify(r))
  const ui = await $.ui.mount(PANE('desktop'))
  expect([await ui.find({ text: /^Rimasto aperto\.$/ }), await ui.find({ text: /^1 problema nel giro 1$/ })].every(Boolean)).toBe(true)
  expect(await ui.find({ key: 'fix:old' })).toBeUndefined()
  await ui.unmount()
})

test('a correction\'s review does not inherit the stage\'s old rounds: after a clean round the count starts again (3.6.0, review round 1)', async ($, on) => {
  const seen = await open($, on, withPast(3, [1, 2], [2]))
  const ui = await $.ui.mount(PANE('desktop'))
  expect(await ui.find({ text: /^Tre giri di fila con problemi ancora aperti: tocca a te\.$/ })).toBeUndefined()
  expect(await ui.find({ key: 'fix:f1' })).toBeDefined()
  await ui.unmount()
  seen.files['blueprint/reviews/fb.json'] = withPast(5, [1, 2, 3, 4], [2])
  const again = await $.ui.mount(PANE('desktop'))
  expect(await again.find({ text: /^Tre giri di fila con problemi ancora aperti: tocca a te\.$/ })).toBeDefined()
  await again.unmount()
})
