/** One numbered item of the list a reply ended with. */
export type Item = {
  n: number
  text: string
}

declare module 'claude-code' {
  interface PluginState {
    'decision-dock': { items: Item[] }
  }
}
