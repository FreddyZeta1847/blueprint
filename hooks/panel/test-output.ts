/*
 * Reads the output of a test command into counts: how many tests passed, how many ran, which
 * failed. One small matcher per common runner, tried in order (bun / `claude plugin test`,
 * node:test, jest, vitest, pytest), then any «N passed / N failed» line, which covers rtk's
 * condensed lines; only that last one is not `sure`. `files` holds the per-file blocks when the
 * output has them (bun's `path\x.test.tsx:` header followed by `(pass)` / `(fail)` lines), keyed by
 * the file's base name. Line starts use [ \t]*, never \s*: \s also crosses line ends, and on
 * output full of empty lines the match turns quadratic. Long output is read from its end only.
 */
export type Count = { passed: number; total: number; failed: string[] }
/** `sure`: the summary has a known runner's shape (not only some «N passed» line). */
export type TestOutput = Count & { files: Record<string, Count>; sure: boolean }

/** Summaries are at the end: longer output is read from its last part only. */
const TAIL = 200_000

const num = (re: RegExp, text: string): number | null => {
  const m = re.exec(text)
  return m?.[1] ? Number(m[1]) : null
}
const all = (re: RegExp, text: string): string[] => [...text.matchAll(re)].map(m => m[1]!.trim())
const counts = (line: string) => ({ passed: num(/(\d+) passed/, line) ?? 0, failed: num(/(\d+) failed/, line) ?? 0 })

/** passed and failed counts, or null when the output has no summary this reader knows. */
function summary(text: string): { passed: number; failed: number; sure: boolean } | null {
  // bun, claude plugin test: « 73 pass» / « 0 fail» on lines of their own
  let p = num(/^[ \t]*(\d+)[ \t]+pass[ \t]*\r?$/m, text); let f = num(/^[ \t]*(\d+)[ \t]+fail[ \t]*\r?$/m, text)
  if (p !== null) return { passed: p, failed: f ?? 0, sure: true }
  // node:test: «# pass 77» (TAP) or «ℹ pass 2» (spec)
  p = num(/^[ \t]*(?:#|ℹ)[ \t]*pass[ \t]+(\d+)/m, text); f = num(/^[ \t]*(?:#|ℹ)[ \t]*fail[ \t]+(\d+)/m, text)
  if (p !== null) return { passed: p, failed: f ?? 0, sure: true }
  // jest: «Tests:  1 failed, 5 passed, 6 total»; vitest: «Tests  1 failed | 12 passed (13)» —
  // also when every test failed and the line has no «passed»
  const tests = /^[ \t]*Tests:?[ \t]+(.*\d+ (?:passed|failed).*)$/m.exec(text)?.[1]
  if (tests) return { ...counts(tests), sure: true }
  // pytest: «==== 3 passed, 1 failed in 0.12s ====»
  const pytest = /^=+ .*\d+ (?:passed|failed).* in [\d.]+s.*=+\r?$/m.exec(text)?.[0]
  if (pytest) return { ...counts(pytest), sure: true }
  // any other «N passed / N failed» line (rtk's condensed lines), never jest's «Test Suites» or vitest's «Test Files»
  const any = /^(?![ \t]*Test (?:Suites|Files))[^\n]*\d+ (?:passed|failed)[^\n]*$/m.exec(text)?.[0]
  return any ? { ...counts(any), sure: false } : null
}

function failedNames(text: string): string[] {
  return [
    ...all(/^not ok \d+ - (.+)$/gm, text), // node TAP
    ...all(/^[ \t]*✖ (.+?)(?: \([\d.]+m?s\))?$/gm, text), // node spec
    ...all(/^\(fail\) (.+?)(?: \[[\d.]+m?s\])?$/gm, text), // bun
    ...all(/^[ \t]*FAIL[ \t]+\S+ > (.+)$/gm, text), // vitest
    ...all(/^[ \t]*● (.+)$/gm, text), // jest
    ...all(/^FAILED (\S+)/gm, text), // pytest
  ]
}

/** bun's per-file blocks: a `path\name.test.tsx:` line, then its `(pass)` / `(fail)` lines. */
function fileBlocks(text: string): Record<string, Count> {
  const files: Record<string, Count> = {}
  let current: Count | null = null
  for (const line of text.split(/\r?\n/)) {
    const head = /^(\S.*\.(?:test|spec)\.[cm]?[jt]sx?):\s*$/.exec(line)
    if (head?.[1]) {
      const name = head[1].split(/[\\/]/).pop()!
      current = files[name] = { passed: 0, total: 0, failed: [] }
      continue
    }
    const res = /^\((pass|fail)\) (.+?)(?: \[[\d.]+m?s\])?$/.exec(line)
    if (!current || !res) continue
    current.total++
    if (res[1] === 'pass') current.passed++
    else current.failed.push(res[2]!)
  }
  return files
}

export function parseTestOutput(output: string): TestOutput | null {
  const text = output.length > TAIL ? output.slice(-TAIL) : output
  const s = summary(text)
  if (!s) return null
  return { passed: s.passed, total: s.passed + s.failed, failed: failedNames(text), files: fileBlocks(text), sure: s.sure }
}
