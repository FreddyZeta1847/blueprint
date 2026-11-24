/*
 * The review's findings (groups E and F of stage «Test e revisione»). The main session runs the
 * review tools chosen at the stage's opening and writes what they found to
 * blueprint/reviews/<stage id>.json (format below). The panel shows them; «Correggi» /
 * «Correggi tutto» send them to Claude with $.prompt.submit (a turn of its own once the session is
 * idle), and so does the countdown, 30 s after the round was written. Sent findings are marked
 * `sent` in the file before the prompt goes, so a reload never sends them twice. After fixing,
 * Claude runs the tools again and writes the next round; a round with no finding ends the review.
 * On round 3 with findings still open nothing is sent: it is the user's turn.
 * The countdown runs only for a round that appeared while this session was open (a round already
 * there when the session started, e.g. in a cloned project, waits for a press), and is timed from
 * when this session first saw it, never from the file's own clock. Only one sending at a time, and
 * one session per round (a `.sent-by` file next to the round).
 */
import type { Lang, PlanModel } from './types'
import { tr } from './text'
import { SAFE_ID } from './repo'

export type Finding = { id: string; tool: string; severity: 'high' | 'medium' | 'low'; text: string; status: 'open' | 'sent' | 'fixed' }
/** `tools`: every tool that ran this round, so one that found nothing can say so. */
/** A past round, as it ended (its findings fixed or still open). */
export type PastRound = { round: number; foundAt?: string; tools?: string[]; findings: Finding[] }
/** `history`: the rounds before this one, so the panel can add them up («12 problemi in 2 giri»). */
export type Reviews = { v: 1; round: number; foundAt: string; tools?: string[]; findings: Finding[]; history?: PastRound[] }

/** Every finding of every round, each with the round that found it, the past rounds first. */
export function allFindings(r: Reviews): (Finding & { round: number })[] {
  const past = (Array.isArray(r.history) ? r.history : [])
    .filter(h => h && Array.isArray(h.findings))
    .flatMap(h => h.findings.map(f => ({ ...f, round: Number(h.round) || 0 })))
  return [...past, ...r.findings.map(f => ({ ...f, round: r.round }))]
}

export const AUTO_FIX_MS = 30_000
export const MAX_ROUNDS = 3

const dir = (main: string) => `${main}/blueprint/reviews`
const file = (main: string, stageId: string) => `${dir(main)}/${stageId}.json`

export async function readReviews($: any, main: string, stageId: string): Promise<Reviews | null> {
  if (!SAFE_ID.test(stageId)) return null
  const r = await $.fs.read(file(main, stageId)).then(JSON.parse).catch(() => null)
  return r && Array.isArray(r.findings) ? { ...r, round: Number(r.round) || 1 } : null
}

export const openOnes = (r: Reviews) => r.findings.filter(f => f.status === 'open')
export const stuck = (r: Reviews) => r.round >= MAX_ROUNDS && openOnes(r).length > 0
export const howMany = (lang: Lang, n: number) => (n === 1 ? tr(lang, 'reviewOne') : tr(lang, 'reviewMany', { n }))

// Module memory: when this session first refreshed, and when it first saw each round.
let startedAt: number | null = null
const firstSeen = new Map<string, number>()
let sending = false

/** Called on the session's first refresh: rounds already there then wait for a press. */
export function markStart(now: number): void {
  if (startedAt === null) startedAt = now
}

/**
 * Seconds before a round fixes itself, or null when it waits for a press: a round already there
 * when the session started, or seen before the session's first refresh.
 */
export function secondsLeft(stageId: string, r: Reviews, now: number): number | null {
  if (startedAt === null) return null
  const key = `${stageId}:${r.round}:${r.foundAt}`
  if (!firstSeen.has(key)) firstSeen.set(key, now)
  const seen = firstSeen.get(key)!
  if (seen <= startedAt) return null
  return Math.max(0, Math.ceil((seen + AUTO_FIX_MS - now) / 1000))
}

/** Marks the chosen open findings `sent`, then asks Claude to fix them, in one message. */
export async function sendFixes($: any, main: string, stageId: string, ids: string[] | 'all', lang: Lang): Promise<void> {
  if (sending) return
  sending = true
  try { await sendNow($, main, stageId, ids, lang) } finally { sending = false }
}

async function sendNow($: any, main: string, stageId: string, ids: string[] | 'all', lang: Lang): Promise<void> {
  const r = await readReviews($, main, stageId)
  if (!r || stuck(r)) return
  const chosen = openOnes(r).filter(f => ids === 'all' || ids.includes(f.id))
  if (chosen.length === 0) return
  const sent = new Set(chosen.map(f => f.id))
  const next = { ...r, findings: r.findings.map(f => (sent.has(f.id) ? { ...f, status: 'sent' as const } : f)) }
  if (!(await $.fs.exists(`${dir(main)}/.gitignore`).catch(() => false))) await $.fs.write(`${dir(main)}/.gitignore`, '*\n')
  await $.fs.write(file(main, stageId), JSON.stringify(next, null, 2))
  const list = chosen.map(f => `- [${f.tool} · ${tr(lang, `sev_${f.severity}`)}] ${f.text} (${f.id})`).join('\n')
  await $.prompt.submit({ text: tr(lang, 'fixPrompt', { stage: stageId, r: r.round, list }) })
}

/**
 * The countdown of the current stage, when it is in its review phase with open findings: the
 * seconds left, or null when there is none. At 0 it sends every open finding.
 */
export async function autoFix($: any, main: string, plan: PlanModel | null, lang: Lang): Promise<{ open: number; seconds: number } | null> {
  const stage = plan?.stages[plan.currentIndex]
  if (!stage || stage.type !== 'implementation' || stage.status !== 'in_progress' || stage.phase !== 'review') return null
  const r = await readReviews($, main, stage.id)
  if (!r || stuck(r)) return null
  const open = openOnes(r).length
  if (open === 0) return null
  const seconds = secondsLeft(stage.id, r, await $.clock.now())
  if (seconds === null) return null
  if (seconds > 0) return { open, seconds }
  if (await claim($, main, stage.id, r.round)) await sendFixes($, main, stage.id, 'all', lang)
  return null
}

/** One session sends a round: the first to write its id in the round's `.sent-by` file. */
async function claim($: any, main: string, stageId: string, round: number): Promise<boolean> {
  const lock = `${dir(main)}/${stageId}.r${round}.sent-by`
  const me = String(await $.session.id().catch(() => 'this'))
  const holder = await $.fs.read(lock).catch(() => null)
  if (holder !== null) return holder.trim() === me
  await $.fs.write(lock, me)
  return (await $.fs.read(lock).catch(() => '')).trim() === me
}
