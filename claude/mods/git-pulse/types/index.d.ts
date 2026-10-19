/** One remote, and how far the checkout is ahead of everything it holds. */
export type Remote = {
  name: string
  /** Commits on HEAD that no branch of this remote has. */
  ahead: number
  /** False for a remote nothing was ever fetched from or pushed to. */
  isKnown: boolean
}

/** An email on unpushed commits that is not the public identity. */
export type Stray = {
  email: string
  commits: number
}

/** The working tree of the session's repository, as last measured. */
export type Pulse = {
  isRepo: boolean
  branch: string
  /** Changed and untracked paths. */
  dirty: number
  /** Commits the upstream has that HEAD lacks, as of the last fetch. */
  behind: number
  remotes: Remote[]
  /** Commits no remote has yet. */
  unpushed: number
  strays: Stray[]
  /** The email the next commit would carry. */
  nextEmail: string
}

/** A commit identity as git config holds it; each part '' where git has none. */
export type Identity = {
  name: string
  email: string
}

/** An identity found on commits, as `Name <email>`, and how many commits carry it. */
export type Seen = {
  identity: string
  commits: number
}

/** One repository as the identity audit read it. */
export type RepoAudit = {
  /** The repository's folder, absolute. */
  path: string
  /** `reading` until its git calls have answered, then `read`; `failed` when git could not read it at all. */
  status: 'reading' | 'read' | 'failed'
  /** Why it failed, or which part of a read repository git did not answer for; '' otherwise. */
  reason: string
  /** The repository's own user.name and user.email, which shadow the global ones; null where it sets none. */
  override: { name: string | null; email: string | null }
  /** What the next commit there would carry. */
  resolved: Identity
  /** Authors in HEAD's history other than the intended identity, most commits first. */
  history: Seen[]
  /** True when the history was longer than one read takes. */
  isHistoryCut: boolean
  /** Identities other than the intended one, as author or committer, on commits no remote has. */
  unpushed: Seen[]
  /** Each remote with the host it points at; one or more means the history is published. */
  remotes: string[]
}

/** The identity audit across repositories, as the pane draws it. */
export type Audit = {
  /** The global user.name and user.email: what every commit is meant to carry. */
  intended: Identity
  /** The paths asked for, as typed; none for the session repository's siblings. */
  asked: string[]
  /** The folders that were looked in, absolute. */
  looked: string[]
  /** `idle` before the first audit; `finding` while the repositories are listed. */
  phase: 'idle' | 'finding' | 'reading' | 'done'
  repos: RepoAudit[]
}

declare module 'claude-code' {
  interface PluginState {
    'git-pulse': { pulse: Pulse; audit: Audit }
  }
}
