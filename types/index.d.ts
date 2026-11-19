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
      waiting: Shaped<boolean>
    }
  }
}
