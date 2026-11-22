/*
 * State contract of Blueprint's panel mod: the values it keeps in $.state, so they survive a
 * reload of the module (a plugin option change reloads it).
 */
export type PanelView = 'piano' | 'sessioni' | 'legenda'

declare module 'claude-code' {
  interface PluginState {
    blueprint: {
      view: Shaped<PanelView>
      tick: Shaped<number>
      expanded: Shaped<string[]>
      /** per stage id, the phase the user looks at and the running phase when chosen (view only) */
      phaseLens: Shaped<Record<string, { at: number; live: number }>>
      /** the note shown as a field, `<stage id>:<index in notes.json>`, or null */
      noteEdit: Shaped<string | null>
      waiting: Shaped<boolean>
    }
  }
}
