/*
 * Acceptance tests of the Sessioni view and the status writer (Tasks B1–B3 of the panel
 * plan), written by the mother before the child «vista-sessioni» starts: the child makes them
 * pass and does not edit them. Contract of element keys: Button `tab:sessioni` (entry),
 * Button `enter:<worktree>` per child, Button `notify-switch`; a Box `ctx:<worktree>` wrapping the context-bar Svg (Svg takes no key).
 */
import { expect, test } from 'claude-code/testing'
import { engine, defaultFiles, MAIN, NOW, PANE, sessionsWorld } from './harness'

const WT = `${MAIN}/.claude/worktrees/area-clienti`
const KEYS = ['context', 'costUsd', 'lastTool', 'sessionId', 'since', 'startedAt', 'tool', 'turns', 'updatedAt', 'v', 'worktree']
const child = { gitFile: `gitdir: ${MAIN}/.git/worktrees/area-clienti\n`, sessionId: 'cccccccc-2222' }

test('B1: a child writes its v1 status file, tool set while running and cleared after', async ($, on) => {
  const seen = engine(on, child)
  await $.session.start({ cwd: WT, surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await seen.clock.advance(2_500) // the trailing write of the 2 s throttle
  const mine = seen.writes.filter(w => w.path === `${MAIN}/blueprint/sessions/area-clienti.json`)
  expect(mine.length).toBeGreaterThan(0)
  const last = JSON.parse(mine[mine.length - 1]!.text)
  expect(Object.keys(last).sort()).toEqual(KEYS)
  expect(last.v).toBe(1)
  expect(last.worktree).toBe('area-clienti')
  expect(last.sessionId).toBe('cccccccc-2222')
  expect(last.tool).toBeNull()
  expect(last.since).toBeNull()
  expect(last.lastTool).toBe('Bash')
  expect(last.turns).toBe(14)
  expect(last.context.percent).toBe(31)
  expect(last.costUsd).toBe(2.4)
  expect(Date.parse(last.updatedAt)).toBeGreaterThanOrEqual(NOW)
  expect(mine.some(w => w.text.includes('npm test'))).toBe(false) // never tool arguments
  expect(seen.writes.filter(w => w.path === `${MAIN}/blueprint/sessions/.gitignore` && w.text.trim() === '*').length).toBe(1)
})

test('B1: at most one write every 2 s, plus the trailing one', async ($, on) => {
  const seen = engine(on, child)
  await $.session.start({ cwd: WT, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Read', file_path: `f${i}` })
  const burst = seen.writes.filter(w => w.path.endsWith('/area-clienti.json')).length
  expect(burst).toBeLessThanOrEqual(2)
  await seen.clock.advance(2_500)
  expect(seen.writes.filter(w => w.path.endsWith('/area-clienti.json')).length).toBeGreaterThan(burst)
})

test('B1: the mother, and a worktree of a repository without a plan, write nothing', async ($, on) => {
  const seen = engine(on, { ...child, files: { ...defaultFiles(), 'blueprint/plan.json': undefined } })
  await $.session.start({ cwd: WT, surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await seen.clock.advance(2_500)
  expect(seen.writes.some(w => w.path.includes('/blueprint/sessions/'))).toBe(false)
})

test('B1: the mother (not a worktree) writes no status file', async ($, on) => {
  const seen = engine(on, {})
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await seen.clock.advance(2_500)
  expect(seen.writes.some(w => w.path.includes('/blueprint/sessions/'))).toBe(false)
})

async function openSessions($: any, on: any, extra: Partial<Parameters<typeof engine>[1]> = {}) {
  const seen = engine(on, { ...sessionsWorld(), ...extra })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  return seen
}

test('B2/B3: the table — mother, children matched to their parts, others, total', async ($, on) => {
  await openSessions($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(PANE(surface))
    await ui.press({ key: 'tab:sessioni' })
    expect(await ui.find({ text: /madre/ })).toBeDefined()
    expect(await ui.find({ text: /31%/ })).toBeDefined()
    expect(await ui.find({ text: /2,40 \$/ })).toBeDefined()
    expect(await ui.find({ text: /figlia-area-admin/ })).toBeDefined()
    expect(await ui.find({ text: /finita/ })).toBeDefined()
    expect(await ui.find({ text: /figlia-area-clienti/ })).toBeDefined()
    expect(await ui.find({ text: /58%/ })).toBeDefined()
    expect(await ui.find({ text: /6,80 \$/ })).toBeDefined()
    expect(await ui.find({ text: /altre sessioni/ })).toBeDefined() // prova-libera matches no part
    expect(await ui.find({ text: /Totale tappa: 13,30 \$/ })).toBeDefined() // mother + the stage's children
    if (surface === 'desktop') expect(await ui.find({ key: 'ctx:area-clienti' })).toBeDefined()
    await ui.unmount()
  }
})

test('B2: a blocked child shows «ferma: aspetta te» and the status line says «tocca a te»', async ($, on) => {
  const seen = await openSessions($, on)
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'tab:sessioni' })
  expect(await ui.find({ text: /ferma: aspetta te/ })).toBeDefined()
  await ui.unmount()
  expect(seen.status).toContain('Blueprint · tocca a te: tappa 3')
})

test('B2: a running child shows the tool it is using', async ($, on) => {
  const world = sessionsWorld()
  world.agents = world.agents!.map(a => (a.sessionId === 'cccccccc-2222' ? { ...a, state: 'running', status: 'running' } : a))
  world.files!['blueprint/sessions/area-clienti.json'] = world.files!['blueprint/sessions/area-clienti.json']!
    .replace(/"since":"[^"]+"/, `"since":"${new Date(NOW - 30_000).toISOString()}"`)
  engine(on, world)
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'tab:sessioni' })
  expect(await ui.find({ text: /Bash/ })).toBeDefined()
  expect(await ui.find({ text: /ferma: aspetta te/ })).toBeUndefined()
  await ui.unmount()
})

test('B3: «entra nella sessione» copies the attach command', async ($, on) => {
  const seen = await openSessions($, on)
  const ui = await $.ui.mount(PANE('desktop'))
  await ui.press({ key: 'tab:sessioni' })
  await ui.press({ key: 'enter:area-clienti' })
  expect(seen.copies).toContain('claude attach cccccccc')
  expect(seen.toasts.some(t => t.includes('claude attach cccccccc'))).toBe(true)
  await ui.unmount()
})

test('B3: the switch shows the option and turns it on', async ($, on) => {
  const seen = await openSessions($, on)
  const ui = await $.ui.mount(PANE('desktop'))
  await ui.press({ key: 'tab:sessioni' })
  expect((await ui.find({ key: 'notify-switch' }))?.text).toMatch(/spento/)
  await ui.press({ key: 'notify-switch' })
  expect(seen.config).toEqual([{ key: 'blueprint.notifyWhenWaiting', value: true }])
  await ui.unmount()
})

test('B2: a stale child shows «terminata»; a file older than 7 days is ignored', async ($, on) => {
  const world = sessionsWorld()
  const old = (wt: string, days: number) => JSON.stringify({ v: 1, sessionId: `${wt}-old`, worktree: wt, startedAt: '2026-11-01T00:00:00Z',
    updatedAt: new Date(NOW - days * 86_400_000).toISOString(), turns: 1, tool: null, since: null, lastTool: null, context: { percent: 5 }, costUsd: 0.1 })
  world.agents = world.agents!.filter(a => a.sessionId !== 'aaaaaaaa-1111' && a.sessionId !== 'pppppppp-3333')
  world.files!['blueprint/sessions/area-admin.json'] = old('area-admin', 1)
  world.files!['blueprint/sessions/prova-libera.json'] = old('prova-libera', 8)
  engine(on, world)
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'tab:sessioni' })
  expect(await ui.find({ text: /terminata/ })).toBeDefined()
  expect(await ui.find({ text: /prova-libera/ })).toBeUndefined()
  await ui.unmount()
})

test('B3: no parallel stage — one explaining line, no table, no sessions list run', async ($, on) => {
  const world = sessionsWorld()
  world.files!['blueprint/plan.json'] = JSON.stringify({ version: 3, project: 'x', stages: [{ id: 'a', name: 'Solo', type: 'quick_task', status: 'in_progress', phase: 'do' }] })
  const seen = engine(on, world)
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'tab:sessioni' })
  expect(await ui.find({ text: /Nessuna tappa in parallelo/ })).toBeDefined()
  expect(await ui.find({ text: /Totale tappa/ })).toBeUndefined()
  await ui.unmount()
  expect(seen.agentRuns).toBe(0)
})

test('B3: English labels when the language setting is English', async ($, on) => {
  await openSessions($, on, { language: 'en' })
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'tab:sessioni' })
  expect(await ui.find({ text: /\bmother\b/ })).toBeDefined()
  expect(await ui.find({ text: /\bmadre\b/ })).toBeUndefined()
  await ui.unmount()
})
