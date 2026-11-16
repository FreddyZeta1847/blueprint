/*
 * Shared types of Blueprint's panel: the plan model the Piano view draws, the summary of the
 * child sessions the plan model and the status line use, and the context every view receives.
 * Files store neutral codes only (done, running, stopped, todo, skipped); words come from text.ts.
 */
export type Lang = 'it' | 'en'

export type PhaseState = 'done' | 'running' | 'stopped' | 'todo' | 'skipped'

export type TopicModel = { name: string; done: boolean; current: boolean }

export type StageModel = {
  id: string
  name: string
  type: string
  status: string
  phase?: string
  /** One per phase of the loop (per-stage types) or one per topic (discussion). */
  segments: PhaseState[]
  /** The loop's phases with their state, for the phase rail of an open stage. */
  phases: { id: string; state: PhaseState }[]
  yourTurn: boolean
  deadline?: string
  independentParts: string[]
  topics: TopicModel[]
  how?: string
}

export type PlanModel = {
  project: string
  card?: { size: string; difficulty: string; pace: string }
  stages: StageModel[]
  currentIndex: number
}

export type SessionsSummary = { kids: number; blocked: { worktree: string; reason: string }[] }

/**
 * What every view receives besides `$`. The engine forbids putting `$` in an object:
 * views take it as their first parameter, e.g. renderPlanView($, ctx, plan).
 */
export type ViewCtx = {
  /** The surface's element table: $.ui.resolve(e). */
  el: any
  lang: Lang
  /** The main checkout's absolute path, with forward slashes. */
  main: string
  surface: string
}
