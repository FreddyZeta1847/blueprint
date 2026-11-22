/*
 * Test harness of the panel's acceptance tests (owned by the mother: children do not edit it).
 * engine(on, world) answers the engine events the mod raises from a fake project world —
 * files (paths matched exactly under MAIN), .git, settings, the sessions list, a mock clock —
 * and records what the mod did: commands, panes, status lines, pushes, file writes, copies,
 * toasts, option changes. Mods have no file delete: old status files are ignored by the
 * reader and deleted by the mother at stage close. Staleness uses updatedAt, never mtime.
 */
import { mock } from 'claude-code/testing'

export const MAIN = 'C:/proj'

export const LOOPS = JSON.stringify({ types: {
  discussion: { cycle: 'per_step', phases: [{ id: 'clarify' }, { id: 'proposal' }, { id: 'convergence', user: true }, { id: 'decision' }, { id: 'recap', user: true }] },
  implementation: { cycle: 'per_stage', phases: [{ id: 'clarify' }, { id: 'plan' }, { id: 'build' }, { id: 'test' }, { id: 'review' }, { id: 'first_use', user: true }, { id: 'integrate', optional: true }] },
  delivery: { cycle: 'per_stage', phases: [{ id: 'clarify' }, { id: 'prepare' }, { id: 'rehearse', optional: true }, { id: 'deliver', user: true }, { id: 'feedback', user: true }] },
  quick_task: { cycle: 'per_stage', phases: [{ id: 'clarify' }, { id: 'do' }, { id: 'check' }, { id: 'report' }] },
} })

export const LONG_NAME = 'Una tappa con un nome lunghissimo che non entra nel pannello stretto e deve essere tagliata con i puntini finali'

export function planJson(opts: { phase?: string; longName?: boolean } = {}): string {
  return JSON.stringify({ version: 3, project: 'sito-parrucchiere', context: 'blueprint/context.md', stages: [
    { id: 'repo', name: 'Repository e struttura', type: 'quick_task', status: 'done', phase: 'report', how: 'git init e repository privato' },
    { id: 'db', name: 'Database: scelte', type: 'discussion', status: 'done',
      topics: [{ name: 'Tabelle e campi', done: true, phase: 'decision' }, { name: 'Login cifrato', done: true, phase: 'decision' }] },
    { id: 'fb', name: 'Frontend e backend in parallelo', type: 'implementation', status: 'in_progress', phase: opts.phase ?? 'build',
      how: 'madre + 2 figlie (area admin, area clienti)', independent_parts: ['Area admin', 'Area clienti'],
      topics: [{ name: 'Area admin', done: true }, { name: 'Area clienti', done: false }] },
    { id: 'sec', name: opts.longName ? LONG_NAME : 'Controllo di sicurezza', type: 'quick_task', status: 'todo' },
    { id: 'end', name: 'Chiusura', type: 'quick_task', status: 'todo', deadline: '2026-11-20' },
  ] })
}

export const CARD = '# Context — sito-parrucchiere\nConfirmed: 2026-11-06\nSize: project — un sito\nDifficulty: difficile — dati personali\nPace: calma — nessuna scadenza\n'

export const DECISIONS = '# Decisioni\n\n## Frontend e backend in parallelo\n\n- **Le figlie usano le porte 3001 e 3002** — una per figlia; facile da cambiare; Claude; 2026-11-07\n\n### Grafica\n\n- **Grafica: direzione «salone chiaro»** — scelta guardando; difficile da cambiare; Federico; 2026-11-07\n\n## Chiusura\n\n- **Rilascio il venerdì** — x\n'

export const NOTES = JSON.stringify({ notes: [{ stage: 'fb', text: 'Provarlo anche sul telefono', read: false }] })

export const NOW = Date.parse('2026-11-16T10:00:00Z')

export type Agent = { id: string; sessionId: string; name: string; cwd: string; kind: string; state: string; status: string; pid: number; startedAt: number }

export type World = {
  cwd?: string
  /** contents of .git when it is a file (a child worktree) */
  gitFile?: string
  /** files under MAIN by relative path (undefined = missing); data/loops.json is the plugin's */
  files?: Record<string, string | undefined>
  agents?: Agent[]
  language?: string
  /** what $.session.id() answers (default: the mother's id) */
  sessionId?: string
}

export type Seen = {
  commands: string[]; opened: string[]; closed: string[]; status: (string | undefined)[]; pushes: string[]
  writes: { path: string; text: string }[]; copies: string[]; toasts: string[]; config: { key: string; value: unknown }[]
  agentRuns: number
  /** where the session works now (what $.session.cwd() answers); a test may move it */
  cwd: string
  /** the mock clock: `await seen.clock.advance(ms)` moves time and fires due timers */
  clock: { advance: (ms: number) => Promise<void> }
  /** the fake files under MAIN, live: a test may change one and let the refresh read it */
  files: Record<string, string | undefined>
}

export function defaultFiles(): Record<string, string | undefined> {
  return {
    'blueprint/plan.json': planJson(), 'blueprint/context.md': CARD, 'blueprint/decisions.md': DECISIONS,
    'blueprint/notes.json': NOTES, 'data/loops.json': LOOPS,
  }
}

const norm = (p: string) => p.replace(/\\/g, '/')

export function engine(on: any, world: World = {}): Seen {
  const clock = mock.clock(on, { now: NOW })
  const files: Record<string, string | undefined> = { ...defaultFiles(), ...(world.files ?? {}) }
  const seen: Seen = { commands: [], opened: [], closed: [], status: [], pushes: [], writes: [], copies: [], toasts: [], config: [], agentRuns: 0, clock, cwd: world.cwd ?? MAIN, files }
  // exact paths under MAIN; the plugin's loops.json and a worktree's .git by their ending
  const rel = (p: string): string | undefined => {
    const n = norm(p)
    if (n.endsWith('/data/loops.json')) return 'data/loops.json'
    if (n.endsWith('/.git')) return world.gitFile !== undefined ? '.git' : undefined
    return n.startsWith(`${MAIN}/`) ? n.slice(MAIN.length + 1) : undefined
  }
  const content = (p: string) => {
    const k = rel(p)
    if (k === '.git') return world.gitFile
    return k === undefined ? undefined : files[k]
  }
  on('fs.read', (_: any, e: any) => { const c = content(e.path); if (c === undefined) throw new Error(`ENOENT ${e.path}`); return { value: c } })
  on('fs.exists', (_: any, e: any) => ({ value: content(e.path) !== undefined }))
  on('fs.write', (_: any, e: any) => {
    seen.writes.push({ path: norm(e.path), text: e.text })
    const k = rel(e.path)
    if (k) files[k] = e.text
    return { value: undefined }
  })
  on('fs.list', (_: any, e: any) => {
    const dir = (rel(e.path) ?? '').replace(/\/$/, '') + '/'
    const below = Object.keys(files).filter(k => files[k] !== undefined && k.startsWith(dir))
    if (below.length === 0) throw new Error(`ENOENT ${e.path}`)
    const entries = below.filter(k => !k.slice(dir.length).includes('/'))
      .map(k => ({ name: k.slice(dir.length), kind: 'file', size: files[k]!.length, mtimeMs: NOW, isLink: false }))
    const dirs = [...new Set(below.map(k => k.slice(dir.length)).filter(r => r.includes('/')).map(r => r.split('/')[0]!))]
      .map(name => ({ name, kind: 'dir', size: 0, mtimeMs: NOW, isLink: false }))
    return { value: [...entries, ...dirs] }
  })
  on('fs.stat', (_: any, e: any) => {
    const n = norm(e.path)
    if (n.endsWith('/.git')) {
      const isWorktreeGit = world.gitFile !== undefined && n !== `${MAIN}/.git`
      if (isWorktreeGit) return { value: { kind: 'file', size: world.gitFile!.length, mtimeMs: NOW, isLink: false } }
      if (n === `${MAIN}/.git`) return { value: { kind: 'dir', size: 0, mtimeMs: NOW, isLink: false } }
      throw new Error(`ENOENT ${n}`)
    }
    const c = content(n)
    if (c === undefined) throw new Error(`ENOENT ${n}`)
    return { value: { kind: 'file', size: c.length, mtimeMs: NOW, isLink: false } }
  })
  on('settings.read', () => ({ value: { language: world.language ?? 'italian' } }))
  on('command.register', (_: any, e: any) => { seen.commands.push(e.name); return { value: { command: e.name } } })
  on('ui.open', (_: any, e: any) => { seen.opened.push(e.id); return { value: { isPlaced: true } } })
  on('ui.close', (_: any, e: any) => { seen.closed.push(e.id); return { value: undefined } })
  on('ui.panes', () => ({ value: seen.opened.map(id => ({ id, title: 'Blueprint', isShown: true, isFocused: false })) }))
  on('ui.status', (_: any, e: any) => { seen.status.push(e.text); return { value: undefined } })
  on('ui.toast', (_: any, e: any) => { seen.toasts.push(e.text); return { value: undefined } })
  on('ui.copy', (_: any, e: any) => { seen.copies.push(e.text); return { value: { isCopied: true } } })
  on('config.set', (_: any, e: any) => { seen.config.push({ key: e.key, value: e.value }); return { value: e.value } })
  on('session.id', () => ({ value: world.sessionId ?? 'mother-session-id' }))
  on('session.usage', () => ({ value: { startedAt: NOW - 80 * 60_000, context: { tokens: 310_000, window: 1_000_000, percent: 31 }, rateLimits: [], cost: { usd: 2.4 } } }))
  on('session.turns', () => ({ value: 14 }))
  on('process.run', (_: any, e: any) => {
    const argv: string[] = e.argv ?? []
    if (argv.includes('agents') && argv.includes('--json') && argv.includes('--all')) {
      seen.agentRuns++
      return { value: { exitCode: 0, stdout: JSON.stringify(world.agents ?? []), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: 1, stdout: '', stderr: 'not stubbed', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', (_: any, e: any) => { if (e.tool === 'PushNotification') seen.pushes.push(e.message); return { result: {} } })
  // where the session works: the folder it started in, or the one the test moves it to
  on('session.cwd', () => ({ value: seen.cwd }))
  on('session.start', (_: any, e: any) => { seen.cwd = e.cwd ?? seen.cwd; return { cwd: e.cwd } })
  return seen
}

export const PANE = (surface: 'terminal' | 'desktop') => ({
  plugin: 'blueprint', component: 'Pane', requestId: 'blueprint', surface,
  props: { title: 'Blueprint', isFocused: true, bodyColumns: 48, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const)

/** Two children of stage «fb»: area-admin finished, area-clienti blocked; one stray worktree. */
export function sessionsWorld(): World {
  const child = (wt: string, sid: string, state: string): Agent => ({
    id: sid.slice(0, 8), sessionId: sid, name: `figlia-${wt}`, cwd: `${MAIN}/.claude/worktrees/${wt}`, kind: 'background',
    state, status: state, pid: 4000, startedAt: NOW - 60 * 60_000,
  })
  const status = (wt: string, sid: string, tool: string | null, pct: number, cost: number) => JSON.stringify({
    v: 1, sessionId: sid, worktree: wt, startedAt: new Date(NOW - 60 * 60_000).toISOString(), updatedAt: new Date(NOW - 5_000).toISOString(),
    turns: 20, tool, since: tool ? new Date(NOW - 20 * 60_000).toISOString() : null, lastTool: 'Edit', context: { percent: pct }, costUsd: cost,
  })
  return {
    agents: [child('area-admin', 'aaaaaaaa-1111', 'done'), child('area-clienti', 'cccccccc-2222', 'blocked'), child('prova-libera', 'pppppppp-3333', 'running')],
    files: {
      ...defaultFiles(),
      'blueprint/sessions/area-admin.json': status('area-admin', 'aaaaaaaa-1111', null, 44, 4.1),
      'blueprint/sessions/area-clienti.json': status('area-clienti', 'cccccccc-2222', 'Bash', 58, 6.8),
      'blueprint/sessions/prova-libera.json': status('prova-libera', 'pppppppp-3333', null, 12, 0.5),
    },
  }
}
