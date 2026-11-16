/*
 * Blueprint panel — the mod module listed under `modules` in hooks/hooks.json, next to
 * Blueprint's classic hooks. It opens a pane beside the chat with two views: Piano (the
 * plan's stages and phases) and Sessioni (the mother and child sessions of a parallel
 * stage). Decisions: blueprint/decisions.md of the Blueprint repository (stage «Costruzione»).
 *
 * - Child sessions (a linked worktree) show nothing: they only write their status file.
 * - Elsewhere: the command /blueprint-panel [piano|sessioni] opens and closes the pane; with
 *   a plan, the pane opens by itself (option autoOpen, default on) and the status line says
 *   «Blueprint · tappa N/M» or «Blueprint · tocca a te: tappa N».
 * - When it becomes the user's turn, one push notification (option notifyWhenWaiting).
 */
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { PanelView } from '../types'
import type { Lang, PlanModel, SessionsSummary, ViewCtx } from './panel/types'
import { findRepo } from './panel/repo'
import { readPlan } from './panel/plan-data'
import { langFrom, tr } from './panel/text'
import { C } from './panel/marks'
import { Header } from './panel/header'
import { renderPlanView } from './panel/plan-view'
import { renderSessionsView } from './panel/sessions-view'
import { sessionsSummary } from './panel/sessions-data'
import { registerStatusWriter } from './panel/status-writer'

const PANE = 'blueprint'
const REFRESH_MS = 5000

const view = atom({ plugin: 'blueprint', key: 'view' } as const, 'piano' as PanelView, { shape: 'view-1' })
const tick = atom({ plugin: 'blueprint', key: 'tick' } as const, 0, { shape: 'tick-1' })
const waiting = atom({ plugin: 'blueprint', key: 'waiting' } as const, false, { shape: 'waiting-1' })

// Module memory, rebuilt by refresh() after a reload.
let main: string | null = null
let lang: Lang = 'en'
let lastPlan: PlanModel | null = null
let unreadable = false
let summary: SessionsSummary = { kids: 0, blocked: [] }

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')

async function refresh($: any, options: any): Promise<void> {
  if (!main) return
  summary = await sessionsSummary($, main, lastPlan).catch(() => summary)
  const plan = await readPlan($, main, summary)
  const hasPlanFile = await $.fs.exists(`${main}/blueprint/plan.json`).catch(() => false)
  unreadable = !plan && hasPlanFile && !!lastPlan
  if (plan) lastPlan = plan
  else if (!hasPlanFile) lastPlan = null
  await updateStatus($)
  await notifyIfYourTurn($, options)
  void update($, tick, n => (n + 1) % 1_000_000)
}

async function updateStatus($: any): Promise<void> {
  const plan = lastPlan
  if (!plan) return void (await $.ui.status(undefined))
  const current = plan.stages[plan.currentIndex]
  const n = plan.currentIndex + 1
  await $.ui.status(current?.yourTurn
    ? tr(lang, 'statusYourTurn', { n })
    : tr(lang, 'statusLine', { n, m: plan.stages.length }))
}

async function notifyIfYourTurn($: any, options: any): Promise<void> {
  const current = lastPlan?.stages[lastPlan.currentIndex]
  const now = !!current?.yourTurn
  const before = await read($, waiting)
  if (now === before) return
  await update($, waiting, () => now)
  if (now && options?.notifyWhenWaiting === true && current) {
    await $.tool.call({ tool: 'PushNotification', message: tr(lang, 'pushYourTurn', { stage: current.name }), status: 'proactive' })
      .catch(() => undefined)
  }
}

function wantedView(args: string): PanelView | null {
  const a = args.trim().toLowerCase()
  if (a === 'sessioni' || a === 'sessions') return 'sessioni'
  if (a === 'piano' || a === 'plan') return 'piano'
  return null
}

export const register: Register = (on, options) => {
  registerStatusWriter(on)

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const repo = await findRepo($, e.cwd)
    if (repo?.worktree) return result // a child session: only the status writer works here
    main = repo?.main ?? norm(e.cwd)
    lang = langFrom(await $.settings.read({ key: 'language' }).catch(() => undefined))
    await $.command.register({
      name: 'blueprint-panel', description: tr(lang, 'cmdDescription'), argumentHint: 'piano | sessioni', immediate: true,
    })
    await refresh($, options)
    if (lastPlan && (options as any)?.autoOpen !== false) void $.ui.open({ id: PANE, title: 'Blueprint' })
    $.clock.every(REFRESH_MS, () => void refresh($, options))
    return result
  })

  on('command.run', { command: 'blueprint-panel' }, async ($, e) => {
    const want = wantedView(e.args ?? '')
    const isUp = (await $.ui.panes()).some(p => p.id === PANE)
    if (isUp && !want) {
      await $.ui.close({ id: PANE })
      return { text: tr(lang, 'closed') }
    }
    if (want) await update($, view, () => want)
    if (!isUp) await $.ui.open({ id: PANE, title: 'Blueprint' })
    return { text: tr(lang, 'opened') }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const el: any = $.ui.resolve(e)
    const { Box, Text, Button } = el
    await read($, tick) // redraw on every refresh
    const current = await read($, view)
    if (!main || !lastPlan) return <Text dimColor>{tr(lang, 'noPlan')}</Text>
    const ctx: ViewCtx = { el, lang, main, surface: String(e.surface) }
    const choose = (v: PanelView) => () => void update($, view, () => v)
    return (
      <Box flexDirection="column" gap={1}>
        {Header(ctx, lastPlan)}
        {unreadable && <Text color={C.amber}>{tr(lang, 'planUnreadable')}</Text>}
        <Box flexDirection="row" gap={1}>
          <Button key="tab:piano" hotkey="p" variant={current === 'piano' ? 'primary' : 'secondary'} onPress={choose('piano')}>{tr(lang, 'piano')}</Button>
          <Button key="tab:sessioni" hotkey="s" variant={current === 'sessioni' ? 'primary' : 'secondary'} onPress={choose('sessioni')}>{tr(lang, 'sessioni')}</Button>
        </Box>
        {current === 'sessioni' ? await renderSessionsView($, ctx, lastPlan) : await renderPlanView($, ctx, lastPlan)}
      </Box>
    )
  })
}
