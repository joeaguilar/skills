/** A file or folder a reply named, found on disk. */
export type LinkedFile = {
  /** Absolute, in the host's own spelling. */
  path: string
  /** As drawn: from the working directory or `~`, with the line when the link names one. */
  label: string
  kind: 'file' | 'dir'
  line?: number
}

/** The band above the prompt: the files of the latest reply that linked any. */
export type Band = {
  files: LinkedFile[]
  /** The first file the band draws: Next moves it on when there are more files than rows. */
  first: number
  isHidden: boolean
  /** The turn the files were linked in: a later turn's first links start a new list. */
  turn: number
}

declare module 'claude-code' {
  interface PluginState {
    'open-links': { band: Shaped<Band>; history: Shaped<LinkedFile[]> }
  }
}
