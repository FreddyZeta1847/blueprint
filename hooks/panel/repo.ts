/*
 * Where the session works: the main checkout and, in a linked git worktree (a child session),
 * the worktree's name. A worktree's `.git` is a file "gitdir: <main>/.git/worktrees/<name>".
 * Also slug(), the rule that matches a plan part ("Area admin") to a worktree ("area-admin").
 */
const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')
const parent = (p: string) => p.slice(0, Math.max(p.lastIndexOf('/'), 0))

export function slug(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function findRepo($: any, cwd?: string): Promise<{ main: string; worktree: string | null } | null> {
  let dir = norm(cwd ?? (await $.session.cwd()))
  for (let i = 0; i < 12 && dir; i++, dir = parent(dir)) {
    const stat = await $.fs.stat(`${dir}/.git`).catch(() => null)
    if (!stat) continue
    if (stat.kind === 'dir') return { main: dir, worktree: null }
    const text: string = await $.fs.read(`${dir}/.git`).catch(() => '')
    const m = /gitdir:\s*(.+?)\/\.git\/worktrees\/([^/\s]+)/.exec(norm(text.trim()))
    // the worktree's name is its folder: git's own entry may carry a suffix ("area-admin1")
    // when an earlier worktree of the same name was removed
    return m?.[1] ? { main: m[1], worktree: dir.slice(dir.lastIndexOf('/') + 1) } : { main: dir, worktree: null }
  }
  return null
}
