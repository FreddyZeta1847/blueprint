/*
 * Vista Piano — the plan's stages as rows (segmented phase bar, ticked circle when done,
 * pills «tocca a te» / «N figlie» / deadline); a press opens a stage: phase rail, wait reason,
 * topics, decisions, how, notes with a field to add one. Mockup D, decisions «Mockup del pannello».
 * PLACEHOLDER written by the mother: the child «vista-piano» replaces this body (Tasks A1–A3).
 */
import type { PlanModel, ViewCtx } from './types'

export async function renderPlanView(_$: any, ctx: ViewCtx, plan: PlanModel | null) {
  const { Text } = ctx.el
  return <Text dimColor>{plan ? `${plan.stages.length} stages` : '—'}</Text>
}
