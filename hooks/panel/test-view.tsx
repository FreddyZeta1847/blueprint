/*
 * The test phase of an open implementation stage (group D of stage «Test e revisione», mockup 2
 * «Barre»): a total bar with «N di M», the failed tests by name, then every group of the plain plan
 * in plan order — no sessions, the children are merged and closed by then — each with its bar, its
 * fraction and its plain words. A number Claude wrote itself carries «*» and a note. Counts come
 * from checks.ts (the newest result per group). The terminal gets the fractions as text.
 */
import type { StageModel, ViewCtx } from './types'
import { C, fractionSvg } from './marks'
import { tr } from './text'
import { readSteps } from './plan-steps'
import { groupKey, readChecks, type GroupResult } from './checks'

const clock = (iso: string) => new Date(iso).toTimeString().slice(0, 5)

function failedLine(ctx: ViewCtx, group: string, r: GroupResult): string {
  const names = r.failed.join('», «')
  const n = r.total - r.passed
  return tr(ctx.lang, n === 1 ? 'testFailedOne' : 'testFailedMany', { n, group, names: names || '?' })
}

/** A bar (Svg needs a keyed Box around it) on surfaces that draw Svg; nothing on the terminal. */
function Bar(ctx: ViewCtx, key: string, svg: string, alt: string) {
  const { Box, Svg } = ctx.el
  if (ctx.surface === 'terminal' || !Svg) return null
  return <Box key={key} flexShrink={0}><Svg source={svg} alt={alt} /></Box>
}

export async function TestResults($: any, ctx: ViewCtx, stage: StageModel) {
  const { Box, Text } = ctx.el
  const groups = (await readSteps($, ctx.main, stage)).filter(s => s.test)
  if (groups.length === 0) return null
  const results = await readChecks($, ctx.main, stage.id)
  const rows = groups.map(s => ({ name: groupKey(s), text: s.test!, r: results[groupKey(s)] }))
  const ran = rows.filter(x => x.r)
  const passed = ran.reduce((a, x) => a + x.r!.passed, 0)
  const total = ran.reduce((a, x) => a + x.r!.total, 0)
  const last = ran.map(x => x.r!.at).sort().pop()
  const of = (p: number, t: number) => tr(ctx.lang, 'testsOf', { p, t })
  return (
    <Box flexDirection="column" gap={1}>
      <Text wrap="wrap"><Text bold color={C.ink}>{tr(ctx.lang, 'checksTest')}</Text>{last ? <Text dimColor>{` · ${tr(ctx.lang, 'testsLast', { t: clock(last) })}`}</Text> : null}</Text>
      {ran.length > 0 && (
        <Box flexDirection="row" gap={1}>
          {Bar(ctx, 'tests:total', fractionSvg(passed, total, 240), of(passed, total))}
          <Text bold color={passed === total ? C.ink : C.coral}>{of(passed, total)}</Text>
        </Box>
      )}
      {ran.filter(x => x.r!.passed < x.r!.total).map(x => <Text wrap="wrap" color={C.coral}>{failedLine(ctx, x.name, x.r!)}</Text>)}
      {rows.map(({ name, text, r }) => (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Box flexGrow={1} flexShrink={1}><Text wrap="wrap" color={r ? C.ink : C.faint}>{name}</Text></Box>
            {r ? Bar(ctx, `tests:${name}`, fractionSvg(r.passed, r.total), of(r.passed, r.total)) : null}
            <Text color={!r ? C.faint : r.passed === r.total ? C.muted : C.coral}>{r ? `${r.passed}/${r.total}${r.source === 'told' ? ' *' : ''}` : '—'}</Text>
          </Box>
          <Text wrap="wrap" dimColor>{text}</Text>
        </Box>
      ))}
      {ran.some(x => x.r!.source === 'told') && <Text wrap="wrap" dimColor>{tr(ctx.lang, 'testToldNote')}</Text>}
    </Box>
  )
}
