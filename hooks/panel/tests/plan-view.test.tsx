/*
 * Unit tests of the Piano view's own helpers (cut, shortDate, decisions parsing, notes).
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, PANE } from './harness'

test('debug dump', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  const svgs = (await ui.findAll({ type: "Svg" })).map((s: any) => s.key)
  expect(JSON.stringify([svgs, (await ui.findAll({ type: "Text" })).map((s: any) => s.text)])).toBe("")
  await ui.unmount()
})
