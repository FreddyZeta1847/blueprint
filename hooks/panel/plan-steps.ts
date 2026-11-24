/*
 * The plain plan of an implementation stage, blueprint/plans/<stage id>.md (format in the
 * docs-management skill): `## ` sections (one per part, «Madre»/«Mother» for the main session),
 * optional `### ` groups inside a section (letters: «A. Title»), optional `#### ` Tasks inside a
 * group («A1. Title»), checkbox steps («A1.1 Title», the sub-tasks), a line of plain words under
 * each title, and per group the «Test:» and «Finita quando:» lines. Each session ticks its own section in its own copy, so a child's section is read
 * from its worktree (<main>/.claude/worktrees/<slug of the part>/…) when that copy exists.
 * A stage built in one session (no independent parts) is one session: its `## ` sections are groups.
 * `$` is the mod's engine interface, always passed as a parameter.
 */
import type { PhaseState, StageModel } from './types'
import { slug } from './repo'

export type StepRole = 'mother' | 'child' | 'single'
/** One group of one session: `name` is the session (empty for a single session), `group` its title. */
export type StepSection = {
  name: string; role: StepRole; group?: string
  steps: { text: string; state: PhaseState }[]
  test?: string; doneWhen?: string
  /** what the «Test (key):» line names: a command, or a test file whose block the output carries */
  testKey?: string
  /** the plain words under the group's title */
  expl?: string
  /** the group's `#### ` Tasks with their sub-tasks (the same steps as `steps`), when the plan has them */
  tasks?: TaskNode[]
}
/** A Task of the four-level plan (`#### A1. Title`); `id` is its name when the title starts with one. */
export type TaskNode = { id?: string; title?: string; expl?: string; steps: TreeStep[] }
export type TreeStep = { id?: string; text: string; expl?: string; state: PhaseState }
type RawStep = { text: string; done: boolean; expl?: string }
type RawTask = { title?: string; expl?: string; steps: RawStep[] }
type RawGroup = { title?: string; steps: RawStep[]; test?: string; testKey?: string; doneWhen?: string; expl?: string; tasks?: RawTask[] }
type RawSection = { name: string; groups: RawGroup[] }

/** One `- Test: …` / `- Test (key): …` / `- Finita quando: …` / `- Done when: …` line, or null. */
function checkLine(line: string): { key: 'test' | 'doneWhen'; text: string; testKey?: string } | null {
  const m = /^\s*[-*]\s+(test|finita quando|done when)\s*(?:\(([^)]+)\))?\s*:\s*(.+?)\s*$/i.exec(line)
  if (!m?.[1] || !m[3]) return null
  const testKey = m[2]?.replace(/`/g, '').trim()
  return { key: m[1].toLowerCase() === 'test' ? 'test' : 'doneWhen', text: m[3], ...(testKey ? { testKey } : {}) }
}

/** Markdown marks the panel cannot draw (**bold**, __bold__, *italic*, _italic_, `code`, [links](url)) taken out of a line. */
const plain = (text: string) => text
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\*\*|__|`/g, '')
  .replace(/(^|[\s(])([*_])([^*_\s][^*_]*?)\2/g, '$1$3')

/** Adds a line of plain words to what an element already says. */
const addExpl = (on: { expl?: string }, line: string) => { on.expl = on.expl ? `${on.expl} ${plain(line.trim())}` : plain(line.trim()) }

/**
 * `## name` sections, their `### ` groups, `#### ` Tasks and lines; steps before any `## ` form a
 * nameless section. A text line under a group or Task title is its explanation, an indented one
 * under a step is the step's; after a «Test» or «Finita quando» line, text is no one's.
 */
export function parseSteps(text: string): RawSection[] {
  const sections: RawSection[] = []
  let owner: { expl?: string } | null = null // what a text line explains now
  let stepOwner = false // the owner is a step: only an indented line explains it
  for (const line of text.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2?.[1]) { sections.push({ name: plain(h2[1]), groups: [{ steps: [] }] }); owner = null; continue }
    const opensBody = /^###\s/.test(line) || /^####\s/.test(line) || /^\s*[-*]\s+\[[ xX]\]\s/.test(line) || checkLine(line) !== null
    if (sections.length === 0 && opensBody) sections.push({ name: '', groups: [{ steps: [] }] })
    const section = sections[sections.length - 1]
    if (!section) continue
    const h3 = /^###\s+(.+?)\s*$/.exec(line)
    if (h3?.[1]) { const g: RawGroup = { title: plain(h3[1]), steps: [] }; section.groups.push(g); owner = g; stepOwner = false; continue }
    const group = section.groups[section.groups.length - 1]!
    const h4 = /^####\s+(.+?)\s*$/.exec(line)
    if (h4?.[1]) { const t: RawTask = { title: plain(h4[1]), steps: [] }; (group.tasks ??= []).push(t); owner = t; stepOwner = false; continue }
    const box = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(line)
    if (box?.[2]) {
      const step: RawStep = { text: plain(box[2]), done: box[1] !== ' ' }
      group.steps.push(step)
      group.tasks?.[group.tasks.length - 1]?.steps.push(step)
      owner = step; stepOwner = true; continue
    }
    const check = checkLine(line)
    if (check) {
      group[check.key] = plain(check.text)
      if (check.testKey) group.testKey = check.testKey
      owner = null; continue
    }
    if (!owner || !line.trim() || /^\s*([-*]|#)/.test(line)) continue
    if (stepOwner && !/^\s/.test(line)) { owner = null; continue }
    addExpl(owner, line)
  }
  return sections
    .map(s => ({ ...s, groups: s.groups.filter(g => g.steps.length > 0 || g.test || g.doneWhen).map(tidy) }))
    // a section with letters but no checkbox yet is the plan phase's skeleton: kept, so it shows
    .filter(s => s.groups.length > 0)
}

/** Drops an empty title; steps written before the first Task go to a Task with no title, so none is lost. */
function tidy({ title, ...g }: RawGroup): RawGroup {
  if (g.tasks) {
    const inTasks = new Set(g.tasks.flatMap(t => t.steps))
    const loose = g.steps.filter(s => !inTasks.has(s))
    if (loose.length > 0) g.tasks.unshift({ steps: loose })
  }
  return title ? { title, ...g } : g
}

/** «A1.2 Titolo» → { id: 'A1.2', title: 'Titolo' }; a title with no name stays whole. */
export function splitId(text: string): { id?: string; title: string } {
  // a capital letter alone is a name only with its dot («A. Title»), so «I test unitari» has none
  const m = /^([A-Z]\d+(?:\.\d+)*|[A-Z](?=\.))\.?\s+(.+)$/.exec(text)
  return m?.[1] && m[2] ? { id: m[1], title: m[2] } : { title: text }
}

/** A node's state from its children's: in progress or stopped if one is, done if all are, else to do. */
export function nodeState(states: PhaseState[]): PhaseState {
  if (states.includes('running')) return 'running'
  if (states.includes('stopped')) return 'stopped'
  return states.length > 0 && states.every(s => s === 'done') ? 'done' : 'todo'
}

const isMother = (name: string) => /^(madre|mother)$/i.test(name.trim())
const stepsOf = (s: RawSection) => s.groups.flatMap(g => g.steps)

/**
 * One session's groups: done steps ticked; while it works, its first open step is the one in
 * progress (`live`: running, or stopped when the session waits for the user).
 */
function toSections(name: string, role: StepRole, groups: RawGroup[], live: PhaseState | null, titled: boolean): StepSection[] {
  const first = groups.flatMap(g => g.steps).findIndex(s => !s.done)
  let n = 0
  return groups.map(g => {
    const state = new Map<RawStep, PhaseState>()
    for (const s of g.steps) {
      const i = n++ // the step's place in the whole session
      state.set(s, s.done ? 'done' : live && i === first ? live : 'todo')
    }
    const tree = (s: RawStep): TreeStep => ({ ...splitId(s.text), text: splitId(s.text).title, ...(s.expl ? { expl: s.expl } : {}), state: state.get(s)! })
    const tasks = g.tasks?.map(t => ({ ...(t.title ? splitId(t.title) : {}), ...(t.expl ? { expl: t.expl } : {}), steps: t.steps.map(tree) }))
      .map(({ title, ...t }) => (title ? { title, ...t } : t))
    return {
      name, role, ...(titled && g.title ? { group: g.title } : {}), test: g.test, doneWhen: g.doneWhen,
      ...(g.testKey ? { testKey: g.testKey } : {}), ...(g.expl ? { expl: g.expl } : {}), ...(tasks ? { tasks } : {}),
      steps: g.steps.map(s => ({ text: s.text, state: state.get(s)! })),
    }
  })
}

/** In progress, or stopped while the stage's phase waits for the user. */
const liveOf = (stage: StageModel): PhaseState => (stage.phases.some(p => p.state === 'stopped') ? 'stopped' : 'running')

export async function readSteps($: any, main: string, stage: StageModel): Promise<StepSection[]> {
  const file = `blueprint/plans/${stage.id}.md`
  const text: string | null = await $.fs.read(`${main}/${file}`).catch(() => null)
  if (text === null) return []
  const sections = parseSteps(text)
  const running = stage.status === 'in_progress'
  if (stage.independentParts.length === 0) {
    // one session: every ## section is one of its groups
    const groups = sections.flatMap(s => s.groups.map(g => ({ ...g, title: g.title ?? (sections.length > 1 ? s.name : undefined) })))
    return toSections('', 'single', groups, running ? liveOf(stage) : null, true)
  }
  const parts = new Set(stage.independentParts.map(slug))
  const read: { raw: RawSection; role: StepRole }[] = []
  for (const section of sections) {
    const wt = slug(section.name)
    const child = parts.has(wt) && !isMother(section.name)
    let raw = section
    if (child) {
      // the child ticks its steps in its own worktree: its copy wins when it has this section
      const copy: string | null = await $.fs.read(`${main}/.claude/worktrees/${wt}/${file}`).catch(() => null)
      raw = (copy && parseSteps(copy).find(s => s.name === section.name)) || section
    }
    read.push({ raw, role: child ? 'child' : 'mother' })
  }
  // the mother's own steps (merge, checks) start only once every child has finished its section
  const childrenDone = read.every(r => r.role !== 'child' || stepsOf(r.raw).every(s => s.done))
  const waiting = new Set(stage.waitingOn)
  const live = (raw: RawSection, role: StepRole): PhaseState | null => {
    if (!running || (role === 'mother' && !childrenDone)) return null
    if (role === 'child') return waiting.has(slug(raw.name)) ? 'stopped' : 'running'
    return liveOf(stage)
  }
  return read.flatMap(({ raw, role }) => toSections(raw.name, role, raw.groups, live(raw, role), true))
}
