/*
 * Vista Sessioni — the mother and the child sessions of the parallel stage as a table
 * (state, context bar, time, cost, tool or wait reason), «↗ entra nella sessione» per child,
 * the stage total and the notification switch. Mockup D-sessioni.
 *
 * Rows: the mother (this session, from $.session.usage()), then the children matched to the
 * current stage's parts, then «altre sessioni» (status files matching no part, not in the
 * total). Surfaces with Svg draw the context bar; the others get a text bar.
 */
import type { Lang, PhaseState, PlanModel, ViewCtx } from './types'
import type { RowState, SessionRow } from './sessions-data'
import { readSessions } from './sessions-data'
import { C, GLYPH, contextBarSvg } from './marks'
import { tr } from './text'

const MARK: Record<RowState, PhaseState> = { running: 'running', blocked: 'stopped', done: 'done', ended: 'skipped' }
const WORD: Record<RowState, string> = { running: 'st_running', blocked: 'st_blocked', done: 'st_done', ended: 'st_ended' }

export function money(lang: Lang, usd: number): string {
  return lang === 'it' ? `${usd.toFixed(2).replace('.', ',')} $` : `$${usd.toFixed(2)}`
}

export function duration(ms: number): string {
  const min = Math.max(Math.round(ms / 60_000), 0)
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

export function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(max - 1, 1))}…`
}

function ContextCell(ctx: ViewCtx, key: string, percent: number) {
  const { Box, Text, Svg } = ctx.el
  const p = Math.round(percent)
  const bar = Svg
    ? <Svg key={`ctx:${key}`} source={contextBarSvg(p)} alt={`${tr(ctx.lang, 'context')} ${p}%`} />
    : <Text color={p > 70 ? C.amber : C.muted}>{'█'.repeat(Math.round(p / 20)) + '░'.repeat(5 - Math.round(p / 20))}</Text>
  return <Box flexDirection="row" gap={1}>{bar}<Text dimColor>{`${p}%`}</Text></Box>
}

type Line = { key: string; glyph: string; name: string; percent: number; time: string; cost: string; detail: string; amber: boolean }

function Row(ctx: ViewCtx, line: Line, enter?: () => void) {
  const { Box, Text, Button } = ctx.el
  const nameMax = Math.max(ctx.columns - 26, 8)
  return (
    <Box key={`row:${line.key}`} flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={line.amber ? C.amber : undefined}>{`${line.glyph} ${cut(line.name, nameMax)}`}</Text>
        <Box flexDirection="row" gap={2}>{ContextCell(ctx, line.key, line.percent)}<Text dimColor>{line.time}</Text></Box>
      </Box>
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={line.amber ? C.amber : C.muted} wrap="truncate">{`  ${line.detail}`}</Text>
        <Text dimColor>{line.cost}</Text>
      </Box>
      {enter && <Button key={`enter:${line.key}`} variant="secondary" onPress={enter}>{tr(ctx.lang, 'enter')}</Button>}
    </Box>
  )
}

function kidLine(ctx: ViewCtx, row: SessionRow, now: number): Line {
  const end = row.state === 'running' || row.state === 'blocked' ? now : row.updatedAt
  const detail = row.state === 'running' ? row.tool ?? tr(ctx.lang, WORD.running) : tr(ctx.lang, WORD[row.state])
  return {
    key: row.worktree, glyph: GLYPH[MARK[row.state]], name: row.name, percent: row.percent,
    time: duration(end - row.startedAt), cost: money(ctx.lang, row.costUsd), detail, amber: row.state === 'blocked',
  }
}

export async function renderSessionsView($: any, ctx: ViewCtx, plan: PlanModel | null) {
  const { Box, Text, Button } = ctx.el
  const lang = ctx.lang
  const sessions = await readSessions($, ctx.main, plan)
  const stage = plan?.stages[plan.currentIndex]
  if (!stage || sessions.parts.length === 0) return <Text dimColor>{tr(lang, 'noParallel')}</Text>

  const now: number = await $.clock.now()
  const usage = await $.session.usage()
  const motherCost = usage?.cost?.usd ?? 0
  const mother: Line = {
    key: 'mother', glyph: GLYPH.running, name: tr(lang, 'mother'), percent: usage?.context?.percent ?? 0,
    time: duration(now - (usage?.startedAt ?? now)), cost: money(lang, motherCost),
    detail: `${tr(lang, 'thisSession')} · ${tr(lang, 'waitingKids')}`, amber: false,
  }
  const enter = (row: SessionRow) => row.id === null ? undefined : async () => {
    const cmd = `claude attach ${row.id}`
    await $.ui.copy({ text: cmd })
    await $.ui.toast(tr(lang, 'copied', { cmd }))
  }
  const total = motherCost + sessions.kids.reduce((sum, k) => sum + k.costUsd, 0)
  const on = ctx.options.notifyWhenWaiting

  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor wrap="truncate">{`${tr(lang, 'stageOf', { n: plan!.currentIndex + 1, m: plan!.stages.length })} · ${stage.name}`}</Text>
      <Box flexDirection="row" justifyContent="space-between">
        <Text dimColor bold>{tr(lang, 'session')}</Text>
        <Text dimColor bold>{`${tr(lang, 'context')} · ${tr(lang, 'timeCost')}`}</Text>
      </Box>
      {Row(ctx, mother)}
      {sessions.kids.map(k => Row(ctx, kidLine(ctx, k, now), enter(k)))}
      {sessions.others.length > 0 && <Text dimColor bold>{tr(lang, 'others')}</Text>}
      {sessions.others.map(k => Row(ctx, kidLine(ctx, k, now), enter(k)))}
      <Text dimColor>{tr(lang, 'total', { cost: money(lang, total), n: sessions.kids.length + 1 })}</Text>
      <Button key="notify-switch" variant={on ? 'primary' : 'secondary'}
        onPress={() => void $.config.set({ key: 'blueprint.notifyWhenWaiting', value: !on }).catch(() => undefined)}>
        {`${tr(lang, 'notifySwitch')}: ${tr(lang, on ? 'switchOn' : 'switchOff')}`}
      </Button>
    </Box>
  )
}
