/*
 * Extra data the Piano view shows for an open stage, read from the project's blueprint/ folder:
 * - stageDecisions: the decisions of a stage, from blueprint/decisions.md (bold text of the
 *   bullets under `## <stage name>`, its `###` subsections included) and from the decisions
 *   folder blueprint/decisions/**.md (the question of each `### id — question` block whose
 *   `- **Stage:** <id>` is the stage).
 * - readNotes / addNote: blueprint/notes.json `{ "notes": [{ stage, text, read }] }`.
 * `$` is the mod's engine interface, always passed as a parameter.
 */
import type { StageModel } from './types'

export type Note = { stage: string; text: string; read: boolean }

export type Decision = { text: string; oneWay: boolean }

/** A bullet of the single decisions file says it is hard to change: «one-way», «difficile da cambiare». */
const hardToChange = (line: string) => /one-way|difficile da cambiare|irreversibil|hard to change/i.test(line) && !/two-way/i.test(line)

/** Bold bullet texts under `## <name>` until the next `## ` heading; one-way when the bullet says so. */
export function decisionsFromFile(text: string, name: string): Decision[] {
  const out: Decision[] = []
  let inside = false
  for (const line of text.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2) { inside = h2[1] === name; continue }
    const bold = inside ? /^\s*[-*]\s+\*\*(.+?)\*\*/.exec(line) : null
    if (bold?.[1]) out.push({ text: bold[1], oneWay: hardToChange(line) })
  }
  return out
}

/** Questions of the `### id — question` blocks whose Stage line names the stage id; one-way by `Reversibility`. */
export function decisionsFromBlocks(text: string, stageId: string): Decision[] {
  return text.split(/^###\s+/m).slice(1).flatMap(block => {
    const title = block.split(/\r?\n/)[0] ?? ''
    const stage = /^\s*-\s+\*\*(?:Stage|Tappa):\*\*\s*(\S+)/m.exec(block)?.[1]
    if (stage !== stageId) return []
    const oneWay = /^\s*-\s+\*\*(?:Reversibility|Reversibilità):\*\*\s*one-way/im.test(block)
    return [{ text: title.split(/\s+[—–-]\s+/).slice(1).join(' — ').trim() || title.trim(), oneWay }]
  })
}

/** Every .md file under a folder; a missing folder gives nothing. */
async function markdownFiles($: any, dir: string, depth = 0): Promise<string[]> {
  if (depth > 6) return []
  const entries: { name: string; kind: string }[] = await $.fs.list(dir).catch(() => [])
  const found: string[] = []
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`
    if (entry.kind === 'dir') found.push(...(await markdownFiles($, path, depth + 1)))
    else if (entry.name.endsWith('.md')) found.push(path)
  }
  return found
}

/**
 * The stage's decisions, the files that hold them (absolute paths), and where the project keeps
 * decisions at all (relative: the decisions folder, the single file, or the context card).
 */
export async function stageDecisions($: any, main: string, stage: StageModel): Promise<{ list: Decision[]; files: string[]; home: string }> {
  const singlePath = `${main}/blueprint/decisions.md`
  const single: string | null = await $.fs.read(singlePath).catch(() => null)
  const list = decisionsFromFile(single ?? '', stage.name)
  const files = list.length > 0 ? [singlePath] : []
  const folder = await markdownFiles($, `${main}/blueprint/decisions`)
  for (const path of folder) {
    const text: string = await $.fs.read(path).catch(() => '')
    const found = decisionsFromBlocks(text, stage.id)
    if (found.length > 0) { list.push(...found); files.push(path) }
  }
  const home = folder.length > 0 ? 'blueprint/decisions/' : single !== null ? 'blueprint/decisions.md' : 'blueprint/context.md'
  return { list, files, home }
}

const notesPath = (main: string) => `${main}/blueprint/notes.json`

/** All notes; a missing or unreadable file gives none. */
export async function readNotes($: any, main: string): Promise<Note[]> {
  try {
    const raw = JSON.parse(await $.fs.read(notesPath(main)))
    return Array.isArray(raw?.notes) ? raw.notes : []
  } catch { return [] }
}

/** Appends one unread note for the stage; an empty text adds nothing. Returns whether it wrote. */
export async function addNote($: any, main: string, stage: string, text: string): Promise<boolean> {
  const clean = text.trim()
  if (!clean) return false
  const existing: string | null = await $.fs.read(notesPath(main)).catch(() => null)
  // a file that exists but does not parse throws here: never overwrite the user's notes
  const notes: Note[] = existing === null ? [] : (JSON.parse(existing).notes ?? [])
  notes.push({ stage, text: clean, read: false })
  await $.fs.write(notesPath(main), JSON.stringify({ notes }, null, 2) + '\n')
  return true
}
