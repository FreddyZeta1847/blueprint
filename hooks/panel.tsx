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
import { renderLegendView } from './panel/legend-view'
import { sessionsSummary } from './panel/sessions-data'
import { registerStatusWriter } from './panel/status-writer'
import { registerTestRecorder } from './panel/checks'
import { registerActivity } from './panel/activity'
import { autoFix, howMany, markStart } from './panel/reviews'

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
// The review's countdown (findings open, seconds left): while it runs the panel refreshes every second.
let countdown: { open: number; seconds: number } | null = null

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')

// Why there is no plan, when there should be: shown under the «no plan» line (a diagnosis aid).
let why = ''
async function explain($: any, dir: string): Promise<string> {
  const attempt = async (label: string, path: string) =>
    $.fs.read(path).then(() => `${label} ok`, (e: unknown) => `${label}: ${String((e as any)?.message ?? e).slice(0, 120)}`)
  return [`main=${dir}`, await attempt('plan', `${dir}/blueprint/plan.json`), await attempt('loops', `${$.plugin.root}/data/loops.json`)].join(' · ')
}

// The app starts spare sessions in ~/.claude/spares/… and moves them to the real folder later:
// where the session works is asked again on every refresh, never taken from session.start alone.
let cwdSeen = ''
let isChild = false
async function locate($: any): Promise<boolean> {
  const cwd = norm(await $.session.cwd())
  if (cwd === cwdSeen) return false
  cwdSeen = cwd
  const repo = await findRepo($, cwd)
  isChild = !!repo?.worktree // a child session: only the status writer works there
  main = isChild ? null : repo?.main ?? cwd
  lastPlan = null
  return true
}

async function refresh($: any, options: any): Promise<void> {
  const moved = await locate($).catch(() => false)
  if (!main) return
  // plan first (the summary needs the current stage's parts), then the plan again with the summary
  const bare = await readPlan($, main).catch((e: unknown) => { why = `readPlan threw: ${String(e).slice(0, 160)}`; return null })
  if (!bare && !why.startsWith('readPlan threw')) why = await explain($, main)
  if (bare) why = ''
  summary = await sessionsSummary($, main, bare ?? lastPlan).catch(() => summary)
  const plan = bare && (await readPlan($, main, summary))
  const hasPlanFile = await $.fs.exists(`${main}/blueprint/plan.json`).catch(() => false)
  unreadable = !plan && hasPlanFile && !!lastPlan
  if (plan) lastPlan = plan
  else if (!hasPlanFile) lastPlan = null
  if (moved && lastPlan && options?.autoOpen !== false) openTries = 24
  await updateStatus($)
  markStart(await $.clock.now()) // a review round already there now waits for a press
  countdown = await autoFix($, main, lastPlan, lang).catch(() => null)
  if (countdown) await $.ui.status(tr(lang, 'statusFix', { what: howMany(lang, countdown.open), s: countdown.seconds }))
  await notifyIfYourTurn($, options)
  await tryAutoOpen($)
  void update($, tick, n => (n + 1) % 1_000_000)
}

// The window may not be attached yet when the session starts: the first open can fail with
// «no surface». Retry on each refresh (every 5 s) for about two minutes, until it is placed once.
let openTries = 0
async function tryAutoOpen($: any): Promise<void> {
  if (openTries <= 0) return
  openTries--
  const opened = await $.ui.open({ id: PANE, title: 'Blueprint' }).catch(() => null)
  if (opened?.isPlaced !== false && opened !== null) openTries = 0
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
  if (a === 'legenda' || a === 'legend') return 'legenda'
  return null
}

export const register: Register = (on, options) => {
  registerStatusWriter(on)
  registerTestRecorder(on)
  registerActivity(on)

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    lang = langFrom(await $.settings.read({ key: 'language' }).catch(() => undefined))
    await $.command.register({
      name: 'blueprint-panel', description: tr(lang, 'cmdDescription'), argumentHint: 'piano | sessioni | legenda', immediate: true,
    })
    await refresh($, options) // finds where the session works, reads the plan, opens the pane if wanted
    $.clock.every(REFRESH_MS, () => void refresh($, options))
    $.clock.every(1000, () => { if (countdown) void refresh($, options) })
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
    if (!main || !lastPlan) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>{tr(lang, 'noPlan')}</Text>
          {why ? <Text dimColor>{why}</Text> : null}
        </Box>
      )
    }
    const ctx: ViewCtx = {
      el, lang, main, surface: String(e.surface),
      columns: Number((e as any).props?.bodyColumns ?? 48),
      options: { notifyWhenWaiting: (options as any)?.notifyWhenWaiting === true },
    }
    const choose = (v: PanelView) => () => void update($, view, () => v)
    return (
      <Box flexDirection="column" gap={1}>
        {Header(ctx, lastPlan)}
        {unreadable && <Text color={C.amber}>{tr(lang, 'planUnreadable')}</Text>}
        {/* a navigation bar: one frame holds both tabs, the open one is the filled button, the other is dim text */}
        <Box flexDirection="row" gap={1} borderStyle="round" borderColor={C.line} paddingX={1}>
          <Button key="tab:piano" hotkey="p" variant={current === 'piano' ? 'primary' : 'secondary'} dimColor={current !== 'piano'} onPress={choose('piano')}>{tr(lang, 'piano')}</Button>
          <Button key="tab:sessioni" hotkey="s" variant={current === 'sessioni' ? 'primary' : 'secondary'} dimColor={current !== 'sessioni'} onPress={choose('sessioni')}>{tr(lang, 'sessioni')}</Button>
          <Button key="tab:legenda" hotkey="l" variant={current === 'legenda' ? 'primary' : 'secondary'} dimColor={current !== 'legenda'} onPress={choose('legenda')}>{tr(lang, 'legenda')}</Button>
        </Box>
        {current === 'sessioni' ? await renderSessionsView($, ctx, lastPlan)
          : current === 'legenda' ? await renderLegendView($, ctx)
          : await renderPlanView($, ctx, lastPlan)}
      </Box>
    )
  })
}
