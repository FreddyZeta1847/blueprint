/*
 * Extra data the Piano view shows for an open stage, read from the project's blueprint/ folder:
 * - stageDecisions: the decisions of a stage, from blueprint/decisions.md (bold text of the
 *   bullets under `## <stage name>`, its `###` subsections included) and from the decisions
 *   folder blueprint/decisions/**.md (the question of each `### id — question` block whose
 *   `- **Stage:** <id>` is the stage).
 * - readNotes / addNote / changeNote: blueprint/notes.json `{ "notes": [{ stage, text, read }] }`.
 * `$` is the mod's engine interface, always passed as a parameter.
 */
import type { StageModel } from './types'

export type Note = { stage: string; text: string; read: boolean }

/**
 * One decision as the panel shows it: its title, whether it is hard to change, and — when the file
 * says them — who decided, why, what was rejected, the topic it belongs to and its date.
 */
export type Decision = {
  text: string; oneWay: boolean; by?: 'user' | 'claude'
  why?: string; rejected?: string; topic?: string; date?: string
}

/**
 * Who decided, from the name the file gives («Federico», «user», «decided by Claude»): Claude, the
 * user, or nobody known — a decision found in code («discovery», «inherited») or a rule was not the
 * user's, and a reversibility word in that place is no name at all.
 */
function who(name: string | undefined): Decision['by'] {
  const n = (name ?? '').trim().replace(/^(decided by|deciso da)\s*:?\s*/i, '')
  if (!n) return undefined
  // «Claude», «Claude, approvato da Federico»: Claude wrote it, even with the user's OK
  if (/^claude\b/i.test(n)) return 'claude'
  if (/^(discovery|inherited|rule|scoperta|ereditat[ao]|regola|one-way|two-way)$/i.test(n)) return undefined
  return 'user'
}

/** A sentence that only says how hard a decision is to change. */
const isReversibility = (s: string) => /^(one-way|two-way|(facil[ei]|difficil[ei]) da cambiare|(easy|hard) to change)/i.test(s.trim())

/** A bullet of the single decisions file says it is hard to change: «one-way», «difficile da cambiare». */
const hardToChange = (line: string) => /one-way|difficile da cambiare|irreversibil|hard to change/i.test(line) && !/two-way/i.test(line)

/** Only the keys that have a value: a decision without a date has no `date` key at all. */
const some = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as Record<string, string>

/**
 * A bullet's body split in its parts. The files write it in several ways — «why. Scartati: ….
 * Facile da cambiare; Federico; 2026-11-16», «why; one-way; 2026-11-16», «why. Claude; 2026-11-24»,
 * «why (a; b). Claude, approvato da Federico; 2026-11-24» — so: the date is the last thing; the
 * author is what comes after the last «;» before it, or else the last sentence, but only when that
 * reads as a name (short, no full stop); the rest is the why, without the rejected options and the
 * reversibility words (the card's mark shows those).
 */
function bulletParts(line: string): Pick<Decision, 'by' | 'why' | 'rejected' | 'date'> {
  // what follows the bold title, with or without a dash («**Title** — why», «**Title** (why)»)
  const rest = /^\s*[-*]\s+\*\*.+?\*\*\s*(?:[—–-]\s*)?(.*)$/.exec(line)?.[1] ?? ''
  const dated = /^(.*?)(?:;\s*|\s+)(\d{4}-\d{2}-\d{2})\s*$/.exec(rest)
  let body = (dated ? dated[1]! : rest).trim()
  let by: Decision['by']
  if (dated) {
    const segment = body.slice(body.lastIndexOf(';') + 1)
    const last = segment.split(/(?<=[.!?»)])\s+/).pop()?.trim() ?? ''
    if (last && last.length <= 60 && !/[.!?]$/.test(last)) {
      by = isReversibility(last) ? undefined : who(last)
      body = body.slice(0, body.length - last.length).replace(/[;\s]+$/, '')
    }
  }
  // «; one-way», «; facile da cambiare (un numero)» inside the why: shown by the mark, not repeated
  body = body.replace(/;\s*(one-way|two-way|(facil[ei]|difficil[ei]) da cambiare|(easy|hard) to change)[^;]*/gi, '')
  const sentences = body.split(/(?<=[.!?»])\s+(?=[A-ZÀ-Ý«])/)
  const isRejected = (s: string) => /^(Scartat[aeio]|Rejected|Alternative scartate)\b/i.test(s)
  const why = sentences.filter(s => !isRejected(s) && !isReversibility(s)).join(' ').replace(/[;\s]+$/, '').trim()
  const rejected = sentences.filter(isRejected).join(' ').replace(/^(Scartat[aeio]|Rejected|Alternative scartate)\s*:\s*/i, '').replace(/[.\s]+$/, '').trim()
  return { ...(by ? { by } : {}), ...some({ why, rejected, date: dated?.[2] }) }
}

/** Bold bullet texts under `## <name>` until the next `## ` heading, with the `### ` topic they sit under. */
export function decisionsFromFile(text: string, name: string): Decision[] {
  const out: Decision[] = []
  let inside = false
  let topic: string | undefined
  for (const line of text.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2) { inside = h2[1] === name; topic = undefined; continue }
    const h3 = inside ? /^###\s+(.+?)\s*$/.exec(line) : null
    if (h3) { topic = h3[1]; continue }
    const bold = inside ? /^\s*[-*]\s+\*\*(.+?)\*\*/.exec(line) : null
    if (bold?.[1]) out.push({ text: bold[1], oneWay: hardToChange(line), ...bulletParts(line), ...some({ topic }) })
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
    const field = (names: string) => new RegExp(`^\\s*-\\s+\\*\\*(?:${names}):\\*\\*\\s*(.+?)\\s*$`, 'im').exec(block)?.[1]
    const decided = field('Decided by|Deciso da')
    const by = who(/^\w+/.exec(decided ?? '')?.[0])
    const parts = some({ why: field('Why|Perché'), rejected: field('Rejected|Alternative scartate|Scartat[aeio]'), date: /\d{4}-\d{2}-\d{2}/.exec(decided ?? '')?.[0] })
    return [{ text: title.split(/\s+[—–-]\s+/).slice(1).join(' — ').trim() || title.trim(), oneWay, ...(by ? { by } : {}), ...parts }]
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

/** The notes to change; a file that exists but does not parse throws: never overwrite the user's notes. */
async function loadNotes($: any, main: string): Promise<Note[]> {
  const existing: string | null = await $.fs.read(notesPath(main)).catch(() => null)
  return existing === null ? [] : (JSON.parse(existing).notes ?? [])
}

async function saveNotes($: any, main: string, notes: Note[]): Promise<void> {
  await $.fs.write(notesPath(main), JSON.stringify({ notes }, null, 2) + '\n')
}

/** Appends one unread note for the stage; an empty text adds nothing. Returns whether it wrote. */
export async function addNote($: any, main: string, stage: string, text: string): Promise<boolean> {
  const clean = text.trim()
  if (!clean) return false
  const notes = await loadNotes($, main)
  notes.push({ stage, text: clean, read: false })
  await saveNotes($, main, notes)
  return true
}

/**
 * Rewrites (unread again, so Claude sees it) or, with `text` null, deletes the note at `index`
 * of notes.json. 'changed' and nothing written when that note is no longer the one the panel
 * showed, same stage and same text (Claude or another pane changed the file meanwhile); 'same' for
 * an empty or unchanged text.
 */
export async function changeNote($: any, main: string, index: number, shown: { stage: string; text: string }, text: string | null): Promise<'done' | 'same' | 'changed'> {
  const notes = await loadNotes($, main)
  if (notes[index]?.stage !== shown.stage || notes[index]?.text !== shown.text) return 'changed'
  const clean = text?.trim()
  if (text !== null && (!clean || clean === shown.text)) return 'same'
  if (clean) notes[index] = { ...notes[index]!, text: clean, read: false }
  else notes.splice(index, 1)
  await saveNotes($, main, notes)
  return 'done'
}
