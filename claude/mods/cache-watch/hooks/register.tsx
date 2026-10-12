import { atom, read, update } from 'claude-code'
import type {
  ButtonProps,
  ElementConstructor,
  EngineInterface,
  ModelForkResult,
  ModelUsage,
  PluginOptions,
  Register,
  RenderElement,
  SessionRateLimit,
  Timer,
} from 'claude-code'

import type { CompactMode, Handoff, Ledger, Miss, MissCause, Tally, Ttl, TtlSource } from '../types'

const PANE = 'cache-watch'
const TITLE = 'Cache Watch'
const TICK_MS = 15_000
const MINUTE = 60_000
const TTL_MS: Record<Ttl, number> = { '5m': 5 * MINUTE, '1h': 60 * MINUTE }
/** How far ahead of a lapse the warning shows. */
const WARN_MS: Record<Ttl, number> = { '5m': MINUTE, '1h': 5 * MINUTE }
/** A miss as /usage counts one: over 5% and at least 2,000 tokens short of what the cache held. */
const MISS_SHARE = 0.05
const MISS_TOKENS = 2_000
const MAX_MISSES = 5
/** A request this long after the last one that still read the cache proves the one-hour lifetime. */
const PROOF_MS = 5 * MINUTE + 30_000
/** How often the tool list is sampled, so a miss can be laid at a change in it. */
const SAMPLE_MS = 5 * MINUTE
const TOAST_MS = 12_000
const CELLS = 5
/** The handoff file an auto+summary compaction writes, in the working directory. */
const HANDOFF_PREFIX = 'auto-compact-handoff-'
/** The project's own rule, in its root: `compact: manual | auto | auto+summary`, `threshold: 85`. */
const RULE_FILE = '.cache-watch'
/** The share of the window at which the mod compacts on its own account, between turns. */
const THRESHOLD = 85
/** Long enough for the compaction that set the timer to have settled. */
const SOON_MS = 1_000
/** A compaction the mod starts is refused while a turn runs: how long after a turn to try. */
const GUARD_MS = 1_000

const MODE_TEXT: Record<CompactMode, string> = {
  manual: 'manual: nothing compacts on its own here; only your /compact compacts',
  auto: 'auto: the conversation compacts at the threshold, and the cache rebuilds cold',
  'auto+summary':
    'auto+summary ¤: a fork of the warm cache writes the handoff file first, then the wake prompt is filled',
}

/** The selector: one button per mode, and the letter that presses it while the pane holds the focus. */
const MODE_BUTTONS: readonly { mode: CompactMode; label: string; hotkey: string }[] = [
  { mode: 'manual', label: 'manual', hotkey: 'm' },
  { mode: 'auto', label: 'auto', hotkey: 'a' },
  { mode: 'auto+summary', label: 'summary ¤', hotkey: 's' },
]
/** The columns the selector takes on the terminal: `[ label ]` each, one space between. */
const SELECTOR_COLUMNS =
  MODE_BUTTONS.reduce((width, button) => width + button.label.length + 4, 0) + MODE_BUTTONS.length - 1

/** Why the fork gave no handoff, as the toast says it. */
const REASON: Record<string, string> = {
  'nothing-to-fork': 'nothing to fork yet',
  'api-error': 'the API refused the fork',
  'empty-reply': 'the fork answered nothing',
  aborted: 'the turn was interrupted',
}

/** What the fork of the warm cache is asked, just before the summary replaces the conversation. */
const ASK = `This conversation is about to be compacted. Before the summary replaces it, write the handoff a session with no memory of this one needs, so it can carry on from the handoff file alone. Answer with these three fenced blocks and nothing else: markdown inside the first, plain text inside the other two, no code fences inside any of them.

\`\`\`handoff-doc
The handoff document. Cover, under headings: the goal; what is done and committed, with commit hashes; what is in flight or uncommitted, including anything subagents, workflows or background runs left behind; what is broken right now; the next steps in order; the decisions and standing rules given in this session (model routing, commit rules, review limits); the open questions that wait on the person; and, last, the person's most recent instruction quoted word for word under a heading of its own. Name files by path and tickets by id.
\`\`\`

\`\`\`handoff-compact
What the compaction summary must keep: the tracker ids, what is done, what is broken, the standing rules, the open questions.
\`\`\`

\`\`\`handoff-wake
The prompt that resumes the work after compaction: the standing rules restated, the first step named.
\`\`\``

/**
 * List price in USD per million tokens, [model, base input, cache read], the
 * more specific name first. A cache write is 1.25x the input price on the
 * five-minute lifetime and 2x on the one-hour one, on every model.
 */
const PRICES = [
  ['fable-5-1', 10, 0.25],
  ['mythos-5-1', 10, 0.25],
  ['fable-5', 10, 1],
  ['mythos-5', 10, 1],
  ['opus-5-5', 4, 0.2],
  ['opus-5', 5, 0.5],
  ['opus-4-8', 5, 0.5],
  ['opus-4-7', 5, 0.5],
  ['opus-4-6', 5, 0.5],
  ['opus-4-5', 5, 0.5],
  ['sonnet-5', 2, 0.2],
  ['sonnet-4', 3, 0.3],
  ['haiku-4-5', 1, 0.1],
] as const

const SOURCE: Record<TtlSource, string> = {
  option: 'set in this mod’s options',
  engine: 'as Claude Code reported it',
  observed: 'seen: a hit after five idle minutes',
  env: 'from the environment',
  setting: 'from settings',
  plan: 'subscription, within plan usage',
  default: 'the default',
}

const CAUSE: Record<MissCause, string> = {
  ttl: 'idle past the lifetime',
  model: 'model changed',
  effort: 'effort changed',
  tools: 'tool list changed',
  unknown: 'cause unknown, see /usage',
}

const NO_TALLY: Tally = { requests: 0, read: 0, written: 0, uncached: 0, spentUsd: 0, savedUsd: 0 }

const BLANK: Ledger = {
  refreshedAt: 0,
  model: '',
  effort: '',
  cached: 0,
  tail: 0,
  isSeeded: false,
  hasCaching: false,
  pending: '',
  pendingTokens: 0,
  switchedTo: '',
  ttl: '5m',
  ttlSource: 'default',
  ttlBasis: '',
  otherTtl: '5m',
  window: 0,
  tools: '',
  otherAt: 0,
  main: NO_TALLY,
  others: NO_TALLY,
  misses: [],
  missCount: 0,
  missTokens: 0,
  missUsd: 0,
  rebuilds: 0,
  warnedFor: 0,
}

const ledger = atom({ plugin: 'cache-watch', key: 'ledger' } as const, BLANK)
const now = atom({ plugin: 'cache-watch', key: 'now' } as const, 0)

const NO_HANDOFF: Handoff = { path: '', wake: '', at: 0, count: 0 }

const handoff = atom({ plugin: 'cache-watch', key: 'handoff' } as const, NO_HANDOFF)

type Config = {
  ttl: 'auto' | Ttl
  hasBand: boolean
  isWarning: boolean
  warnUsd: number
  inputPrice: number
  compact: CompactMode
}

/** What an auto+summary compaction prepared: the file, the wake prompt, and the summarizer's brief. */
type Prepared = { path: string; wake: string; instructions: string }

/** The compaction rule in force: the project's `.cache-watch` first, then the option. */
type Rule = { mode: CompactMode; threshold: number; isFromFile: boolean }

/** USD per token. */
type Rates = { input: number; read: number; write: number }

/** One model request, as its response reported it. */
type Step = {
  /** When the request started: what the cache's lifetime counts from. */
  at: number
  model: string
  effort: string
  /** The tool list's signature, '' when this step did not sample it. */
  tools: string
  usage: ModelUsage
}

type View = {
  state: 'none' | 'off' | 'rebuild' | 'switched' | 'warm' | 'cold'
  /** The model the next request runs on. */
  model: string
  idleMs: number
  leftMs: number
  /** Tokens the next request re-sends. */
  context: number
  hasPrice: boolean
  /** The next turn's input while the cache holds: the prefix read, the tail written. */
  warmUsd: number
  /** The next turn's input with nothing to read: all of it written again. */
  coldUsd: number
}

type Tone = 'success' | 'warning' | 'error'

type Line = {
  text: string
  tone?: Tone
  isBold?: boolean
  isDim?: boolean
}

/** The one line above the prompt: the head carries the colour, the rest the figures. */
type Reading = { head: string; rest: string; tone: Tone }

let config: Config = {
  ttl: 'auto',
  hasBand: true,
  isWarning: true,
  warnUsd: 0.5,
  inputPrice: 0,
  compact: 'auto',
}
let timer: Timer | undefined
let rule: Rule = { mode: 'auto', threshold: THRESHOLD, isFromFile: false }
/** The `refreshedAt` the mod last judged against its threshold: one try per response. */
let guardedFor = 0
let isCompacting = false
/** A manual project is told once per session that a compaction was held off. */
let hasWarnedVeto = false
/** One step's bookkeeping at a time, off the response's own path. */
let queue: Promise<unknown> = Promise.resolve()
let isBusy = false
let sampledAt = 0
let seenWindow = 0

const asTtl = (value: unknown): Ttl | undefined =>
  value === '5m' || value === '1h' ? value : undefined

const asMode = (value: unknown): CompactMode | undefined =>
  value === 'manual' || value === 'auto' || value === 'auto+summary' ? value : undefined

const two = (part: number) => String(part).padStart(2, '0')

/** `2026-10-11` of a time, in the host's zone. */
const dateOf = (ms: number) => {
  const at = new Date(ms)

  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`
}

/** `2026-10-11-1432`: the handoff file's date, with the time so two compactions a day keep both files. */
const stampOf = (ms: number) => {
  const at = new Date(ms)

  return `${dateOf(ms)}-${two(at.getHours())}${two(at.getMinutes())}`
}

/**
 * The three blocks of the fork's reply, each read up to the next block's
 * opening fence, so a code fence inside the document does not cut it short.
 */
const blocksOf = (answer: string) => {
  const found: Record<string, string> = {}
  const marks = [...answer.matchAll(/^```(handoff-(?:doc|compact|wake))[^\n]*\n/gm)]

  marks.forEach((mark, index) => {
    const from = (mark.index ?? 0) + mark[0].length
    const to = marks[index + 1]?.index ?? answer.length
    const body = answer.slice(from, to).replace(/\n```\s*$/, '').trim()

    found[mark[1] ?? ''] = body
  })

  return {
    doc: found['handoff-doc'] ?? '',
    compact: found['handoff-compact'] ?? '',
    wake: found['handoff-wake'] ?? '',
  }
}

const isOn = (value: string | undefined) =>
  value !== undefined && /^(1|true|yes|on)$/i.test(value.trim())

/** `opus-5-5` of `claude-opus-5-5-20260401`, `us.anthropic.claude-opus-5-5-v1:0` or `claude-opus-5-5[1m]`. */
const nameOf = (id: string) =>
  id
    .replace(/^.*claude-/, '')
    .replace(/\[.*\]$/, '')
    .replace(/-v\d+(:\d+)?$/, '')
    .replace(/-\d{8}$/, '')

const isSame = (a: string, b: string) => nameOf(a) === nameOf(b)

const listOf = (model: string) => PRICES.find(([name]) => model.includes(name))

const ratesOf = (model: string, ttl: Ttl): Rates | undefined => {
  const listed = listOf(model)
  const input = config.inputPrice > 0 ? config.inputPrice : listed?.[1]

  if (input === undefined) {
    return undefined
  }

  const readShare = listed === undefined ? 0.1 : listed[2] / listed[1]

  return {
    input: input / 1e6,
    read: (input * readShare) / 1e6,
    write: (input * (ttl === '1h' ? 2 : 1.25)) / 1e6,
  }
}

const count = (tokens: number) => {
  if (tokens >= 999_500) {
    return `${(tokens / 1e6).toFixed(tokens >= 9_995_000 ? 1 : 2)}M`
  }

  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(tokens >= 99_950 ? 0 : 1)}k`
  }

  return String(Math.round(tokens))
}

const usd = (amount: number) => (amount > 0 && amount < 0.005 ? '<$0.01' : `$${amount.toFixed(2)}`)

/** Time left: whole minutes from ten up, then quarter minutes, as often as the reading is taken. */
const left = (ms: number) => {
  const seconds = Math.floor(Math.max(0, ms) / 1000)

  if (seconds >= 600) {
    return `${Math.floor(seconds / 60)}m`
  }

  const stepped = seconds - (seconds % 15)

  if (stepped >= 60) {
    return `${Math.floor(stepped / 60)}m${String(stepped % 60).padStart(2, '0')}s`
  }

  return stepped === 0 ? '<15s' : `${stepped}s`
}

/** Compact duration, as the status line spells it: `<1m`, `45m`, `3h12`. */
const span = (ms: number) => {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE)

  if (minutes < 1) {
    return '<1m'
  }

  if (minutes < 60) {
    return `${minutes}m`
  }

  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

/** The heat bar: every cell lit on a fresh cache, none on a cold one. */
const bar = (share: number) => {
  const lit = share <= 0 ? 0 : Math.min(CELLS, Math.max(1, Math.ceil(share * CELLS)))

  return '▰'.repeat(lit) + '▱'.repeat(CELLS - lit)
}

/** The share of input tokens the cache served, as /usage reports it; undefined before any. */
const hitOf = (tally: Tally) => {
  const all = tally.read + tally.written + tally.uncached

  return all === 0 ? undefined : Math.round((tally.read / all) * 100)
}

const add = (tally: Tally, usage: ModelUsage, rates: Rates | undefined): Tally => {
  const read = usage.cache_read_input_tokens
  const written = usage.cache_creation_input_tokens
  const uncached = usage.input_tokens
  const spent =
    rates === undefined ? 0 : read * rates.read + written * rates.write + uncached * rates.input
  const flat = rates === undefined ? 0 : (read + written + uncached) * rates.input

  return {
    requests: tally.requests + 1,
    read: tally.read + read,
    written: tally.written + written,
    uncached: tally.uncached + uncached,
    spentUsd: tally.spentUsd + spent,
    savedUsd: tally.savedUsd + flat - spent,
  }
}

/**
 * The lifetime in force as a resume gives it away, when it does. Between the
 * two lifetimes, whether the engine calls the cache expired says which.
 * Otherwise its estimate of the re-cache does: a write is priced at 1.25x the
 * model's input rate on the short lifetime and 2x on the long one.
 */
const toldBy = (
  model: string,
  idle: number,
  size: number,
  isExpired: boolean | undefined,
  estimate: number | undefined,
): Ttl | undefined => {
  if (isExpired !== undefined && idle > 300 && idle <= 3600) {
    return isExpired ? '5m' : '1h'
  }

  const listed = listOf(model)

  // Under two cents the estimate's rounding is as large as the difference.
  if (listed === undefined || estimate === undefined || estimate < 0.02) {
    return undefined
  }

  const ratio = ((estimate / size) * 1e6) / listed[1]

  if (Math.abs(ratio - 2) <= 0.2) {
    return '1h'
  }

  return Math.abs(ratio - 1.25) <= 0.125 ? '5m' : undefined
}

/** How far a request fell short of the prefix it could have read; 0 unless that is a miss. */
const shortOf = (held: Ledger, usage: ModelUsage) => {
  if (held.refreshedAt === 0) {
    return 0
  }

  const short = held.cached - usage.cache_read_input_tokens
  // A resume's summary counts the last reply as cached too: be coarse there.
  const floor = held.isSeeded ? held.cached / 2 : held.cached * MISS_SHARE

  return short > floor && short >= MISS_TOKENS ? short : 0
}

const causeOf = (held: Ledger, step: Step, gapMs: number): MissCause => {
  if (held.isSeeded) {
    return gapMs >= TTL_MS[held.ttl] ? 'ttl' : 'unknown'
  }

  if (!isSame(step.model, held.model)) {
    return 'model'
  }

  if (gapMs >= TTL_MS[held.ttl]) {
    return 'ttl'
  }

  if (step.effort !== held.effort) {
    return 'effort'
  }

  return step.tools !== '' && held.tools !== '' && step.tools !== held.tools ? 'tools' : 'unknown'
}

/** The ledger after one response of the main conversation. Pure: `update` may run it twice. */
const absorb = (held: Ledger, step: Step): Ledger => {
  const { usage } = step
  const rates = ratesOf(step.model, held.ttl)
  const cached = usage.cache_read_input_tokens + usage.cache_creation_input_tokens
  const short = shortOf(held, usage)
  const gapMs = step.at - held.refreshedAt
  const next: Ledger = {
    ...held,
    refreshedAt: step.at,
    model: step.model,
    effort: step.effort,
    tools: step.tools || held.tools,
    cached,
    tail: usage.input_tokens + usage.output_tokens,
    isSeeded: false,
    hasCaching: held.hasCaching || cached > 0,
    pending: '',
    pendingTokens: 0,
    switchedTo: '',
    main: add(held.main, usage, rates),
  }

  if (short > 0 && held.pending === 'compact') {
    return { ...next, rebuilds: held.rebuilds + 1 }
  }

  if (short > 0) {
    const miss: Miss = {
      at: step.at,
      cause: causeOf(held, step, gapMs),
      gapMs,
      tokens: short,
      usd: rates === undefined ? 0 : short * (rates.write - rates.read),
    }

    return {
      ...next,
      misses: [...held.misses, miss].slice(-MAX_MISSES),
      missCount: held.missCount + 1,
      missTokens: held.missTokens + short,
      missUsd: held.missUsd + miss.usd,
    }
  }

  // A full read after more than five idle minutes, with no other loop that
  // could have kept the entry alive meanwhile: the lifetime is the long one.
  const isProof =
    held.ttl === '5m' &&
    held.ttlSource !== 'option' &&
    !held.isSeeded &&
    held.cached >= MISS_TOKENS &&
    gapMs >= PROOF_MS &&
    isSame(step.model, held.model) &&
    held.otherAt < held.refreshedAt

  return isProof ? { ...next, ttl: '1h', ttlSource: 'observed' } : next
}

const viewOf = (held: Ledger, at: number): View => {
  const model = held.switchedTo || held.model
  const rates = ratesOf(model, held.ttl)
  const idleMs = held.refreshedAt === 0 ? 0 : Math.max(0, at - held.refreshedAt)
  const leftMs = held.refreshedAt === 0 ? 0 : Math.max(0, TTL_MS[held.ttl] - idleMs)
  const isRebuild = held.pending === 'compact'
  const context = isRebuild ? held.pendingTokens : held.cached + held.tail
  let state: View['state'] = leftMs > 0 && held.cached > 0 ? 'warm' : 'cold'

  if (!held.hasCaching) {
    state = 'off'
  }

  if (held.switchedTo !== '') {
    state = 'switched'
  }

  if (isRebuild) {
    state = 'rebuild'
  }

  if (held.refreshedAt === 0) {
    state = 'none'
  }

  const coldUsd = rates === undefined ? 0 : context * (state === 'off' ? rates.input : rates.write)
  const warmUsd =
    rates === undefined || state !== 'warm'
      ? coldUsd
      : held.cached * rates.read + held.tail * rates.write

  return { state, model, idleMs, leftMs, context, hasPrice: rates !== undefined, warmUsd, coldUsd }
}

/** Green while the cache holds, yellow on the bar's last cell or while it must be rebuilt, red once cold. */
const toneOf = (view: View, held: Ledger): Tone => {
  if (view.state === 'cold' || view.state === 'switched') {
    return 'error'
  }

  return view.state === 'warm' && view.leftMs > TTL_MS[held.ttl] / CELLS ? 'success' : 'warning'
}

/** The line above the prompt; undefined before the conversation's first response. */
const readingOf = (held: Ledger, at: number): Reading | undefined => {
  const view = viewOf(held, at)
  const tone = toneOf(view, held)
  const size = count(view.context)
  const price = (label: string, amount: number) =>
    view.hasPrice ? ` · ${label} ${usd(amount)}` : ''
  const hit = hitOf(held.main)
  const rate = hit === undefined ? '' : ` · hit ${hit}%`

  if (view.state === 'none') {
    return undefined
  }

  if (view.state === 'off') {
    return {
      head: 'cache off',
      rest: ` · ${size} sent uncached${price('next', view.coldUsd)}`,
      tone,
    }
  }

  if (view.state === 'rebuild') {
    const rebuilt = view.context > 0 ? ` · ${size}${price('next', view.coldUsd)}` : ''

    return { head: `cache ${bar(0)} compacted`, rest: ` · rebuilds next turn${rebuilt}`, tone }
  }

  if (view.state === 'switched') {
    return {
      head: `cache ${bar(0)} cold on ${nameOf(view.model)}`,
      rest: ` · ${size}${price('next', view.coldUsd)}`,
      tone,
    }
  }

  if (view.state === 'cold') {
    return {
      head: `cache ${bar(0)} cold`,
      rest: ` · idle ${span(view.idleMs)} · ${size}${price('next', view.coldUsd)}${rate}`,
      tone,
    }
  }

  return {
    head: `cache ${bar(view.leftMs / TTL_MS[held.ttl])} ${left(view.leftMs)}`,
    rest: ` · ${size}${price('next', view.warmUsd)}${price('cold', view.coldUsd)}${rate}`,
    tone,
  }
}

const tallyLines = (tally: Tally, hasPrice: boolean): Line[] => {
  const hit = hitOf(tally)
  const saved =
    tally.savedUsd >= 0
      ? `caching saved ${usd(tally.savedUsd)}`
      : `caching has cost ${usd(-tally.savedUsd)} more so far`

  return [
    {
      text: `  ${tally.requests} requests${hit === undefined ? '' : ` · ${hit}% of input read from cache`}`,
    },
    {
      text: `  ${count(tally.read)} read · ${count(tally.written)} written · ${count(tally.uncached)} uncached`,
    },
    ...(hasPrice ? [{ text: `  input cost ${usd(tally.spentUsd)} · ${saved}` }] : []),
  ]
}

/**
 * The selector's buttons, the mode in force drawn primary: on the band they
 * have no hotkey (one letter per mod there), in the pane m, a and s.
 */
const selectorOf = (
  $: EngineInterface,
  Button: ElementConstructor<ButtonProps>,
  hasHotkeys: boolean,
): RenderElement[] =>
  MODE_BUTTONS.map(button => (
    <Button
      key={`mode-${button.mode}`}
      label={button.label}
      hotkey={hasHotkeys ? button.hotkey : undefined}
      variant={button.mode === rule.mode ? 'primary' : 'secondary'}
      dimColor={button.mode !== rule.mode}
      onPress={() => {
        // Off the dispatch: the file is written and the readers redrawn after the press returns.
        $.clock.after(0, () => {
          void setMode($, button.mode)
            .then(text => say($, text))
            .catch(() => undefined)
        })
      }}
    />
  ))

/** The pane's closing section: how the conversation compacts, and the last handoff. */
const compactLines = (hand: Handoff, at: number): Line[] => [
  { text: 'Compaction', isBold: true },
  { text: `  ${MODE_TEXT[rule.mode]}` },
  {
    text: `  rule from ${rule.isFromFile ? RULE_FILE : 'the option'}${rule.mode === 'manual' ? '' : ` · compacts from ${rule.threshold}% of the window`}`,
    isDim: true,
  },
  ...(hand.count > 0
    ? [{ text: `  last handoff ${span(at - hand.at)} ago · ${hand.path || 'file not written'}`, isDim: true }]
    : []),
]

/** The pane, line by line. */
const linesOf = (held: Ledger, at: number): Line[] => {
  const view = viewOf(held, at)

  if (view.state === 'none') {
    return [{ text: 'No response yet in this conversation.', isDim: true }]
  }

  const head: Record<Exclude<View['state'], 'none'>, string> = {
    warm: `${bar(view.leftMs / TTL_MS[held.ttl])} warm · ${left(view.leftMs)} left`,
    cold: `${bar(0)} cold · idle ${span(view.idleMs)}`,
    switched: `${bar(0)} cold on ${nameOf(view.model)}: each model has its own cache`,
    rebuild: `${bar(0)} compacted: the next turn rebuilds the cache`,
    off: 'No prompt caching reported by the API',
  }
  const lifetime = held.ttl === '1h' ? 'One-hour' : 'Five-minute'
  const share =
    held.window > 0
      ? ` · ${Math.round((view.context / held.window) * 100)}% of ${count(held.window)}`
      : ''
  const size: Line[] =
    view.state === 'rebuild'
      ? [{ text: view.context > 0 ? `  ${count(view.context)} tokens after compaction${share}` : '  known after the next response' }]
      : [
          { text: `  ${count(view.context)} tokens in context${share}` },
          { text: `  ${count(held.cached)} cached · ${count(held.tail)} new behind it` },
        ]
  let resend: Line[] = [
    { text: `  no list price for ${nameOf(view.model)}: set the input price option`, isDim: true },
  ]

  if (view.hasPrice && view.state === 'warm') {
    resend = [
      { text: `  while warm  ${usd(view.warmUsd)}` },
      {
        text: `  once cold   ${usd(view.coldUsd)} (a lapse adds ${usd(view.coldUsd - view.warmUsd)})`,
      },
    ]
  } else if (view.hasPrice) {
    resend = [{ text: `  ${usd(view.coldUsd)} to send it all again` }]
  }

  const misses: Line[] =
    held.missCount === 0
      ? [{ text: '  no misses' }]
      : [
          {
            text: `  ${held.missCount} ${held.missCount === 1 ? 'miss' : 'misses'} · ${count(held.missTokens)} re-processed${view.hasPrice ? ` · ${usd(held.missUsd)} extra` : ''}`,
            tone: 'warning',
          },
          ...[...held.misses].reverse().map(miss => ({
            text: `    ${span(at - miss.at)} ago · ${CAUSE[miss.cause]}${miss.cause === 'ttl' ? ` (${span(miss.gapMs)})` : ''} · ${count(miss.tokens)}${view.hasPrice ? ` · ${usd(miss.usd)}` : ''}`,
            isDim: true,
          })),
        ]

  return [
    { text: head[view.state], tone: toneOf(view, held), isBold: true },
    {
      text: `${lifetime} lifetime (${SOURCE[held.ttlSource]}) · ${nameOf(view.model)} · last request ${span(view.idleMs)} ago`,
      isDim: true,
    },
    { text: ' ' },
    { text: 'Size', isBold: true },
    ...size,
    { text: 'Next turn', isBold: true },
    ...resend,
    { text: 'Main conversation', isBold: true },
    ...tallyLines(held.main, view.hasPrice),
    ...misses,
    ...(held.rebuilds > 0
      ? [{ text: `  ${held.rebuilds} expected ${held.rebuilds === 1 ? 'rebuild' : 'rebuilds'} after compaction` }]
      : []),
    ...(held.others.requests > 0
      ? [
          { text: 'Subagents and workflows', isBold: true },
          ...tallyLines(held.others, held.others.spentUsd > 0),
          { text: `  ${held.otherTtl === '1h' ? 'one-hour' : 'five-minute'} lifetime`, isDim: true },
        ]
      : []),
  ]
}

const say = ($: EngineInterface, text: string) => {
  $.ui.toast(`Cache Watch: ${text}`, { timeoutMs: TOAST_MS })
}

/**
 * Before an auto+summary compaction: a fork of the warm cache writes the
 * handoff, the mod puts it in the working directory, and the summarizer is
 * told what to keep and where the file is. Undefined when there is no handoff,
 * and the compaction goes on as usual.
 */
const prepare = async (
  $: EngineInterface,
  given: string | undefined,
): Promise<Prepared | undefined> => {
  let reply: ModelForkResult

  try {
    reply = await $.model.fork({ prompt: ASK })
  } catch {
    say($, 'the fork could not be started; compacting as usual')

    return undefined
  }

  if (!reply.isAnswered) {
    say($, `no handoff written (${REASON[reply.reason] ?? reply.reason}); compacting as usual`)

    return undefined
  }

  const { doc, compact, wake } = blocksOf(reply.text)

  if (doc === '') {
    say($, 'the fork gave no handoff document; compacting as usual')

    return undefined
  }

  const at = await $.clock.now()
  const path = joinOf(await rootOf($), `${HANDOFF_PREFIX}${stampOf(at)}.md`)
  const model = await $.session.model().catch(() => '')
  const head = `# Auto-compact handoff · ${dateOf(at)}\n\nWritten by Cache Watch from a fork of this conversation just before Claude Code compacted it${model === '' ? '' : ` (${nameOf(model)})`}. Read it fully before any other work.\n\n`
  let isWritten = true

  try {
    await $.fs.write(path, `${head}${doc}\n`)
  } catch {
    isWritten = false
    say($, `the handoff file could not be written to ${path}; its content goes to the summary instead`)
  }

  const keep =
    compact === '' ? 'what is done, what is broken, the standing rules and the open questions' : compact
  const where = isWritten
    ? `The handoff document is at ${path}: name that path in the summary. The next turn reads it fully before any other work.`
    : `The handoff document could not be written, so the summary carries it whole:\n\n${doc}`
  const own = `${keep}\n\n${where}`
  const instructions = given === undefined || given.trim() === '' ? own : `${own}\n\n${given}`

  return { path: isWritten ? path : '', wake, instructions }
}

/** Puts the wake prompt in the input box, unless a draft is already there. */
const fillWake = async ($: EngineInterface) => {
  const { wake } = await read($, handoff)

  if (wake === '') {
    return 'No wake prompt is held.'
  }

  const box = await $.prompt.read().catch(() => undefined)

  if (box !== undefined && box.text.trim() !== '') {
    return 'The input box holds a draft; clear it and run /cache-watch wake.'
  }

  const filled = await $.prompt.fill({ text: wake }).catch(() => undefined)

  return filled?.isFilled === true
    ? 'The wake prompt is in the input box; Enter resumes.'
    : 'The input box could not take the wake prompt; run /cache-watch wake.'
}

/** After a compaction that wrote a handoff: the wake prompt is offered. */
const wakeUp = async ($: EngineInterface) => {
  const held = await read($, handoff)
  const file = held.path === '' ? 'no handoff file' : baseOf(held.path)

  say($, `compacted after writing ${file}. ${await fillWake($)}`)
}

/** The project's root: the git repository's, else the session's, else the working directory; '' when none is known. */
const rootOf = async ($: EngineInterface) => {
  const repo = await $.session.repo().catch(() => null)
  const root =
    repo?.root || (await $.session.root().catch(() => '')) || (await $.session.cwd().catch(() => ''))

  return root.replace(/[\\/]+$/, '')
}

/** `name` under `root`, with the separator the root is spelled with. */
const joinOf = (root: string, name: string) =>
  root === '' ? name : `${root}${root.includes('\\') ? '\\' : '/'}${name}`

/** The file's own name, after the last separator. */
const baseOf = (path: string) => path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)

/** The project's rule file: `.cache-watch` in the project root. */
const ruleFileOf = async ($: EngineInterface) => joinOf(await rootOf($), RULE_FILE)

/** The rule in force, read afresh: the project's file first, then the option, then the threshold's default. */
const refreshRule = async ($: EngineInterface) => {
  const text = await $.fs.read(await ruleFileOf($)).catch(() => '')
  let mode: CompactMode | undefined
  let threshold: number | undefined

  for (const line of text.split('\n')) {
    const found = /^\s*([a-z]+)\s*:\s*(.+?)\s*$/i.exec(line)

    if (found === null) {
      continue
    }

    const key = (found[1] ?? '').toLowerCase()
    const value = (found[2] ?? '').toLowerCase()

    if (key === 'compact') {
      mode = asMode(value.replace(/\s+/g, '')) ?? mode
    }

    if (key === 'threshold') {
      const share = Number(value.replace('%', ''))

      threshold = share >= 10 && share <= 99 ? share : threshold
    }
  }

  rule = {
    mode: mode ?? config.compact,
    threshold: threshold ?? THRESHOLD,
    isFromFile: mode !== undefined,
  }
}

/** Writes the mode into the project's rule file, keeping its other lines. */
const writeRule = async ($: EngineInterface, mode: CompactMode) => {
  const path = await ruleFileOf($)
  const text = (await $.fs.read(path).catch(() => '')).replace(/\r/g, '')
  const kept = text === '' ? [] : text.split('\n').filter(line => !/^\s*compact\s*:/i.test(line))

  while (kept.length > 0 && (kept[kept.length - 1] ?? '').trim() === '') {
    kept.pop()
  }

  const lines =
    kept.length === 0
      ? ['# Cache Watch: how this project compacts. compact: manual | auto | auto+summary. threshold: 10-99 (% of the window).']
      : kept

  await $.fs.write(path, [...lines, `compact: ${mode}`, ''].join('\n'))
  rule = { ...rule, mode, isFromFile: true }

  return path
}

/** Sets the project's mode from the command or the pane: the file is written, the readers redrawn, and the result said. */
const setMode = async ($: EngineInterface, mode: CompactMode) => {
  let path: string

  try {
    path = await writeRule($, mode)
  } catch {
    return `${RULE_FILE} could not be written; nothing changed`
  }

  await tick($)

  return `compaction set to ${MODE_TEXT[mode]} (${path})`
}

/** Once a session: a manual project is told its compaction was held off. */
const warnVeto = ($: EngineInterface, percent: number | undefined) => {
  if (hasWarnedVeto) {
    return
  }

  hasWarnedVeto = true
  say(
    $,
    `compaction held off here (${RULE_FILE}: manual)${percent === undefined ? '' : `, context at ${Math.round(percent)}% of the window`}; /compact when ready`,
  )
}

/** After a compaction stood: the reading rebuilds, and a handoff's wake prompt is offered. */
const settleCompaction = async (
  $: EngineInterface,
  tokensAfter: number,
  prepared: Prepared | undefined,
) => {
  await update($, ledger, (held): Ledger =>
    held.refreshedAt === 0 ? held : { ...held, pending: 'compact', pendingTokens: tokensAfter },
  )

  if (prepared !== undefined) {
    const at = await $.clock.now()

    await update($, handoff, (held): Handoff => ({
      path: prepared.path,
      wake: prepared.wake,
      at,
      count: held.count + 1,
    }))
    $.clock.after(SOON_MS, () => {
      void wakeUp($).catch(() => undefined)
    })
  }

  await tick($)
}

/**
 * The mod's own compaction: between turns, once the context crosses the
 * project's threshold, by the project's rule. Claude Code's own switch plays
 * no part; a manual project is told once and left to its own /compact.
 */
const guard = async ($: EngineInterface) => {
  if (isBusy || isCompacting) {
    return
  }

  const held = await read($, ledger)

  if (held.refreshedAt === 0 || held.pending === 'compact' || guardedFor === held.refreshedAt) {
    return
  }

  const context = (await $.session.usage().catch(() => undefined))?.context
  const percent =
    context?.percent ??
    (context !== undefined && context.window > 0 && context.tokens !== undefined
      ? (context.tokens / context.window) * 100
      : undefined)

  if (percent === undefined || percent < rule.threshold) {
    return
  }

  await refreshRule($).catch(() => undefined)
  guardedFor = held.refreshedAt

  if (rule.mode === 'manual') {
    warnVeto($, percent)

    return
  }

  isCompacting = true

  try {
    const prepared =
      rule.mode === 'auto+summary' ? await prepare($, undefined).catch(() => undefined) : undefined
    const done = await $.session.compact(
      prepared === undefined ? {} : { instructions: prepared.instructions },
    )

    if (done.skip === undefined) {
      await settleCompaction($, done.tokensAfter ?? 0, prepared)
    } else {
      say($, `compaction skipped (${done.skip})`)
    }
  } catch {
    // A turn began meanwhile: the next quiet moment judges again.
    guardedFor = 0
  } finally {
    isCompacting = false
  }
}

/** A short signature of the tool list: its length and a hash of the names. */
const toolsOf = async ($: EngineInterface) => {
  const names = (await $.tool.list()).map(tool => tool.name).sort()
  let hash = 0

  for (const char of names.join('\n')) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0
  }

  return `${names.length}:${hash}`
}

/** Takes a reading: the lapse warning when it is due, then the clock the band and the pane count from. */
const tick = async ($: EngineInterface) => {
  const at = await $.clock.now()
  const held = await read($, ledger)
  const view = viewOf(held, at)
  const isDue =
    config.isWarning &&
    !isBusy &&
    view.state === 'warm' &&
    view.hasPrice &&
    view.leftMs <= WARN_MS[held.ttl] &&
    view.coldUsd - view.warmUsd >= config.warnUsd &&
    held.warnedFor !== held.refreshedAt

  if (isDue) {
    await update($, ledger, value => ({ ...value, warnedFor: value.refreshedAt }))
    $.ui.toast(
      `Cache Watch: cold in ${left(view.leftMs)}. The next turn would then re-cache ${count(view.context)} for ${usd(view.coldUsd)}, not ${usd(view.warmUsd)}`,
      { timeoutMs: TOAST_MS },
    )
  }

  // Writing the clock draws its readers again: the band and an open pane.
  await update($, now, () => at)

  if (!isBusy) {
    await guard($).catch(() => undefined)
  }
}

/**
 * Settles which lifetime each kind of request gets, by Claude Code's own
 * rules in its own order. Evidence a response or the engine gave since stands
 * until those rules answer differently.
 */
const settle = async ($: EngineInterface, limits: readonly SessionRateLimit[], window: number) => {
  const isForced = isOn(await $.env.get('FORCE_PROMPT_CACHING_5M'))
  const isLong = isOn(await $.env.get('ENABLE_PROMPT_CACHING_1H'))
  const named = asTtl(await $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL'))
  const namedOther = asTtl(await $.env.get('CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL'))
  const settings = await $.settings.read()
  const plan = limits.filter(limit => limit.kind === 'five_hour' || limit.kind === 'seven_day')
  // Past a plan window the session draws on usage credits, and the main
  // conversation drops to five minutes with everything else.
  const isInPlan = plan.length > 0 && plan.every(limit => limit.percentUsed < 100)
  let rule: [Ttl, TtlSource] = isInPlan ? ['1h', 'plan'] : ['5m', 'default']

  // Lowest precedence first: each later rule overrides the ones before it.
  if (isLong) {
    rule = ['1h', 'env']
  }

  const set = asTtl(settings.promptCacheTtl)

  if (set !== undefined) {
    rule = [set, 'setting']
  }

  if (named !== undefined) {
    rule = [named, 'env']
  }

  if (isForced) {
    rule = ['5m', 'env']
  }

  if (config.ttl !== 'auto') {
    rule = [config.ttl, 'option']
  }

  const [ttl, ttlSource] = rule
  const ttlBasis = `${ttlSource}:${ttl}`
  const otherTtl = isForced
    ? '5m'
    : (namedOther ?? asTtl(settings.subagentPromptCacheTtl) ?? (isLong ? '1h' : '5m'))

  await update($, ledger, held => {
    // What a resume told before the rules were first read stands, too.
    const isTold = held.ttlBasis === '' && held.ttlSource === 'engine' && ttlSource !== 'option'
    const keeps = held.ttlBasis === ttlBasis || isTold

    return {
      ...held,
      ...(keeps ? {} : { ttl, ttlSource }),
      ttlBasis,
      otherTtl,
      window: window > 0 ? window : held.window,
    }
  })
}

const record = async ($: EngineInterface, step: Step, agentId: string | undefined) => {
  if (agentId !== undefined) {
    await update($, ledger, held => ({
      ...held,
      otherAt: step.at,
      others: add(held.others, step.usage, ratesOf(step.model, held.otherTtl)),
    }))

    return
  }

  let before = await read($, ledger)

  // The plan's rate-limit windows arrive with the first response: settle the
  // lifetime again before that response's writes are priced.
  if (before.main.requests === 0) {
    const usage = await $.session.usage().catch(() => undefined)

    if (usage !== undefined) {
      await settle($, usage.rateLimits, usage.context.window).catch(() => undefined)
      before = await read($, ledger)
    }
  }

  const isSampling = step.at - sampledAt >= SAMPLE_MS || shortOf(before, step.usage) > 0
  const tools = isSampling ? await toolsOf($).catch(() => '') : ''

  if (tools !== '') {
    sampledAt = step.at
  }

  const after = await update($, ledger, held => absorb(held, { ...step, tools }))
  const miss = after.misses[after.misses.length - 1]

  if (config.isWarning && miss !== undefined && after.missCount > before.missCount && miss.usd >= config.warnUsd) {
    $.ui.toast(
      `Cache Watch: miss, ${count(miss.tokens)} re-processed for ${usd(miss.usd)} extra (${CAUSE[miss.cause]})`,
      { timeoutMs: TOAST_MS },
    )
  }

  await tick($)
}

const configOf = (options: PluginOptions): Config => ({
  ttl: asTtl(options.ttl) ?? 'auto',
  hasBand: options.band !== false,
  isWarning: options.warn !== false,
  warnUsd: typeof options.warnUsd === 'number' ? options.warnUsd : 0.5,
  inputPrice: typeof options.inputPrice === 'number' ? options.inputPrice : 0,
  compact: asMode(options.compact) ?? 'auto',
})

export const register: Register = (on, options) => {
  config = configOf(options)
  rule = { mode: config.compact, threshold: THRESHOLD, isFromFile: false }

  on('session.start', async ($, e, next) => {
    await $.command
      .register({
        name: 'cache-watch',
        description:
          'Show how warm the prompt cache is, its size, and what the next turn costs; manual | auto | summary sets how the conversation compacts (summary ¤ forks a handoff first), wake refills the wake prompt',
        argumentHint: '[manual | auto | summary | wake]',
        immediate: true,
      })
      .catch(() => undefined)

    const usage = await $.session.usage().catch(() => undefined)

    seenWindow = usage?.context.window ?? 0
    await settle($, usage?.rateLimits ?? [], seenWindow)
    await refreshRule($).catch(() => undefined)

    // The reading used to be pinned as a status row: a reload must not leave one behind.
    $.ui.status(undefined)

    timer?.cancel()
    timer = $.clock.every(TICK_MS, () => {
      void tick($).catch(() => undefined)
    })
    await tick($)

    return next(e)
  })

  on('command.run', { command: 'cache-watch' }, async ($, e) => {
    const args = e.args.trim().toLowerCase()

    if (args === 'wake') {
      return { text: `Cache Watch: ${await fillWake($)}` }
    }

    const mode = asMode(args === 'summary' ? 'auto+summary' : args)

    if (mode !== undefined) {
      return { text: `Cache Watch: ${await setMode($, mode)}` }
    }

    if (args !== '') {
      return { text: 'Cache Watch: /cache-watch [manual | auto | summary | wake]' }
    }

    await tick($)

    const placed = await $.ui.open({ id: PANE, title: TITLE })
    const reading = readingOf(await read($, ledger), await $.clock.now())
    const line =
      reading === undefined
        ? 'cache: no response yet in this conversation'
        : `${reading.head}${reading.rest}`

    return { text: placed.isPlaced ? line : `${line} (${placed.reason})` }
  })

  // The lifetime counts from the start of the request that reads or writes
  // the entry, so the time is taken before the request goes out.
  on('turn.step', async function* ($, e, next) {
    const sentAt = await $.clock.now().catch(() => 0)
    const result = yield* next(e)
    const { usage } = result

    if (usage !== null && sentAt > 0) {
      const step: Step = {
        at: sentAt,
        model: usage.model || e.model,
        effort: e.effort === undefined ? '' : String(e.effort),
        tools: '',
        usage,
      }

      queue = queue.then(() => record($, step, e.agentId)).catch(() => undefined)
    }

    return result
  })

  on('turn.start', ($, e, next) => {
    isBusy = true

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      isBusy = false
      $.clock.after(GUARD_MS, () => {
        void guard($).catch(() => undefined)
      })
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') || e.context.window !== seenWindow) {
      seenWindow = e.context.window
      await settle($, e.rateLimits, e.context.window).catch(() => undefined)
      await tick($).catch(() => undefined)
    }

    return next(e)
  })

  // A compaction replaces the conversation: the next request reads only the
  // system prompt's entry and writes the summary behind it. The project's rule
  // decides the engine's own: a manual project holds it off; on auto+summary a
  // fork of the still-warm cache writes the handoff first and the summarizer
  // is told what to keep and where the file is.
  on('session.compact', async ($, e, next) => {
    const isMain = e.agentId === undefined && e.trigger !== 'precompute'
    const isRuled = isMain && (e.trigger === 'auto' || e.trigger === 'manual')

    if (isRuled) {
      await refreshRule($).catch(() => undefined)
    }

    if (isRuled && e.trigger === 'auto' && rule.mode === 'manual') {
      warnVeto($, undefined)

      return { skip: `Cache Watch: this project compacts by hand (${RULE_FILE}: manual); /compact when ready` }
    }

    const isSummary = isRuled && rule.mode === 'auto+summary'
    const prepared = isSummary ? await prepare($, e.instructions).catch(() => undefined) : undefined
    const done = await next(
      prepared === undefined ? e : { ...e, instructions: prepared.instructions },
    )

    if (isMain && done.skip === undefined) {
      await settleCompaction($, done.tokensAfter ?? 0, prepared)
    }

    return done
  })

  // A resumed conversation: the engine says how large it is and how long ago
  // it last answered, which is the reading until its first response here.
  on('classic.SessionStart', async ($, e, next) => {
    const idle = e.seconds_since_last_response
    const size = e.context_tokens

    if (idle !== undefined && size !== undefined && size > 0) {
      const at = await $.clock.now()
      const model = e.model ?? (await $.session.model().catch(() => ''))
      const told =
        config.ttl === 'auto'
          ? toldBy(model, idle, size, e.prompt_cache_likely_expired, e.estimated_cache_write_usd)
          : undefined

      await update($, ledger, held =>
        held.main.requests > 0
          ? held
          : {
              ...held,
              refreshedAt: at - idle * 1000,
              model: model || held.model,
              cached: size,
              tail: 0,
              isSeeded: true,
              hasCaching: true,
              ttl: told ?? held.ttl,
              ttlSource: told === undefined ? held.ttlSource : 'engine',
            },
      )
      await tick($)
    }

    return next(e)
  })

  on('classic.PostModelSwitch', async ($, e, next) => {
    const isTelling = config.ttl === 'auto'

    await update($, ledger, held => ({
      ...held,
      switchedTo: isSame(e.to_model, held.model) ? '' : e.to_model,
      ttl: isTelling ? e.cache_ttl : held.ttl,
      ttlSource: isTelling ? 'engine' : held.ttlSource,
    }))
    await tick($)

    return next(e)
  })

  // A /clear or a resume leaves this conversation: its cache figures go with it.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') {
      guardedFor = 0
      hasWarnedVeto = false
      await update($, ledger, held => ({
        ...BLANK,
        ttl: held.ttl,
        ttlSource: held.ttlSource,
        ttlBasis: held.ttlBasis,
        otherTtl: held.otherTtl,
        window: held.window,
        tools: held.tools,
      }))
      await tick($)
    }

    return next(e)
  })

  // The band is one instance every mod shares: what is beneath is drawn too.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !config.hasBand) {
      return next(e)
    }

    const held = await read($, ledger)
    const reading = readingOf(held, Math.max(await read($, now), held.refreshedAt))

    if (reading === undefined) {
      return next(e)
    }

    const { Box, Text, Button } = $.ui.resolve(e)
    const below = await next(e)
    const selector = selectorOf($, Button, false)
    const isWide = reading.head.length + reading.rest.length + 1 + SELECTOR_COLUMNS <= e.props.bodyColumns

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Box>
            <Text color={reading.tone}>{reading.head}</Text>
            <Text wrap="truncate-end">{reading.rest}</Text>
          </Box>
          {isWide && selector}
        </Box>
        {!isWide && (
          <Box flexDirection="row" columnGap={1}>
            {selector}
          </Box>
        )}
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const held = await read($, ledger)
    const hand = await read($, handoff)
    const at = Math.max(await read($, now), held.refreshedAt)

    const draw = (lines: Line[]) =>
      lines.map(line => (
        <Text color={line.tone} bold={line.isBold} dimColor={line.isDim} wrap="truncate-end">
          {line.text}
        </Text>
      ))
    const [headline, lifetime, ...body] = linesOf(held, at)

    // The selector sits under the headline: an inline pane shows its first rows and scrolls the rest.
    return (
      <Box flexDirection="column">
        {draw(headline === undefined ? [] : lifetime === undefined ? [headline] : [headline, lifetime])}
        {draw(compactLines(hand, at))}
        <Box flexDirection="row" columnGap={1}>
          {selectorOf($, Button, true)}
        </Box>
        {draw(body)}
      </Box>
    )
  })
}
