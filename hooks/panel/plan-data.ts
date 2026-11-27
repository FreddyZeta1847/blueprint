/*
 * Reads Blueprint's plan for the panel: blueprint/plan.json, the summary lines of
 * blueprint/context.md and the plugin's data/loops.json, and turns them into a PlanModel.
 * Bars: one segment per loop phase, for every stage type (a discussion shows the phases of the topic being discussed); a running
 * phase becomes "stopped" when it needs the user (user: true) or a child of the stage is
 * blocked. An unreadable plan gives null; the caller keeps its last good model.
 */
import { SAFE_ID } from './repo'
import type { PhaseState, PlanModel, SessionsSummary, StageModel } from './types'

type LoopPhase = { id: string; optional?: boolean; user?: boolean }
export type Loops ={ types: Record<string, { cycle: string; phases: LoopPhase[] }> }
type RawTopic = { name: string; done?: boolean; phase?: string }
type RawStage = {
  id: string; name: string; type: string; status: string; phase?: string
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

/**
 * Whether the plain plan is written to the end: every letter (`### `) has its Tasks (`#### `), each
 * with sub-tasks — or, in the older format, its checkbox steps. A plan written letter by letter is
 * not complete after the first one.
 */
export function plansComplete(text: string): boolean {
  let letters = 0; let ok = true
  let inLetter = false; let letterTasks = 0; let letterBoxes = 0
  let inTask = false; let taskBoxes = 0
  const closeTask = () => { if (inTask && taskBoxes === 0) ok = false; inTask = false; taskBoxes = 0 }
  const closeLetter = () => {
    closeTask()
    if (inLetter && letterTasks === 0 && letterBoxes === 0) ok = false
    inLetter = false; letterTasks = 0; letterBoxes = 0
  }
  for (const line of text.split(/\r?\n/)) {
    if (/^### /.test(line)) { closeLetter(); inLetter = true; letters++ }
    else if (/^#### /.test(line)) { closeTask(); inTask = true; letterTasks++ }
    else if (/^## /.test(line)) closeLetter()
    else if (/^[ \t]*- \[[ xX]\] /.test(line)) { taskBoxes++; letterBoxes++ }
  }
  closeLetter()
  return ok && letters > 0
}

/**
 * The plan phase waits for the user only once both plans are written: the plain plan is complete.
 * Before that Claude is still writing them, and a «tocca a te» (and its push) would come too early
 * and never again when the plans are ready.
 */
async function plansReady($: any, main: string, stage: RawStage): Promise<boolean> {
  if (stage.status !== 'in_progress' || stage.phase !== 'plan' || !SAFE_ID.test(stage.id)) return false
  const text: string = await $.fs.read(`${main}/blueprint/plans/${stage.id}.md`).catch(() => '')
  return plansComplete(text)
}

function perStage(stage: RawStage, phases: LoopPhase[], stopRunning: boolean, planReady: boolean) {
  const skipped = new Set((stage.skipped ?? []).map(s => s.id))
  const at = phases.findIndex(p => p.id === stage.phase)
  const rail = phases.map((p, i): { id: string; state: PhaseState; user?: boolean } => {
    let state: PhaseState = 'todo'
    // a stage closed at an earlier phase (an implementation done at first use before 3.6.0) never did the rest
    if (stage.status === 'done') state = skipped.has(p.id) || (at >= 0 && i > at) ? 'skipped' : 'done'
    else if (stage.status === 'in_progress' && at >= 0) {
      if (i < at) state = skipped.has(p.id) ? 'skipped' : 'done'
      else if (i === at) state = (p.user && (p.id !== 'plan' || planReady)) || stopRunning ? 'stopped' : 'running'
    }
    return { id: p.id, state, ...(p.user ? { user: true } : {}) }
  })
  return { rail }
}

/** A discussion's phases are those of the topic being discussed; done when the stage is. */
function perStep(stage: RawStage, phases: LoopPhase[]) {
  const topics = stage.topics ?? []
  const lead = topics.find(t => !t.done && t.phase)
  const at = phases.findIndex(p => p.id === lead?.phase)
  const rail = phases.map((p, i): { id: string; state: PhaseState; user?: boolean } => ({
    id: p.id, ...(p.user ? { user: true } : {}),
    state: stage.status === 'done' ? 'done' : at < 0 ? 'todo' : i < at ? 'done' : i === at ? (p.user ? 'stopped' : 'running') : 'todo',
  }))
  return { rail }
}

function toStage(stage: RawStage, loops: Loops, isCurrent: boolean, sessions?: SessionsSummary, planReady = false): StageModel {
  const loop = loops.types[stage.type] ?? { cycle: 'per_stage', phases: [] }
  const blocked = isCurrent && (sessions?.blocked.length ?? 0) > 0
  const { rail } = loop.cycle === 'per_step' ? perStep(stage, loop.phases) : perStage(stage, loop.phases, blocked, planReady)
  const segments = rail.map(r => r.state) // the closed bar and the open rail say the same thing: the phases
  const firstOpen = (stage.topics ?? []).findIndex(t => !t.done)
  return {
    id: stage.id, name: stage.name, type: stage.type, status: stage.status, phase: stage.phase,
    segments, phases: rail,
    yourTurn: stage.status === 'in_progress' && segments.includes('stopped'),
    kids: isCurrent ? sessions?.kids ?? 0 : 0,
    waitingOn: isCurrent ? (sessions?.blocked ?? []).map(b => b.worktree) : [],
    deadline: stage.deadline, independentParts: stage.independent_parts ?? [],
    topics: (stage.topics ?? []).map((t, i) => ({
      name: t.name, done: !!t.done, phase: t.phase,
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
  // the children belong to the running stage built in parallel, even when another stage runs too
  const found = stages.findIndex(s => s.status === 'in_progress' && (s.independent_parts?.length ?? 0) > 0)
  const parallel = found >= 0 ? found : current
  const ready = await Promise.all(stages.map(s => plansReady($, main, s)))
  return {
    project: String(raw.project ?? ''),
    stages: stages.map((s, i) => toStage(s, loops, i === parallel, sessions, ready[i])),
    currentIndex: current,
    parallelIndex: parallel,
  }
}
