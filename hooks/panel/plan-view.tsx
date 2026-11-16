/*
 * Vista Piano — the plan's stages as rows (segmented phase bar, ticked circle when done,
 * pills «tocca a te» / «N figlie» / deadline); a press opens a stage: type, phase line and rail,
 * topics, decisions, how, notes with a field to add one. Mockup D, decisions «Mockup del pannello».
 * Surfaces without Svg (the terminal) get text bars and text pills. Which stages are open lives
 * in the `expanded` $.state atom; "*" stands for «the current stage» until the user presses a row.
 */
import { atom, read, update } from 'claude-code'
import type { PhaseState, PlanModel, StageModel, ViewCtx } from './types'
import { C, GLYPH, barSvg, barText, pillSvg, railSvg } from './marks'
import { tr } from './text'
import { addNote, readNotes, stageDecisions, type Note } from './plan-extras'

const CURRENT = '*'
const expanded = atom({ plugin: 'blueprint', key: 'expanded' } as const, [CURRENT] as string[], { shape: 'expanded-1' })

const MONTHS = {
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

/** "2026-11-20" → "20 nov"; anything else as it is. */
export function shortDate(lang: ViewCtx['lang'], iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso)
  const month = m ? MONTHS[lang][Number(m[1]) - 1] : undefined
  return m && month ? `${Number(m[2])} ${month}` : iso
}

/** One line: longer text is cut and ends with «…». */
export function cut(text: string, max: number): string {
  const room = Math.max(max, 4)
  return text.length <= room ? text : `${text.slice(0, room - 1).trimEnd()}…`
}

function glyphOf(stage: StageModel): string {
  if (stage.status === 'done') return GLYPH.done
  if (stage.status === 'in_progress') return stage.yourTurn ? GLYPH.stopped : GLYPH.running
  return GLYPH.todo
}

/** The running or stopped phase, labelled «costruzione» or «costruzione · ferma». */
function currentPhase(ctx: ViewCtx, stage: StageModel): { label: string; stopped: boolean } | null {
  const at = stage.phases.find(p => p.state === 'running' || p.state === 'stopped')
  if (!at) return null
  const stopped = at.state === 'stopped'
  const name = tr(ctx.lang, `ph_${at.id}`)
  return { label: stopped ? `${name} · ${tr(ctx.lang, 'stopped')}` : name, stopped }
}

function isOpen(list: string[], stage: StageModel, plan: PlanModel): boolean {
  return list.includes(stage.id) || (list.includes(CURRENT) && plan.stages[plan.currentIndex]?.id === stage.id)
}

function toggle(list: string[], id: string, plan: PlanModel): string[] {
  const currentId = plan.stages[plan.currentIndex]?.id
  const resolved = list.flatMap(x => (x === CURRENT ? (currentId ? [currentId] : []) : [x]))
  return resolved.includes(id) ? resolved.filter(x => x !== id) : [...resolved, id]
}

function Pills(ctx: ViewCtx, stage: StageModel) {
  const { Box, Text, Svg } = ctx.el
  const pills: { key: string; label: string; tone: 'amber' | 'accent' | 'muted' }[] = []
  if (stage.yourTurn) pills.push({ key: `pill:turn:${stage.id}`, label: tr(ctx.lang, 'yourTurn'), tone: 'amber' })
  if (stage.kids > 0) pills.push({ key: `pill:kids:${stage.id}`, label: tr(ctx.lang, 'kids', { n: stage.kids }), tone: 'accent' })
  if (stage.deadline) pills.push({ key: `pill:due:${stage.id}`, label: shortDate(ctx.lang, stage.deadline), tone: 'muted' })
  if (pills.length === 0) return null
  const color = { amber: C.amber, accent: C.accent, muted: C.muted }
  return (
    <Box flexDirection="row" gap={1}>
      {pills.map(p => Svg
        ? <Svg key={p.key} source={pillSvg(p.label, p.tone)} alt={p.label} />
        : <Text key={p.key} color={color[p.tone]}>{`[${p.label}]`}</Text>)}
    </Box>
  )
}

function Bar(ctx: ViewCtx, stage: StageModel) {
  const { Text, Svg } = ctx.el
  const done = stage.status === 'done'
  const alt = `${barText(stage.segments)}${done ? ` ${GLYPH.done}` : ''}`
  return Svg
    ? <Svg key={`bar:${stage.id}`} source={barSvg(stage.segments, 120, done)} alt={alt} />
    : <Text key={`bar:${stage.id}`} dimColor>{alt}</Text>
}

function Row($: any, ctx: ViewCtx, plan: PlanModel, stage: StageModel, index: number, open: boolean) {
  const { Box, Button } = ctx.el
  const pills = Pills(ctx, stage)
  const room = ctx.columns - 4 - (pills ? 14 : 0)
  const label = cut(`${glyphOf(stage)} ${index + 1}. ${stage.name}`, room)
  const press = () => void update($, expanded, list => toggle(list, stage.id, plan))
  return (
    <Box flexDirection="row" justifyContent="space-between" gap={1}>
      <Button key={`stage:${stage.id}`} variant="plain" onPress={press}>{label}</Button>
      {!open && pills}
    </Box>
  )
}

function Section(ctx: ViewCtx, title: string, lines: string[]) {
  const { Box, Text } = ctx.el
  return (
    <Box flexDirection="column">
      <Text dimColor bold>{title}</Text>
      {lines.map(line => <Text wrap="wrap">{line}</Text>)}
    </Box>
  )
}

function topicLine(t: StageModel['topics'][number]): string {
  const state: PhaseState = t.done ? 'done' : t.current ? 'running' : 'todo'
  return `${GLYPH[state]} ${t.name}`
}

async function OpenStage($: any, ctx: ViewCtx, stage: StageModel, notes: Note[]) {
  const { Box, Text, Svg, Input } = ctx.el
  const phase = currentPhase(ctx, stage)
  const decisions = await stageDecisions($, ctx.main, stage)
  const mine = notes.filter(n => n.stage === stage.id).map(n => `· ${n.text}`)
  const submit = async (value: string) => {
    if (!(await addNote($, ctx.main, stage.id, value))) return
    await $.ui.toast(tr(ctx.lang, 'noteSaved'))
    void update($, expanded, list => [...list]) // same value, new array: redraws with the new note
  }
  return (
    <Box flexDirection="column" paddingLeft={2} gap={1}>
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Text dimColor>{tr(ctx.lang, `type_${stage.type}`)}</Text>
        {Pills(ctx, stage)}
      </Box>
      {phase && (
        <Box flexDirection="column">
          {Svg && <Svg key={`rail:${stage.id}`} source={railSvg(stage.phases, phase.label)} alt={phase.label} />}
          <Text color={phase.stopped ? C.amber : C.accent}>{tr(ctx.lang, 'phaseNow', { phase: phase.label })}</Text>
        </Box>
      )}
      {stage.topics.length > 0 && Section(ctx, tr(ctx.lang, 'topics'), stage.topics.map(topicLine))}
      {decisions.length > 0 && Section(ctx, tr(ctx.lang, 'decisions'), decisions.map(d => `· ${d}`))}
      {stage.how && Section(ctx, tr(ctx.lang, 'how'), [stage.how])}
      <Box flexDirection="column">
        <Text dimColor bold>{tr(ctx.lang, 'notes')}</Text>
        {mine.map(line => <Text wrap="wrap">{line}</Text>)}
        <Input key={`note:${stage.id}`} placeholder={tr(ctx.lang, 'addNote')} onSubmit={submit} />
      </Box>
    </Box>
  )
}

function Legend(ctx: ViewCtx) {
  const { Box, Text } = ctx.el
  const items: [string, string, string][] = [
    ['■', C.muted, 'lg_done'], ['▶', C.accent, 'lg_running'], ['!', C.amber, 'lg_stopped'], ['□', C.faint, 'lg_todo'],
  ]
  return (
    <Box flexDirection="row" gap={1}>
      <Text dimColor>{tr(ctx.lang, 'legend')}</Text>
      {items.map(([mark, color, key]) => <Text color={color}>{`${mark} ${tr(ctx.lang, key)}`}</Text>)}
    </Box>
  )
}

export async function renderPlanView($: any, ctx: ViewCtx, plan: PlanModel | null) {
  const { Box, Text } = ctx.el
  if (!plan) return <Text dimColor>{tr(ctx.lang, 'noPlan')}</Text>
  const list = await read($, expanded)
  const notes = await readNotes($, ctx.main)
  const rows = []
  for (const [i, stage] of plan.stages.entries()) {
    const open = isOpen(list, stage, plan)
    rows.push(
      <Box flexDirection="column">
        {Row($, ctx, plan, stage, i, open)}
        {open ? await OpenStage($, ctx, stage, notes) : Bar(ctx, stage)}
      </Box>,
    )
  }
  return (
    <Box flexDirection="column" gap={1}>
      {rows}
      {Legend(ctx)}
    </Box>
  )
}
