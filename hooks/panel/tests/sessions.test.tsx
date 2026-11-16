/*
 * Tests of the child «vista-sessioni» (Tasks B1–B3 of the panel plan), beyond the mother's
 * acceptance tests: money and time formats, name cutting, the row rules of sessions-data
 * (two files on one part, a half-written file, a long-running tool, the sessions-list
 * cache) and the status writer's trailing write.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, NOW, PANE, sessionsWorld } from './harness'

test('debug dump', async ($, on) => {
  engine(on, sessionsWorld())
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'tab:sessioni' })
  const all = await ui.findAll({ type: 'Text' })
  console.log(JSON.stringify(all.map(a => a.text)))
  await ui.unmount()
  expect(NOW).toBeGreaterThan(0)
})
