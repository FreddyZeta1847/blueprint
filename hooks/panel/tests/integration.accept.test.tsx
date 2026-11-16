/*
 * Integration acceptance tests of the panel: what needs both views and the sessions data.
 * Expected to fail in each child's worktree; the mother makes them pass after the merge.
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, PANE, sessionsWorld } from './harness'

test('the parallel stage carries «2 figlie» and turns amber when a child is blocked', async ($, on) => {
  engine(on, sessionsWorld())
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(PANE(surface))
    if (surface === 'terminal') expect(await ui.find({ text: /2 figlie/ })).toBeDefined()
    else expect(JSON.stringify(await ui.findAll({ type: 'Svg' }))).toContain('2 figlie')
    expect((await ui.find({ key: 'stage:fb' }))?.text).toMatch(/!\s*3\./)
    expect(await ui.find({ text: /costruzione · ferma/ })).toBeDefined()
    await ui.unmount()
  }
})
