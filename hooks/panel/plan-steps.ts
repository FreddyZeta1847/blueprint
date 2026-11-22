/*
 * The plain plan of an implementation stage, blueprint/plans/<stage id>.md (format in the
 * docs-management skill): `## ` sections (one per part, «Madre»/«Mother» for the main session),
 * optional `### ` groups inside a section, checkbox steps, and per group the «Test:» and «Finita
 * quando:» lines. Each session ticks its own section in its own copy, so a child's section is read
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
}
type RawStep = { text: string; done: boolean }
type RawGroup = { title?: string; steps: RawStep[]; test?: string; doneWhen?: string }
type RawSection = { name: string; groups: RawGroup[] }

/** One `- Test: …` / `- Finita quando: …` / `- Done when: …` line, or null. */
function checkLine(line: string): { key: 'test' | 'doneWhen'; text: string } | null {
  const m = /^\s*[-*]\s+(test|finita quando|done when)\s*:\s*(.+?)\s*$/i.exec(line)
  if (!m?.[1] || !m[2]) return null
  return { key: m[1].toLowerCase() === 'test' ? 'test' : 'doneWhen', text: m[2] }
}

/** Markdown marks the panel cannot draw (**bold**, __bold__, *italic*, _italic_, `code`, [links](url)) taken out of a line. */
const plain = (text: string) => text
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\*\*|__|`/g, '')
  .replace(/(^|[\s(])([*_])([^*_\s][^*_]*?)\2/g, '$1$3')

/** `## name` sections, their `### ` groups and lines; steps before any `## ` form a nameless section. */
export function parseSteps(text: string): RawSection[] {
  const sections: RawSection[] = []
  for (const line of text.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2?.[1]) { sections.push({ name: plain(h2[1]), groups: [{ steps: [] }] }); continue }
    const opensBody = /^###\s/.test(line) || /^\s*[-*]\s+\[[ xX]\]\s/.test(line) || checkLine(line) !== null
    if (sections.length === 0 && opensBody) sections.push({ name: '', groups: [{ steps: [] }] })
    const section = sections[sections.length - 1]
    if (!section) continue
    const h3 = /^###\s+(.+?)\s*$/.exec(line)
    if (h3?.[1]) { section.groups.push({ title: plain(h3[1]), steps: [] }); continue }
    const group = section.groups[section.groups.length - 1]!
    const box = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(line)
    if (box?.[2]) { group.steps.push({ text: plain(box[2]), done: box[1] !== ' ' }); continue }
    const check = checkLine(line)
    if (check) group[check.key] = plain(check.text)
  }
  return sections
    .map(s => ({ ...s, groups: s.groups.filter(g => g.steps.length > 0 || g.test || g.doneWhen).map(({ title, ...g }) => (title ? { title, ...g } : g)) }))
    .filter(s => s.groups.some(g => g.steps.length > 0))
}

const isMother = (name: string) => /^(madre|mother)$/i.test(name.trim())
const stepsOf = (s: RawSection) => s.groups.flatMap(g => g.steps)

/** One session's groups: done steps ticked; while it runs, its first open step is the one in progress. */
function toSections(name: string, role: StepRole, groups: RawGroup[], running: boolean, titled: boolean): StepSection[] {
  const first = groups.flatMap(g => g.steps).findIndex(s => !s.done)
  let n = 0
  return groups.map(g => ({
    name, role, ...(titled && g.title ? { group: g.title } : {}), test: g.test, doneWhen: g.doneWhen,
    steps: g.steps.map(s => {
      const i = n++ // the step's place in the whole session
      const state: PhaseState = s.done ? 'done' : running && i === first ? 'running' : 'todo'
      return { text: s.text, state }
    }),
  }))
}

export async function readSteps($: any, main: string, stage: StageModel): Promise<StepSection[]> {
  const file = `blueprint/plans/${stage.id}.md`
  const text: string | null = await $.fs.read(`${main}/${file}`).catch(() => null)
  if (text === null) return []
  const sections = parseSteps(text)
  const running = stage.status === 'in_progress'
  if (stage.independentParts.length === 0) {
    // one session: every ## section is one of its groups
    const groups = sections.flatMap(s => s.groups.map(g => ({ ...g, title: g.title ?? (sections.length > 1 ? s.name : undefined) })))
    return toSections('', 'single', groups, running, true)
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
  return read.flatMap(({ raw, role }) => toSections(raw.name, role, raw.groups, running && (role !== 'mother' || childrenDone), true))
}
