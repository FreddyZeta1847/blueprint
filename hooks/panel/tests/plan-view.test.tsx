/*
 * Unit tests of the Piano view's own helpers (the acceptance tests are plan-view.accept.test.tsx):
 * name cutting, deadline dates, decisions parsing from decisions.md and from decision blocks,
 * notes (never overwrite a notes.json that does not parse), and the text fallback on the terminal.
 * Run: claude plugin test .   (from the repository root)
 */
import { expect, test } from 'claude-code/testing'
import { cut, shortDate } from '../plan-view'
import { addNote, decisionsFromBlocks, decisionsFromFile } from '../plan-extras'
import { engine, MAIN, PANE } from './harness'

// A stand-in for the mod's $ with an in-memory file system.
function fakeFs(files: Record<string, string>): any {
  return {
    fs: {
      read: async (p: string) => { if (!(p in files)) throw new Error(`ENOENT ${p}`); return files[p] },
      write: async (p: string, text: string) => { files[p] = text },
    },
  }
}

test('cut keeps short text and ends long text with «…» within the room', async () => {
  expect(cut('abc', 10)).toBe('abc')
  const long = cut('a'.repeat(50), 20)
  expect(long.length).toBe(20)
  expect(long.endsWith('…')).toBe(true)
})

test('shortDate: ISO day → «20 nov» / «20 Nov»; other text as it is', async () => {
  expect(shortDate('it', '2026-11-20')).toBe('20 nov')
  expect(shortDate('en', '2026-01-05')).toBe('5 Jan')
  expect(shortDate('it', 'venerdì')).toBe('venerdì')
})

test('decisions.md: bold bullets of the stage section and its subsections only', async () => {
  const text = '## A\n- **uno** — x; one-way\n### Sub\n- **due** — facile da cambiare\n- **quattro** — difficile da cambiare\n## B\n- **tre**\n'
  expect(decisionsFromFile(text, 'A')).toEqual([{ text: 'uno', oneWay: true, why: 'x' }, { text: 'due', oneWay: false, topic: 'Sub' }, { text: 'quattro', oneWay: true, topic: 'Sub' }])
  expect(decisionsFromFile(text, 'B')).toEqual([{ text: 'tre', oneWay: false }])
  expect(decisionsFromFile(text, 'C')).toEqual([])
})

test('decision blocks: the question of blocks whose Stage is the stage id', async () => {
  const text = '# Area\n### db — Quale database?\n- **Reversibility:** one-way\n- **Stage:** fb\n### x — Altro?\n- **Stage:** db\n'
  expect(decisionsFromBlocks(text, 'fb')).toEqual([{ text: 'Quale database?', oneWay: true }])
  expect(decisionsFromBlocks(text, 'zz')).toEqual([])
})

test('addNote: empty text writes nothing; a notes.json that does not parse is never overwritten', async () => {
  const files: Record<string, string> = { [`${MAIN}/blueprint/notes.json`]: '{ broken' }
  const $f = fakeFs(files)
  expect(await addNote($f, MAIN, 'fb', '  ')).toBe(false)
  await expect(addNote($f, MAIN, 'fb', 'nota')).rejects.toThrow()
  expect(files[`${MAIN}/blueprint/notes.json`]).toBe('{ broken')
})

test('terminal: bars and pills are text (✓ after a done bar, the deadline in brackets)', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: MAIN, surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal'))
  expect((await ui.find({ key: 'bar:repo' }))?.text ?? JSON.stringify(await ui.find({ key: 'bar:repo' }))).toContain('✓')
  expect(await ui.find({ text: '[entro 20 nov]' })).toBeDefined()
  await ui.unmount()
})
