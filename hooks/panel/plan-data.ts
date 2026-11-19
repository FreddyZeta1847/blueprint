/*
 * Reads Blueprint's plan for the panel: blueprint/plan.json, the summary lines of
 * blueprint/context.md and the plugin's data/loops.json, and turns them into a PlanModel.
 * Bars: one segment per loop phase, for every stage type (a discussion shows the phases of the topic being discussed); a running
 * phase becomes "stopped" when it needs the user (user: true) or a child of the stage is
 * blocked. An unreadable plan gives null; the caller keeps its last good model.
 */
import type { PhaseState, PlanModel, SessionsSummary, StageModel } from './types'

type LoopPhase = { id: string; optional?: boolean; user?: boolean }
export type Loops ={ types: Record<string, { cycle: string; phases: LoopPhase[] }> }
type RawTopic = { name: string; done?: boolean; phase?: string }
type RawStage = {
  id: string; name: string; type: string; status: string; phase?: string; how?: string
  deadline?: string; independent_parts?: string[]; topics?: RawTopic[]; skipped?: { id: string }[]
}

async function readJson($: any, path: string): Promise<any | null> {
  try { return JSON.parse(await $.fs.read(path)) } catch { return null }
}

/** The plugin's stage loops (data/loops.json), or null when they cannot be read. */
export async function readLoops($: any): Promise<Loops | null> {
  const loops = await readJson($, `${$.plugin.root}/data/loops.json`)
  return loops?.types ? loops : null
}

/** "Size: project — un sito" → "project": the first part of a card line, before the dash. */
function cardLine(text: string, key: string): string | undefined {
  const m = new RegExp(`^${key}:\\s*(.+)$`, 'mi').exec(text)
  return m?.[1]?.split(/\s+[—–-]\s+/)[0]?.trim()
}

async function readCard($: any, main: string): Promise<PlanModel['card']> {
  const text: string = await $.fs.read(`${main}/blueprint/context.md`).catch(() => '')
  const size = cardLine(text, 'Size'); const difficulty = cardLine(text, 'Difficulty'); const pace = cardLine(text, 'Pace')
  return size && difficulty && pace ? { size, difficulty, pace } : undefined
}

function perStage(stage: RawStage, phases: LoopPhase[], stopRunning: boolean) {
  const skipped = new Set((stage.skipped ?? []).map(s => s.id))
  const at = phases.findIndex(p => p.id === stage.phase)
  const rail = phases.map((p, i): { id: string; state: PhaseState } => {
    let state: PhaseState = 'todo'
    if (stage.status === 'done') state = skipped.has(p.id) ? 'skipped' : 'done'
    else if (stage.status === 'in_progress' && at >= 0) {
      if (i < at) state = skipped.has(p.id) ? 'skipped' : 'done'
      else if (i === at) state = p.user || stopRunning ? 'stopped' : 'running'
    }
    return { id: p.id, state }
  })
  return { rail }
}

/** A discussion's phases are those of the topic being discussed; done when the stage is. */
function perStep(stage: RawStage, phases: LoopPhase[]) {
  const topics = stage.topics ?? []
  const lead = topics.find(t => !t.done && t.phase)
  const at = phases.findIndex(p => p.id === lead?.phase)
  const rail = phases.map((p, i): { id: string; state: PhaseState } => ({
    id: p.id,
    state: stage.status === 'done' ? 'done' : at < 0 ? 'todo' : i < at ? 'done' : i === at ? (p.user ? 'stopped' : 'running') : 'todo',
  }))
  return { rail }
}

function toStage(stage: RawStage, loops: Loops, isCurrent: boolean, sessions?: SessionsSummary): StageModel {
  const loop = loops.types[stage.type] ?? { cycle: 'per_stage', phases: [] }
  const blocked = isCurrent && (sessions?.blocked.length ?? 0) > 0
  const { rail } = loop.cycle === 'per_step' ? perStep(stage, loop.phases) : perStage(stage, loop.phases, blocked)
  const segments = rail.map(r => r.state) // the closed bar and the open rail say the same thing: the phases
  const firstOpen = (stage.topics ?? []).findIndex(t => !t.done)
  return {
    id: stage.id, name: stage.name, type: stage.type, status: stage.status, phase: stage.phase,
    segments, phases: rail,
    yourTurn: stage.status === 'in_progress' && segments.includes('stopped'),
    kids: isCurrent ? sessions?.kids ?? 0 : 0,
    waitingOn: isCurrent ? (sessions?.blocked ?? []).map(b => b.worktree) : [],
    deadline: stage.deadline, independentParts: stage.independent_parts ?? [], how: stage.how,
    topics: (stage.topics ?? []).map((t, i) => ({
      name: t.name, done: !!t.done,
      current: stage.status === 'in_progress' && !t.done && (loop.cycle === 'per_step' ? !!t.phase : i === firstOpen),
    })),
  }
}

export async function readPlan($: any, main: string, sessions?: SessionsSummary): Promise<PlanModel | null> {
  const raw = await readJson($, `${main}/blueprint/plan.json`)
  const loops: Loops | null = await readJson($, `${$.plugin.root}/data/loops.json`)
  if (!raw || !Array.isArray(raw.stages) || !loops?.types) return null
  const stages = raw.stages as RawStage[]
  let current = stages.findIndex(s => s.status === 'in_progress')
  if (current < 0) current = stages.findIndex(s => s.status === 'todo')
  if (current < 0) current = Math.max(stages.length - 1, 0)
  return {
    project: String(raw.project ?? ''),
    card: await readCard($, main),
    stages: stages.map((s, i) => toStage(s, loops, i === current, sessions)),
    currentIndex: current,
  }
}
