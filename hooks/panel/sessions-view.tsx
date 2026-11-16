/*
 * Vista Sessioni — the mother and the child sessions of the parallel stage as a table
 * (state, context bar, time, cost, tool or wait reason), «↗ entra nella sessione» per child,
 * the stage total and the notification switch. Mockup D-sessioni.
 * PLACEHOLDER written by the mother: the child «vista-sessioni» replaces this body (Task B3).
 */
import type { PlanModel, ViewCtx } from './types'

export async function renderSessionsView(_$: any, ctx: ViewCtx, plan: PlanModel | null) {
  const { Text } = ctx.el
  return <Text dimColor>{plan ? plan.project : '—'}</Text>
}
