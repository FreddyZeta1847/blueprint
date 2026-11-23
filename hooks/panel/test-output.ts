/*
 * Reads the output of a test command into counts: how many tests passed, how many ran, which
 * failed. One small matcher per common runner, tried in order (bun / `claude plugin test`,
 * node:test, jest, vitest, then any «N passed / N failed» line, which also covers pytest and
 * rtk's condensed lines). `files` holds the per-file blocks when the output has them (bun's
 * `path\x.test.tsx:` header followed by `(pass)` / `(fail)` lines), keyed by the file's base name.
 */
export type Count = { passed: number; total: number; failed: string[] }
export type TestOutput = Count & { files: Record<string, Count> }

const num = (re: RegExp, text: string): number | null => {
  const m = re.exec(text)
  return m?.[1] ? Number(m[1]) : null
}
const all = (re: RegExp, text: string): string[] => [...text.matchAll(re)].map(m => m[1]!.trim())

/** passed and failed counts, or null when the output has no summary this reader knows. */
function summary(text: string): { passed: number; failed: number } | null {
  // bun, claude plugin test: « 73 pass» / « 0 fail» on lines of their own
  let p = num(/^\s*(\d+)\s+pass\s*$/m, text); let f = num(/^\s*(\d+)\s+fail\s*$/m, text)
  if (p !== null) return { passed: p, failed: f ?? 0 }
  // node:test: «# pass 77» (TAP) or «ℹ pass 2» (spec)
  p = num(/^\s*(?:#|ℹ)\s*pass\s+(\d+)/m, text); f = num(/^\s*(?:#|ℹ)\s*fail\s+(\d+)/m, text)
  if (p !== null) return { passed: p, failed: f ?? 0 }
  // jest: «Tests:  1 failed, 5 passed, 6 total»; vitest: «Tests  1 failed | 12 passed (13)»
  const line = /^\s*Tests:?\s+(.*\d+ passed.*)$/m.exec(text)?.[1]
  const any = line ?? /^.*\d+ (?:passed|failed).*$/m.exec(text)?.[0]
  if (!any) return null
  return { passed: num(/(\d+) passed/, any) ?? 0, failed: num(/(\d+) failed/, any) ?? 0 }
}

function failedNames(text: string): string[] {
  return [
    ...all(/^not ok \d+ - (.+)$/gm, text), // node TAP
    ...all(/^\s*✖ (.+?)(?: \([\d.]+m?s\))?$/gm, text), // node spec
    ...all(/^\(fail\) (.+?)(?: \[[\d.]+m?s\])?$/gm, text), // bun
    ...all(/^\s*FAIL\s+\S+ > (.+)$/gm, text), // vitest
    ...all(/^\s*● (.+)$/gm, text), // jest
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

export function parseTestOutput(text: string): TestOutput | null {
  const s = summary(text)
  if (!s) return null
  return { passed: s.passed, total: s.passed + s.failed, failed: failedNames(text), files: fileBlocks(text) }
}
