/*
 * Tests of the main session's activity (stage «Il pannello come cruscotto», review rounds 1 and 2):
 * overlapping calls keep the one still running, a subagent's call is not the session's, and the
 * session is still only once no call is left. The hook is called directly with a fake clock.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { activity, track } from '../activity'

test('two calls overlap: when the short one ends first, the long one is still shown; idle only after both', async () => {
  let t = 1000
  const $: any = { clock: { now: async () => t } }
  let endShort!: () => void, endLong!: () => void
  const long = track($, { tool: 'Bash' }, () => new Promise<void>(r => { endLong = r }))
  t = 2000
  const short = track($, { tool: 'Read' }, () => new Promise<void>(r => { endShort = r }))
  await Promise.resolve(); await Promise.resolve()
  expect(activity().tool).toBe('Read')
  t = 3000; endShort(); await short
  expect(activity()).toMatchObject({ tool: 'Bash', since: 1000 }) // still working
  t = 4000; endLong(); await long
  expect(activity()).toEqual({ tool: null, since: null, idleSince: 4000 })
  await track($, { tool: 'Read', agentId: 'sub-1' }, async () => undefined) // a subagent's call
  expect(activity().idleSince).toBe(4000)
})
