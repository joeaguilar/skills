// One recorded write or edit, as the feed shows it.
export type Change = {
  seq: number
  // Milliseconds since the epoch.
  at: number
  op: string
  path: string
  intent: string
  prompt: string
  // Whether this session made it.
  isOurs: boolean
}

declare module 'claude-code' {
  interface PluginState {
    arcana: { feed: Change[] }
  }
}
