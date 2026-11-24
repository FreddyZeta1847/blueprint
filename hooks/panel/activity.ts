/*
 * What the main session is doing (letter A of stage «Il pannello come cruscotto»): the tool it is
 * using and since when, or since when it has been still. A tool.call hook keeps it in module
 * memory, so the «Adesso» card, the work tree and the Sessioni view can say «Bash da 2 min».
 * Children write their own status files (status-writer.ts); this is only for the session the
 * panel runs in. A reload starts it over: until the next tool call, nothing is known.
 */
export type Activity = { tool: string | null; since: number | null; idleSince: number | null }

let now: Activity = { tool: null, since: null, idleSince: null }

export const activity = (): Activity => now

const clock = async ($: any): Promise<number | null> => { try { return await $.clock.now() } catch { return null } }

export function registerActivity(on: any): void {
  // every tool: a matcher, because the engine takes one tool.call hook without one (status-writer.ts)
  on('tool.call', { tool: /./ }, async ($: any, e: any, next: any) => {
    const started = await clock($)
    now = { tool: typeof e?.tool === 'string' ? e.tool : null, since: started, idleSince: null }
    try {
      return await next(e)
    } finally {
      const ended = await clock($)
      now = { tool: null, since: null, idleSince: ended }
    }
  })
}
