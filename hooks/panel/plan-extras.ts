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

/** Bold bullet texts under `## <name>` until the next `## ` heading. */
export function decisionsFromFile(text: string, name: string): string[] {
  const out: string[] = []
  let inside = false
  for (const line of text.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2) { inside = h2[1] === name; continue }
    const bold = inside ? /^\s*[-*]\s+\*\*(.+?)\*\*/.exec(line) : null
    if (bold?.[1]) out.push(bold[1])
  }
  return out
}

/** Questions of the `### id — question` blocks whose Stage line names the stage id. */
export function decisionsFromBlocks(text: string, stageId: string): string[] {
  return text.split(/^###\s+/m).slice(1).flatMap(block => {
    const title = block.split(/\r?\n/)[0] ?? ''
    const stage = /^\s*-\s+\*\*Stage:\*\*\s*(\S+)/m.exec(block)?.[1]
    if (stage !== stageId) return []
    return [title.split(/\s+[—–]\s+/).slice(1).join(' — ').trim() || title.trim()]
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

export async function stageDecisions($: any, main: string, stage: StageModel): Promise<string[]> {
  const single: string = await $.fs.read(`${main}/blueprint/decisions.md`).catch(() => '')
  const fromFolder: string[] = []
  for (const path of await markdownFiles($, `${main}/blueprint/decisions`)) {
    const text: string = await $.fs.read(path).catch(() => '')
    fromFolder.push(...decisionsFromBlocks(text, stage.id))
  }
  return [...decisionsFromFile(single, stage.name), ...fromFolder]
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
