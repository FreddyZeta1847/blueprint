/*
 * The review phase of an open implementation stage (group E of stage «Test e revisione», mockup 2
 * «Barre»): an amber banner while findings are open (how many, the seconds left before they are
 * fixed by themselves, with a ring that empties, «Correggi tutto ora»), then the findings from the
 * most severe down, each with its severity as three bars and a word (no amber: amber means «your
 * turn»), «trovato da: <tool>» under it and a «Correggi» button; at the end, the tools that ran. A round already there when the
 * session started has no countdown: it waits for a press. Round 3 with findings still open
 * says it is the user's turn and offers no button; before the first round, one line saying so.
 * Data and sending: reviews.ts.
 */
import type { StageModel, ViewCtx } from './types'
import { C, ringSvg, severitySvg } from './marks'
import { tr } from './text'
import { AUTO_FIX_MS, MAX_ROUNDS, howMany, openOnes, readReviews, secondsLeft, sendFixes, stuck, type Finding } from './reviews'

const ORDER = { high: 0, medium: 1, low: 2 }

function FindingRow($: any, ctx: ViewCtx, stage: StageModel, f: Finding, canFix: boolean) {
  const { Box, Text, Button, Svg } = ctx.el
  const fix = () => void sendFixes($, ctx.main, stage.id, [f.id], ctx.lang)
  const word = tr(ctx.lang, `sev_${f.severity}`)
  return (
    <Box flexDirection="row" gap={1}>
      <Box width={6} flexShrink={0} flexDirection="column">
        {ctx.surface !== 'terminal' && <Box key={`sev:${f.id}`}><Svg source={severitySvg(f.severity)} alt={word} /></Box>}
        <Text color={f.severity === 'high' ? C.ink : C.muted}>{word}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1} flexDirection="column">
        <Text wrap="wrap" color={f.status === 'open' ? C.ink : C.muted}>{f.text}</Text>
        <Text wrap="wrap" dimColor>{tr(ctx.lang, 'reviewFoundBy', { tool: f.tool })}</Text>
      </Box>
      {f.status === 'open' && canFix
        ? <Button key={`fix:${f.id}`} variant="secondary" onPress={fix}>{tr(ctx.lang, 'reviewFix')}</Button>
        : f.status === 'sent' ? <Text dimColor>{tr(ctx.lang, 'reviewSent')}</Text> : null}
    </Box>
  )
}

export async function ReviewResults($: any, ctx: ViewCtx, stage: StageModel) {
  const { Box, Text, Button, Svg } = ctx.el
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
            {left !== null && ctx.surface !== 'terminal' && <Box key="ring"><Svg source={ringSvg(left / (AUTO_FIX_MS / 1000))} alt={`${left} s`} /></Box>}
            <Box flexGrow={1} flexShrink={1}><Text wrap="wrap" color={C.amber}>{left === null ? tr(ctx.lang, 'reviewWaiting', { what: howMany(ctx.lang, open) }) : tr(ctx.lang, 'reviewCountdown', { what: howMany(ctx.lang, open), s: left })}</Text></Box>
            <Button key="fix-all" variant="primary" onPress={fixAll}>{tr(ctx.lang, 'reviewFixAll')}</Button>
          </Box>
        )
        : sent > 0 ? <Text wrap="wrap" color={C.muted}>{tr(ctx.lang, 'reviewFixing', { what: howMany(ctx.lang, sent) })}</Text>
        : <Text wrap="wrap" color={C.muted}>{tr(ctx.lang, 'reviewNone', { r: r.round })}</Text>}
      {r.findings.filter(live).sort((a, b) => (ORDER[a.severity] ?? 3) - (ORDER[b.severity] ?? 3)).map(f => FindingRow($, ctx, stage, f, !isStuck))}
      {tools.length > 0 && (
        <Text wrap="wrap" dimColor>{tr(ctx.lang, 'reviewTools', { list: tools.map(tool => {
          const n = r.findings.filter(f => f.tool === tool && live(f)).length
          return `${tool} (${n ? howMany(ctx.lang, n) : tr(ctx.lang, 'reviewNothing')})`
        }).join(' · ') })}</Text>
      )}
      {open + sent > 0 && r.round < MAX_ROUNDS && <Text wrap="wrap" dimColor>{tr(ctx.lang, 'reviewFoot', { next: r.round + 1 })}</Text>}
    </Box>
  )
}
