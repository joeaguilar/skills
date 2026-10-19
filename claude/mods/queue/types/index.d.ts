/** What .claude/queue.md held when it was last read. */
export type QueueView = {
  hasFile: boolean
  pending: number
  running: number
  failed: number
  later: number
  /** The head of the queue, the first pending item: its id, 0 when nothing is pending. */
  nextId: number
  nextTask: string
}

/** The item this session is running, or asked a verdict on. */
export type QueueRun = {
  /** The item's id; 0 while nothing runs. */
  id: number
  /** `run` stops after this item; `drain` goes on to the next pending one. */
  mode: 'run' | 'drain'
  /**
   * `launching`: marked running, its prompt not yet a turn. `running`: its turn
   * is under way. `verdict`: the turn ended without saying how it went.
   */
  phase: 'idle' | 'launching' | 'running' | 'verdict'
  /** The turn that carries the item; '' until it starts. */
  turnId: string
  /** HEAD when the run began, short; '' outside a repository. */
  head: string
  /** The task text, as staged. */
  task: string
  /** True once the task has been handed to the engine. */
  isSent: boolean
  /** True when the task ran as a slash command, not as a prompt. */
  isCommand: boolean
  /** True when that command answered with text of its own, so no turn need follow. */
  isPrinted: boolean
  /** True once the note for the model has joined the item's prompt row. */
  isNoted: boolean
}

declare module 'claude-code' {
  interface PluginState {
    queue: { view: QueueView; run: QueueRun; isGreeted: boolean }
  }
}
