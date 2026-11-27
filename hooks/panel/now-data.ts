/*
 * What the «Adesso» card says (letter A of stage «Il pannello come cruscotto»), built only from
 * data the panel already reads: the current stage, the plain plan's step in progress, the test
 * counts, the open review findings, the children's status, and what the main session is doing.
 * `mode`: working (a stage in progress), yourTurn (it waits for the user), idle (nothing runs).
 * Signals are what went wrong or waits, each pointing at the phase that shows it.
 */
import type { Lang, PlanModel, StageModel } from './types'
import { tr } from './text'
import { readSteps } from './plan-steps'
import { readChecks } from './checks'
import { howMany, openOnes, readReviews } from './reviews'
import { readSessions } from './sessions-data'
import { activity } from './activity'
import { duration } from './sessions-view'

export type Signal = { key: string; shape: 'fail' | 'wait'; text: string; stageId: string; phase: string }
export type NowLine = { who: string; role: 'mother' | 'child' | 'single'; what: string; tool?: string; since?: number }
export type NowModel = { mode: 'working' | 'yourTurn' | 'idle'; stage?: StageModel; since?: number; lines: NowLine[]; wait?: string; signals: Signal[] }

/** A child waiting for this long is a problem worth a signal. */
const STUCK_MS = 10 * 60_000

const phaseName = (lang: Lang, stage: StageModel) => tr(lang, `ph_${stage.phase ?? ''}`)

/** What each session works on: the step in progress of an implementation, else the phase and topic. */
async function linesOf($: any, main: string, stage: StageModel, lang: Lang): Promise<NowLine[]> {
  const me = activity()
  const mine = { ...(me.tool ? { tool: me.tool } : {}), ...(me.since !== null && me.tool ? { since: me.since } : {}) }
  if (stage.type === 'implementation') {
    const sections = await readSteps($, main, stage)
    const out: NowLine[] = []
    for (const s of sections) {
      const live = s.steps.find(st => st.state === 'running' || st.state === 'stopped')
      const who = s.role === 'single' ? tr(lang, 'mainSession') : s.name
      if (!live || out.some(l => l.who === who)) continue // one line per session
      out.push({ who, role: s.role, what: live.text, ...(s.role === 'child' ? {} : mine) })
    }
    return out.length > 0 ? out : [{ who: tr(lang, 'mainSession'), role: 'single', what: phaseName(lang, stage), ...mine }]
  }
  const topic = stage.topics.find(t => t.current) ?? stage.topics.find(t => !t.done)
  const what = stage.type === 'discussion' && topic
    ? tr(lang, 'nowTopic', { n: stage.topics.indexOf(topic) + 1, m: stage.topics.length, name: topic.name, phase: tr(lang, `ph_${topic.phase ?? stage.phase ?? ''}`) })
    : topic ? `${phaseName(lang, stage)} · ${topic.name}` : phaseName(lang, stage)
  return [{ who: tr(lang, 'mainSession'), role: 'single', what, ...mine }]
}

/** What went wrong or waits: failed test groups, open review findings, a child stuck for long. */
async function signalsOf($: any, main: string, plan: PlanModel, stage: StageModel, lang: Lang, now: number): Promise<Signal[]> {
  const out: Signal[] = []
  if (stage.type === 'implementation') {
    for (const [group, r] of Object.entries(await readChecks($, main, stage.id))) {
      if (r.passed >= r.total) continue
      const letter = /^([A-Z])\./.exec(group)?.[1] ?? group
      out.push({ key: `test:${group}`, shape: 'fail', text: tr(lang, r.total - r.passed === 1 ? 'nowFailedOne' : 'nowFailed', { n: r.total - r.passed, group: letter }), stageId: stage.id, phase: 'test' })
    }
    const reviews = await readReviews($, main, stage.id)
    const open = reviews ? openOnes(reviews).length : 0
    if (open > 0) out.push({ key: 'review', shape: 'wait', text: tr(lang, 'nowReview', { what: howMany(lang, open) }), stageId: stage.id, phase: 'review' })
  }
  // the children belong to the stage built in parallel: read them once, for that stage only
  if (stage.independentParts.length > 0 && plan.stages[plan.parallelIndex] === stage) {
    for (const kid of (await readSessions($, main, plan)).kids) {
      if (kid.state !== 'blocked' || now - kid.updatedAt < STUCK_MS) continue
      out.push({ key: `kid:${kid.worktree}`, shape: 'fail', text: tr(lang, 'nowKidStuck', { who: kid.name, t: duration(now - kid.updatedAt) }), stageId: stage.id, phase: stage.phase ?? '' })
    }
  }
  return out
}

export async function nowModel($: any, main: string, plan: PlanModel | null, lang: Lang): Promise<NowModel> {
  const stage = plan?.stages[plan.currentIndex]
  if (!plan || !stage || stage.status !== 'in_progress') return { mode: 'idle', lines: [], signals: [] }
  const now: number = await $.clock.now()
  const me = activity()
  const lines = await linesOf($, main, stage, lang).catch(() => [])
  // a later stage in its test or review phase (the current one may wait at «integrate») signals too
  const tested = plan.stages.find(s => s !== stage && s.type === 'implementation' && s.status === 'in_progress' && (s.phase === 'test' || s.phase === 'review'))
  const signals = [
    ...(await signalsOf($, main, plan, stage, lang, now).catch(() => [])),
    ...(tested ? await signalsOf($, main, plan, tested, lang, now).catch(() => []) : []),
  ]
  if (stage.yourTurn) {
    const at = stage.phases.find(p => p.state === 'stopped')
    const wait = stage.waitingOn.length > 0
      ? tr(lang, 'waitChild', { who: stage.waitingOn.join(', ') })
      : tr(lang, 'waitPhase', { phase: tr(lang, `ph_${at?.id ?? stage.phase ?? ''}`) })
    return { mode: 'yourTurn', stage, ...(me.idleSince !== null ? { since: me.idleSince } : {}), lines, wait, signals }
  }
  return { mode: 'working', stage, ...(me.since !== null ? { since: me.since } : {}), lines, signals }
}
