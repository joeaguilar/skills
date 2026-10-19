/** One model loop other than the main one: a subagent's or a workflow agent's. */
export type Seat = {
  /** The loop's agent id, as its `turn.step` and `tool.call` events carry it. */
  id: string
  label: string
  /** The model its requests name, as the engine resolved it; '' until its first request. */
  model: string
  /** The model Seat Guard sends its requests to instead, once the person swapped it; '' otherwise. */
  swappedTo: string
  /** How many edits to code files it has made. */
  codeEdits: number
  /** The last code file it edited. */
  lastFile: string
  /**
   * `flagged`: a planner seat that edits code, waiting on the person. `allowed`:
   * they let it go on. `stopping`: they stopped it, and its next model request
   * ends its turn. `stopped`: that happened.
   */
  verdict: 'none' | 'flagged' | 'allowed' | 'stopping' | 'stopped'
  isLive: boolean
  /**
   * What the loop's opening prompt named itself, from a first line of the form
   * `[seat crucible:parser#2 build]`; '' when the prompt carried none.
   */
  tag: string
  /** How many model requests it has made. */
  steps: number
  /** Tokens its finished turns reported: input, cache writes, cache reads and output. */
  tokens: number
  /** Each Codex launch it made, in order. */
  launched: CodexLaunch[]
}

/** One `codex exec` or Codex-companion run a seat started from a shell call. */
export type CodexLaunch = {
  /** The `-m` model, `codex` when the command named none, `codex-companion` for the companion. */
  model: string
  /** False when the shell call came back as an error. */
  isOk: boolean
}

/** How many times a Codex model was launched from the session's loops. */
export type CodexCount = {
  model: string
  count: number
}

declare module 'claude-code' {
  interface PluginState {
    'seat-guard': {
      seats: Seat[]
      codex: CodexCount[]
      /** Silenced for this session: seats are counted, nothing is flagged or toasted. */
      isQuiet: boolean
    }
  }
}
