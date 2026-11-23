/*
 * The work tree of an implementation stage's build (and plan) phase, for a plain plan written in
 * four levels (decisions «Albero del lavoro»): session → letter → Task → sub-task, each with its
 * name (A, A1, A1.1), its short title and, only on the path being worked on, its plain words.
 * Sessions, letters and Tasks are open; a Task's sub-tasks open with its button («▸ 3» / «▾ 3»),
 * the Task in progress already open. The state of the sub-task in progress climbs back up: its Task,
 * letter and session are blue while the session works, amber when it waits for the user. Which
 * Tasks were opened or shut by hand lives in the `taskOpen` $.state atom. The terminal gets the
 * same tree with text marks and no guides. Data: plan-steps.ts.
 */
import { atom, read, update } from 'claude-code'
import type { PhaseState, StageModel, ViewCtx } from './types'
import { C, GLYPH, stepLineSvg, treeMarkSvg } from './marks'
import { tr } from './text'
import { nodeState, splitId, type StepSection, type TaskNode, type TreeStep } from './plan-steps'

const taskOpen = atom({ plugin: 'blueprint', key: 'taskOpen' } as const, [] as string[], { shape: 'taskOpen-1' })

const onPath = (state: PhaseState) => state === 'running' || state === 'stopped'
const inkOf = (state: PhaseState) => (state === 'todo' ? C.faint : onPath(state) ? C.ink : C.muted)

/** The sessions of the plan, each with its groups (the letters), in the file's order. */
function bySession(sections: StepSection[]): { name: string; role: StepSection['role']; groups: StepSection[] }[] {
  const out: { name: string; role: StepSection['role']; groups: StepSection[] }[] = []
  for (const s of sections) {
    const last = out[out.length - 1]
    if (last && last.name === s.name && last.role === s.role) last.groups.push(s)
    else out.push({ name: s.name, role: s.role, groups: [s] })
  }
  return out
}

/**
 * One row: the mark, the name and title (the name bold on a letter), what is on the right, and
 * under the title its plain words when the row is on the path being worked on.
 */
function Row(ctx: ViewCtx, o: { state: PhaseState; label: string; expl?: string; right?: unknown; bold?: boolean; color?: string }) {
  const { Box, Text, Svg } = ctx.el
  const svg = ctx.surface !== 'terminal'
  return (
    <Box flexDirection="row" gap={1} width="100%">
      {svg && (
        <Box width={3} flexShrink={0}>
          <Svg source={treeMarkSvg(o.state)} alt={GLYPH[o.state]} width={18} height={20} />
        </Box>
      )}
      <Box flexGrow={1} flexShrink={1} flexDirection="column">
        <Text wrap="wrap" bold={o.bold || onPath(o.state)} color={o.color ?? inkOf(o.state)}>{svg ? o.label : `${GLYPH[o.state]} ${o.label}`}</Text>
        {o.expl && onPath(o.state) && <Text wrap="wrap" color={C.muted}>{o.expl}</Text>}
      </Box>
      {o.right ?? null}
    </Box>
  )
}

/** The children of a row, one level in, with a thin guide under the parent's mark (none on the terminal). */
function Level(ctx: ViewCtx, children: unknown) {
  const { Box, Svg } = ctx.el
  return (
    <Box flexDirection="column" width="100%" paddingLeft={3}>
      {ctx.surface !== 'terminal' && (
        <Box position="absolute" top={0} bottom={0} left={0} overflow="hidden">
          <Svg source={stepLineSvg(C.line)} alt="│" width={18} height={4000} />
        </Box>
      )}
      {children}
    </Box>
  )
}

const label = (id: string | undefined, title: string) => (id ? `${id} ${title}` : title)
const stepRow = (ctx: ViewCtx, s: TreeStep) => Row(ctx, { state: s.state, label: label(s.id, s.text), expl: s.expl })

/** A Task with its button and, when open, its sub-tasks. */
function TaskRows($: any, ctx: ViewCtx, key: string, task: TaskNode, opened: string[]) {
  const { Box, Button } = ctx.el
  const state = nodeState(task.steps.map(s => s.state))
  const open = opened.includes(`open:${key}`) || (!opened.includes(`shut:${key}`) && onPath(state))
  const flip = () => void update($, taskOpen, list => [...list.filter(k => k !== `open:${key}` && k !== `shut:${key}`), `${open ? 'shut' : 'open'}:${key}`])
  const n = task.steps.length
  const button = n > 0 ? <Button key={`task:${key}`} plain dimColor onPress={flip}>{`${open ? '▾' : '▸'} ${n}`}</Button> : null
  return (
    <Box flexDirection="column" width="100%">
      {Row(ctx, { state, label: label(task.id, task.title ?? ''), expl: task.expl, right: button })}
      {open && n > 0 && Level(ctx, task.steps.map(s => stepRow(ctx, s)))}
    </Box>
  )
}

/** A letter: its row («A Title», Tasks done of all), then its Tasks — or its steps, in the old format. */
function LetterRows($: any, ctx: ViewCtx, stage: StageModel, session: string, g: StepSection, opened: string[]) {
  const { Box, Text } = ctx.el
  const { id, title } = splitId(g.group ?? '')
  const states = g.tasks ? g.tasks.map(t => nodeState(t.steps.map(s => s.state))) : g.steps.map(s => s.state)
  const state = nodeState(g.steps.map(s => s.state))
  const right = g.tasks ? <Text dimColor>{`${states.filter(s => s === 'done').length}/${states.length}`}</Text> : null
  const kids = g.tasks
    ? g.tasks.map((t, i) => TaskRows($, ctx, `${stage.id}:${session}:${t.id ?? `${id ?? ''}#${i}`}`, t, opened))
    : g.steps.map(s => Row(ctx, { state: s.state, label: s.text }))
  if (!g.group) return kids
  return (
    <Box flexDirection="column" width="100%">
      {Row(ctx, { state, label: label(id, title), expl: g.expl, right, bold: true })}
      {Level(ctx, kids)}
    </Box>
  )
}

/** The whole tree: one session row each (teal for a child), its letters inside. */
export async function WorkTree($: any, ctx: ViewCtx, stage: StageModel, sections: StepSection[], asPlan: boolean) {
  const { Box, Text } = ctx.el
  const opened = await read($, taskOpen)
  // in the plan phase nothing is built yet: every row to do
  const shown = asPlan
    ? sections.map(s => ({ ...s, steps: s.steps.map(st => ({ ...st, state: 'todo' as PhaseState })), tasks: s.tasks?.map(t => ({ ...t, steps: t.steps.map(st => ({ ...st, state: 'todo' as PhaseState })) })) }))
    : sections
  return (
    <Box key={`tree:${stage.id}`} flexDirection="column" width="100%">
      {bySession(shown).map(s => {
        const steps = s.groups.flatMap(g => g.steps)
        const state = nodeState(steps.map(st => st.state))
        const name = s.role === 'single' ? tr(ctx.lang, 'mainSession') : s.name
        const done = tr(ctx.lang, 'stepsOf', { done: steps.filter(st => st.state === 'done').length, all: steps.length })
        return (
          <Box flexDirection="column" width="100%">
            {Row(ctx, { state, label: name, bold: true, color: s.role === 'child' ? C.teal : C.muted, right: <Text dimColor>{done}</Text> })}
            {Level(ctx, s.groups.map(g => LetterRows($, ctx, stage, s.name, g, opened)))}
          </Box>
        )
      })}
    </Box>
  )
}
