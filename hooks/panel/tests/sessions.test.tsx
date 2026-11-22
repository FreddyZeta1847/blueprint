/*
 * Tests of the child «vista-sessioni» (Tasks B1–B3 of the panel plan), beyond the mother's
 * acceptance tests: money and time formats, name cutting, the row rules of sessions-data
 * (one row per worktree file even when a part was resumed, a half-written file, a tool
 * running for more than 10 minutes, the sessions-list cache).
 * The data helpers get a stand-in for the mod's $ (fs, process, clock); each test uses its
 * own project path, because the module keeps its caches by path.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { cut, duration, money } from '../sessions-view'
import { readSessions, sessionsSummary, toRow } from '../sessions-data'
import type { PlanModel } from '../types'

const NOW = Date.parse('2026-11-16T10:00:00Z')

const plan = (parts: string[]): PlanModel => ({
  project: 'p', currentIndex: 0, parallelIndex: 0,
  stages: [{ id: 'fb', name: 'FB', type: 'implementation', status: 'in_progress', segments: [], phases: [], yourTurn: false, kids: 0, waitingOn: [], independentParts: parts, topics: [] }],
})

const status = (wt: string, sid: string, extra: Record<string, unknown> = {}) => JSON.stringify({
  v: 1, sessionId: sid, worktree: wt, startedAt: new Date(NOW - 3_600_000).toISOString(), updatedAt: new Date(NOW - 5_000).toISOString(),
  turns: 3, tool: null, since: null, lastTool: 'Edit', context: { percent: 20 }, costUsd: 1, ...extra,
})

// A stand-in for the mod's $: files under `${main}/blueprint/sessions/`, the sessions list, a clock.
function fake(main: string, files: Record<string, string>, agents: unknown[], clock = { now: NOW }) {
  const runs = { count: 0 }
  const $ = {
    clock: { now: async () => clock.now },
    fs: {
      list: async (dir: string) => {
        if (dir !== `${main}/blueprint/sessions`) throw new Error(`ENOENT ${dir}`)
        return Object.keys(files).map(name => ({ name, kind: 'file' }))
      },
      read: async (p: string) => { const f = files[p.slice(`${main}/blueprint/sessions/`.length)]; if (f === undefined) throw new Error('ENOENT'); return f },
    },
    process: { run: async () => { runs.count++; return { exitCode: 0, stdout: JSON.stringify(agents) } } },
  }
  return { $, runs, files, clock }
}

const agent = (wt: string, sid: string, state: string) =>
  ({ id: sid.slice(0, 8), sessionId: sid, name: `figlia-${wt}`, cwd: `C:\\x\\.claude\\worktrees\\${wt}`, kind: 'background', state })

test('money and time read as in the mockup', () => {
  expect(money('it', 13.3)).toBe('13,30 $')
  expect(money('en', 2.4)).toBe('$2.40')
  expect(duration(41 * 60_000)).toBe('41 min')
  expect(duration(80 * 60_000)).toBe('1 h 20')
  expect(duration(65 * 60_000)).toBe('1 h 05')
  expect(cut('figlia-area-clienti', 10)).toBe('figlia-ar…')
  expect(cut('corto', 10)).toBe('corto')
})

test('a resumed part: two sessions on one worktree give one row, named by the file\'s session', async () => {
  const { $ } = fake('C:/r1', { 'area-admin.json': status('area-admin', 'bbbbbbbb-2') },
    [agent('area-admin', 'aaaaaaaa-1', 'done'), { ...agent('area-admin', 'bbbbbbbb-2', 'working'), name: 'ripresa' }])
  const s = await readSessions($, 'C:/r1', plan(['Area admin']))
  expect(s.kids.length).toBe(1)
  expect(s.kids[0]!.name).toBe('ripresa')
  expect(s.kids[0]!.id).toBe('bbbbbbbb')
  expect(s.kids[0]!.state).toBe('running')
  expect(s.others.length).toBe(0)
})

test('a half-written file keeps the last good value', async () => {
  const { $, files } = fake('C:/r2', { 'area-admin.json': status('area-admin', 'a-1', { costUsd: 3 }) }, [agent('area-admin', 'a-1', 'working')])
  expect((await readSessions($, 'C:/r2', plan(['Area admin']))).kids[0]!.costUsd).toBe(3)
  files['area-admin.json'] = '{"v":1,"sessionId":"a-1","work'
  const again = await readSessions($, 'C:/r2', plan(['Area admin']))
  expect(again.kids.length).toBe(1)
  expect(again.kids[0]!.costUsd).toBe(3)
})

test('a tool running for more than 10 minutes counts as blocked', async () => {
  const since = new Date(NOW - 11 * 60_000).toISOString()
  const { $ } = fake('C:/r3', {
    'area-admin.json': status('area-admin', 'a-1', { tool: 'Bash', since }),
    'area-clienti.json': status('area-clienti', 'c-1', { tool: 'Read', since: new Date(NOW - 60_000).toISOString() }),
  }, [agent('area-admin', 'a-1', 'working'), agent('area-clienti', 'c-1', 'working')])
  const summary = await sessionsSummary($, 'C:/r3', plan(['Area admin', 'Area clienti']))
  expect(summary.kids).toBe(2)
  expect(summary.blocked).toEqual([{ worktree: 'area-admin', reason: 'Bash' }])
})

test('the sessions list is run at most once every 5 s, and never without parallel parts', async () => {
  const clock = { now: NOW }
  const { $, runs } = fake('C:/r4', { 'area-admin.json': status('area-admin', 'a-1') }, [agent('area-admin', 'a-1', 'working')], clock)
  await sessionsSummary($, 'C:/r4', plan([]))
  expect(runs.count).toBe(0)
  await sessionsSummary($, 'C:/r4', plan(['Area admin']))
  clock.now += 3_000
  await sessionsSummary($, 'C:/r4', plan(['Area admin']))
  expect(runs.count).toBe(1)
  clock.now += 3_000
  await sessionsSummary($, 'C:/r4', plan(['Area admin']))
  expect(runs.count).toBe(2)
})

test('no sessions folder yet: no rows, no throw', async () => {
  const { $ } = fake('C:/r5', {}, [])
  $.fs.list = async (dir: string) => { throw new Error(`ENOENT ${dir}`) }
  const s = await readSessions($, 'C:/r5', plan(['Area admin']))
  expect(s.kids).toEqual([])
  expect(s.others).toEqual([])
})

test('a session left «blocked» for days is ended, not waiting; a recent one waits', async () => {
  const now = Date.parse('2026-11-16T10:00:00Z')
  const file = (ageMs: number) => ({ sessionId: 's1', worktree: 'area-admin', startedAt: '2026-11-10T00:00:00Z',
    updatedAt: new Date(now - ageMs).toISOString(), tool: null, since: null, context: { percent: 10 }, costUsd: 1 })
  const agents = [{ id: 's1', sessionId: 's1', state: 'blocked', cwd: 'C:/proj/.claude/worktrees/area-admin' }]
  expect(toRow(file(2 * 86_400_000), agents, now, 'C:/proj').state).toBe('ended')
  expect(toRow(file(5 * 60_000), agents, now, 'C:/proj').state).toBe('blocked')
  expect(money('it', Number.NaN)).toBe('0,00 $')
})
