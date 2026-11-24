/*
 * Tests of the test-output reader (group B of stage «Test e revisione»): one real-looking sample
 * per common test runner, rtk-condensed lines, per-file blocks, and text that is not a test run.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { parseTestOutput } from '../test-output'

const count = (text: string) => {
  const r = parseTestOutput(text)
  return r && { passed: r.passed, total: r.total, failed: r.failed }
}

test('node:test, TAP and spec reporters', async () => {
  expect(count('TAP version 13\nok 1 - a\nnot ok 3 - posti sotto gli iscritti\n# tests 78\n# pass 77\n# fail 1\n'))
    .toEqual({ passed: 77, total: 78, failed: ['posti sotto gli iscritti'] })
  expect(count('✔ a (1ms)\n✖ disdetta tardi (2.1ms)\nℹ tests 3\nℹ pass 2\nℹ fail 1\n'))
    .toEqual({ passed: 2, total: 3, failed: ['disdetta tardi'] })
})

test('bun and claude plugin test, with the per-file blocks', async () => {
  const out = 'hooks\\panel\\tests\\a.test.tsx:\n(pass) x [1ms]\n(fail) y [2ms]\n\nhooks\\panel\\tests\\b.test.tsx:\n(pass) z [1ms]\n\n 2 pass\n 1 fail\nRan 3 tests across 2 files. [6.87s]\n'
  const r = parseTestOutput(out)!
  expect({ passed: r.passed, total: r.total, failed: r.failed }).toEqual({ passed: 2, total: 3, failed: ['y'] })
  expect(r.files).toEqual({ 'a.test.tsx': { passed: 1, total: 2, failed: ['y'] }, 'b.test.tsx': { passed: 1, total: 1, failed: [] } })
})

test('vitest, jest and pytest summaries', async () => {
  expect(count(' FAIL  src/b.test.ts > lista d\'attesa\n Test Files  1 failed | 3 passed (4)\n      Tests  1 failed | 12 passed (13)\n'))
    .toEqual({ passed: 12, total: 13, failed: ['lista d\'attesa'] })
  expect(count(' ● Prenotazioni › corso pieno\nTests:       1 failed, 5 passed, 6 total\n'))
    .toEqual({ passed: 5, total: 6, failed: ['Prenotazioni › corso pieno'] })
  expect(count('FAILED tests/test_b.py::test_disdetta - assert 1 == 2\n==== 1 failed, 5 passed in 0.12s ====\n'))
    .toEqual({ passed: 5, total: 6, failed: ['tests/test_b.py::test_disdetta'] })
  expect(count('==== 5 passed in 0.12s ====\n')).toEqual({ passed: 5, total: 5, failed: [] })
})

test('rtk-condensed lines read like the raw output', async () => {
  expect(count(' 73 pass\n 0 fail\nRan 73 tests across 8 files. [6.87s]\n')).toEqual({ passed: 73, total: 73, failed: [] })
  expect(count('# pass 78\n# fail 0\n')).toEqual({ passed: 78, total: 78, failed: [] })
  expect(count('pytest: 5 passed, 1 failed\n')).toEqual({ passed: 5, total: 6, failed: [] })
})

test('text that is not a test run gives nothing', async () => {
  expect(parseTestOutput('Switched to a new branch\n')).toBe(null)
  expect(parseTestOutput('')).toBe(null)
})

test('review round 1: every jest/vitest test failed, pytest, «sure», and output full of empty lines', async () => {
  // every test failed: the «Tests» line has no «passed», and «Test Suites» is never the count
  expect(count('Test Suites: 1 failed, 1 total\nTests:       3 failed, 3 total\n')).toEqual({ passed: 0, total: 3, failed: [] })
  expect(count(' Test Files  1 failed (1)\n      Tests  3 failed (3)\n')).toEqual({ passed: 0, total: 3, failed: [] })
  expect(parseTestOutput('============ 3 passed, 1 failed in 0.12s ============\n')!.sure).toBe(true)
  // a «2 failed» line that is not a known runner's summary is read, but not surely a test run
  expect(parseTestOutput('a1b2c3 retry: 2 failed attempts\n')!.sure).toBe(false)
  expect(parseTestOutput(' 5 pass\n 0 fail\n')!.sure).toBe(true)
  // 50 000 empty CRLF lines are read at once, not in seconds
  const start = Date.now()
  expect(parseTestOutput('\r\n'.repeat(50_000) + 'x')).toBeNull()
  expect(Date.now() - start).toBeLessThan(1000)
})
