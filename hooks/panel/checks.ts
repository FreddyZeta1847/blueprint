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
import { findRepo } from './repo'
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
    for (const [group, r] of Object.entries(file?.groups ?? {})) {
      if (!out[group] || out[group]!.at < r.at) out[group] = r
    }
  }
  return out
}

/** A command as typed, without rtk's prefix and with single spaces. */
const bare = (command: string) => command.trim().replace(/^rtk\s+(?:proxy\s+)?/, '').replace(/\s+/g, ' ')

/** The counts that belong to one key: a test file's own block, or the whole run when the command names the key. */
function countFor(key: string, command: string, out: TestOutput): Count | null {
  const base = key.split(/[\\/]/).pop()!
  if (TEST_FILE.test(base) && out.files[base]) return out.files[base]!
  return bare(command).includes(bare(key)) ? out : null
}

/** The stage this session works on: the parallel one in a child, the current one in the main session. */
async function stageOf($: any, main: string, child: boolean): Promise<StageModel | null> {
  const plan = await readPlan($, main)
  const stage = plan ? plan.stages[child ? plan.parallelIndex : plan.currentIndex] : undefined
  const ok = stage && stage.type === 'implementation' && stage.status === 'in_progress' && RECORDED_PHASES.has(stage.phase ?? '')
  return ok ? stage : null
}

export async function recordRun($: any, command: string, output: string): Promise<void> {
  const repo = await findRepo($, String(await $.session.cwd()).replace(/\\/g, '/'))
  if (!repo) return
  const stage = await stageOf($, repo.main, !!repo.worktree)
  const out = stage && parseTestOutput(output)
  if (!stage || !out) return
  const at = new Date(await $.clock.now()).toISOString()
  const found: Record<string, GroupResult> = {}
  for (const section of await readSteps($, repo.main, stage)) {
    const count = section.testKey ? countFor(section.testKey, command, out) : null
    if (count) found[groupKey(section)] = { passed: count.passed, total: count.total, failed: count.failed, source: 'seen', at }
  }
  if (Object.keys(found).length === 0) return
  const path = `${dir(repo.main)}/${stage.id}--${repo.worktree ?? 'main'}.json`
  const before: ChecksFile | null = await $.fs.read(path).then(JSON.parse).catch(() => null)
  if (!(await $.fs.exists(`${dir(repo.main)}/.gitignore`).catch(() => false))) await $.fs.write(`${dir(repo.main)}/.gitignore`, '*\n')
  await $.fs.write(path, JSON.stringify({ v: 1, groups: { ...(before?.groups ?? {}), ...found } }))
}

export function registerTestRecorder(on: any): void {
  on('tool.call', { tool: /^(?:Bash|PowerShell)$/ }, async ($: any, e: any, next: any) => {
    const result = await next(e)
    const stdout = result?.result?.stdout
    if (typeof e.command === 'string' && typeof stdout === 'string') {
      await recordRun($, e.command, `${stdout}\n${result.result.stderr ?? ''}`).catch(() => undefined) // never fails the tool call
    }
    return result
  })
}
