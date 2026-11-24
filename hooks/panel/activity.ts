/*
 * What the main session is doing (letter A of stage «Il pannello come cruscotto»): the tool it is
 * using and since when, or since when it has been still. A tool.call hook keeps it in module
 * memory, so the «Adesso» card, the work tree and the Sessioni view can say «Bash da 2 min».
 * Calls made by a subagent (they carry an agentId) are not the session's own. Calls may overlap:
 * each one holds the slot with its own token, and only the call that holds it clears it.
 * Children write their own status files (status-writer.ts); this is only for the session the
 * panel runs in. A reload starts it over: until the next tool call, nothing is known.
 */
export type Activity = { tool: string | null; since: number | null; idleSince: number | null }

let now: Activity = { tool: null, since: null, idleSince: null }
let holder = 0 // the token of the call that set `now`
let tokens = 0

export const activity = (): Activity => now

const clock = async ($: any): Promise<number | null> => { try { return await $.clock.now() } catch { return null } }

export function registerActivity(on: any): void {
  // every tool: a matcher, because the engine takes one tool.call hook without one (status-writer.ts)
  on('tool.call', { tool: /./ }, async ($: any, e: any, next: any) => {
    if (e?.agentId) return next(e) // a subagent's call is not what the session itself is doing
    const token = ++tokens
    holder = token
    now = { tool: typeof e?.tool === 'string' ? e.tool : null, since: await clock($), idleSince: null }
    try {
      return await next(e)
    } finally {
      // a later call that started meanwhile holds the slot: it says what is still running
      if (holder === token) now = { tool: null, since: null, idleSince: await clock($) }
    }
  })
}
