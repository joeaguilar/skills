/** A file the picture points at, and how far it lags the last commit. */
export type Pointer = {
  kind: 'next' | 'sprint' | 'roadmap' | 'handoff' | 'campaign'
  /** From the repository root, forward slashes. */
  path: string
  /** What the file says, in a few words: the sprint folder, the campaign and its status. */
  detail: string
  /** Whole days its last change lags the last commit; 0 unless that is more than seven. */
  staleDays: number
}

/** An issue somebody has in progress. */
export type Claim = {
  id: number
  title: string
  assignee: string
  /** Whole hours since its last update; 0 unless that is more than 48. */
  staleHours: number
}

/** The tracker issue to pull next, and where the pick came from. */
export type Task = {
  id: number
  title: string
  priority: string
  why: string
  /** The pick rests on something flagged: named as "perhaps". */
  isDoubted: boolean
}

/** The lane or section the next task sits in, and which file ranked it. */
export type Lane = {
  text: string
  source: 'NEXT.md' | 'ROADMAP' | 'itr-only' | 'none'
}

/** Something the sources disagree on, or a pointer that has gone stale. */
export type Flag = {
  kind: 'stale' | 'pointer' | 'digest' | 'contradiction' | 'unblocked' | 'procedure'
  text: string
}

/** What is next for the project, reconciled from the tracker, the pointer files and git. */
export type Picture = {
  /** When it was gathered, epoch milliseconds; 0 before the first gathering. */
  at: number
  project: string
  /** Null outside a repository, or in one with no commit yet. */
  commit: { hash: string; date: string; subject: string } | null
  /** Changed and untracked paths. */
  dirty: number
  /** The path with the most uncommitted change; '' on a clean tree. */
  dirtiest: string
  tracker: 'itr' | 'no-binary' | 'no-database'
  pointers: Pointer[]
  lane: Lane
  task: Task | null
  claims: Claim[]
  ready: number
  blocked: number
  flags: Flag[]
  /** The project's own next-work command, run only when the person asks; '' when it has none. */
  script: string
}

/** The project's own next-work command, as last run on the person's request. */
export type ScriptRun = {
  /** '' when none has run. */
  command: string
  output: string
  exitCode: number
}

declare module 'claude-code' {
  interface PluginState {
    'whats-next': { picture: Picture; script: ScriptRun }
  }
}
