/*
 * Sessions data — merges `claude agents --json --all` with the child status files in
 * <main>/blueprint/sessions/, matches children to plan parts by slug, marks stale ones.
 * sessionsSummary() feeds the plan model and the status line: it must stay cheap (no process
 * run when the current stage has no independent parts; the sessions list cached 5 s).
 *
 * Rows come from the status files (one per worktree); the sessions list only adds the state
 * and the short id for `claude attach`. State of a row:
 *   blocked — the list says `blocked`, or a tool has been running for more than 10 minutes
 *   done    — the list says `done`
 *   ended   — updatedAt older than 60 s and the session absent from the list or not running
 *   running — otherwise
 * Files with updatedAt older than 7 days are ignored; a half-written file keeps its last value.
 */
import type { PlanModel, SessionsSummary } from './types'
import { slug } from './repo'

export type RowState = 'running' | 'blocked' | 'done' | 'ended'

export type SessionRow = {
  worktree: string
  name: string
  /** short id for `claude attach`; null when the session is not in the list */
  id: string | null
  state: RowState
  tool: string | null
  percent: number
  costUsd: number
  /** ms */
  startedAt: number
  updatedAt: number
}

export type Sessions = { parts: string[]; kids: SessionRow[]; others: SessionRow[] }

type Agent = { id?: string; sessionId?: string; name?: string; cwd?: string; state?: string }
type StatusFile = {
  sessionId: string; worktree: string; startedAt: string; updatedAt: string
  tool: string | null; since: string | null; context?: { percent?: number }; costUsd?: number
}

const LIST_CACHE_MS = 5_000
const STALE_MS = 60_000
const IGNORE_MS = 7 * 86_400_000
const STUCK_TOOL_MS = 10 * 60_000
const BLOCKED_FRESH_MS = 24 * 3_600_000

// shortcut: one cache per module (one project per session); keyed by main to stay correct anyway
let listCache: { main: string; at: number; agents: Promise<Agent[]> } | null = null
const lastGood = new Map<string, StatusFile>()

export function currentParts(plan: PlanModel | null): string[] {
  return plan?.stages[plan.parallelIndex]?.independentParts ?? []
}

async function listAgents($: any, main: string, now: number): Promise<Agent[]> {
  // the promise is cached too, so a refresh and a redraw never run two lists at once
  if (listCache && listCache.main === main && now - listCache.at < LIST_CACHE_MS) return listCache.agents
  const agents = runList($, main)
  listCache = { main, at: now, agents }
  return agents
}

async function runList($: any, main: string): Promise<Agent[]> {
  try {
    const out = await $.process.run(['claude', 'agents', '--json', '--all', '--cwd', main], { timeoutMs: 10_000 })
    const parsed = JSON.parse(out?.stdout ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] } // no list: rows keep their file data, stale ones show «terminata»
}

async function readStatus($: any, path: string): Promise<StatusFile | null> {
  try {
    const s = JSON.parse(await $.fs.read(path))
    if (s && typeof s.worktree === 'string' && typeof s.updatedAt === 'string') {
      lastGood.set(path, s)
      return s
    }
  } catch { /* half-written: fall back to the last good value */ }
  return lastGood.get(path) ?? null
}

async function readStatusFiles($: any, main: string): Promise<StatusFile[]> {
  const dir = `${main}/blueprint/sessions`
  let names: string[] = []
  try {
    names = (await $.fs.list(dir)).map((f: any) => String(f.name)).filter((n: string) => n.endsWith('.json'))
  } catch { return [] } // no sessions folder yet
  const files = await Promise.all(names.map(n => readStatus($, `${dir}/${n}`)))
  return files.filter((f): f is StatusFile => f !== null)
}

const isRunning = (a?: Agent) => a?.state === 'working' || a?.state === 'running'
const worktreeOf = (cwd?: string) => /\/worktrees\/([^/]+)\/?$/.exec((cwd ?? '').replace(/\\/g, '/'))?.[1]

/** The list's session for a file: same session id, else the newest session in the same worktree path. */
function agentFor(file: StatusFile, agents: Agent[], main?: string): Agent | undefined {
  const byId = agents.find(a => a.sessionId === file.sessionId)
  if (byId) return byId
  const here = (a: Agent) => main
    ? (a.cwd ?? '').replace(/\\/g, '/').replace(/\/$/, '') === `${main}/.claude/worktrees/${file.worktree}`
    : worktreeOf(a.cwd) === file.worktree
  return agents.filter(here).sort((a, b) => Number((b as any).startedAt ?? 0) - Number((a as any).startedAt ?? 0))[0]
}

export function toRow(file: StatusFile, agents: Agent[], now: number, main?: string): SessionRow {
  const agent = agentFor(file, agents, main)
  const updatedAt = Date.parse(file.updatedAt)
  const toolFor = file.tool && file.since ? now - Date.parse(file.since) : 0
  // a session left «blocked» for days is dead, not waiting: only a recent file can wait for you
  const recent = now - updatedAt <= BLOCKED_FRESH_MS
  let state: RowState = 'running'
  if (agent?.state === 'done') state = 'done'
  else if (now - updatedAt > STALE_MS && !isRunning(agent) && !(agent?.state === 'blocked' && recent)) state = 'ended'
  else if ((agent?.state === 'blocked' && recent) || toolFor > STUCK_TOOL_MS) state = 'blocked'
  return {
    worktree: file.worktree,
    name: agent?.name || file.worktree,
    id: agent?.id ?? null,
    state,
    tool: file.tool,
    percent: Number(file.context?.percent ?? 0),
    costUsd: Number(file.costUsd ?? 0),
    startedAt: Date.parse(file.startedAt) || updatedAt,
    updatedAt,
  }
}

/** The rows of the current stage's children and of the other sessions with a status file. */
export async function readSessions($: any, main: string, plan: PlanModel | null): Promise<Sessions> {
  const parts = currentParts(plan)
  if (parts.length === 0) return { parts, kids: [], others: [] }
  const now: number = await $.clock.now()
  const files = (await readStatusFiles($, main)).filter(f => now - Date.parse(f.updatedAt) <= IGNORE_MS)
  // rows come only from the files: with none, skip the list (a `claude agents` process each time)
  if (files.length === 0) return { parts, kids: [], others: [] }
  const agents = await listAgents($, main, now)
  const wanted = new Set(parts.map(slug))
  const rows = files.map(f => toRow(f, agents, now, main)).sort((a, b) => a.startedAt - b.startedAt)
  return { parts, kids: rows.filter(r => wanted.has(r.worktree)), others: rows.filter(r => !wanted.has(r.worktree)) }
}

export async function sessionsSummary($: any, main: string, plan: PlanModel | null): Promise<SessionsSummary> {
  const { kids } = await readSessions($, main, plan)
  return {
    kids: kids.length,
    blocked: kids.filter(k => k.state === 'blocked').map(k => ({ worktree: k.worktree, reason: k.tool ?? 'blocked' })),
  }
}
