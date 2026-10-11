/** The two lifetimes the API offers a cached prefix. */
export type Ttl = '5m' | '1h'

/**
 * Where the lifetime in force was read from: the mod's own option; the
 * engine's word at a model switch or a resume; a hit seen after more than five
 * idle minutes; then Claude Code's own rules, in the order it applies them.
 */
export type TtlSource = 'option' | 'engine' | 'observed' | 'env' | 'setting' | 'plan' | 'default'

/** The likely reason a request re-processed what the cache already held. */
export type MissCause = 'ttl' | 'model' | 'effort' | 'tools' | 'unknown'

/** The input side of every request of one kind, summed. */
export type Tally = {
  requests: number
  /** Input tokens the cache served. */
  read: number
  /** Input tokens written to the cache. */
  written: number
  /** Input tokens neither read from nor written to the cache. */
  uncached: number
  /** What that input cost, each request at the rates in force when it ran. */
  spentUsd: number
  /** What the same input would have cost with no caching, less `spentUsd`. */
  savedUsd: number
}

export type Miss = {
  at: number
  cause: MissCause
  /** How long the cache had gone unread when the request started. */
  gapMs: number
  /** Tokens the request could have read from the cache and did not. */
  tokens: number
  /** What re-writing them cost over reading them. */
  usd: number
}

/** The main conversation's cache as its responses report it, and the session's totals. */
export type Ledger = {
  /** When the request that last read or wrote the cache started; 0 before any. */
  refreshedAt: number
  /** The model that answered it, '' before any. */
  model: string
  /** The effort it ran at, '' when the model takes none. */
  effort: string
  /** The prefix the last response left in the cache: what it read plus what it wrote. */
  cached: number
  /** What the next request adds behind that prefix: the uncached input and the reply. */
  tail: number
  /** True while the figures come from a resume's summary, not from a response. */
  isSeeded: boolean
  /** True once any response has reported cache tokens. */
  hasCaching: boolean
  /** 'compact' from a compaction until the next response rebuilds the cache. */
  pending: '' | 'compact'
  /** The conversation's size after that compaction; 0 when the engine did not say. */
  pendingTokens: number
  /** The model a switch left the session on, '' once it has answered. */
  switchedTo: string
  ttl: Ttl
  ttlSource: TtlSource
  /** The answer Claude Code's rules gave last, which evidence stands over until it changes. */
  ttlBasis: string
  /** The lifetime of every request outside the main conversation. */
  otherTtl: Ttl
  /** The model's context window, 0 while unknown. */
  window: number
  /** A signature of the tool list when it was last sampled. */
  tools: string
  /** When a loop other than the main one last made a request. */
  otherAt: number
  main: Tally
  others: Tally
  /** The latest misses, oldest first. */
  misses: Miss[]
  missCount: number
  missTokens: number
  missUsd: number
  /** Rebuilds that followed a compaction: expected, so not counted as misses. */
  rebuilds: number
  /** The `refreshedAt` a lapse warning was last shown for. */
  warnedFor: number
}

/**
 * How the conversation compacts: by the person's /compact alone (Claude
 * Code's own compaction switched off), by Claude Code at its threshold, or by
 * Claude Code after a fork of the warm cache has written a handoff file.
 */
export type CompactMode = 'manual' | 'auto' | 'auto+summary'

/** The last handoff an auto+summary compaction wrote, and the wake prompt it left. */
export type Handoff = {
  /** The handoff file's path; '' before any, or when the file could not be written. */
  path: string
  /** The prompt that resumes the work; '' before any, kept until the next handoff. */
  wake: string
  /** When the compaction that wrote it ran; 0 before any. */
  at: number
  /** Handoffs written this session. */
  count: number
}

declare module 'claude-code' {
  interface PluginState {
    'cache-watch': {
      ledger: Ledger
      /** The time of the last reading, what the drawings count from. */
      now: number
      handoff: Handoff
    }
  }
}
