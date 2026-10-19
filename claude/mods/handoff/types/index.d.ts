/** Where a `/handoff` stands, and what its turn produced. */
export type Plan = {
  /**
   * `idle`: nothing pending. `writing`: the handoff turn is asked for or
   * running. `ready`: its two blocks are held for the next compaction.
   */
  phase: 'idle' | 'writing' | 'ready'
  /** The handoff turn's id once it started, '' before. */
  turnId: string
  /** Write only, and wait for the person's own /compact. */
  isHeld: boolean
  /** What the compaction summary must keep. */
  compact: string
  /** The prompt that resumes the work; kept after the compaction for `/handoff wake`. */
  wake: string
}

declare module 'claude-code' {
  interface PluginState {
    handoff: { plan: Plan }
  }
}
