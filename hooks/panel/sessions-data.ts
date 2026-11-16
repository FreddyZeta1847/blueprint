/*
 * Sessions data — merges `claude agents --json --all` with the child status files in
 * <main>/blueprint/sessions/, matches children to plan parts by slug, marks stale ones.
 * sessionsSummary() feeds the plan model and the status line: it must stay cheap (no process
 * run when the current stage has no independent parts; results cached at least 5 s).
 * PLACEHOLDER written by the mother: the child «vista-sessioni» replaces this body (Task B2).
 */
import type { PlanModel, SessionsSummary } from './types'

export async function sessionsSummary(_$: any, _main: string, _plan: PlanModel | null): Promise<SessionsSummary> {
  return { kids: 0, blocked: [] }
}
