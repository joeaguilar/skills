import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { QueueRun, QueueView } from '../types'

/** The queue's file, under the session's repository (its directory when there is none). */
const FILE = '.claude/queue.md'
const HEADER = '# queue'
/** The git exclude pattern for the queue file: anchored to the repository's root. */
const EXCLUDE = `/${FILE}`
const EXCLUDE_NOTE = '# queue mod: a personal staging file, kept out of status and commits in this repository only'
const GIT_MS = 10_000
const TOAST_MS = 12_000
/** Long enough for the hook or the press that set the timer to have returned. */
const SOON_MS = 50
/** How long a slash command has to start a turn before its outcome is asked for instead. */
const GRACE_MS = 3_000
/** Marks an action that spends tokens: it starts a model turn. */
const COST = '¤'
const LEGEND = `${COST} uses tokens`
const USAGE =
  'usage: /queue [<task> | --later <task> | --now <task> | --run [qN] | --drain | --drop qN | --clear]'

type Action = 'run' | 'drain' | 'done' | 'failed'

// Every mod's band shares one site: these letters are no other mod's.
const HOTKEYS: Record<Action, string> = { run: 'u', drain: 'd', done: 'k', failed: 'f' }

/** `[ ]` pending, `[>]` running, `[x]` done, `[!]` failed, `[~]` later (another session). */
export type Mark = ' ' | '>' | 'x' | '!' | '~'

/** One item line of the file, by the place it stands at. */
export type Item = {
  at: number
  mark: Mark
  id: number
  when: string
  task: string
  /** The branch at stage time; '' on a line that names none. */
  branch: string
  /** What follows the branch: `running`, `done <sha>`, `failed: <why>`, `later`. */
  note: string
}

/** The file as read: every line kept as written, the item lines parsed beside them. */
export type Doc = { lines: string[]; eol: string; items: Item[] }

type Outcome = { isDone: boolean; reason: string }

/** One line of the band: what it says, and the buttons beside it. */
type Band = { line: string; actions: { action: Action; label: string }[]; hasCost: boolean }

const EMPTY: QueueView = {
  hasFile: false,
  pending: 0,
  running: 0,
  failed: 0,
  later: 0,
  nextId: 0,
  nextTask: '',
}

const IDLE: QueueRun = {
  id: 0,
  mode: 'run',
  phase: 'idle',
  turnId: '',
  head: '',
  task: '',
  isSent: false,
  isCommand: false,
  isPrinted: false,
  isNoted: false,
}

const view = atom({ plugin: 'queue', key: 'view' } as const, EMPTY)
const run = atom({ plugin: 'queue', key: 'run' } as const, IDLE)
const greeted = atom({ plugin: 'queue', key: 'isGreeted' } as const, false)

const ITEM = /^- \[([ >x!~])\] q(\d+)(?: · (.*))?$/
const WHEN = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})(?: · (.*))?$/
/** The last ` · @branch` of a line, and what follows it. */
const TAIL = /^(.*) · @(\S*)(?: · (.*))?$/
const SLASH = /^\/([A-Za-z0-9_:-]+)(?:\s+(.*))?$/
const FLAG = /^(--[a-z]+)(?:\s+(.*))?$/

/** One line, however it was typed: a queue line holds no line break. */
const oneLine = (text: string) => text.replace(/\s*\r?\n\s*/g, ' ').trim()

/** The first `words` words of a task, for the lines that name it. */
export const brief = (task: string, words: number) => {
  const all = task.trim().split(/\s+/)

  return all.length <= words ? all.join(' ') : `${all.slice(0, words).join(' ')}…`
}

/** `YYYY-MM-DD HH:MM`, local time. */
export const stamp = (ms: number) => {
  const at = new Date(ms)
  const two = (part: number) => String(part).padStart(2, '0')

  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`
}

export const parseLine = (line: string, at: number): Item | undefined => {
  const found = ITEM.exec(line)

  if (found === null) {
    return undefined
  }

  const stamped = WHEN.exec(found[3] ?? '')
  const rest = stamped === null ? (found[3] ?? '') : (stamped[2] ?? '')
  const tail = TAIL.exec(rest)

  return {
    at,
    mark: (found[1] ?? ' ') as Mark,
    id: Number(found[2]),
    when: stamped?.[1] ?? '',
    task: tail?.[1] ?? rest,
    branch: tail?.[2] ?? '',
    note: tail?.[3] ?? '',
  }
}

export const renderLine = (item: Item) =>
  [
    `- [${item.mark}] q${item.id}`,
    item.when,
    item.task,
    item.branch === '' ? '' : `@${item.branch}`,
    item.note,
  ]
    .filter(part => part !== '')
    .join(' · ')

const docOf = (lines: string[], eol: string): Doc => ({
  lines,
  eol,
  items: lines.flatMap((line, at) => parseLine(line, at) ?? []),
})

export const parseDoc = (text: string): Doc => {
  const lines = text.split(/\r?\n/)

  if (lines.at(-1) === '') {
    lines.pop()
  }

  return docOf(lines, text.includes('\r\n') ? '\r\n' : '\n')
}

export const renderDoc = (doc: Doc) => doc.lines.join(doc.eol) + doc.eol

/** The file with one item's line rewritten, or added when it stands past the end. */
const withItem = (doc: Doc, item: Item): Doc => {
  const lines = [...doc.lines]

  lines[item.at] = renderLine(item)

  return docOf(lines, doc.eol)
}

const without = (doc: Doc, gone: readonly Item[]): Doc =>
  docOf(
    doc.lines.filter((_, at) => !gone.some(item => item.at === at)),
    doc.eol,
  )

export const viewOf = (doc: Doc | undefined): QueueView => {
  if (doc === undefined) {
    return EMPTY
  }

  const count = (mark: Mark) => doc.items.filter(item => item.mark === mark).length
  const head = doc.items.find(item => item.mark === ' ')

  return {
    hasFile: true,
    pending: count(' '),
    running: count('>'),
    failed: count('!'),
    later: count('~'),
    nextId: head?.id ?? 0,
    nextTask: head?.task ?? '',
  }
}

export const summaryOf = (seen: QueueView) =>
  `${seen.pending} pending · ${seen.running} running · ${seen.failed} failed · ${seen.later} later · next: ${seen.nextId === 0 ? 'none' : `q${seen.nextId}`}`

/** `queue: done` or `queue: failed — why`, when the reply ends on one. */
export const verdictOf = (answer: string): Outcome | undefined => {
  const tail = answer
    .split(/\r?\n/)
    .map(line => line.replace(/[*`]/g, '').trim())
    .filter(line => line !== '')
    .slice(-3)
    .reverse()

  for (const line of tail) {
    const found = /^queue:\s*(done|failed)\b[\s:—–-]*(.*)$/i.exec(line)

    if (found !== null) {
      return { isDone: (found[1] ?? '').toLowerCase() === 'done', reason: (found[2] ?? '').trim() }
    }
  }

  return undefined
}

/** What the model reads beside a queued task, the task itself left as the person wrote it. */
export const noteOf = (id: number, task: string) => {
  const issue = /^#(\d+)$/.exec(task.trim())?.[1]

  return [
    `[queue] This is item q${id} of the user's queue (${FILE}); they asked for it to run now. Do it as if they had just typed it: the project's CLAUDE.md and AGENTS.md conventions apply.`,
    issue === undefined
      ? ''
      : `#${issue} is an itr issue: claim it (itr claim ${issue}) and work it per the project's conventions.`,
    'Commit what lands unless they asked for no commit. If it is blocked or fails, leave the work in the tree and do not revert it.',
    `Leave ${FILE} alone, and never stage or commit it: the queue mod records the outcome.`,
    'End your reply with exactly one line and nothing after it: `queue: done`, or `queue: failed — <one-line reason>`.',
  ]
    .filter(line => line !== '')
    .join('\n')
}

/** What the band shows; undefined when the queue has nothing to say. */
export const bandOf = (seen: QueueView, held: QueueRun): Band | undefined => {
  if (held.phase === 'verdict') {
    return {
      line: `q${held.id} finished?`,
      actions: [
        { action: 'done', label: 'Done' },
        { action: 'failed', label: 'Failed' },
      ],
      hasCost: false,
    }
  }

  if (held.phase !== 'idle') {
    return { line: `queue · q${held.id} running`, actions: [], hasCost: false }
  }

  if (seen.pending === 0) {
    return undefined
  }

  return {
    line: `queue · ${seen.pending} pending · next q${seen.nextId} ${brief(seen.nextTask, 6)}`,
    actions: [
      { action: 'run', label: `Run ${COST}` },
      { action: 'drain', label: `Drain ${COST}` },
    ],
    hasCost: true,
  }
}

// One change to the file at a time: commands, presses and turn ends take turns.
let chain: Promise<unknown> = Promise.resolve()

const serial = <T,>(work: () => Promise<T>): Promise<T> => {
  const done = chain.then(work, work)

  chain = done.catch(() => undefined)

  return done
}

// A main turn is under way: a slash command handed over meanwhile has not had its chance to start one.
let isBusy = false
let isLaunching = false

const say = ($: EngineInterface, text: string) => {
  $.ui.toast(`queue: ${text}`, { timeoutMs: TOAST_MS })
}

/** Runs git in the session's directory; '' when it fails or has nothing to say. */
const git = async ($: EngineInterface, args: readonly string[]) => {
  try {
    const ran = await $.process.run(['git', '--no-optional-locks', ...args], { timeoutMs: GIT_MS })

    return ran.exitCode === 0 ? ran.stdout.trim() : ''
  } catch {
    return ''
  }
}

/** Reads the file; `doc` is undefined when there is none. A file that cannot be read rejects. */
const load = async ($: EngineInterface) => {
  const top = await git($, ['rev-parse', '--show-toplevel'])
  const path = `${top === '' ? await $.session.cwd() : top}/${FILE}`

  return { path, doc: (await $.fs.exists(path)) ? parseDoc(await $.fs.read(path)) : undefined }
}

const save = async ($: EngineInterface, path: string, doc: Doc) => {
  await $.fs.write(path, renderDoc(doc))
  await update($, view, () => viewOf(doc))
}

/** Reads the file again for the band: it may have been edited by hand. */
const refresh = async ($: EngineInterface) => {
  const { doc } = await load($)

  await update($, view, () => viewOf(doc))
}

/** Adds one line. The only place the file is created. */
/**
 * Keeps the queue file out of git, for this repository alone. One line goes in
 * the repository's own exclude file, which git never commits or shares, and the
 * line is anchored, so it names the file at this repository's root and no other:
 * another project's queue, a nested repository's, or a `queue.md` deeper in the
 * tree is untouched. A project that tracks the file, or already ignores it, is
 * left as it chose.
 */
const keepOutOfGit = async ($: EngineInterface) => {
  const top = await git($, ['rev-parse', '--show-toplevel'])

  if (
    top === '' ||
    (await git($, ['-C', top, 'ls-files', '--', FILE])) !== '' ||
    (await git($, ['-C', top, 'check-ignore', '--', FILE])) !== ''
  ) {
    return
  }

  const where = await git($, ['-C', top, 'rev-parse', '--git-path', 'info/exclude'])

  if (where === '') {
    return
  }

  // Relative to the repository's top in a plain checkout; absolute in a linked worktree.
  const path = /^(?:[A-Za-z]:)?[\\/]/.test(where) ? where : `${top}/${where}`
  const text = (await $.fs.exists(path)) ? await $.fs.read(path) : ''

  if (text.split(/\r?\n/).some(line => line.trim() === EXCLUDE)) {
    return
  }

  const eol = text.includes('\r\n') ? '\r\n' : '\n'

  await $.fs.write(path, `${text}${text === '' || /\n$/.test(text) ? '' : eol}${EXCLUDE_NOTE}${eol}${EXCLUDE}${eol}`)
}

const stage = async ($: EngineInterface, task: string, mark: ' ' | '~') => {
  const { path, doc } = await load($)
  const held = doc ?? parseDoc(`${HEADER}\n`)
  const id = held.items.reduce((most, item) => Math.max(most, item.id), 0) + 1
  const branch = await git($, ['branch', '--show-current'])
  const next = withItem(held, {
    at: held.lines.length,
    mark,
    id,
    when: stamp(await $.clock.now()),
    task,
    branch: branch === '' ? '-' : branch,
    note: mark === '~' ? 'later' : '',
  })

  await save($, path, next)
  // The staged line is on disk whatever happens here: a failed exclude is not a failed stage.
  await keepOutOfGit($).catch(() => undefined)

  return { id, text: `queued q${id} · ${brief(task, 8)} · ${viewOf(next).pending} pending` }
}

const listing = async ($: EngineInterface) => {
  const { doc } = await load($)

  await update($, view, () => viewOf(doc))

  if (doc === undefined || doc.items.length === 0) {
    return 'queue empty'
  }

  return [
    ...doc.items
      .filter(item => item.mark === ' ' || item.mark === '>')
      .map(item => doc.lines[item.at] ?? ''),
    summaryOf(viewOf(doc)),
  ].join('\n')
}

const dropItem = async ($: EngineInterface, id: number) => {
  const { path, doc } = await load($)
  const item = doc?.items.find(found => found.id === id)

  if (doc === undefined || item === undefined) {
    return doc === undefined ? 'queue empty' : `no q${id} in the queue`
  }

  const next = without(doc, [item])

  await save($, path, next)
  // Dropping the item this session runs lets go of it.
  await update($, run, held => (held.id === id ? IDLE : held))

  return `dropped q${id} · ${brief(item.task, 8)} · ${viewOf(next).pending} pending`
}

const clearAll = async ($: EngineInterface) => {
  const { path, doc } = await load($)

  if (doc === undefined || doc.items.length === 0) {
    return 'queue empty'
  }

  await save($, path, without(doc, doc.items))
  await update($, run, () => IDLE)

  return `queue cleared · ${doc.items.length} removed`
}

/** The slash command a task names, when the session has one by that name. */
const slashOf = async ($: EngineInterface, task: string) => {
  const found = SLASH.exec(task)
  const command = found?.[1]

  if (command === undefined || command === 'queue') {
    return undefined
  }

  try {
    return (await $.command.list()).some(known => known.name === command)
      ? { command, args: found?.[2] ?? '' }
      : undefined
  } catch {
    return undefined
  }
}

/** The run could not be handed over, or said nothing of how it went: the person rules. */
const askVerdict = async ($: EngineInterface, id: number, why: string) => {
  await update($, run, (held): QueueRun =>
    held.id === id && held.phase !== 'idle' ? { ...held, phase: 'verdict', mode: 'run' } : held,
  )

  if (why !== '') {
    say($, why)
  }
}

/**
 * A slash command that started no turn. One that printed an answer of its own
 * ran to its end, and is done; one that showed nothing as text (a panel, a
 * prompt that never became a turn) leaves the verdict to the person.
 */
const unstarted = async ($: EngineInterface, id: number): Promise<void> => {
  const held = await read($, run)

  if (held.id !== id || held.phase !== 'launching' || !held.isCommand || held.turnId !== '') {
    return
  }

  if (isBusy) {
    // The command still waits behind a running turn: look again once that could have ended.
    watchStart($, id)

    return
  }

  if (!held.isPrinted) {
    await askVerdict($, id, '')

    return
  }

  await update($, run, () => IDLE)
  await finish($, held, { isDone: true, reason: '' })
}

const watchStart = ($: EngineInterface, id: number) => {
  $.clock.after(GRACE_MS, () => {
    void serial(() => unstarted($, id)).catch(() => undefined)
  })
}

/** Submits the task as the person's own words; the note joins its row (see `session.append`). */
const submitTask = async ($: EngineInterface, held: QueueRun) => {
  try {
    const sent = await $.prompt.submit({ text: held.task, asUser: true })

    if (sent.drop !== undefined) {
      await serial(() => askVerdict($, held.id, `q${held.id} was not accepted as a prompt: ${sent.drop}`))
    }
  } catch {
    await serial(() => askVerdict($, held.id, `q${held.id} could not be submitted.`))
  }
}

/** The item could not be handed to the engine at all: it failed before it began. */
const failRun = async ($: EngineInterface, held: QueueRun, reason: string) => {
  await update($, run, (live): QueueRun => (live.id === held.id ? IDLE : live))
  await finish($, held, { isDone: false, reason })
}

/**
 * Hands the running item to the engine, from a timer: a command hook holds the
 * turn a submission would wait on. A task that begins with `/` runs as that
 * slash command, the only way it can: the engine refuses a plugin's prompt
 * that begins with one. Any other is submitted as a prompt. Either waits its
 * turn in the engine's own queue. Spends a turn; only a run the person asked
 * for gets here.
 */
const launch = async ($: EngineInterface) => {
  if (isLaunching) {
    return
  }

  isLaunching = true

  try {
    const held = await read($, run)

    if (held.phase !== 'launching' || held.isSent) {
      return
    }

    if (!held.task.startsWith('/')) {
      await update($, run, (live): QueueRun => (live.id === held.id ? { ...live, isSent: true } : live))
      void submitTask($, held)

      return
    }

    const slash = await slashOf($, held.task)

    if (slash === undefined) {
      const name = held.task.split(/\s/)[0] ?? held.task

      await serial(() => failRun($, held, `${name} is no command this session can run`))

      return
    }

    await update($, run, (live): QueueRun =>
      live.id === held.id ? { ...live, isSent: true, isCommand: true } : live,
    )
    void $.command
      .run({ command: slash.command, args: slash.args })
      .then(async ran => {
        if (ran.text !== undefined) {
          await update($, run, (live): QueueRun => (live.id === held.id ? { ...live, isPrinted: true } : live))
        }

        watchStart($, held.id)
      })
      .catch(() => serial(() => failRun($, held, `/${slash.command} could not be run`)).catch(() => undefined))
  } finally {
    isLaunching = false
  }
}

const launchSoon = ($: EngineInterface) => {
  $.clock.after(SOON_MS, () => {
    void launch($).catch(() => undefined)
  })
}

/** Marks the head (or qN) running and schedules its launch. */
const begin = async ($: EngineInterface, wanted: number | undefined, mode: QueueRun['mode']) => {
  const live = await read($, run)

  if (live.phase === 'verdict') {
    return { isBegun: false, isMoved: false, text: `q${live.id} finished? Press Done or Failed first.` }
  }

  if (live.phase !== 'idle') {
    return { isBegun: false, isMoved: false, text: `q${live.id} is running.` }
  }

  const { path, doc } = await load($)
  const item =
    wanted === undefined
      ? doc?.items.find(found => found.mark === ' ')
      : doc?.items.find(found => found.id === wanted)

  if (doc === undefined || item === undefined) {
    const text =
      doc === undefined || doc.items.length === 0
        ? 'queue empty'
        : wanted === undefined
          ? 'nothing pending'
          : `no q${wanted} in the queue`

    return { isBegun: false, isMoved: false, text }
  }

  if (item.mark === 'x') {
    return { isBegun: false, isMoved: false, text: `q${item.id} is done.` }
  }

  if (item.mark === '>') {
    return {
      isBegun: false,
      isMoved: false,
      text: `q${item.id} is marked running by another session or a lost one; /queue --drop q${item.id} removes it.`,
    }
  }

  const [head, branch] = await Promise.all([
    git($, ['rev-parse', '--short', 'HEAD']),
    git($, ['branch', '--show-current']),
  ])

  await save($, path, withItem(doc, { ...item, mark: '>', note: 'running' }))
  await update($, run, () => ({ ...IDLE, id: item.id, mode, phase: 'launching', head, task: item.task }))
  launchSoon($)

  const isMoved = item.branch !== '' && item.branch !== '-' && branch !== '' && branch !== item.branch
  const moved = isMoved ? ` · staged on @${item.branch}, now on @${branch}` : ''

  return {
    isBegun: true,
    isMoved,
    text: `${mode === 'drain' ? 'draining · ' : ''}running q${item.id} · ${brief(item.task, 8)}${moved}`,
  }
}

/** Writes how the item ended, and under a drain goes on to the next pending one. */
const finish = async ($: EngineInterface, held: QueueRun, outcome: Outcome) => {
  const { path, doc } = await load($)
  const item = doc?.items.find(found => found.id === held.id)
  const head = outcome.isDone ? await git($, ['rev-parse', '--short', 'HEAD']) : ''
  const landed = head !== '' && head !== held.head ? head : 'no-commit'
  const reason = oneLine(outcome.reason).replace(/ · @/g, ' · at ') || 'no reason given'

  if (doc !== undefined && item !== undefined) {
    await save(
      $,
      path,
      withItem(doc, {
        ...item,
        mark: outcome.isDone ? 'x' : '!',
        note: outcome.isDone ? `done ${landed}` : `failed: ${reason}`,
      }),
    )
  }

  if (!outcome.isDone) {
    say($, `q${held.id} failed — ${reason}${held.mode === 'drain' ? '; the drain stopped.' : ''}`)

    return
  }

  if (held.mode !== 'drain') {
    say($, `q${held.id} done · ${landed}`)

    return
  }

  const next = await begin($, undefined, 'drain')

  if (!next.isBegun) {
    say($, `q${held.id} done · ${landed}; drained.`)
  } else if (next.isMoved) {
    say($, next.text)
  }
}

/** The turn that carries the item has started: its end is the one that settles it. */
const claimTurn = async ($: EngineInterface, text: string, turnId: string) => {
  await update($, run, (held): QueueRun => {
    if (held.phase !== 'launching' || !held.isSent || held.turnId !== '') {
      return held
    }

    // A slash command's turn opens on the engine's record of the command; a prompt's on the task.
    const opening = held.isCommand
      ? `<command-name>/${SLASH.exec(held.task)?.[1] ?? ''}</command-name>`
      : held.task

    return text.includes(opening) ? { ...held, phase: 'running', turnId } : held
  })
}

/** The end of a main turn: settles the running item when the turn was its own. */
const settleTurn = async ($: EngineInterface, turnId: string, answer: string, isAnswered: boolean) => {
  const held = await read($, run)

  if (held.phase !== 'launching' && held.phase !== 'running') {
    await refresh($)

    return
  }

  const outcome = isAnswered ? verdictOf(answer) : undefined
  const isOwn = held.turnId === turnId || (held.isSent && held.turnId === '' && outcome !== undefined)

  if (!isOwn) {
    // Another prompt's turn ran first. What a reload's lost timers left undone is taken up again:
    // an item never handed over goes now, and a command still without a turn is looked at once more.
    if (!held.isSent) {
      launchSoon($)
    } else if (held.isCommand && held.turnId === '') {
      watchStart($, held.id)
    }

    return
  }

  if (outcome === undefined) {
    await askVerdict(
      $,
      held.id,
      held.mode === 'drain' ? `the drain stopped: q${held.id} ended without saying how it went.` : '',
    )

    return
  }

  await update($, run, () => IDLE)
  await finish($, held, outcome)
}

/** Done or Failed, pressed by the person for a run that did not say. */
const rule = async ($: EngineInterface, isDone: boolean) => {
  const held = await read($, run)

  if (held.phase !== 'verdict') {
    return
  }

  await update($, run, () => IDLE)
  await finish($, { ...held, mode: 'run' }, { isDone, reason: isDone ? '' : 'marked failed by hand' })
}

/** A pressed band button. Run and Drain spend a turn; Done and Failed only write the file. */
const press = async ($: EngineInterface, action: Action) => {
  try {
    if (action === 'done' || action === 'failed') {
      await serial(() => rule($, action === 'done'))

      return
    }

    const begun = await serial(() => begin($, undefined, action))

    if (!begun.isBegun || begun.isMoved) {
      say($, begun.text)
    }
  } catch {
    say($, `${FILE} could not be read or written.`)
  }
}

/**
 * A new session: an item a lost session left running is marked interrupted,
 * and what is pending is named once. Nothing is ever started from here.
 */
const greet = async ($: EngineInterface, isInteractive: boolean) => {
  const { path, doc } = await load($)

  // A headless run in the same repository changes nothing: a live session may own the running item.
  if (doc === undefined || !isInteractive || (await read($, greeted))) {
    await update($, view, () => viewOf(doc))

    return
  }

  const live = await read($, run)
  const lost = doc.items.filter(item => item.mark === '>' && item.id !== live.id)
  const next = lost.reduce(
    (held, item) => withItem(held, { ...item, mark: '!', note: 'interrupted' }),
    doc,
  )

  await update($, greeted, () => true)

  if (lost.length > 0) {
    await save($, path, next)
  } else {
    await update($, view, () => viewOf(next))
  }

  const { pending } = viewOf(next)

  if (pending > 0) {
    $.ui.toast(`queue: ${pending} pending — /queue --run`, { timeoutMs: TOAST_MS })
  }
}

const idOf = (text: string) => {
  const found = /^q?(\d+)$/i.exec(text)

  return found === null ? undefined : Number(found[1])
}

/** `/queue` as typed: no model turn for any form but --run, --now and --drain. */
const dispatch = async ($: EngineInterface, typed: string): Promise<string> => {
  const args = oneLine(typed)

  if (args === '') {
    return listing($)
  }

  const found = FLAG.exec(args)
  const rest = (found?.[2] ?? '').trim()

  switch (found?.[1]) {
    case '--later':
      return rest === '' ? USAGE : (await stage($, rest, '~')).text
    case '--now': {
      if (rest === '') {
        return USAGE
      }

      const staged = await stage($, rest, ' ')
      const begun = await begin($, staged.id, 'run')

      return begun.isBegun
        ? `queued q${staged.id} · ${brief(rest, 8)} · runs once the session is idle`
        : `${staged.text} · ${begun.text}`
    }
    case '--run': {
      const id = idOf(rest)

      return rest !== '' && id === undefined ? USAGE : (await begin($, id, 'run')).text
    }
    case '--drain':
      return rest === '' ? (await begin($, undefined, 'drain')).text : USAGE
    case '--drop': {
      const id = idOf(rest)

      return id === undefined ? USAGE : dropItem($, id)
    }
    case '--clear':
      return rest === '' ? clearAll($) : USAGE
    default:
      // Anything else is the task itself, kept as written.
      return (await stage($, args, ' ')).text
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'queue',
      description: `Stage a task in ${FILE} with no turn, show the queue, or run it (--run, --now and --drain: ${LEGEND})`,
      argumentHint: '[<task> | --later <task> | --now <task> | --run [qN] | --drain | --drop qN | --clear]',
      // Staging mid-turn must not wait for the turn: the work in flight goes on.
      immediate: true,
    })
    void serial(() => greet($, e.isInteractive)).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'queue' }, async ($, e) => {
    try {
      return { text: await serial(() => dispatch($, e.args)) }
    } catch {
      return { text: `queue: ${FILE} could not be read or written.` }
    }
  })

  // The queue's own submission, as its row joins the conversation: the note the
  // model needs is added after the task, whose words stay as the person wrote
  // them. (A plugin's own $.prompt.submit skips its own prompt.submit hook, so
  // the note cannot ride as context.) No other row is touched.
  on('session.append', { door: 'prompt' }, async ($, e, next) => {
    if (e.origin.kind !== 'plugin' || !('name' in e.origin) || e.origin.name !== 'queue') {
      return next(e)
    }

    const held = await read($, run)

    if ((held.phase !== 'launching' && held.phase !== 'running') || !held.isSent || held.isNoted) {
      return next(e)
    }

    await update($, run, (live): QueueRun => (live.id === held.id ? { ...live, isNoted: true } : live))

    return next({
      ...e,
      message: {
        ...e.message,
        content: [...e.message.content, { type: 'text', text: noteOf(held.id, held.task) }],
      },
    })
  })

  // Nothing here waits: the turn goes on while the queue takes note of it.
  on('turn.start', ($, e, next) => {
    isBusy = true
    void serial(() => claimTurn($, e.text, e.turnId)).catch(() => undefined)

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      isBusy = false
      void serial(() => settleTurn($, e.turnId, e.answer, e.reason === 'answer')).catch(() => undefined)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const band = bandOf(await read($, view), await read($, run))

    if (band === undefined) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // Another mod's band, when one draws beneath this one, stays under it.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Text dimColor wrap="truncate-end">
            {band.line}
          </Text>
          {band.actions.map(({ action, label }) => (
            <Button
              key={`queue-${action}`}
              label={label}
              hotkey={HOTKEYS[action]}
              onPress={() => press($, action)}
            />
          ))}
          {band.hasCost && <Text dimColor>{LEGEND}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
