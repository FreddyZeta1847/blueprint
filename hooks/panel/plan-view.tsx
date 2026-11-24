/*
 * Vista Piano — the plan's stages as rows (segmented phase bar, ticked circle when done, a caption
 * saying what the bar means, pills «tocca a te» / «N figlie» / «entro <data>»); only the current
 * stage and the open ones are framed, the rest are plain rows. A press opens a stage: pills, type
 * and what it is for, rail with ◀ ▶ to look at each phase, what that phase shows (topics, plain plan, steps, tests, done-when, decision
 * files: PhaseContent), notes with ✎ ✕ and a field to add one. Mockup D, decisions
 * «Mockup del pannello». Surfaces without Svg (the terminal) get text bars and text pills. Which
 * stages are open lives in the `expanded` $.state atom; "*" stands for «the current stage» until
 * the user presses a row; which phase each stage shows lives in `phaseLens`.
 */
import { atom, read, update } from 'claude-code'
import type { PhaseState, PlanModel, StageModel, ViewCtx } from './types'
import { C, GLYPH, barSvg, barText, pillSvg, railSvg, stepLineSvg, stepMarkSvg } from './marks'
import { tr } from './text'
import { addNote, changeNote, readNotes, stageDecisions, type Note } from './plan-extras'
import { readSteps, type StepSection } from './plan-steps'
import { TestResults } from './test-view'
import { ReviewResults } from './review-view'
import { WorkTree } from './tree-view'

/**
 * The steps of the stage's plain plan (blueprint/plans/<id>.md): one column per session, one under
 * the other, its name above; the line is teal for a child, muted for the mother. Text on the terminal.
 */
async function Steps($: any, ctx: ViewCtx, stage: StageModel, asPlan: boolean) {
  const { Box, Text, Svg, Button } = ctx.el
  const sections = await readSteps($, ctx.main, stage)
  if (sections.length === 0) return null
  const path = `${ctx.main}/blueprint/plans/${stage.id}.md`
  const copy = async () => {
    await $.ui.copy({ text: path })
    await $.ui.toast(tr(ctx.lang, 'decisionsFileCopied', { path }))
  }
  // how far each session is, by its ticked steps: «App dei soci · 3 di 4» (not in the plan phase,
  // where nothing is built yet); a single session carries it on the title
  const progress = (s: StepSection) => asPlan ? '' : ` · ${tr(ctx.lang, 'stepsOf', { done: s.steps.filter(st => st.state === 'done').length, all: s.steps.length })}`
  const sessions = bySession(sections)
  const lone = sessions.length === 1 && sessions[0]!.role === 'single'
  // a plan written in four levels (letters, Tasks, sub-tasks) is drawn as the work tree
  const tree = sections.some(s => s.tasks)
  return (
    <Box flexDirection="column" gap={1} width="100%">
      <Text bold color={C.ink}>{`${tr(ctx.lang, asPlan ? 'planSteps' : 'steps')}${lone || tree ? progress({ ...sections[0]!, steps: sections.flatMap(s => s.steps) }) : ''}`}</Text>
      {asPlan && <Button key={`plan-file:${stage.id}`} plain dimColor onPress={copy}>{`⧉ blueprint/plans/${stage.id}.md`}</Button>}
      {tree && await WorkTree($, ctx, stage, sections, asPlan)}
      {!tree && sessions.map((s, i) => {
        const color = s.role === 'child' ? C.teal : C.muted
        const steps = asPlan ? s.steps.map(st => ({ ...st, state: 'todo' as PhaseState })) : s.steps
        const lines = steps.map(st => `${GLYPH[st.state]} ${st.text}`)
        return (
          <Box flexDirection="column" width="100%">
            {s.role !== 'single' && <Text bold color={color}>{`${s.name}${progress(s)}`}</Text>}
            {hasSvg(ctx)
              ? <Box key={`steps:${stage.id}:${i}`} flexDirection="column" width="100%">{steps.map((st, k) => StepRow(ctx, st, color, k === 0, k === steps.length - 1))}</Box>
              : lines.map(line => <Text color={color} wrap="wrap">{`│ ${line}`}</Text>)}
          </Box>
        )
      })}
    </Box>
  )
}

/** One column per session: its groups' steps one after the other (the groups' titles stay in the file). */
function bySession(sections: StepSection[]): StepSection[] {
  const out: StepSection[] = []
  for (const s of sections) {
    const last = out[out.length - 1]
    if (last && last.name === s.name && last.role === s.role) last.steps = [...last.steps, ...s.steps]
    else out.push({ ...s, steps: [...s.steps] })
  }
  return out
}

/**
 * One step on the desktop: the drawn mark on the session's line, then the step as real text, which
 * wraps to whatever width the pane has. The mark, with the line's pieces around it, is in the
 * flow, so it always shows; under it, from the second text row down, an absolute Box carries the
 * rest of the line, so it follows the row's height and never crosses the mark (the desktop draws
 * absolute layers over everything else).
 */
function StepRow(ctx: ViewCtx, step: { state: PhaseState; text: string }, line: string, first: boolean, last: boolean) {
  const { Box, Text, Svg } = ctx.el
  const ink = step.state === 'done' ? C.muted : step.state === 'todo' ? C.faint : C.ink
  return (
    <Box flexDirection="row" gap={1} width="100%" alignItems="stretch">
      <Box width={3} flexShrink={0} flexDirection="column" alignItems="flex-start" justifyContent="flex-start">
        <Svg source={stepMarkSvg(step.state, line, first, last)} alt={GLYPH[step.state]} width={18} height={20} />
        {!last && (
          <Box position="absolute" top={1} bottom={0} left={0} overflow="hidden">
            <Svg source={stepLineSvg(line)} alt="│" width={18} height={4000} />
          </Box>
        )}
      </Box>
      <Box flexGrow={1} flexShrink={1} paddingBottom={last ? 0 : 'xs'}>
        <Text color={ink} wrap="wrap">{step.text}</Text>
      </Box>
    </Box>
  )
}

/** The «Test:» or «Finita quando:» (first-use phase: the user's checklist) line of each session or group. */
async function Checks($: any, ctx: ViewCtx, stage: StageModel, key: 'test' | 'doneWhen') {
  const { Box, Text } = ctx.el
  const rows = (await readSteps($, ctx.main, stage)).filter(s => s[key])
  if (rows.length === 0) return null
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={C.ink}>{tr(ctx.lang, key === 'test' ? 'checksTest' : 'checksDone')}</Text>
      {rows.map(s => (
        <Box flexDirection="column">
          {(s.group || s.name) && <Text bold color={s.role === 'child' ? C.teal : C.muted}>{[s.role === 'single' ? '' : s.name, s.group].filter(Boolean).join(' · ')}</Text>}
          <Text wrap="wrap">{s[key]}</Text>
        </Box>
      ))}
    </Box>
  )
}

/**
 * The topics. In a discussion each topic is marked against the phase looked at: past it ✓, in it ●,
 * not there yet ○ (a done topic has passed every phase).
 */
function Topics(ctx: ViewCtx, stage: StageModel, at: number) {
  if (stage.topics.length === 0)
    return Section(ctx, tr(ctx.lang, 'topics'), [tr(ctx.lang, 'noTopics')])
  if (stage.type !== 'discussion') return Section(ctx, tr(ctx.lang, 'topics'), stage.topics.map(topicLine))
  const mark = (t: StageModel['topics'][number]): PhaseState => {
    if (t.done || stage.status === 'done') return 'done'
    const reached = stage.phases.findIndex(p => p.id === t.phase)
    return reached > at ? 'done' : reached === at ? 'running' : 'todo'
  }
  return Section(ctx, tr(ctx.lang, 'topics'), stage.topics.map(t => `${GLYPH[mark(t)]} ${t.name}`))
}

/** What the phase looked at shows under the rail (decisions «Piano spiegato per passi»). */
async function PhaseContent($: any, ctx: ViewCtx, stage: StageModel, at: number) {
  const id = stage.phases[at]?.id
  if (!id) return Topics(ctx, stage, at) // a type with no known loop
  if (stage.type === 'discussion') {
    return [Topics(ctx, stage, at), id === 'decision' || id === 'recap' ? await Decisions($, ctx, stage) : null]
  }
  if (id === 'clarify' || id === 'do' || id === 'prepare') return Topics(ctx, stage, at)
  if (id === 'plan') return await Steps($, ctx, stage, true)
  if (id === 'build') return await Steps($, ctx, stage, false)
  if (id === 'test') return await TestResults($, ctx, stage)
  if (id === 'review') return await ReviewResults($, ctx, stage)
  if (id === 'first_use') return await Checks($, ctx, stage, 'doneWhen') // the user's checklist
  return null
}

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

/** «si costruisce.» → «Si costruisce.»: the phase texts are written to follow a dash in the Legenda. */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
/** «Serve a costruire…» → «serve a costruire…», after the type's name. */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/** The terminal hands out Svg too, but as an empty fragment: it gets text instead. */
const hasSvg = (ctx: ViewCtx) => ctx.surface !== 'terminal'

/** Svg and Text take no `key`: the key goes on a Box around them, which tests and presses find. */
function Keyed(ctx: ViewCtx, key: string, child: unknown) {
  const { Box } = ctx.el
  return <Box key={key}>{child}</Box>
}

type Pill = { key: string; label: string; tone: 'amber' | 'accent' | 'muted' }

function pillList(ctx: ViewCtx, stage: StageModel): Pill[] {
  const pills: Pill[] = []
  if (stage.yourTurn) pills.push({ key: `pill:turn:${stage.id}`, label: tr(ctx.lang, 'yourTurn'), tone: 'amber' })
  if (stage.kids > 0) pills.push({ key: `pill:kids:${stage.id}`, label: tr(ctx.lang, 'kids', { n: stage.kids }), tone: 'accent' })
  if (stage.deadline) pills.push({ key: `pill:due:${stage.id}`, label: tr(ctx.lang, 'due', { d: shortDate(ctx.lang, stage.deadline) }), tone: 'muted' })
  return pills
}

/** Columns the pills take on a row: each label plus its brackets and the gap. */
const pillColumns = (pills: Pill[]) => pills.reduce((n, p) => n + p.label.length + 3, 0)

function Pills(ctx: ViewCtx, stage: StageModel) {
  const { Box, Text, Svg } = ctx.el
  const vector = hasSvg(ctx)
  const pills = pillList(ctx, stage)
  if (pills.length === 0) return null
  const color = { amber: C.amber, accent: C.accent, muted: C.muted }
  return (
    <Box flexDirection="row" gap={1}>
      {pills.map(p => Keyed(ctx, p.key, vector
        ? <Svg source={pillSvg(p.label, p.tone)} alt={p.label} />
        : <Text color={color[p.tone]}>{`[${p.label}]`}</Text>))}
    </Box>
  )
}

/**
 * What the bar of a closed stage means, in words beside it: «implementazione · fase 3 di 7:
 * costruzione», «consegna · da fare»; a finished stage only its type (its tick says the rest:
 * decision «tappa finita col cerchio spuntato»).
 */
function caption(ctx: ViewCtx, stage: StageModel): string {
  const type = tr(ctx.lang, `type_${stage.type}`)
  const live = liveIndex(stage)
  if (stage.status === 'in_progress' && live >= 0) {
    const phase = tr(ctx.lang, `ph_${stage.phases[live]!.id}`)
    return `${type} · ${tr(ctx.lang, 'phaseOf', { n: live + 1, m: stage.phases.length, phase })}`
  }
  if (stage.status === 'done') return type
  return `${type} · ${tr(ctx.lang, stage.status === 'postponed' ? 'stageParked' : 'stageTodo')}`
}

/** The closed stage's second line: its phase bar (a text bar on the terminal) and the caption. */
function Bar(ctx: ViewCtx, stage: StageModel) {
  const { Box, Text, Svg } = ctx.el
  const done = stage.status === 'done'
  const alt = `${barText(stage.segments)}${done ? ` ${GLYPH.done}` : ''}`
  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      {Keyed(ctx, `bar:${stage.id}`, hasSvg(ctx)
        ? <Svg source={barSvg(stage.segments, 96, done)} alt={alt} />
        : <Text dimColor>{alt}</Text>)}
      <Text dimColor wrap="truncate">{caption(ctx, stage)}</Text>
    </Box>
  )
}

/** The stage's name as a button (a press opens or closes it); a finished stage's name is dimmed. */
function Row($: any, ctx: ViewCtx, plan: PlanModel, stage: StageModel, index: number, open: boolean) {
  const { Box, Button } = ctx.el
  const pills = Pills(ctx, stage)
  const room = ctx.columns - 8 - (open ? 0 : pillColumns(pillList(ctx, stage))) // 4 for the frame and its padding
  const label = cut(`${glyphOf(stage)} ${index + 1}. ${stage.name}`, room)
  const press = () => void update($, expanded, list => toggle(list, stage.id, plan))
  return (
    <Box flexDirection="row" justifyContent="space-between" gap={1}>
      <Button key={`stage:${stage.id}`} dimColor={stage.status === 'done' && !open} onPress={press}>{label}</Button>
      {!open && pills}
    </Box>
  )
}

/** A titled list: the title is bold and bright, so the lists stand out from the stage's own line. */
function Section(ctx: ViewCtx, title: string, lines: string[]) {
  const { Box, Text } = ctx.el
  return (
    <Box flexDirection="column">
      <Text bold color={C.ink}>{title}</Text>
      {lines.map(line => <Text wrap="wrap">{line}</Text>)}
    </Box>
  )
}

function topicLine(t: StageModel['topics'][number]): string {
  const state: PhaseState = t.done ? 'done' : t.current ? 'running' : 'todo'
  return `${GLYPH[state]} ${t.name}`
}

/**
 * Which phase the user looks at, per stage: only the panel's view, never the plan. `live` is the
 * stage's running phase when the choice was made: once the stage moves on, the choice lapses.
 */
type Lens = Record<string, { at: number; live: number }>
const lens = atom({ plugin: 'blueprint', key: 'phaseLens' } as const, {} as Lens, { shape: 'phase-lens-1' })

const liveIndex = (stage: StageModel) => stage.phases.findIndex(p => p.state === 'running' || p.state === 'stopped')

/**
 * The phase looked at: the user's choice while it holds, else the running one. A stage not running
 * opens on its context phase (its topics), a finished discussion on its last (topics and decision files).
 */
function lookedAt(stage: StageModel, chosen: Lens): { at: number; isChosen: boolean } {
  const live = liveIndex(stage)
  const pick = chosen[stage.id]
  if (pick && pick.live === live) return { at: Math.min(Math.max(pick.at, 0), stage.phases.length - 1), isChosen: true }
  const lastOfDiscussion = stage.status === 'done' && stage.type === 'discussion'
  return { at: live >= 0 ? live : lastOfDiscussion ? stage.phases.length - 1 : 0, isChosen: false }
}

/**
 * The stage's phases, always the same for its type: a rail of marks (text list on the terminal),
 * and under it ◀ phase · state ▶ with what the phase is for. The arrows only move the view.
 */
function Phases($: any, ctx: ViewCtx, stage: StageModel, phase: ReturnType<typeof currentPhase>, at: number, isChosen: boolean) {
  const { Box, Text, Svg, Button } = ctx.el
  if (stage.phases.length === 0) return null
  const seen = stage.phases[at]!
  const name = tr(ctx.lang, `ph_${seen.id}`)
  const idle = tr(ctx.lang, stage.status === 'done' ? 'stageDone' : stage.status === 'postponed' ? 'stageParked' : 'stageTodo')
  const label = isChosen ? name : phase?.label ?? idle
  const color = seen.state === 'stopped' ? C.amber : seen.state === 'running' ? C.accent : C.ink
  const move = (by: number) => () => void update($, lens, m => ({ ...m, [stage.id]: { at: Math.min(Math.max(at + by, 0), stage.phases.length - 1), live: liveIndex(stage) } }))
  return (
    <Box flexDirection="column">
      {hasSvg(ctx)
        ? Keyed(ctx, `rail:${stage.id}`, <Svg source={railSvg(stage.phases, 300, isChosen ? at : undefined)} alt={label} />)
        : Section(ctx, tr(ctx.lang, 'phases'), stage.phases.map(p => `${GLYPH[p.state]} ${tr(ctx.lang, `ph_${p.id}`)}`))}
      <Box flexDirection="row" gap={2}>
        <Button key={`phase-prev:${stage.id}`} plain dimColor={at === 0} onPress={move(-1)}>◀</Button>
        <Text bold color={color}>{`${name} · ${tr(ctx.lang, `ps_${seen.state}`)}`}</Text>
        <Button key={`phase-next:${stage.id}`} plain dimColor={at === stage.phases.length - 1} onPress={move(1)}>▶</Button>
      </Box>
      <Text dimColor wrap="wrap">{sentence(tr(ctx.lang, `phd_${seen.id}`))}</Text>
      {phase?.stopped && <Text color={C.amber} wrap="wrap">{waitLine(ctx, stage)}</Text>}
    </Box>
  )
}

/**
 * Discussion stages only: the files that hold the stage's decisions, one button per file (its path
 * relative to the project; a press copies the full path). With none yet, where they will go.
 */
async function Decisions($: any, ctx: ViewCtx, stage: StageModel) {
  const { Box, Text, Button } = ctx.el
  if (stage.type !== 'discussion') return null
  const { files, home } = await stageDecisions($, ctx.main, stage)
  const relative = (path: string) => path.startsWith(`${ctx.main}/`) ? path.slice(ctx.main.length + 1) : path
  const copy = (path: string) => async () => {
    await $.ui.copy({ text: path })
    await $.ui.toast(tr(ctx.lang, 'decisionsFileCopied', { path }))
  }
  return (
    <Box flexDirection="column">
      <Text bold color={C.ink}>{tr(ctx.lang, 'decisionsWhere')}</Text>
      {files.length > 0
        ? files.map((path, i) => <Button key={`decfile:${stage.id}:${i}`} plain dimColor onPress={copy(path)}>{`⧉ ${relative(path)}`}</Button>)
        : <Text dimColor wrap="wrap">{tr(ctx.lang, 'decisionsNone', { path: home })}</Text>}
    </Box>
  )
}

/** The note being edited, `<stage id>:<index in notes.json>`, or none: only one field at a time. */
const editing = atom({ plugin: 'blueprint', key: 'noteEdit' } as const, null as string | null, { shape: 'note-edit-1' })

/**
 * The stage's notes, each with ✎ (it becomes a field holding its text; Enter saves) and ✕ (deleted
 * at once). `i` is the note's place in notes.json; the shown text guards against a file changed meanwhile.
 */
async function NoteLines($: any, ctx: ViewCtx, stage: StageModel, notes: Note[]) {
  const { Box, Text, Button, Input } = ctx.el
  const open = await read($, editing)
  const change = async (i: number, shown: string, text: string | null) => {
    const result = await changeNote($, ctx.main, i, { stage: stage.id, text: shown }, text).catch(() => null)
    void update($, editing, () => null)
    void update($, expanded, list => [...list]) // same value, new array: redraws with the notes as saved
    if (result === 'same') return
    await $.ui.toast(tr(ctx.lang, result === null ? 'noteNotSaved' : result === 'changed' ? 'noteChanged' : text === null ? 'noteDeleted' : 'noteEdited'))
  }
  return notes.flatMap((n, i) => {
    if (n.stage !== stage.id) return []
    const id = `${stage.id}:${i}`
    if (open === id) return [<Input key={`note-text:${id}`} value={n.text} autoFocus onSubmit={(value: string) => change(i, n.text, value)} />]
    return [
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Text wrap="wrap">{`• ${n.text}`}</Text>
        <Box flexDirection="row" gap={1}>
          <Button key={`note-edit:${id}`} plain dimColor onPress={() => void update($, editing, () => id)}>✎</Button>
          <Button key={`note-del:${id}`} plain dimColor onPress={() => change(i, n.text, null)}>✕</Button>
        </Box>
      </Box>,
    ]
  })
}

async function OpenStage($: any, ctx: ViewCtx, stage: StageModel, notes: Note[]) {
  const { Box, Text, Input } = ctx.el
  const phase = currentPhase(ctx, stage)
  const { at, isChosen } = lookedAt(stage, await read($, lens))
  const submit = async (value: string) => {
    const saved = await addNote($, ctx.main, stage.id, value).catch(() => null)
    if (saved === null) return void (await $.ui.toast(tr(ctx.lang, 'noteNotSaved')))
    if (!saved) return
    await $.ui.toast(tr(ctx.lang, 'noteSaved'))
    void update($, expanded, list => [...list]) // same value, new array: redraws with the new note
  }
  return (
    <Box flexDirection="column" paddingLeft={2} gap={1}>
      {Pills(ctx, stage)}
      <Text dimColor wrap="wrap">{`${tr(ctx.lang, `type_${stage.type}`)} · ${lowerFirst(tr(ctx.lang, `purpose_${stage.type}`))}`}</Text>
      {Phases($, ctx, stage, phase, at, isChosen)}
      {await PhaseContent($, ctx, stage, at)}
      <Box flexDirection="column">
        <Text bold color={C.ink}>{tr(ctx.lang, 'notes')}</Text>
        {await NoteLines($, ctx, stage, notes)}
        <Input key={`note:${stage.id}`} placeholder={tr(ctx.lang, 'addNote')} onSubmit={submit} />
      </Box>
    </Box>
  )
}

/** Why the stage is stopped: the children that wait for the user, or a phase that needs the user. */
function waitLine(ctx: ViewCtx, stage: StageModel): string {
  if (stage.waitingOn.length > 0) return `${GLYPH.stopped} ${tr(ctx.lang, 'waitChild', { who: stage.waitingOn.join(', ') })}`
  const at = stage.phases.find(p => p.state === 'stopped')
  return `${GLYPH.stopped} ${tr(ctx.lang, 'waitPhase', { phase: tr(ctx.lang, `ph_${at?.id ?? ''}`) })}`
}

/** One line under the stages: the four marks and their colours, the same as the rail and the steps. */
function Legend(ctx: ViewCtx) {
  const { Box, Text } = ctx.el
  const items: [string, string, string][] = [
    [GLYPH.done, C.muted, 'lg_done'], [GLYPH.running, C.accent, 'lg_running'], [GLYPH.stopped, C.amber, 'lg_stopped'], [GLYPH.todo, C.faint, 'lg_todo'],
  ]
  return (
    <Box flexDirection="row" gap={1} flexWrap="wrap">
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
    const current = i === plan.currentIndex
    // a frame only where the eye should stop: the current stage (accent, amber when it waits for
    // you) and any open one (grey); the other stages are plain rows, so the list stays light
    const frame = current ? (stage.yourTurn ? C.amber : C.accent) : C.line
    const body = [Row($, ctx, plan, stage, i, open), open ? await OpenStage($, ctx, stage, notes) : Bar(ctx, stage)]
    rows.push(current || open
      ? <Box flexDirection="column" borderStyle="round" borderColor={frame} paddingX={1}>{body}</Box>
      : <Box flexDirection="column" paddingX={1}>{body}</Box>)
  }
  return (
    <Box flexDirection="column" gap={1}>
      {rows}
      {Legend(ctx)}
    </Box>
  )
}
