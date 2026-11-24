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
  expect(await ui.find({ text: /^differential-review$/ })).toBeDefined()
  expect(await ui.find({ text: /^ponytail-review$/ })).toBeDefined()
  expect(await ui.find({ text: /^niente$/ })).toBeDefined() // a tool that found nothing
  expect(await ui.find({ text: /^alta$/ })).toBeDefined()
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
  expect(await ui.find({ text: /^Nessun problema aperto · giro 1 di 3$/ })).toBeDefined()
  expect(await ui.find({ key: 'fix-all' })).toBeUndefined()
  await ui.unmount()
  seen.files['blueprint/reviews/fb.json'] = reviews({ round: 3 })
  ui = await $.ui.mount(PANE('desktop'))
  expect(await ui.find({ text: /^Giro 3 di 3 con problemi ancora aperti: tocca a te\.$/ })).toBeDefined()
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
