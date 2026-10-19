/** The shells the pane can run a line in. */
export type ShellName = 'powershell' | 'bash'

/** One command line run in the pane, and what it printed. */
export type Entry = {
  id: number
  /** The shell it ran in, and the folder it ran from. */
  shell: ShellName
  cwd: string
  line: string
  /** What it wrote, both pipes in the order they came, cleaned for drawing: the tail when long. */
  output: string
  /** True when `output` lost its beginning to the cap. */
  isCut: boolean
  /** `failed` could not start; `stopped` was ended by the person or by a reload. */
  status: 'running' | 'done' | 'stopped' | 'failed'
  /** The exit code of a `done` entry; null for the rest, and for one a signal ended. */
  code: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'shell-pane': {
      /** The shell the next line runs in. */
      shell: ShellName
      /** The folder the next line runs from: where the last one left the shell. */
      cwd: string
      /** Finished commands, oldest first. */
      entries: Entry[]
      /** The command in flight, its output so far. */
      live: Entry | null
      /** Counts the lines taken: the field is drawn anew, and empty, at each. */
      epoch: number
    }
  }
}
