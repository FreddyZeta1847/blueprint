/*
 * The review phase of an open implementation stage (group E of stage «Test e revisione», mockup 2
 * «Barre»): an amber banner while findings are open (how many, the seconds left before they are
 * fixed by themselves, «Correggi tutto ora»), then the findings grouped by the tool that found
 * them, each with its severity in words and a «Correggi» button. A round already there when the
 * session started has no countdown: it waits for a press. Round 3 with findings still open
 * says it is the user's turn and offers no button; before the first round, one line saying so.
 * Data and sending: reviews.ts.
 */
import type { StageModel, ViewCtx } from './types'
import { C } from './marks'
import { tr } from './text'
import { MAX_ROUNDS, howMany, openOnes, readReviews, secondsLeft, sendFixes, stuck, type Finding } from './reviews'

const SEV_COLOR = { high: C.coral, medium: C.amber, low: C.muted }

function FindingRow($: any, ctx: ViewCtx, stage: StageModel, f: Finding, canFix: boolean) {
  const { Box, Text, Button } = ctx.el
  const fix = () => void sendFixes($, ctx.main, stage.id, [f.id], ctx.lang)
  return (
    <Box flexDirection="row" gap={1}>
      <Box width={6} flexShrink={0}><Text color={SEV_COLOR[f.severity] ?? C.muted}>{tr(ctx.lang, `sev_${f.severity}`)}</Text></Box>
      <Box flexGrow={1} flexShrink={1}><Text wrap="wrap" color={f.status === 'open' ? C.ink : C.muted}>{f.text}</Text></Box>
      {f.status === 'open' && canFix
        ? <Button key={`fix:${f.id}`} variant="secondary" onPress={fix}>{tr(ctx.lang, 'reviewFix')}</Button>
        : f.status === 'sent' ? <Text dimColor>{tr(ctx.lang, 'reviewSent')}</Text> : null}
    </Box>
  )
}

export async function ReviewResults($: any, ctx: ViewCtx, stage: StageModel) {
  const { Box, Text, Button } = ctx.el
  const r = await readReviews($, ctx.main, stage.id)
  if (!r) return <Text wrap="wrap" dimColor>{tr(ctx.lang, 'reviewNotYet')}</Text>
  const open = openOnes(r).length
  const sent = r.findings.filter(f => f.status === 'sent').length
  const isStuck = stuck(r)
  const tools = [...new Set([...(r.tools ?? []), ...r.findings.map(f => f.tool)])]
  const left = secondsLeft(stage.id, r, await $.clock.now())
  const fixAll = () => void sendFixes($, ctx.main, stage.id, 'all', ctx.lang)
  const live = (f: Finding) => f.status !== 'fixed'
  return (
    <Box flexDirection="column" gap={1}>
      {isStuck ? <Text wrap="wrap" bold color={C.amber}>{tr(ctx.lang, 'reviewStuck')}</Text>
        : open > 0 ? (
          <Box flexDirection="row" gap={1} borderStyle="round" borderColor={C.amber} paddingX={1}>
            <Box flexGrow={1} flexShrink={1}><Text wrap="wrap" color={C.amber}>{left === null ? tr(ctx.lang, 'reviewWaiting', { what: howMany(ctx.lang, open) }) : tr(ctx.lang, 'reviewCountdown', { what: howMany(ctx.lang, open), s: left })}</Text></Box>
            <Button key="fix-all" variant="primary" onPress={fixAll}>{tr(ctx.lang, 'reviewFixAll')}</Button>
          </Box>
        )
        : sent > 0 ? <Text wrap="wrap" color={C.muted}>{tr(ctx.lang, 'reviewFixing', { what: howMany(ctx.lang, sent) })}</Text>
        : <Text wrap="wrap" color={C.muted}>{tr(ctx.lang, 'reviewNone', { r: r.round })}</Text>}
      {tools.map(tool => {
        const mine = r.findings.filter(f => f.tool === tool && live(f))
        return (
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Box flexGrow={1}><Text bold color={C.ink}>{tool}</Text></Box>
              <Text dimColor>{mine.length ? howMany(ctx.lang, mine.length) : tr(ctx.lang, 'reviewNothing')}</Text>
            </Box>
            {mine.map(f => FindingRow($, ctx, stage, f, !isStuck))}
          </Box>
        )
      })}
      {open + sent > 0 && r.round < MAX_ROUNDS && <Text wrap="wrap" dimColor>{tr(ctx.lang, 'reviewFoot', { next: r.round + 1 })}</Text>}
    </Box>
  )
}
