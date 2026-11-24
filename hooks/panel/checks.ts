/*
 * Test results per group of the plain plan (group C of stage «Test e revisione»). When a session
 * runs a Bash or PowerShell command while its implementation stage is in the build or test phase,
 * and the command belongs to a group (the key of the group's «Test (key):» line), the output is
 * read and the group's counts are written. Each session writes its own file,
 * blueprint/checks/<stage id>--<worktree or «main»>.json, so two children never overwrite each
 * other; the reader keeps, per group, the most recent result. In the test phase the main session
 * re-runs everything after the merge, so its results are the newest and take the children's place.
 * A file Claude writes itself (source «told») stands for output the reader could not read.
 */
import { SAFE_ID, findRepo } from './repo'
import { readPlan } from './plan-data'
import { readSteps } from './plan-steps'
import type { StepSection } from './plan-steps'
import { parseTestOutput } from './test-output'
import type { Count, TestOutput } from './test-output'
import type { StageModel } from './types'

export type GroupResult = Count & { source: 'seen' | 'told'; at: string }
type ChecksFile = { v: 1; groups: Record<string, GroupResult> }

const RECORDED_PHASES = new Set(['build', 'test'])
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/

/** The name a group's result is kept under: its title, or the session's name when it has none. */
export const groupKey = (s: StepSection) => s.group ?? s.name

const dir = (main: string) => `${main}/blueprint/checks`

/** Every session's results for a stage, newest per group. */
export async function readChecks($: any, main: string, stageId: string): Promise<Record<string, GroupResult>> {
  const entries: { name: string; kind: string }[] = await $.fs.list(dir(main)).catch(() => [])
  const out: Record<string, GroupResult> = {}
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.startsWith(`${stageId}--`) || !entry.name.endsWith('.json')) continue
    const file: ChecksFile | null = await $.fs.read(`${dir(main)}/${entry.name}`).then(JSON.parse).catch(() => null)
    for (const [group, raw] of Object.entries(file?.groups ?? {})) {
      // a file Claude wrote by hand may miss a field: never let it break the view
      if (typeof raw?.passed !== 'number' || typeof raw?.total !== 'number') continue
      const r: GroupResult = { ...raw, failed: Array.isArray(raw.failed) ? raw.failed : [], at: String(raw.at ?? '') }
      if (!out[group] || out[group]!.at < r.at) out[group] = r
    }
  }
  return out
}

/** A command as typed, without rtk's prefix and with single spaces. */
const bare = (command: string) => command.trim().replace(/^rtk\s+(?:proxy\s+)?/, '').replace(/\s+/g, ' ')

/** A redirection (`2>&1`, `>out.txt`, `2> err.log`'s first word): ignored after a group's command. */
const REDIRECT = /^\d*>>?(?:&\d+)?\S*$|^\d*<\S*$/

/**
 * A flag's value («-k smoke», «--timeout 20000»): a word that is not itself a flag, a path or a
 * file name, so «pytest tests --lf tests/x.py» still runs another file and is not the key's.
 */
const flagValue = (w: string | undefined) => w !== undefined && !w.startsWith('-') && !/[\\/]|\.\w+$/.test(w)

/** Flags (with their value), and redirections only (a bare `>` takes the next word as its file). */
function onlyFlags(rest: string[]): boolean {
  for (let i = 0; i < rest.length; i++) {
    const w = rest[i]!
    if (/^\d*(?:>>?|<)$/.test(w)) { i++; continue }
    if (REDIRECT.test(w)) continue
    if (!w.startsWith('-')) return false
    // «--» ends the flags: what follows are arguments, never a value
    if (w !== '--' && !w.includes('=') && flagValue(rest[i + 1])) i++
  }
  return true
}

/**
 * Whether the command runs exactly the key's tests: in one of its parts (split on &&, ||, ; and |)
 * the key's words appear in a row with only flags or redirections after them; a launcher before
 * them is fine («python -m pytest tests/ml -q 2>&1 | tail -5»). «pytest tests/ml» is not run by
 * «pytest tests/ml/test_x.py».
 */
function runsKey(command: string, key: string): boolean {
  const k = bare(key).split(' ')
  return command.split(/&&|\|\||;|\|/).map(part => bare(part).split(' ')).some(words => {
    for (let i = 0; i + k.length <= words.length; i++) {
      const same = k.every((w, j) => words[i + j] === w)
      if (same && onlyFlags(words.slice(i + k.length))) return true
    }
    return false
  })
}

/** The counts that belong to one key: a test file's own block, or the whole run when the command is the key. */
function countFor(key: string, command: string, out: TestOutput): Count | null {
  const base = key.split(/[\\/]/).pop()!
  if (TEST_FILE.test(base) && out.files[base]) return out.files[base]!
  return runsKey(command, key) ? out : null
}

/** The stage this session works on: the parallel one in a child, the current one in the main session. */
async function stageOf($: any, main: string, child: boolean): Promise<StageModel | null> {
  const plan = await readPlan($, main)
  if (!plan) return null
  const ok = (s?: StageModel): s is StageModel => !!s && SAFE_ID.test(s.id) && s.type === 'implementation' && s.status === 'in_progress' && RECORDED_PHASES.has(s.phase ?? '')
  if (child) { const s = plan.stages[plan.parallelIndex]; return ok(s) ? s : null }
  // the main session: the first stage being built or tested, not merely the first one open (an
  // earlier stage may still wait at «integrate» for its pull request)
  return plan.stages.find(ok) ?? null
}

/** What Claude reads when a test run counted for no group. */
export const missNote = (stageId: string, out: Count) =>
  `[Blueprint] This command printed a test summary (${out.passed} of ${out.total} passed) but runs no group's «Test (…)» key in blueprint/plans/${stageId}.md, so the panel did not count it (no group matched). Run a group's command as written in its Test line (a launcher before it, flags, pipes and redirections after it are fine), or fix the key.`

/**
 * Records a command's test counts. Says what happened, so the hook can tell Claude when a test run
 * counted for no group (a key that does not match, or a command not written as in the plan):
 * otherwise the panel would show old numbers as if they were new.
 */
export async function recordRun($: any, command: string, output: string): Promise<{ note?: string }> {
  const repo = await findRepo($, String(await $.session.cwd()).replace(/\\/g, '/'))
  if (!repo) return {}
  const stage = await stageOf($, repo.main, !!repo.worktree)
  const out = stage && parseTestOutput(output)
  if (!stage || !out) return {}
  const at = new Date(await $.clock.now()).toISOString()
  const found: Record<string, GroupResult> = {}
  for (const section of await readSteps($, repo.main, stage)) {
    const count = section.testKey ? countFor(section.testKey, command, out) : null
    if (count) found[groupKey(section)] = { passed: count.passed, total: count.total, failed: count.failed, source: 'seen', at }
  }
  if (Object.keys(found).length === 0) {
    // only a known runner's summary is surely a test run: «2 failed attempts» in a git log is not
    return out.sure ? { note: missNote(stage.id, out) } : {}
  }
  const path = `${dir(repo.main)}/${stage.id}--${repo.worktree ?? 'main'}.json`
  await inTurn(async () => {
    const before: ChecksFile | null = await $.fs.read(path).then(JSON.parse).catch(() => null)
    if (!(await $.fs.exists(`${dir(repo.main)}/.gitignore`).catch(() => false))) await $.fs.write(`${dir(repo.main)}/.gitignore`, '*\n')
    await $.fs.write(path, JSON.stringify({ v: 1, groups: { ...(before?.groups ?? {}), ...found } }))
  })
  return {}
}

// Writes of the counts one after the other: two test commands that end together must not read the
// same old file and drop each other's group.
let queue: Promise<void> = Promise.resolve()
function inTurn(write: () => Promise<void>): Promise<void> {
  queue = queue.then(write, write)
  return queue
}

export function registerTestRecorder(on: any): void {
  on('tool.call', { tool: /^(?:Bash|PowerShell)$/ }, async ($: any, e: any, next: any) => {
    const result = await next(e)
    const stdout = result?.result?.stdout
    if (typeof e.command !== 'string' || typeof stdout !== 'string') return result
    // never fails the tool call: an error becomes a note for Claude instead of a silent stop
    const { note } = await recordRun($, e.command, `${stdout}\n${result.result.stderr ?? ''}`)
      .catch((err: unknown) => ({ note: `[Blueprint] The panel could not record these test counts: ${String((err as any)?.message ?? err).slice(0, 200)}` }))
    return note ? { ...result, context: [...(result.context ?? []), note] } : result
  })
}
