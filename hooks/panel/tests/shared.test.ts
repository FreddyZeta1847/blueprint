/*
 * Tests for the panel's shared helpers (Task 1 of the panel plan): slug, language, repo
 * detection from .git, and readPlan's segments for per-stage and discussion stages.
 * The helpers get a stand-in for the mod's $ (fs, session.cwd, plugin.root): in a test the
 * `$` parameter is the engine's, not the mod's.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { slug, findRepo } from '../repo'
import { langFrom, tr } from '../text'
import { readPlan } from '../plan-data'

const MAIN = 'C:/proj'

const LOOPS = JSON.stringify({ types: {
  discussion: { cycle: 'per_step', phases: [{ id: 'clarify' }, { id: 'proposal' }, { id: 'convergence', user: true }, { id: 'decision' }] },
  implementation: { cycle: 'per_stage', phases: [{ id: 'clarify' }, { id: 'plan' }, { id: 'build' }, { id: 'test' }, { id: 'review' }, { id: 'first_use', user: true }, { id: 'integrate', optional: true }] },
  delivery: { cycle: 'per_stage', phases: [{ id: 'clarify' }, { id: 'prepare' }, { id: 'rehearse', optional: true }, { id: 'deliver', user: true }, { id: 'feedback', user: true }] },
  quick_task: { cycle: 'per_stage', phases: [{ id: 'clarify' }, { id: 'do' }, { id: 'check' }, { id: 'report' }] },
} })

const PLAN = {
  version: 3, project: 'sito-parrucchiere', context: 'blueprint/context.md',
  stages: [
    { id: 'repo', name: 'Repository e struttura', type: 'quick_task', status: 'done', phase: 'report' },
    { id: 'db', name: 'Database: scelte', type: 'discussion', status: 'done',
      topics: [{ name: 'Tabelle', done: true, phase: 'decision' }, { name: 'Login', done: true, phase: 'decision' }] },
    { id: 'fb', name: 'Frontend e backend in parallelo', type: 'implementation', status: 'in_progress', phase: 'build',
      independent_parts: ['Backend', 'Frontend'], topics: [{ name: 'Backend', done: true }, { name: 'Frontend', done: false }] },
    { id: 'disc', name: 'Altre scelte', type: 'discussion', status: 'todo',
      topics: [{ name: 'Uno', done: false }, { name: 'Due', done: false }, { name: 'Tre', done: false }] },
    { id: 'end', name: 'Chiusura', type: 'quick_task', status: 'todo', deadline: '2026-11-20' },
  ],
}
const CARD = '# Context — sito\nConfirmed: 2026-11-06\nSize: project — un sito\nDifficulty: difficile — pagamenti\nPace: calma — nessuna scadenza\n'

// A stand-in for the mod's $. `kinds` says which paths exist for fs.stat, and as what.
function fake(files: Record<string, string>, opts: { cwd?: string; kinds?: Record<string, 'file' | 'dir'> } = {}): any {
  const find = (p: string, map: Record<string, unknown>) => Object.entries(map).find(([k]) => p.replace(/\\/g, '/').endsWith(k))
  return {
    plugin: { root: 'C:/plugin' },
    session: { cwd: async () => opts.cwd ?? MAIN },
    fs: {
      read: async (p: string) => { const hit = find(p, files); if (!hit) throw new Error(`ENOENT ${p}`); return hit[1] },
      stat: async (p: string) => {
        const hit = find(p, opts.kinds ?? {})
        if (!hit) throw new Error(`ENOENT ${p}`)
        return { kind: hit[1], size: 1, mtimeMs: 0, isLink: false }
      },
    },
  }
}

test('slug turns part names into worktree names', async () => {
  expect(slug('Area admin')).toBe('area-admin')
  expect(slug('Vista Piàno!')).toBe('vista-piano')
  expect(slug('  Frontend & Backend  ')).toBe('frontend-backend')
})

test('language follows the setting: Italian when it starts with it', async () => {
  expect(langFrom('italian')).toBe('it')
  expect(langFrom('Italiano')).toBe('it')
  expect(langFrom('it')).toBe('it')
  expect(langFrom('en')).toBe('en')
  expect(langFrom(undefined)).toBe('en')
  expect(tr('it', 'stageOf', { n: 5, m: 7 })).toBe('tappa 5 di 7')
  expect(tr('en', 'stageOf', { n: 5, m: 7 })).toBe('stage 5 of 7')
})

test('findRepo: a .git folder is the main checkout, a .git file is a worktree', async () => {
  const child = fake({ 'area-admin/.git': `gitdir: ${MAIN}/.git/worktrees/area-admin\n` },
    { cwd: `${MAIN}/.claude/worktrees/area-admin`, kinds: { 'area-admin/.git': 'file' } })
  expect(await findRepo(child)).toEqual({ main: MAIN, worktree: 'area-admin' })
  // git names its entry "area-admin1" when an earlier worktree of that name was removed: the folder wins
  const reused = fake({ 'area-admin/.git': `gitdir: ${MAIN}/.git/worktrees/area-admin1\n` },
    { cwd: `${MAIN}/.claude/worktrees/area-admin`, kinds: { 'area-admin/.git': 'file' } })
  expect(await findRepo(reused)).toEqual({ main: MAIN, worktree: 'area-admin' })
  const mother = fake({}, { cwd: `${MAIN}/src`, kinds: { 'proj/.git': 'dir' } })
  expect(await findRepo(mother)).toEqual({ main: MAIN, worktree: null })
  expect(await findRepo(fake({}, { cwd: 'C:/nowhere' }))).toBeNull()
})

test('readPlan builds segments, the current stage and the card summary', async () => {
  const plan = await readPlan(fake({ 'blueprint/plan.json': JSON.stringify(PLAN), 'blueprint/context.md': CARD, 'data/loops.json': LOOPS }), MAIN)
  expect(plan?.project).toBe('sito-parrucchiere')
  expect(plan?.currentIndex).toBe(2)
  expect(plan?.card).toEqual({ size: 'project', difficulty: 'difficile', pace: 'calma' })
  expect(plan?.stages[2]!.segments).toEqual(['done', 'done', 'running', 'todo', 'todo', 'todo', 'todo'])
  expect(plan?.stages[2]!.yourTurn).toBe(false)
  expect(plan?.stages[2]!.topics.map(t => t.current)).toEqual([false, true])
  // a discussion's bar is its four phases too, whatever the number of topics
  expect(plan?.stages[1]!.segments).toEqual(['done', 'done', 'done', 'done'])
  expect(plan?.stages[3]!.segments).toEqual(['todo', 'todo', 'todo', 'todo'])
  expect(plan?.stages[0]!.segments.every(s => s === 'done')).toBe(true)
  expect(plan?.stages[4]!.deadline).toBe('2026-11-20')
})

test('a blocked child stops the running phase and makes it your turn', async () => {
  const plan = await readPlan(fake({ 'blueprint/plan.json': JSON.stringify(PLAN), 'data/loops.json': LOOPS }), MAIN,
    { kids: 2, blocked: [{ worktree: 'frontend', reason: 'permission' }] })
  expect(plan?.stages[2]!.segments[2]).toBe('stopped')
  expect(plan?.stages[2]!.yourTurn).toBe(true)
  expect(plan?.card).toBeUndefined()
})

test('a phase that needs the user is stopped: your turn', async () => {
  const atFirstUse = { ...PLAN, stages: PLAN.stages.map(s => (s.id === 'fb' ? { ...s, phase: 'first_use' } : s)) }
  const plan = await readPlan(fake({ 'blueprint/plan.json': JSON.stringify(atFirstUse), 'data/loops.json': LOOPS }), MAIN)
  expect(plan?.stages[2]!.segments[5]).toBe('stopped')
  expect(plan?.stages[2]!.yourTurn).toBe(true)
})

test('an unreadable plan gives null, not a throw', async () => {
  expect(await readPlan(fake({ 'blueprint/plan.json': '{ "version": 3, "stag', 'data/loops.json': LOOPS }), MAIN)).toBeNull()
  expect(await readPlan(fake({ 'data/loops.json': LOOPS }), MAIN)).toBeNull()
})

test('two stages running: the children belong to the one built in parallel, not to the first', async () => {
  const two = { ...PLAN, stages: PLAN.stages.map(s => (s.id === 'repo' ? { ...s, status: 'in_progress', phase: 'do' } : s)) }
  const plan = await readPlan(fake({ 'blueprint/plan.json': JSON.stringify(two), 'data/loops.json': LOOPS }), MAIN, { kids: 2, blocked: [] })
  expect(plan?.currentIndex).toBe(0)
  expect(plan?.parallelIndex).toBe(2)
  expect(plan?.stages[2]!.kids).toBe(2)
  expect(plan?.stages[0]!.kids).toBe(0)
})
