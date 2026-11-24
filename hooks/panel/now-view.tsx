/*
 * The «Adesso» card at the top of the Piano view (letter A of stage «Il pannello come cruscotto»,
 * mockup critica-1): one card that says what is happening, what waits for the user and what went
 * wrong. Blue border while a stage is in progress («Adesso»), amber when it waits («Tocca a te»),
 * no card when nothing runs and nothing went wrong. Each signal is a button that opens its stage on
 * the phase that shows it (`open`, given by the Piano view). Lines are cut to the pane's width.
 * Data: now-data.ts.
 */
import type { PlanModel, ViewCtx } from './types'
import { C } from './marks'
import { tr } from './text'
import { nowModel, type NowLine } from './now-data'
import { cut, duration } from './sessions-view'

const lineText = (ctx: ViewCtx, l: NowLine, now: number) =>
  [l.who, l.what, l.tool ? `${l.tool}${l.since !== undefined ? ` ${tr(ctx.lang, 'nowSince', { t: duration(now - l.since) })}` : ''}` : '']
    .filter(Boolean).join(' · ')

export async function NowCard($: any, ctx: ViewCtx, plan: PlanModel | null, open: (stageId: string, phase: string) => void) {
  const { Box, Text, Button } = ctx.el
  const m = await nowModel($, ctx.main, plan, ctx.lang)
  if (m.mode === 'idle' && m.signals.length === 0) return null
  const now: number = await $.clock.now()
  const turn = m.mode === 'yourTurn'
  const color = turn ? C.amber : C.accent
  // lines wrap; only a very long one is cut, at about two lines of the pane
  const width = Math.max(ctx.columns - 6, 20) * 2
  return (
    <Box key="now" flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={color}>{tr(ctx.lang, turn ? 'nowYourTurn' : 'nowTitle')}</Text>
        {m.since !== undefined && <Text dimColor>{tr(ctx.lang, 'nowSince', { t: duration(now - m.since) })}</Text>}
      </Box>
      {turn && m.wait && <Text wrap="wrap" color={C.ink}>{m.wait}</Text>}
      {m.lines.map(l => <Text wrap="wrap" color={turn ? C.muted : C.ink}>{cut(lineText(ctx, l, now), width)}</Text>)}
      {m.signals.map(s => (
        <Button key={`now:${s.stageId}:${s.key}`} plain onPress={() => open(s.stageId, s.phase)}>
          {cut(`${s.shape === 'fail' ? '✕' : '!'} ${s.text}`, width)}
        </Button>
      ))}
    </Box>
  )
}
