/*
 * What the main session is doing (letter A of stage «Il pannello come cruscotto»): the tool it is
 * using and since when, or since when it has been still. A tool.call hook keeps it in module
 * memory, so the «Adesso» card, the work tree and the Sessioni view can say «Bash da 2 min».
 * Calls made by a subagent (they carry an agentId) are not the session's own. Calls may overlap:
 * every call running is kept, the latest one started is the one shown, and the session is still
 * only when none is left.
 * Children write their own status files (status-writer.ts); this is only for the session the
 * panel runs in. A reload starts it over: until the next tool call, nothing is known.
 */
export type Activity = { tool: string | null; since: number | null; idleSince: number | null }

const running = new Map<number, { tool: string | null; since: number | null }>()
let tokens = 0
let idleSince: number | null = null

export function activity(): Activity {
  const latest = [...running.values()].pop()
  return latest ? { tool: latest.tool, since: latest.since, idleSince: null } : { tool: null, since: null, idleSince }
}

const clock = async ($: any): Promise<number | null> => { try { return await $.clock.now() } catch { return null } }

/** The hook itself, apart so a test can call it with its own clock and calls. */
export async function track($: any, e: any, next: any): Promise<any> {
  if (e?.agentId) return next(e) // a subagent's call is not what the session itself is doing
  const token = ++tokens
  running.set(token, { tool: typeof e?.tool === 'string' ? e.tool : null, since: await clock($) })
  try {
    return await next(e)
  } finally {
    running.delete(token)
    if (running.size === 0) idleSince = await clock($)
  }
}

export function registerActivity(on: any): void {
  // every tool: a matcher, because the engine takes one tool.call hook without one (status-writer.ts)
  on('tool.call', { tool: /./ }, track)
}
