/*
 * A discussion stage's decisions as cards that open (stage «Il pannello come cruscotto», mockup
 * «decisioni», direction 2): filters on top — Tutte · Difficili · Tue · Di Claude, the hard ones by
 * default — then one card per decision with a violet padlock (hard to change) or two arrows (easy),
 * its title and who decided («tu» / «C»). An open card adds why, what was rejected, its topic and
 * date. Under the cards, how many the filter hides, with «mostrale». The chosen filter and the cards
 * opened or shut by hand live in $.state (`decFilter`, `decOpen`); the first card starts open.
 * Data: plan-extras.ts (decisionsFromFile, decisionsFromBlocks).
 */
import { atom, read, update } from 'claude-code'
import type { StageModel, ViewCtx } from './types'
import type { Decision } from './plan-extras'
import { C, lockSvg, swapSvg } from './marks'
import { shortDate, tr } from './text'

type Filter = 'all' | 'hard' | 'mine' | 'claude'
const decFilter = atom({ plugin: 'blueprint', key: 'decFilter' } as const, {} as Record<string, Filter>, { shape: 'dec-filter-1' })
const decOpen = atom({ plugin: 'blueprint', key: 'decOpen' } as const, [] as string[], { shape: 'dec-open-1' })

const PASS: Record<Filter, (d: Decision) => boolean> = {
  all: () => true, hard: d => d.oneWay, mine: d => d.by === 'user', claude: d => d.by === 'claude',
}

/** «tu» or «C» on its own colour; nothing when the file does not say who decided. */
function Who(ctx: ViewCtx, d: Decision) {
  const { Text } = ctx.el
  if (!d.by) return null
  const mine = d.by === 'user'
  return <Text bold backgroundColor={mine ? C.youSoft : C.claySoft} color={mine ? C.you : C.clay}>{` ${tr(ctx.lang, mine ? 'byYou' : 'byClaudeShort')} `}</Text>
}

function Card($: any, ctx: ViewCtx, d: Decision, key: string, open: boolean) {
  const { Box, Text, Svg, Button } = ctx.el
  const svg = ctx.surface !== 'terminal'
  const kind = tr(ctx.lang, d.oneWay ? 'decHard' : 'decEasy')
  const flip = () => void update($, decOpen, list => [...list.filter(k => k !== `open:${key}` && k !== `shut:${key}`), `${open ? 'shut' : 'open'}:${key}`])
  // «decisa da te» only when the file says so: a decision found in code is nobody's
  const when = d.date ? tr(ctx.lang, d.by === 'claude' ? 'decByClaudeOn' : d.by === 'user' ? 'decByYouOn' : 'decOn', { d: shortDate(ctx.lang, d.date) }) : ''
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}
      borderColor={open ? (d.oneWay ? C.violet : C.muted) : C.line} {...(open && d.oneWay ? { backgroundColor: C.violetSoft } : {})}>
      <Box flexDirection="row" gap={1} alignItems="center">
        {svg ? <Box key={`decmark:${key}`}><Svg source={d.oneWay ? lockSvg(C.violet) : swapSvg()} alt={kind} /></Box> : <Text dimColor>{`[${kind}]`}</Text>}
        <Box flexGrow={1} flexShrink={1}><Text wrap="wrap" bold={d.oneWay} color={C.ink}>{d.text}</Text></Box>
        {Who(ctx, d)}
        <Button key={`decopen:${key}`} plain dimColor onPress={flip}>{open ? '▾' : '▸'}</Button>
      </Box>
      {open && d.why && <Text wrap="wrap" color={C.ink}>{d.why}</Text>}
      {open && d.rejected && <Text wrap="wrap" dimColor>{tr(ctx.lang, 'decRejected', { list: d.rejected })}</Text>}
      {open && (d.topic || when) && <Text wrap="wrap" dimColor>{[d.topic, when].filter(Boolean).join(' · ')}</Text>}
    </Box>
  )
}

export async function DecisionCards($: any, ctx: ViewCtx, stage: StageModel, list: Decision[]) {
  const { Box, Text, Button } = ctx.el
  const chosen = (await read($, decFilter))[stage.id] ?? (list.some(d => d.oneWay) ? 'hard' : 'all')
  const opened = await read($, decOpen)
  const shown = list.map((d, i) => ({ d, i })).filter(({ d }) => PASS[chosen](d))
  const hidden = list.length - shown.length
  const pick = (f: Filter) => () => void update($, decFilter, m => ({ ...m, [stage.id]: f }))
  const filters: [Filter, string][] = [
    ['all', tr(ctx.lang, 'decAll', { n: list.length })],
    ['hard', tr(ctx.lang, 'decHardN', { n: list.filter(PASS.hard).length })],
    ['mine', tr(ctx.lang, 'decMine', { n: list.filter(PASS.mine).length })],
    ['claude', tr(ctx.lang, 'decClaude', { n: list.filter(PASS.claude).length })],
  ]
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {filters.map(([f, label]) => (
          <Button key={`decfilter:${stage.id}:${f}`} variant={f === chosen ? 'primary' : 'secondary'} onPress={pick(f)}>{label}</Button>
        ))}
      </Box>
      {shown.map(({ d, i }, at) => {
        // keyed by the decision, not its place: a new decision above does not open another card
        const key = `${stage.id}:${d.text}`
        const open = opened.includes(`open:${key}`) || (!opened.includes(`shut:${key}`) && at === 0)
        return Card($, ctx, d, key, open)
      })}
      {hidden > 0 && (
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          <Text dimColor>{tr(ctx.lang, 'decHidden', { n: hidden })}</Text>
          <Button key={`decshowall:${stage.id}`} plain onPress={pick('all')}>{tr(ctx.lang, 'decShowAll')}</Button>
        </Box>
      )}
    </Box>
  )
}
