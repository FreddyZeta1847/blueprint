/*
 * Tests of the test recorder (group C of stage «Test e revisione»): a command run in the build or
 * test phase writes its group's counts; outside those phases, or with a command of no group,
 * nothing; the last run wins; one run whose output is split per file fills each file's group;
 * a child writes its own file (the reader's «newest wins» is tested in the test-phase view).
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { engine, MAIN, defaultFiles, planJson } from './harness'

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
  const seen = engine(on, world('build'))
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'bun test' })
  expect(file(seen)['B. Chiusure']).toMatchObject({ passed: 1, total: 2, failed: ['ordine'] })
  expect(file(seen)['C. Calendario']).toMatchObject({ passed: 1, total: 1 })
  expect(file(seen)['A. Corsi']).toBe(undefined)
})

test('outside build and test, or with a command of no group, nothing is written', async ($, on) => {
  const review = engine(on, world('review'))
  await $.session.start({ cwd: MAIN, surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(file(review)).toBe(undefined)
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

test('a child writes its own file, next to the main session\'s', async ($, on) => {
  const older = JSON.stringify({ v: 1, groups: { 'A. Corsi': { passed: 1, total: 3, failed: [], source: 'seen', at: '2026-11-16T09:00:00.000Z' } } })
  const seen = engine(on, { ...world('build', { 'blueprint/checks/fb--main.json': older }), gitFile: `gitdir: ${MAIN}/.git/worktrees/area-admin\n`, cwd: `${MAIN}/.claude/worktrees/area-admin` })
  await $.session.start({ cwd: `${MAIN}/.claude/worktrees/area-admin`, surface: 'terminal', isInteractive: false })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- corsi' })
  expect(file(seen, 'area-admin')['A. Corsi']).toMatchObject({ passed: 3, total: 3 })
  expect(file(seen)['A. Corsi']).toMatchObject({ passed: 1, total: 3 }) // the main session's file is untouched
})
