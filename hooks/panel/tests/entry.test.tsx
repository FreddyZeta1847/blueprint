/*
 * Tests for the panel's entry (Task 2 of the panel plan): what a session does at start
 * (child: nothing visible; mother with a plan: command, pane, status line), the toggle
 * command, and the one-shot push notification when it becomes the user's turn.
 * Hooks on `on` stand for the engine and record what the mod asked for.
 */
import { expect, mock, test } from 'claude-code/testing'

const MAIN = 'C:/proj'
const LOOPS = JSON.stringify({ types: {
  implementation: { cycle: 'per_stage', phases: [{ id: 'clarify' }, { id: 'plan' }, { id: 'build' }, { id: 'test' }, { id: 'review' }, { id: 'first_use', user: true }, { id: 'integrate', optional: true }] },
  quick_task: { cycle: 'per_stage', phases: [{ id: 'clarify' }, { id: 'do' }, { id: 'check' }, { id: 'report' }] },
} })
const plan = (phase: string) => JSON.stringify({ version: 3, project: 'demo', stages: [
  { id: 'a', name: 'Primo', type: 'quick_task', status: 'done', phase: 'report' },
  { id: 'b', name: 'Costruzione', type: 'implementation', status: 'in_progress', phase },
  { id: 'c', name: 'Rilascio', type: 'quick_task', status: 'todo' },
] })

type World = { cwd?: string; gitFile?: string; plan?: string | null; panes?: string[] }

function engine(on: any, world: World) {
  const seen = { cwd: world.cwd ?? MAIN, clock: undefined as any, commands: [] as string[], opened: [] as string[], closed: [] as string[], status: [] as (string | undefined)[], pushes: [] as string[] }
  const files: Record<string, string | undefined> = {
    'blueprint/plan.json': world.plan === undefined ? plan('build') : (world.plan ?? undefined),
    'data/loops.json': LOOPS,
    '.git': world.gitFile,
  }
  // the plan exists only under MAIN (a spare session's folder has none)
  const find = (p: string) => Object.entries(files).find(([k, v]) => v !== undefined && p.replace(/\\/g, '/').endsWith(k)
    && (k !== 'blueprint/plan.json' || p.replace(/\\/g, '/').startsWith(MAIN)))
  on('fs.read', (_: any, e: any) => { const hit = find(e.path); if (!hit) throw new Error(`ENOENT ${e.path}`); return { value: hit[1] } })
  on('fs.exists', (_: any, e: any) => ({ value: !!find(e.path) }))
  on('fs.stat', (_: any, e: any) => {
    if (!e.path.replace(/\\/g, '/').endsWith('/.git')) throw new Error('ENOENT')
    return { value: { kind: world.gitFile ? 'file' : 'dir', size: 1, mtimeMs: 0, isLink: false } }
  })
  on('settings.read', () => ({ value: { language: 'italian' } }))
  on('command.register', (_: any, e: any) => { seen.commands.push(e.name); return { value: { command: e.name } } })
  on('ui.open', (_: any, e: any) => { seen.opened.push(e.id); return { value: { isPlaced: true } } })
  on('ui.close', (_: any, e: any) => { seen.closed.push(e.id); return { value: undefined } })
  on('ui.panes', () => ({ value: (world.panes ?? []).map(id => ({ id, title: 'Blueprint', isShown: true, isFocused: false })) }))
  on('ui.status', (_: any, e: any) => { seen.status.push(e.text); return { value: undefined } })
  seen.clock = mock.clock(on, { now: 0 })
  on('tool.call', (_: any, e: any) => { if (e.tool === 'PushNotification') seen.pushes.push(e.message); return { result: {} } })
  on('session.cwd', () => ({ value: seen.cwd }))
  on('session.start', (_: any, e: any) => { seen.cwd = e.cwd ?? seen.cwd; return { cwd: e.cwd } })
  return seen
}

test('a child session (worktree) shows nothing: no pane, no status line', async ($, on) => {
  const seen = engine(on, { gitFile: `gitdir: ${MAIN}/.git/worktrees/area-admin\n` })
  await $.session.start({ cwd: `${MAIN}/.claude/worktrees/area-admin`, surface: 'terminal', isInteractive: true })
  expect(seen.opened).toEqual([])
  expect(seen.status.filter(Boolean)).toEqual([])
})

test('the mother with a plan gets the command, the pane and the status line', async ($, on) => {
  const seen = engine(on, {})
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  expect(seen.commands).toContain('blueprint-panel')
  expect(seen.opened).toEqual(['blueprint'])
  expect(seen.status).toContain('Blueprint · tappa 2/3')
})

test('autoOpen off: the command is there, the pane does not open by itself', { options: { autoOpen: false } }, async ($, on) => {
  const seen = engine(on, {})
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  expect(seen.commands).toContain('blueprint-panel')
  expect(seen.opened).toEqual([])
})

test('no plan: no pane by itself, no status line', async ($, on) => {
  const seen = engine(on, { plan: null })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  expect(seen.opened).toEqual([])
  expect(seen.status.filter(Boolean)).toEqual([])
})

test('your turn: status line says so, and one push when the option is on', { options: { notifyWhenWaiting: true } }, async ($, on) => {
  const seen = engine(on, { plan: plan('first_use') })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  expect(seen.status).toContain('Blueprint · tocca a te: tappa 2')
  expect(seen.pushes).toEqual(['Blueprint: tocca a te nella tappa «Costruzione»'])
})

test('your turn with the option off: no push', async ($, on) => {
  const seen = engine(on, { plan: plan('first_use') })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  expect(seen.pushes).toEqual([])
})

test('/blueprint-panel closes an open pane, and with "sessioni" switches view instead', async ($, on) => {
  const seen = engine(on, { panes: ['blueprint'] })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'blueprint-panel', args: 'sessioni' } as any)
  expect(seen.closed).toEqual([])
  await $.command.run({ command: 'blueprint-panel', args: '' } as any)
  expect(seen.closed).toEqual(['blueprint'])
})

test('a spare session moved into the project later: the panel finds the plan and opens by itself', async ($, on) => {
  const seen = engine(on, { cwd: 'C:/Users/me/.claude/spares/spare-1' })
  await $.session.start({ cwd: 'C:/Users/me/.claude/spares/spare-1', surface: 'desktop', isInteractive: true })
  expect(seen.opened).toEqual([]) // no plan in the spare folder
  seen.cwd = MAIN // the app moves the session into the project
  await seen.clock.advance(5000)
  expect(seen.opened).toEqual(['blueprint'])
  expect(seen.status.at(-1)).toMatch(/2\/3/)
})
