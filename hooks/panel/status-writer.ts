/*
 * Status writer — in a child session (a linked worktree of a repository with a Blueprint
 * plan) writes <main>/blueprint/sessions/<worktree>.json, schema v1, at most every 2 s.
 * Registered once from the entry; at session.start it decides whether this session writes.
 * The entry owns the unmatched session.start hook (the engine allows one per event), so the
 * writer hooks it twice with a matcher that together covers every session.
 *
 * What it writes: ids, times, turns, the tool running now (name only), the last tool,
 * context % and cost. Never prompts, code or tool arguments. The folder gets a .gitignore
 * with `*` on the first write. A burst of tool calls gives one write now plus one trailing
 * write ($.clock.after) carrying the latest state.
 */
import { findRepo } from './repo'

const MIN_GAP_MS = 2000

type Writer = {
  target: { dir: string; worktree: string } | null
  startedAt: string
  tool: string | null
  since: string | null
  lastTool: string | null
  lastWrite: number
  trailing: boolean
  gitignored: boolean
}

const fresh = (): Writer => ({
  target: null, startedAt: '', tool: null, since: null, lastTool: null,
  lastWrite: -Infinity, trailing: false, gitignored: false,
})

// Module memory: rebuilt on every register (a reload starts it over).
let w: Writer = fresh()

const iso = (ms: number) => new Date(ms).toISOString()

async function decide($: any, cwd: string): Promise<void> {
  const repo = await findRepo($, cwd)
  const hasPlan = !!repo?.worktree && (await $.fs.exists(`${repo.main}/blueprint/plan.json`).catch(() => false))
  if (!repo?.worktree || !hasPlan) return
  w.target = { dir: `${repo.main}/blueprint/sessions`, worktree: repo.worktree }
  w.startedAt = iso((await $.session.usage())?.startedAt ?? (await $.clock.now()))
}

async function writeStatus($: any): Promise<void> {
  const target = w.target
  if (!target) return
  const usage = await $.session.usage()
  const status = {
    v: 1,
    sessionId: await $.session.id(),
    worktree: target.worktree,
    startedAt: w.startedAt,
    updatedAt: iso(await $.clock.now()),
    turns: await $.session.turns(),
    tool: w.tool, since: w.since, lastTool: w.lastTool,
    context: { percent: Math.round(usage?.context?.percent ?? 0) },
    costUsd: usage?.cost?.usd ?? 0,
  }
  if (!w.gitignored) {
    await $.fs.write(`${target.dir}/.gitignore`, '*\n')
    w.gitignored = true
  }
  await $.fs.write(`${target.dir}/${target.worktree}.json`, JSON.stringify(status))
}

async function trailingWrite($: any): Promise<void> {
  w.trailing = false
  w.lastWrite = await $.clock.now()
  await writeStatus($).catch(() => undefined)
}

// One write now if the last was 2 s ago; otherwise one trailing write when the gap ends.
async function schedule($: any): Promise<void> {
  const now: number = await $.clock.now()
  if (now - w.lastWrite >= MIN_GAP_MS) {
    w.lastWrite = now
    await writeStatus($).catch(() => undefined)
    return
  }
  if (w.trailing) return
  w.trailing = true
  $.clock.after(MIN_GAP_MS - (now - w.lastWrite), () => void trailingWrite($))
}

async function onStart($: any, e: any, next: any) {
  const result = await next(e)
  w = fresh()
  await decide($, e.cwd).catch(() => undefined)
  if (w.target) await schedule($)
  return result
}

export function registerStatusWriter(on: any): void {
  w = fresh()
  on('session.start', { isInteractive: true }, onStart)
  on('session.start', { isInteractive: false }, onStart)
  // one write per finished turn too (turns and context change between tool calls)
  on('turn.complete', async ($: any, e: any, next: any) => {
    const result = await next(e)
    if (w.target) await schedule($)
    return result
  })
  on('tool.call', async ($: any, e: any, next: any) => {
    if (!w.target) return next(e)
    const name = String(e.tool)
    w.tool = name
    w.since = iso(await $.clock.now())
    await schedule($)
    try {
      return await next(e)
    } finally {
      w.lastTool = name
      if (w.tool === name) { w.tool = null; w.since = null } // a parallel call may hold the slot
      await schedule($)
    }
  })
}
