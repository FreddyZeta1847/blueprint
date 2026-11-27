/*
 * Tests of the test recorder (group C of stage «Test e revisione»): a command run in the build or
 * test phase writes its group's counts; outside those phases, or with a command of no group,
 * nothing; the last run wins; one run whose output is split per file fills each file's group;
 * a child writes its own file (the reader's «newest wins» is tested in the test-phase view).
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, defaultFiles, planJson } from './harness'
import { missNote } from '../checks'

const STEPS = '# Piano\n\n## Area admin\n### A. Corsi\n- [x] 1. Elenco.\n- Test (npm test -- corsi): un corso chiuso non si prenota.\n### B. Chiusure\n- [ ] 2. Chiusura.\n- Test (chiusure.test.ts): gli iscritti ricevono l\'avviso.\n\n## Area clienti\n### C. Calendario\n- [ ] 1. Calendario.\n- Test (calendario.test.ts): settimana che cambia.\n\n## Madre\n### D. Integrazione\n- [ ] Unione.\n- Test (npm run e2e): le due parti insieme.\n'
const TAP = (pass: number, fail: number) => `# tests ${pass + fail}\n# pass ${pass}\n# fail ${fail}\n`
const SPLIT = 'test\\chiusure.test.ts:\n(pass) avviso [1ms]\n(fail) ordine [1ms]\n\ntest\\calendario.test.ts:\n(pass) settimana [1ms]\n\n 2 pass\n 1 fail\n'

function world(phase: string, extra: Record<string, string> = {}) {
  return { files: { ...defaultFiles(), 'blueprint/plan.json': planJson({ phase }), 'blueprint/plans/fb.md': STEPS, ...extra },
    toolOut: { 'npm test -- corsi': TAP(3, 0), 'rtk npm test -- corsi': TAP(2, 1), 'bun test': SPLIT, 'ls': 'a\nb\n' } }
}
const file = (seen: any, who = 'main') => {
  const text = seen.files[`blueprint/checks/fb--${who}.json`]
  return text ? JSON.parse(text).groups : undefined
}

test('in the test phase a group\'s command writes its counts; the last run wins; rtk\'s prefix is ignored', async ($, on) => {
  const seen = engine(on, world('test'))
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi' })
  expect(file(seen)['A. Corsi']).toMatchObject({ passed: 3, total: 3, failed: [], source: 'seen' })
  await seen.clock.advance(1000)
  await $.tool.call({ tool: 'PowerShell', command: 'rtk npm test -- corsi' })
  expect(file(seen)['A. Corsi']).toMatchObject({ passed: 2, total: 3 })
  expect(seen.files['blueprint/checks/.gitignore']).toBe('*\n')
})

test('one run split per file fills each file\'s group, in the build phase too', async ($, on) => {
  // a stage built in one session: the main session builds it, so its runs count while building
  const single = JSON.parse(planJson({ phase: 'build' }))
  single.stages[2].independent_parts = []
  const seen = engine(on, { ...world('build'), files: { ...world('build').files, 'blueprint/plan.json': JSON.stringify(single) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'bun test' })
  expect(file(seen)['B. Chiusure']).toMatchObject({ passed: 1, total: 2, failed: ['ordine'] })
  expect(file(seen)['C. Calendario']).toMatchObject({ passed: 1, total: 1 })
  expect(file(seen)['A. Corsi']).toBe(undefined)
})

test('while children build a parallel stage, the main session\'s runs are not that stage\'s (review round 1)', async ($, on) => {
  // a child's worktree exists: the children are building it
  const seen = engine(on, { ...world('build'), files: { ...world('build').files, '.claude/worktrees/area-admin': '' } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'bun test' })
  expect(file(seen)).toBe(undefined)
})

test('outside build, test and review, or with a command of no group, nothing is written', async ($, on) => {
  const plan = engine(on, world('plan'))
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(file(plan)).toBe(undefined)
})

test('a run during the review counts too: review findings are fixed in place, and so are the tests they break (3.6.0, review round 4)', async ($, on) => {
  const review = engine(on, world('review'))
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi' })
  expect(file(review)).toBeDefined()
})

test('a command is a group\'s only when it runs exactly its key: a launcher, flags and a «cd … &&» are fine, a longer path or another file is not', async ($, on) => {
  const seen = engine(on, { ...world('test'), toolOut: { 'npm test -- corsi-extra': TAP(1, 0), 'npm test -- corsi x.js': TAP(1, 0), 'cd app && npx npm test -- corsi --reporter=tap': TAP(5, 0) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi-extra' })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi x.js' })
  expect(file(seen)).toBe(undefined)
  await $.tool.call({ tool: 'Bash', command: 'cd app && npx npm test -- corsi --reporter=tap' })
  expect(file(seen)['A. Corsi']).toMatchObject({ passed: 5, total: 5 })
})

test('pipes and redirections after a group\'s command still count (issue 004 seen in mote)', async ($, on) => {
  const seen = engine(on, { ...world('test'), toolOut: { 'npm test -- corsi 2>&1 | tail -5': TAP(4, 0), 'npm test -- corsi > out.txt; cat out.txt': TAP(6, 0) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi 2>&1 | tail -5' })
  expect(file(seen)['A. Corsi']).toMatchObject({ passed: 4, total: 4 })
  await seen.clock.advance(1000)
  await $.tool.call({ tool: 'PowerShell', command: 'npm test -- corsi > out.txt; cat out.txt' })
  expect(file(seen)['A. Corsi']).toMatchObject({ passed: 6, total: 6 })
})

test('a test run that belongs to no group is told to Claude, so it is never silently uncounted', async ($, on) => {
  // the note travels in the tool result's context, which a test's own $.tool.call does not carry back:
  // here the text and the fact that nothing was written; the hook returns missNote as context
  const seen = engine(on, { ...world('test'), toolOut: { 'npm test -- altro': TAP(2, 0) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- altro' })
  expect(file(seen)).toBe(undefined)
  expect(missNote('fb', { passed: 2, total: 2, failed: [] })).toMatch(/^\[Blueprint\] .*2 of 2 passed.*blueprint\/plans\/fb\.md.*no group matched/)
})

test('a child writes its own file, next to the main session\'s', async ($, on) => {
  const older = JSON.stringify({ v: 1, groups: { 'A. Corsi': { passed: 1, total: 3, failed: [], source: 'seen', at: '2026-11-16T09:00:00.000Z' } } })
  const seen = engine(on, { ...world('build', { 'blueprint/checks/fb--main.json': older }), gitFile: `gitdir: ${MAIN}/.git/worktrees/area-admin\n`, cwd: `${MAIN}/.claude/worktrees/area-admin` })
  await $.session.start({ cwd: `${MAIN}/.claude/worktrees/area-admin`, surface: 'terminal', isInteractive: false })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi' })
  expect(file(seen, 'area-admin')['A. Corsi']).toMatchObject({ passed: 3, total: 3 })
  expect(file(seen)['A. Corsi']).toMatchObject({ passed: 1, total: 3 }) // the main session's file is untouched
})

test('a flag with its value after the key counts; a flag followed by another test file does not (review round 1)', async ($, on) => {
  const seen = engine(on, { ...world('test'), toolOut: { 'npm test -- corsi -k smoke --timeout 20000': TAP(2, 0), 'npm test -- corsi --lf tests/altro.py': TAP(9, 0) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi --lf tests/altro.py' })
  expect(file(seen)).toBe(undefined)
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi -k smoke --timeout 20000' })
  expect(file(seen)['A. Corsi']).toMatchObject({ passed: 2, total: 2 })
})

test('a stage id that is not kebab-case is never used in a file name (review round 1)', async ($, on) => {
  const plan = JSON.parse(planJson({ phase: 'test' }))
  plan.stages[2].id = '../../fuori'
  const seen = engine(on, { ...world('test'), files: { ...world('test').files, 'blueprint/plan.json': JSON.stringify(plan), 'blueprint/plans/../../fuori.md': STEPS } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi' })
  expect(Object.keys(seen.files).filter(k => k.includes('fuori') && k.endsWith('.json'))).toEqual([])
})

test('an earlier stage waiting at «integrate» does not take the counts: they go to the stage in test', async ($, on) => {
  const plan = JSON.parse(planJson({ phase: 'integrate' }))
  plan.stages[3] = { id: 'sec', name: 'Controllo', type: 'implementation', status: 'in_progress', phase: 'test' }
  const seen = engine(on, { ...world('test'), files: { ...world('test').files, 'blueprint/plan.json': JSON.stringify(plan), 'blueprint/plans/sec.md': STEPS } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi' })
  expect(seen.files['blueprint/checks/fb--main.json']).toBe(undefined)
  expect(JSON.parse(seen.files['blueprint/checks/sec--main.json'] ?? '{}').groups['A. Corsi']).toMatchObject({ passed: 3, total: 3 })
})

test('a parallel stage built by one session (no child worktree) counts the main session\'s runs (review round 2)', async ($, on) => {
  const seen = engine(on, { ...world('build'), toolOut: { 'npm test -- corsi': TAP(4, 0) } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi' })
  expect(file(seen)['A. Corsi']).toMatchObject({ passed: 4, total: 4 })
})

/** The plan with the stage built by one session (no independent parts), at a phase. */
const singleSession = (phase: string) => { const p = JSON.parse(planJson({ phase })); p.stages[2].independent_parts = []; return JSON.stringify(p) }

test('a command that ends with an error and prints red tests still counts for its group (3.5.1)', async ($, on) => {
  // claude plugin test, and most runners, end with an error exactly when a test is red
  const seen = engine(on, { files: { ...world('build').files, 'blueprint/plan.json': singleSession('build') }, toolErr: { 'bun test': `Exit code 1\n${SPLIT}` } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'bun test' })
  expect(file(seen)['B. Chiusure']).toMatchObject({ passed: 1, total: 2, failed: ['ordine'] })
  expect(file(seen)['C. Calendario']).toMatchObject({ passed: 1, total: 1 })
})

test('a command that ends with an error and prints no test summary writes nothing (3.5.1)', async ($, on) => {
  const seen = engine(on, { files: { ...world('build').files, 'blueprint/plan.json': singleSession('build') }, toolErr: { 'ls nope': 'Exit code 2\nls: cannot access \'nope\': No such file or directory' } })
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls nope' })
  expect(file(seen)).toBe(undefined)
})
