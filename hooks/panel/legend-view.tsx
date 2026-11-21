/*
 * Vista Legenda — the third screen of the panel: how to read the marks and colours, what phases
 * each type of stage has (read from the plugin's data/loops.json, so it never drifts from the
 * real loops), how Claude works through them by default, and how the Sessioni screen works.
 * Words come from text.ts; this view has no state of its own.
 */
import type { ViewCtx } from './types'
import { C, GLYPH } from './marks'
import { readLoops } from './plan-data'
import { tr } from './text'

const TYPES = ['discussion', 'implementation', 'delivery', 'quick_task'] as const

/** A titled block: bold bright title, then one wrapped line per item. */
function Block(ctx: ViewCtx, title: string, lines: string[], color: string = C.ink) {
  const { Box, Text } = ctx.el
  return (
    <Box flexDirection="column">
      <Text bold color={color}>{title}</Text>
      {lines.map(line => <Text wrap="wrap">{line}</Text>)}
    </Box>
  )
}

/** «2. proposta · tocca a te — tante opzioni, poi la raccomandazione» */
function phaseLine(ctx: ViewCtx, n: number, p: { id: string; user?: boolean; optional?: boolean }): string {
  const tags = [p.user ? tr(ctx.lang, 'lgYours') : '', p.optional ? tr(ctx.lang, 'lgOptional') : ''].filter(Boolean)
  const name = `${n}. ${tr(ctx.lang, `ph_${p.id}`)}${tags.length > 0 ? ` · ${tags.join(' · ')}` : ''}`
  return `${name} — ${tr(ctx.lang, `phd_${p.id}`)}`
}

function TypeBlock(ctx: ViewCtx, type: string, phases: { id: string; user?: boolean; optional?: boolean }[]) {
  const { Box } = ctx.el
  const head = `${tr(ctx.lang, `type_${type}`)} — ${tr(ctx.lang, `purpose_${type}`)}`
  const lines = phases.map((p, i) => phaseLine(ctx, i + 1, p))
  if (type === 'discussion') lines.push(tr(ctx.lang, 'lgRepeats'))
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={C.line} paddingX={1}>
      {Block(ctx, head, lines, C.accent)}
    </Box>
  )
}

export async function renderLegendView($: any, ctx: ViewCtx) {
  const { Box, Text } = ctx.el
  const loops = await readLoops($)
  const marks = [
    `${GLYPH.done} ${tr(ctx.lang, 'lgMarkDone')}`, `${GLYPH.running} ${tr(ctx.lang, 'lgMarkRunning')}`,
    `${GLYPH.stopped} ${tr(ctx.lang, 'lgMarkStopped')}`, `${GLYPH.todo} ${tr(ctx.lang, 'lgMarkTodo')}`,
    `${GLYPH.skipped} ${tr(ctx.lang, 'lgMarkSkipped')}`, tr(ctx.lang, 'lgFrames'), tr(ctx.lang, 'lgSteps'),
  ]
  const flow = ['lgFlow1', 'lgFlow2', 'lgFlow3', 'lgFlow4'].map(k => `• ${tr(ctx.lang, k)}`)
  const sessions = ['lgSes1', 'lgSes2', 'lgSes3', 'lgSes4', 'lgSes5', 'lgSes6', 'lgSes7'].map(k => `• ${tr(ctx.lang, k)}`)
  return (
    <Box flexDirection="column" gap={1}>
      {Block(ctx, tr(ctx.lang, 'lgMarks'), marks)}
      <Text bold color={C.ink}>{tr(ctx.lang, 'lgTypes')}</Text>
      {TYPES.map(type => TypeBlock(ctx, type, loops?.types[type]?.phases ?? []))}
      {Block(ctx, tr(ctx.lang, 'lgFlow'), flow)}
      {Block(ctx, tr(ctx.lang, 'lgSessions'), sessions)}
    </Box>
  )
}
