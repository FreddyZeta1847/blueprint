/*
 * The panel's header, shared by both views: project name, «tappa N di M», the progress bar
 * (amber when the current stage is stopped) and the context card summary in one line.
 * Surfaces without Svg (the terminal) get a text bar.
 */
import type { PlanModel, ViewCtx } from './types'
import { progressSvg } from './marks'
import { tr } from './text'

export function Header(ctx: ViewCtx, plan: PlanModel) {
  const { Box, Text } = ctx.el
  const Svg = ctx.el.Svg
  const total = plan.stages.length
  const done = plan.stages.filter(s => s.status === 'done').length
  const current = plan.stages[plan.currentIndex]
  const stopped = current?.yourTurn ?? false
  const card = plan.card
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold wrap="truncate">{plan.project}</Text>
        <Text dimColor>{tr(ctx.lang, 'stageOf', { n: plan.currentIndex + 1, m: total })}</Text>
      </Box>
      {Svg
        ? <Svg source={progressSvg(done, total, stopped)} alt={tr(ctx.lang, 'stageOf', { n: plan.currentIndex + 1, m: total })} />
        : <Text dimColor>{'■'.repeat(done) + (done < total ? (stopped ? '!' : '▶') : '') + '□'.repeat(Math.max(total - done - 1, 0))}</Text>}
      {card && (
        <Text dimColor wrap="truncate">
          {`${tr(ctx.lang, `size_${card.size}`)} · ${card.difficulty} · ${card.pace}`}
        </Text>
      )}
    </Box>
  )
}
