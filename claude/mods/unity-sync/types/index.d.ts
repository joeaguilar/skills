/** One error the Unity console held after a sync, as the bridge's `sync` printed it. */
export type CompileError = {
  /** The script as Unity names it (`Assets/Scripts/Player.cs`); '' when the message names none. */
  file: string
  /** 0 when the message names no place. */
  line: number
  column: number
  /** What follows the place; further lines of the same entry after a newline. */
  message: string
}

/** The last thing the mod learned from the editor. */
export type UnityStatus = {
  /**
   * `idle`: no sync has run. `syncing`: one is running. `clean` and `errors`:
   * what the last one found. `dead`: the editor did not answer, so none was
   * queued. `failed`: the bridge script itself failed.
   */
  phase: 'idle' | 'syncing' | 'clean' | 'errors' | 'dead' | 'failed'
  /** When the last sync or ping ended, in epoch milliseconds; 0 before the first. */
  at: number
  errors: CompileError[]
  /** Edits to .cs files no finished sync has covered. */
  unsynced: number
  /** Why the sync failed or the editor counts as not answering; '' otherwise. */
  reason: string
}

declare module 'claude-code' {
  interface PluginState {
    'unity-sync': {
      /** The Unity project's root; '' when the session is not in one that has the bridge. */
      project: string
      status: UnityStatus
    }
  }
}
