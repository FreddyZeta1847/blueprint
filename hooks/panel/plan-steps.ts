/*
 * The plain plan of an implementation stage, blueprint/plans/<stage id>.md (format in the
 * docs-management skill): `## ` sections (one per part, «Madre»/«Mother» for the main session)
 * with checkbox steps. Each session ticks its own section in its own copy, so a child's section is
 * read from its worktree (<main>/.claude/worktrees/<slug of the part>/…) when that copy exists.
 * `$` is the mod's engine interface, always passed as a parameter.
 */
import type { PhaseState, StageModel } from './types'
import { slug } from './repo'

export type StepRole = 'mother' | 'child' | 'single'
export type StepSection = { name: string; role: StepRole; steps: { text: string; state: PhaseState }[] }
type RawSection = { name: string; steps: { text: string; done: boolean }[] }

/** `## name` sections and their `- [ ]` / `- [x]` lines; other lines (tests, «finita quando») are not steps. */
export function parseSteps(text: string): RawSection[] {
  const sections: RawSection[] = []
  for (const line of text.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2?.[1]) { sections.push({ name: h2[1], steps: [] }); continue }
    const box = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(line)
    if (box?.[2] && sections.length > 0) sections[sections.length - 1]!.steps.push({ text: box[2], done: box[1] !== ' ' })
  }
  return sections.filter(s => s.steps.length > 0)
}

const isMother = (name: string) => /^(madre|mother)$/i.test(name.trim())

/** Done steps ticked; while the stage runs, the first open step of each section is the one in progress. */
function toSection(raw: RawSection, role: StepRole, running: boolean): StepSection {
  const first = raw.steps.findIndex(s => !s.done)
  return {
    name: raw.name, role,
    steps: raw.steps.map((s, i) => ({ text: s.text, state: s.done ? 'done' : running && i === first ? 'running' : 'todo' })),
  }
}

export async function readSteps($: any, main: string, stage: StageModel): Promise<StepSection[]> {
  const file = `blueprint/plans/${stage.id}.md`
  const text: string | null = await $.fs.read(`${main}/${file}`).catch(() => null)
  if (text === null) return []
  const sections = parseSteps(text)
  const parts = new Set(stage.independentParts.map(slug))
  const running = stage.status === 'in_progress'
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
    read.push({ raw, role: sections.length === 1 ? 'single' : child ? 'child' : 'mother' })
  }
  // the mother's own steps (merge, checks) start only once every child has finished its section
  const childrenDone = read.every(r => r.role !== 'child' || r.raw.steps.every(s => s.done))
  return read.map(({ raw, role }) => toSection(raw, role, running && (role !== 'mother' || childrenDone)))
}
