/*
 * The review phase of an open implementation stage (stages «Test e revisione» and «Il pannello come
 * cruscotto», mockup «revisione» direction 2): an amber banner while findings are open (how many,
 * the seconds left before they are fixed by themselves, a ring that empties, «Correggi tutto
 * ora»); then a small dashboard over every round so far — «12 problemi in 2 giri», a bar fixed /
 * open, how many per severity, and per tool a bar of what it found (grey in past rounds, amber in
 * this one); then the open findings from the most severe down (severity as three bars and a word,
 * «trovato da», «Correggi»); the fixed ones behind a button. A round already there when the
 * session started has no countdown: it waits for a press. Round 3 with findings still open says it
 * is the user's turn and offers no button; before the first round, one line saying so.
 * Data and sending: reviews.ts.
 */
import type { StageModel, ViewCtx } from './types'
import { C, ringSvg, severitySvg, splitBarSvg } from './marks'
import { tr } from './text'
import { atom, read, update } from 'claude-code'
import { AUTO_FIX_MS, MAX_ROUNDS, allFindings, howMany, openOnes, readReviews, secondsLeft, sendFixes, stuck, type Finding, type Reviews } from './reviews'

const ORDER = { high: 0, medium: 1, low: 2 }
const LEVELS = ['high', 'medium', 'low'] as const
type Found = Finding & { round: number }

/** The stages whose fixed findings are shown (view only). */
const fixedOpen = atom({ plugin: 'blueprint', key: 'fixedOpen' } as const, [] as string[], { shape: 'fixed-open-1' })

const bySeverity = (a: Finding, b: Finding) => (ORDER[a.severity] ?? 3) - (ORDER[b.severity] ?? 3)

function FindingRow($: any, ctx: ViewCtx, stage: StageModel, f: Found, canFix: boolean) {
  const { Box, Text, Button, Svg } = ctx.el
  const fix = () => void sendFixes($, ctx.main, stage.id, [f.id], ctx.lang)
  const word = tr(ctx.lang, `sev_${f.severity}`)
  return (
    <Box flexDirection="row" gap={1}>
      <Box width={6} flexShrink={0} flexDirection="column">
        {ctx.surface !== 'terminal' && <Box key={`sev:${f.round}:${f.id}`}><Svg source={severitySvg(f.severity)} alt={word} /></Box>}
        <Text color={f.severity === 'high' ? C.ink : C.muted}>{word}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1} flexDirection="column">
        <Text wrap="wrap" color={f.status === 'open' ? C.ink : C.muted}>{f.text}</Text>
        <Text wrap="wrap" dimColor>{tr(ctx.lang, 'reviewFoundBy', { tool: f.tool })}</Text>
      </Box>
      {f.status === 'open' && canFix
        ? <Button key={`fix:${f.id}`} variant="secondary" onPress={fix}>{tr(ctx.lang, 'reviewFix')}</Button>
        : f.status === 'sent' ? <Text dimColor>{tr(ctx.lang, 'reviewSent')}</Text>
        : f.status === 'fixed' ? <Text dimColor>{tr(ctx.lang, 'reviewDone')}</Text> : null}
    </Box>
  )
}

/** Every round so far in a few lines: how many found, fixed and open, per severity, per tool. */
function Dashboard(ctx: ViewCtx, r: Reviews, all: Found[]) {
  const { Box, Text, Svg } = ctx.el
  const svg = ctx.surface !== 'terminal'
  const rounds = new Set(all.map(f => f.round)).size || 1
  const fixed = all.filter(f => f.status === 'fixed').length
  const live = all.length - fixed
  const tools = [...new Set([...(r.history ?? []).flatMap(h => h.tools ?? []), ...(r.tools ?? []), ...all.map(f => f.tool)])]
  const most = Math.max(1, ...tools.map(t => all.filter(f => f.tool === t).length))
  const title = rounds > 1 ? tr(ctx.lang, 'reviewInRounds', { what: howMany(ctx.lang, all.length), n: rounds }) : tr(ctx.lang, 'reviewInRound', { what: howMany(ctx.lang, all.length), r: all[0]?.round ?? r.round }) // the round that found them
  return (
    <Box key="review-dash" flexDirection="column" gap={1} borderStyle="round" borderColor={C.line} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Text bold color={C.ink}>{title}</Text>
        <Text dimColor>{tr(ctx.lang, 'reviewSplit', { fixed, open: live })}</Text>
      </Box>
      {svg && all.length > 0 && <Box key="review-split"><Svg source={splitBarSvg(fixed, live, all.length, 340)} alt={tr(ctx.lang, 'reviewSplit', { fixed, open: live })} /></Box>}
      <Box flexDirection="row" gap={2} flexWrap="wrap">
        {LEVELS.map(level => (
          <Box flexDirection="row" gap={1} alignItems="center">
            {svg && <Box key={`review-sev:${level}`}><Svg source={severitySvg(level)} alt={tr(ctx.lang, `sev_${level}`)} /></Box>}
            <Text dimColor>{`${tr(ctx.lang, `sev_${level}`)} ${all.filter(f => f.severity === level).length}`}</Text>
          </Box>
        ))}
      </Box>
      {tools.length > 0 && <Text dimColor>{tr(ctx.lang, 'reviewWhoFound')}</Text>}
      {tools.map(tool => {
        const mine = all.filter(f => f.tool === tool)
        const now = mine.filter(f => f.round === r.round).length
        return (
          <Box flexDirection="row" gap={1} alignItems="center">
            <Box width={20} flexShrink={0}><Text wrap="truncate">{tool}</Text></Box>
            {svg && <Box key={`review-tool:${tool}`} flexGrow={1}><Svg source={splitBarSvg(mine.length - now, now, most, 120)} alt={String(mine.length)} /></Box>}
            <Text dimColor>{mine.length ? String(mine.length) : tr(ctx.lang, 'reviewNothing')}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

export async function ReviewResults($: any, ctx: ViewCtx, stage: StageModel) {
  const { Box, Text, Button, Svg } = ctx.el
  const r = await readReviews($, ctx.main, stage.id)
  // no findings file yet: in the review phase the tools are still running; elsewhere it has not started
  if (!r) return <Text wrap="wrap" dimColor>{tr(ctx.lang, stage.phase === 'review' && stage.status === 'in_progress' ? 'reviewRunning' : 'reviewNotYet')}</Text>
  const open = openOnes(r).length
  const sent = r.findings.filter(f => f.status === 'sent').length
  const isStuck = stuck(r)
  const left = secondsLeft(stage.id, r, await $.clock.now())
  const fixAll = () => void sendFixes($, ctx.main, stage.id, 'all', ctx.lang)
  const all = allFindings(r)
  // every finding not fixed, a past round's too (it is counted as open, so it must be found here);
  // only this round's can be sent from here
  const current = all.filter(f => f.status !== 'fixed')
  const fixed = all.filter(f => f.status === 'fixed')
  const showFixed = (await read($, fixedOpen)).includes(stage.id)
  const flipFixed = () => void update($, fixedOpen, list => (list.includes(stage.id) ? list.filter(id => id !== stage.id) : [...list, stage.id]))
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
        : fixed.length > 0 ? <Text wrap="wrap" color={C.muted}>{tr(ctx.lang, 'reviewAllFixed', { what: howMany(ctx.lang, fixed.length), r: r.round })}</Text>
        : <Text wrap="wrap" color={C.muted}>{tr(ctx.lang, 'reviewNone', { r: r.round })}</Text>}
      {Dashboard(ctx, r, all)}
      {current.sort(bySeverity).map(f => FindingRow($, ctx, stage, f, !isStuck && f.round === r.round))}
      {fixed.length > 0 && (
        <Button key={`fixed:${stage.id}`} plain dimColor onPress={flipFixed}>
          {`${showFixed ? '▾' : '▸'} ${tr(ctx.lang, 'reviewShowFixed', { what: howMany(ctx.lang, fixed.length) })}`}
        </Button>
      )}
      {showFixed && [...fixed].sort(bySeverity).map(f => FindingRow($, ctx, stage, f, false))}
      {open + sent > 0 && r.round < MAX_ROUNDS && <Text wrap="wrap" dimColor>{tr(ctx.lang, 'reviewFoot', { next: r.round + 1 })}</Text>}
    </Box>
  )
}
