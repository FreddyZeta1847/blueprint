/*
 * The work tree of an implementation stage's build (and plan) phase, for a plain plan written in
 * four levels (decisions «Albero del lavoro»): session → letter → Task → sub-task, each with its
 * name (A, A1, A1.1), its short title and, only on the path being worked on, its plain words.
 * Sessions, letters and Tasks are open; a Task's sub-tasks open with its button («▸ 3» / «▾ 3»),
 * the Task in progress already open; a letter's button («▾ 1/2») shuts it, if the user wants. The state of the sub-task in progress climbs back up: its Task,
 * letter and session are blue while the session works, amber when it waits for the user. Which
 * Tasks were opened or shut by hand lives in the `taskOpen` $.state atom. The terminal gets the
 * same tree with text marks and no guides. Data: plan-steps.ts.
 */
import { atom, read, update } from 'claude-code'
import type { PhaseState, StageModel, ViewCtx } from './types'
import { C, GLYPH, beadsSvg, stepLineSvg, treeMarkSvg } from './marks'
import { activity } from './activity'
import { readSessions, type SessionRow } from './sessions-data'
import { duration } from './sessions-view'
import { slug } from './repo'
import { tr } from './text'
import { nodeState, splitId, type StepSection, type TaskNode, type TreeStep } from './plan-steps'

const taskOpen = atom({ plugin: 'blueprint', key: 'taskOpen' } as const, [] as string[], { shape: 'taskOpen-1' })

const onPath = (state: PhaseState) => state === 'running' || state === 'stopped'
const inkOf = (state: PhaseState) => (state === 'todo' ? C.faint : onPath(state) ? C.ink : C.muted)

/** The sessions of the plan, each with its groups (the letters), in the file's order. */
export function sessionsOf(sections: StepSection[]): { name: string; role: StepSection['role']; groups: StepSection[] }[] {
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
function Row(ctx: ViewCtx, o: { state: PhaseState; label: string; expl?: string; words?: boolean; right?: unknown; bold?: boolean; color?: string }) {
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
        {o.expl && (o.words || onPath(o.state)) && <Text wrap="wrap" color={C.muted}>{o.expl}</Text>}
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

/** Whether a row is open: what the user chose last for it, else its default. */
const isOpen = (opened: string[], key: string, byDefault: boolean) =>
  opened.includes(`open:${key}`) || (!opened.includes(`shut:${key}`) && byDefault)

/** The button that opens or shuts a row («▾ …» open, «▸ …» shut), remembering the choice. */
function Toggle($: any, ctx: ViewCtx, key: string, open: boolean, text = '') {
  const { Button } = ctx.el
  const flip = () => void update($, taskOpen, list => [...list.filter(k => k !== `open:${key}` && k !== `shut:${key}`), `${open ? 'shut' : 'open'}:${key}`])
  return <Button key={`task:${key}`} plain dimColor onPress={flip}>{`${open ? '▾' : '▸'}${text ? ` ${text}` : ''}`}</Button>
}

/** A Task with its button and, when open, its sub-tasks (shut by default, but the one in progress). */
function TaskRows($: any, ctx: ViewCtx, key: string, task: TaskNode, opened: string[]) {
  const { Box } = ctx.el
  const state = nodeState(task.steps.map(s => s.state))
  const open = isOpen(opened, key, onPath(state))
  const n = task.steps.length
  const button = n > 0 ? Toggle($, ctx, key, open, String(n)) : null
  return (
    <Box flexDirection="column" width="100%">
      {Row(ctx, { state, label: label(task.id, task.title ?? ''), expl: task.expl, right: button })}
      {open && n > 0 && Level(ctx, task.steps.map(s => stepRow(ctx, s)))}
    </Box>
  )
}

/**
 * A letter: its row («A Title» and a button with the Tasks done of all, open by default; the user
 * may shut it), then its Tasks — or its steps, in the old format.
 */
function LetterRows($: any, ctx: ViewCtx, stage: StageModel, session: string, g: StepSection, opened: string[], asPlan: boolean) {
  const { Box, Text, Svg } = ctx.el
  const { id, title } = splitId(g.group ?? '')
  const states = g.tasks ? g.tasks.map(t => nodeState(t.steps.map(s => s.state))) : g.steps.map(s => s.state)
  const state = nodeState(g.steps.map(s => s.state))
  const key = `${stage.id}:${session}:letter:${g.group ?? ''}`
  const open = isOpen(opened, key, true)
  const count = `${states.filter(s => s === 'done').length}/${states.length}`
  const beads = ctx.surface !== 'terminal'
    ? <Box key={`beads:${key}`}><Svg source={beadsSvg(states)} alt={count} width={states.length * 12} height={12} /></Box>
    : <Text dimColor>{states.map(s => GLYPH[s]).join('')}</Text>
  // one bead per Task (the count stays in the picture's alt), then the button that shuts the letter
  const right = states.length > 0 ? <Box flexDirection="row" gap={1} alignItems="center">{beads}{Toggle($, ctx, key, open)}</Box> : null
  const kids = g.tasks
    ? g.tasks.map((t, i) => TaskRows($, ctx, `${stage.id}:${session}:${t.id ?? `${id ?? ''}#${i}`}`, t, opened))
    : g.steps.map(s => Row(ctx, { state: s.state, label: s.text }))
  if (!g.group) return kids
  return (
    <Box flexDirection="column" width="100%">
      {Row(ctx, { state, label: label(id, title), expl: g.expl, words: asPlan, right, bold: true })}
      {open && Level(ctx, kids)}
    </Box>
  )
}

/**
 * What a session is doing, on its row: «al lavoro · Bash da 2 min» or «ferma da 14 min» — from
 * the main session's own activity, or from a child's status file. Nothing when it is not known.
 */
function doingText(ctx: ViewCtx, role: StepSection['role'], name: string, state: PhaseState, kids: SessionRow[], now: number): string {
  if (role === 'child') {
    const kid = kids.find(k => k.worktree === slug(name))
    if (!kid) return ''
    if (kid.state === 'blocked') return tr(ctx.lang, 'stoppedFor', { t: duration(now - kid.updatedAt) })
    return kid.tool ? tr(ctx.lang, 'atWorkTool', { tool: kid.tool }) : ''
  }
  const me = activity()
  if (me.tool && me.since !== null) return tr(ctx.lang, 'atWork', { tool: me.tool, t: duration(now - me.since) })
  if (state === 'stopped' && me.idleSince !== null) return tr(ctx.lang, 'stoppedFor', { t: duration(now - me.idleSince) })
  return ''
}

/** A group with every step to do: the plan phase, where nothing is built yet. */
export const asTodo = (s: StepSection): StepSection => ({
  ...s, steps: s.steps.map(st => ({ ...st, state: 'todo' as PhaseState })),
  ...(s.tasks ? { tasks: s.tasks.map(t => ({ ...t, steps: t.steps.map(st => ({ ...st, state: 'todo' as PhaseState })) })) } : {}),
})

/** In the plan phase every letter shows its plain words, so the skeleton can be read in the panel. The whole tree: one session row each (teal for a child), its letters inside. */
export async function WorkTree($: any, ctx: ViewCtx, stage: StageModel, sections: StepSection[], asPlan: boolean) {
  const { Box, Text } = ctx.el
  const opened = await read($, taskOpen)
  const now: number = await $.clock.now()
  // the children's status files: readSessions wants a plan, and this stage is the parallel one
  const kids = sections.some(s => s.role === 'child') && !asPlan
    ? (await readSessions($, ctx.main, { stages: [stage], parallelIndex: 0 } as any).catch(() => ({ kids: [] as SessionRow[] }))).kids
    : []
  return (
    <Box key={`tree:${stage.id}`} flexDirection="column" width="100%">
      {sessionsOf(sections).map(s => {
        const steps = s.groups.flatMap(g => g.steps)
        const state = nodeState(steps.map(st => st.state))
        const name = s.role === 'single' ? tr(ctx.lang, 'mainSession') : s.name
        const done = tr(ctx.lang, 'stepsOf', { done: steps.filter(st => st.state === 'done').length, all: steps.length })
        const doing = asPlan ? '' : doingText(ctx, s.role, s.name, state, kids, now)
        return (
          <Box flexDirection="column" width="100%">
            {Row(ctx, { state, label: `${name} · ${done}`, bold: true, color: s.role === 'child' ? C.teal : C.muted, right: doing ? <Text dimColor>{doing}</Text> : null })}
            {Level(ctx, s.groups.map(g => LetterRows($, ctx, stage, s.name, g, opened, asPlan)))}
          </Box>
        )
      })}
    </Box>
  )
}
