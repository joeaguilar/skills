import type { Claim, Flag, Lane, Picture, Pointer, ScriptRun, Task } from '../types'

// Everything here is a plain function of text already read: no file, process or clock.

export const DAY_MS = 86_400_000
export const HOUR_MS = 3_600_000
/** A pointer file is stale once its last change lags the last commit by more than this. */
export const STALE_POINTER_DAYS = 7
/** A claim is stale once nothing has touched the issue for more than this. */
export const STALE_CLAIM_HOURS = 48
/** How many of one kind of flag the report spells out. */
const MAX_FLAGS = 5
/** How much of a project script's output the report keeps: short enough that the state of play stays in view. */
const MAX_SCRIPT_LINES = 30
const MAX_SCRIPT_COLUMNS = 200
const CLOSED = new Set(['done', 'wontfix'])

export const EMPTY: Picture = {
  at: 0,
  project: '',
  commit: null,
  dirty: 0,
  dirtiest: '',
  tracker: 'no-database',
  pointers: [],
  lane: { text: '', source: 'none' },
  task: null,
  claims: [],
  ready: 0,
  blocked: 0,
  flags: [],
  script: '',
}

export const NO_RUN: ScriptRun = { command: '', output: '', exitCode: 0 }

/** One tracker issue, as much of it as the reconciliation reads. */
export type Issue = {
  id: number
  title: string
  status: string
  priority: string
  tags: string[]
  assignee: string
  /** Epoch milliseconds; 0 when the tracker did not say. */
  updatedAt: number
  blockedBy: number[]
}

/** What one itr call printed: its issues, or why there are none. */
export type Listed = {
  issues: Issue[]
  isMissingDatabase: boolean
}

const numbers = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((one): one is number => typeof one === 'number') : []

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : []

const text = (value: unknown) => (typeof value === 'string' ? value : '')

const issueOf = (value: unknown): Issue | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const row = value as Record<string, unknown>
  const id = row['id']

  if (typeof id !== 'number') {
    return undefined
  }

  return {
    id,
    title: text(row['title']),
    status: text(row['status']),
    priority: text(row['priority']),
    tags: strings(row['tags']),
    assignee: text(row['assigned_to']),
    updatedAt: Date.parse(text(row['updated_at'])) || 0,
    blockedBy: numbers(row['blocked_by']),
  }
}

/**
 * Reads what `itr <command> -f json` wrote: one issue, a list of them, or its
 * error object. Anything else reads as no issues.
 */
export const parseItr = (stdout: string): Listed => {
  // itr may say a line of its own first (`REVIEW: ...`): the JSON starts a line.
  const at = stdout.search(/^[[{]/m)
  let parsed: unknown

  try {
    parsed = at < 0 ? undefined : JSON.parse(stdout.slice(at))
  } catch {
    parsed = undefined
  }

  if (Array.isArray(parsed)) {
    return {
      issues: parsed.map(issueOf).filter((one): one is Issue => one !== undefined),
      isMissingDatabase: false,
    }
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const row = parsed as Record<string, unknown>

    if ('error' in row) {
      return { issues: [], isMissingDatabase: row['code'] === 'NO_DATABASE' }
    }

    const one = issueOf(parsed)

    return { issues: one === undefined ? [] : [one], isMissingDatabase: false }
  }

  return { issues: [], isMissingDatabase: false }
}

/** A table row's cells; a pipe written `\|` stays inside its cell. */
const cellsOf = (row: string): string[] => {
  const cells: string[] = []
  let cell = ''

  for (let at = 0; at < row.length; at += 1) {
    const char = row[at]

    if (char === '\\' && row[at + 1] === '|') {
      cell += '|'
      at += 1
    } else if (char === '|') {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += char
    }
  }

  cells.push(cell.trim())

  // A row opens and closes with a pipe: the pieces outside them are not cells.
  return cells.slice(1, row.trimEnd().endsWith('|') ? -1 : undefined)
}

const isTableRow = (line: string) => line.trimStart().startsWith('|')
const isRule = (line: string) => /^\s*\|[\s:|-]+\|?\s*$/.test(line) && line.includes('-')

/** Markdown marks and comments taken out, the text on one line. */
export const plain = (marked: string) =>
  marked
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** The first `count` words, with a mark when words were left out. */
export const words = (sentence: string, count: number) => {
  const all = sentence.trim().split(/\s+/).filter(word => word !== '')

  return all.length <= count ? all.join(' ') : `${all.slice(0, count).join(' ')}…`
}

/** Issue ids written `#12` or `itr#12`, in order, each once; one the text itself calls open is left out. */
const idsOf = (cell: string): number[] => {
  const ids: number[] = []

  for (const found of cell.matchAll(/#(\d+)(\s*\(([^)]*)\))?/g)) {
    const id = Number(found[1])
    const isSaidOpen = /\bopen\b/i.test(found[3] ?? '')

    if (!isSaidOpen && !ids.includes(id)) {
      ids.push(id)
    }
  }

  return ids
}

/** Every `#12` in the text, in order, each once. */
const everyId = (cell: string): number[] => [...new Set([...cell.matchAll(/#(\d+)/g)].map(found => Number(found[1])))]

/** The rank-1 lane of a ranked digest. */
export type RankedLane = {
  name: string
  ids: number[]
  why: string
}

/**
 * Reads the rank-1 lane out of docs/NEXT.md: the row ranked 1 in its pull-order
 * table, or its first numbered item when it keeps no such table.
 */
export const parseNext = (digest: string): RankedLane | undefined => {
  const rows = digest.split(/\r?\n/)

  for (let at = 0; at < rows.length; at += 1) {
    const header = rows[at] ?? ''

    if (!isTableRow(header) || !isRule(rows[at + 1] ?? '')) {
      continue
    }

    const names = cellsOf(header).map(name => plain(name).toLowerCase())
    const rank = names.findIndex(name => name === 'rank' || name === '#' || name === 'order')

    if (rank < 0) {
      continue
    }

    const lane = names.findIndex((name, index) => index !== rank && /lane|work|item|what|section/.test(name))
    const tracker = names.findIndex(name => /tracker|ticket|issue|\bids?\b/.test(name))
    const why = names.findIndex(name => name.startsWith('why'))
    const data: string[][] = []

    for (let row = at + 2; row < rows.length && isTableRow(rows[row] ?? ''); row += 1) {
      data.push(cellsOf(rows[row] ?? ''))
    }

    const first = data.find(cells => plain(cells[rank] ?? '').replace(/\D/g, '') === '1') ?? data[0]

    if (first === undefined) {
      continue
    }

    const named = first[lane < 0 ? (rank === 0 ? 1 : 0) : lane] ?? ''

    return {
      name: plain(named),
      ids: everyId(tracker < 0 ? first.join(' ') : (first[tracker] ?? '')),
      why: why < 0 ? '' : plain(first[why] ?? ''),
    }
  }

  const item = rows.find(row => /^\s*1[.)]\s+\S/.test(row))

  if (item === undefined) {
    return undefined
  }

  return { name: plain(item.replace(/^\s*1[.)]\s+/, '')), ids: everyId(item), why: '' }
}

/** One section of the roadmap. */
export type RoadmapRow = {
  title: string
  status: 'done' | 'partial' | 'todo'
  /** The issues the row links, less any it says are open. */
  ids: number[]
  /** Under a heading that puts it past the release: v2, deferred, excluded, removed. */
  isDeferred: boolean
}

const statusOf = (cell: string): RoadmapRow['status'] | undefined =>
  cell.includes('✅') ? 'done' : cell.includes('🟡') ? 'partial' : cell.includes('❌') ? 'todo' : undefined

const DEFERRED = /\b(v2|deferred|excluded|never|removed|historical|legend)\b/i

/**
 * Reads the roadmap's sections: the rows of every table with a Status column,
 * and checkbox list items. A legend's bullets are neither, so they are not rows.
 */
export const parseRoadmap = (roadmap: string): RoadmapRow[] => {
  const rows: RoadmapRow[] = []
  const lines = roadmap.split(/\r?\n/)
  let deferredAt: number | undefined
  let status = -1
  let linked = -1
  let isInTable = false

  for (let at = 0; at < lines.length; at += 1) {
    const line = lines[at] ?? ''
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)

    if (heading !== null) {
      const level = (heading[1] ?? '').length

      // A deferred heading covers everything beneath it, until one at its level or above.
      if (deferredAt !== undefined && level <= deferredAt) {
        deferredAt = undefined
      }

      if (deferredAt === undefined && DEFERRED.test(heading[2] ?? '')) {
        deferredAt = level
      }

      isInTable = false
      continue
    }

    if (isTableRow(line)) {
      if (!isInTable) {
        if (isRule(lines[at + 1] ?? '')) {
          const names = cellsOf(line).map(name => plain(name).toLowerCase())

          status = names.findIndex(name => name === 'status' || name === 'state')
          linked = names.findIndex(name => /linked|itr|issue|ticket/.test(name))
          isInTable = true
          at += 1
        }

        continue
      }

      const cells = cellsOf(line)
      const found = status < 0 ? undefined : statusOf(cells[status] ?? '')

      if (found !== undefined) {
        rows.push({
          title: plain(cells[0] ?? ''),
          status: found,
          ids: linked < 0 ? [] : idsOf(cells[linked] ?? ''),
          isDeferred: deferredAt !== undefined,
        })
      }

      continue
    }

    isInTable = false

    const box = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line)

    if (box !== null) {
      const said = box[2] ?? ''

      rows.push({
        title: words(plain(said), 12),
        status: box[1] === ' ' ? 'todo' : 'done',
        ids: idsOf(said),
        isDeferred: deferredAt !== undefined,
      })
    }
  }

  return rows
}

/** The first heading in an instruction file that says the project has its own next-work procedure. */
export const procedureOf = (instructions: string): string | undefined => {
  for (const line of instructions.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    const title = plain(heading?.[1] ?? '')

    if (/\bnext[- ]work\b|\bwhat'?s next\b|\bnext task\b/i.test(title)) {
      return title
    }
  }

  return undefined
}

/** Whether a justfile has a `next` recipe. */
export const hasNextRecipe = (justfile: string) => /^next(\s+[^:=]*)?:(?!=)/m.test(justfile)

/** Whole days a file's last change lags the last commit, when that is more than seven; else 0. */
export const staleDaysOf = (mtimeMs: number, commitMs: number) => {
  const lag = commitMs - mtimeMs

  return mtimeMs > 0 && commitMs > 0 && lag > STALE_POINTER_DAYS * DAY_MS ? Math.floor(lag / DAY_MS) : 0
}

/** Whole hours since an issue's last update, when that is more than 48; else 0. */
export const staleHoursOf = (updatedAt: number, now: number) => {
  const idle = now - updatedAt

  return updatedAt > 0 && idle > STALE_CLAIM_HOURS * HOUR_MS ? Math.floor(idle / HOUR_MS) : 0
}

/** A file as read: its text and when it last changed. */
export type FileRead = {
  text: string
  mtimeMs: number
}

/** What every itr call printed, or why none ran. */
export type ItrRead =
  | { state: 'no-binary' }
  | { state: 'ok'; next: string; ready: string; wip: string; blocked: string; all: string }

/** Everything the gathering read, before any of it is interpreted. */
export type Raw = {
  now: number
  project: string
  /** Undefined outside a repository. */
  git: { log: string; status: string; numstat: string } | undefined
  itr: ItrRead
  nextMd: FileRead | undefined
  roadmap: (FileRead & { path: string }) | undefined
  sprintCurrent: FileRead | undefined
  isSprintFolderThere: boolean
  handoff: { path: string; mtimeMs: number } | undefined
  campaignCurrent: FileRead | undefined
  campaignJson: string | undefined
  /** CLAUDE.md and AGENTS.md, those that exist. */
  instructions: { path: string; text: string }[]
  hasNextScript: boolean
  justfile: string | undefined
}

const firstLine = (file: string) => (file.split(/\r?\n/)[0] ?? '').trim()

/** The path with the most uncommitted change: by lines changed, else the first one git lists. */
const dirtiestOf = (numstat: string, dirty: readonly string[]) => {
  let best = ''
  let most = -1

  for (const row of numstat.split(/\r?\n/)) {
    const [added = '', removed = '', ...path] = row.split('\t')
    const churn = (Number(added) || 0) + (Number(removed) || 0)

    if (path.length > 0 && churn > most) {
      most = churn
      best = path.join('\t')
    }
  }

  return best !== '' ? best : (dirty[0] ?? '').slice(3).trim()
}

const several = (flags: Flag[], kind: Flag['kind'], texts: readonly string[], more: (rest: number) => string) => {
  for (const one of texts.slice(0, MAX_FLAGS)) {
    flags.push({ kind, text: one })
  }

  if (texts.length > MAX_FLAGS) {
    flags.push({ kind, text: more(texts.length - MAX_FLAGS) })
  }
}

const ids = (list: readonly number[]) => list.map(id => `#${id}`).join(', ')

/**
 * Reconciles what was read into one picture: the tracker is trusted over the
 * files, git over both, and every disagreement is flagged rather than settled.
 */
export const reconcile = (raw: Raw): Picture => {
  const flags: Flag[] = []
  const pointers: Pointer[] = []

  // git
  const [hash = '', seconds = '', date = '', ...subject] = (raw.git?.log ?? '').trim().split('\t')
  const commitMs = (Number(seconds) || 0) * 1000
  const dirty = (raw.git?.status ?? '').split(/\r?\n/).filter(row => row.trim() !== '')

  // tracker
  let tracker: Picture['tracker'] = raw.itr.state === 'ok' ? 'itr' : 'no-binary'
  let next: Issue | undefined
  let ready: Issue[] = []
  let wip: Issue[] = []
  let blocked: Issue[] = []
  const statuses = new Map<number, string>()

  if (raw.itr.state === 'ok') {
    const first = parseItr(raw.itr.next)

    if (first.isMissingDatabase) {
      tracker = 'no-database'
    } else {
      next = first.issues[0]
      ready = parseItr(raw.itr.ready).issues
      wip = parseItr(raw.itr.wip).issues
      blocked = parseItr(raw.itr.blocked).issues

      for (const issue of parseItr(raw.itr.all).issues) {
        statuses.set(issue.id, issue.status)
      }
    }
  }

  const isOpen = (id: number) => statuses.has(id) && !CLOSED.has(statuses.get(id) ?? '')
  const isClosed = (id: number) => CLOSED.has(statuses.get(id) ?? '')
  const claims: Claim[] = wip.map(issue => ({
    id: issue.id,
    title: issue.title,
    assignee: issue.assignee,
    staleHours: staleHoursOf(issue.updatedAt, raw.now),
  }))

  // the pointer files
  const ranked = raw.nextMd === undefined ? undefined : parseNext(raw.nextMd.text)
  const sections = raw.roadmap === undefined ? [] : parseRoadmap(raw.roadmap.text)
  const section = sections.find(row => !row.isDeferred && row.status !== 'done')

  if (raw.nextMd !== undefined) {
    pointers.push({
      kind: 'next',
      path: 'docs/NEXT.md',
      detail: ranked === undefined ? 'no ranked lane' : `rank 1: ${words(ranked.name, 8)}`,
      staleDays: 0,
    })
  }

  if (raw.sprintCurrent !== undefined) {
    const folder = firstLine(raw.sprintCurrent.text)

    pointers.push({
      kind: 'sprint',
      path: 'sprint/CURRENT',
      detail: folder === '' ? 'empty' : folder,
      staleDays: staleDaysOf(raw.sprintCurrent.mtimeMs, commitMs),
    })

    if (folder === '' || !raw.isSprintFolderThere) {
      flags.push({
        kind: 'pointer',
        text: folder === '' ? 'sprint/CURRENT is empty' : `sprint/CURRENT names sprint/${folder}, which is not there`,
      })
    }
  }

  if (raw.roadmap !== undefined) {
    pointers.push({
      kind: 'roadmap',
      path: raw.roadmap.path,
      detail: section === undefined ? 'no open section' : `next: ${words(section.title, 8)}`,
      staleDays: staleDaysOf(raw.roadmap.mtimeMs, commitMs),
    })
  }

  if (raw.handoff !== undefined) {
    pointers.push({
      kind: 'handoff',
      path: raw.handoff.path,
      detail: '',
      staleDays: staleDaysOf(raw.handoff.mtimeMs, commitMs),
    })
  }

  if (raw.campaignCurrent !== undefined) {
    const folder = firstLine(raw.campaignCurrent.text)
    let state = ''

    try {
      const parsed: unknown = JSON.parse(raw.campaignJson ?? '')

      state = typeof parsed === 'object' && parsed !== null ? text((parsed as Record<string, unknown>)['status']) : ''
    } catch {
      state = ''
    }

    pointers.push({
      kind: 'campaign',
      path: 'campaign/CURRENT',
      detail: `${folder === '' ? 'empty' : folder}${state === '' ? '' : ` (${state})`}`,
      staleDays: 0,
    })
  }

  for (const pointer of pointers) {
    if (pointer.staleDays > 0) {
      flags.push({ kind: 'stale', text: `⚠ ${pointer.path} stale (${pointer.staleDays}d behind git)` })
    }
  }

  // the pick: the digest's rank-1 lane, then the lane tag, then the tracker's own recommendation
  let task: Task | null = null

  if (tracker === 'itr') {
    // An issue somebody is working on now is not next; one whose claim went stale still is, named with doubt.
    const isFree = (issue: Issue) => !claims.some(claim => claim.id === issue.id && claim.staleHours === 0)
    const inLane = ranked?.ids
      .map(id => ready.find(issue => issue.id === id && isFree(issue)))
      .find(issue => issue !== undefined)
    const tagged = ready.find(issue => issue.tags.includes('next-lane') && isFree(issue))
    const picked = inLane ?? tagged ?? next
    const known = ranked?.ids.filter(id => statuses.has(id)) ?? []

    if (ranked !== undefined && known.length > 0 && known.every(isClosed)) {
      flags.push({ kind: 'digest', text: 'docs/NEXT.md rank 1 lists only tickets itr has closed: trust itr, fix the digest' })
    } else if (ranked !== undefined && known.length > 0 && inLane === undefined) {
      flags.push({ kind: 'digest', text: 'docs/NEXT.md rank 1 has no ready ticket (blocked or claimed)' })
    }

    if (picked !== undefined) {
      const claim = claims.find(one => one.id === picked.id)

      task = {
        id: picked.id,
        title: picked.title,
        priority: picked.priority,
        why: inLane !== undefined ? 'rank-1 lane in docs/NEXT.md' : tagged !== undefined ? 'next-lane tag' : 'itr next',
        isDoubted: (claim?.staleHours ?? 0) > 0,
      }
    }

    // contradictions: the roadmap says done, the tracker says open
    several(
      flags,
      'contradiction',
      sections
        .filter(row => row.status === 'done' && row.ids.some(isOpen))
        .map(row => `roadmap marks "${words(row.title, 8)}" done, but ${ids(row.ids.filter(isOpen))} still open`),
      rest => `${rest} more roadmap rows marked done with open issues`,
    )

    several(
      flags,
      'unblocked',
      blocked
        .filter(issue => issue.blockedBy.length > 0 && issue.blockedBy.every(isClosed))
        .map(issue => `#${issue.id} actually unblocked (${ids(issue.blockedBy)} closed)`),
      rest => `${rest} more actually unblocked`,
    )
  }

  const lane: Lane =
    ranked !== undefined
      ? { text: ranked.name, source: 'NEXT.md' }
      : section !== undefined
        ? { text: `${section.status === 'todo' ? '❌' : '🟡'} ${section.title}`, source: 'ROADMAP' }
        : { text: '', source: tracker === 'itr' ? 'itr-only' : 'none' }

  for (const file of raw.instructions) {
    const heading = procedureOf(file.text)

    if (heading !== undefined) {
      flags.push({
        kind: 'procedure',
        text: `this project documents its own procedure (${file.path} § ${heading}): Ask ¤ has Claude follow it`,
      })
      break
    }
  }

  return {
    at: raw.now,
    project: raw.project,
    commit: hash === '' ? null : { hash, date, subject: subject.join('\t') },
    dirty: dirty.length,
    dirtiest: dirty.length === 0 ? '' : dirtiestOf(raw.git?.numstat ?? '', dirty),
    tracker,
    pointers,
    lane,
    task,
    claims,
    ready: ready.length,
    blocked: blocked.length,
    flags,
    script: raw.hasNextScript ? 'scripts/next-work.sh' : raw.justfile !== undefined && hasNextRecipe(raw.justfile) ? 'just next' : '',
  }
}

const NO_TRACKER: Record<Exclude<Picture['tracker'], 'itr'>, string> = {
  'no-binary': 'itr is not on PATH',
  'no-database': 'no .itr.db here',
}

const pointerText = (pointer: Pointer) =>
  `${pointer.kind} ${pointer.kind === 'handoff' || pointer.kind === 'roadmap' || pointer.kind === 'next' ? pointer.path : pointer.detail}${
    pointer.staleDays > 0 ? ` ⚠ stale (${pointer.staleDays}d behind git)` : ''
  }`

/** A project script's output, cut to what a report can carry. */
export const clip = (output: string) => {
  const rows = output.replace(/\r/g, '').replace(/\n+$/, '').split('\n')
  const kept = rows
    .slice(0, MAX_SCRIPT_LINES)
    .map(row => (row.length > MAX_SCRIPT_COLUMNS ? `${row.slice(0, MAX_SCRIPT_COLUMNS)}…` : row))

  if (rows.length > MAX_SCRIPT_LINES) {
    kept.push(`… ${rows.length - MAX_SCRIPT_LINES} more lines`)
  }

  return kept.join('\n')
}

/** The state-of-play lines, in the order the report gives them; no script output, no closing line. */
export const stateOf = (found: Picture): string[] => {
  const commit =
    found.commit === null
      ? 'none (not a git repository, or no commit yet)'
      : `${found.commit.hash} ${found.commit.date} ${found.commit.subject}`
  const held = found.pointers.filter(pointer => pointer.kind === 'sprint' || pointer.kind === 'handoff' || pointer.kind === 'campaign')
  const lane =
    found.lane.source === 'none'
      ? 'none (no digest, no roadmap, no tracker)'
      : `${found.lane.text === '' ? '—' : found.lane.text}  (source: ${found.lane.source})`
  const task =
    found.tracker !== 'itr'
      ? `no tracker (${NO_TRACKER[found.tracker]}): reconciled from the files and git alone`
      : found.task === null
        ? 'nothing ready'
        : `${found.task.isDoubted ? 'perhaps ' : ''}#${found.task.id} ${found.task.title}  (why: ${found.task.why})`
  const claims =
    found.claims.length === 0
      ? 'nothing claimed'
      : found.claims
          .map(
            claim =>
              `#${claim.id} ${claim.title}${claim.assignee === '' ? '' : ` (${claim.assignee})`}${
                claim.staleHours > 0 ? ` ⚠ stale claim (${claim.staleHours}h idle)` : ''
              }`,
          )
          .join('; ')

  return [
    `## ${found.project === '' ? 'this project' : found.project} — state of play`,
    `Last commit: ${commit} · working tree: ${found.dirty === 0 ? 'clean' : `${found.dirty} dirty`}`,
    `Handoff/sprint: ${held.length === 0 ? 'none' : held.map(pointerText).join(' · ')}`,
    '',
    `**Lane/section next:** ${lane}`,
    `**Task next:** ${task}`,
    `**In progress:** ${found.tracker === 'itr' ? claims : '—'}`,
    `**Ready behind it:** ${found.tracker === 'itr' ? `${found.ready} ready, ${found.blocked} blocked` : '—'}`,
    `**Flags:** ${found.flags.length === 0 ? 'none' : found.flags.map(flag => flag.text).join('; ')}`,
  ]
}

export const CLOSING = 'Run /whats-next --start to begin the top item.'

/** The whole report: the project's own script first when it ran, then the state of play. */
export const reportOf = (found: Picture, ran: ScriptRun = NO_RUN): string => {
  const script =
    ran.command === ''
      ? found.script === ''
        ? []
        : [`Project script: ${found.script} (not run for this report; /whats-next runs it)`, '']
      : [`### ${ran.command}${ran.exitCode === 0 ? '' : ` (exit ${ran.exitCode})`}`, '```text', ran.output, '```', '']

  return [...script, ...stateOf(found), '', CLOSING].join('\n')
}

/** The one stone: what tsugi points at. Undefined when the water is still. */
export type Stone = {
  label: string
  title: string
  why: string
}

export const stoneOf = (found: Picture): Stone | undefined => {
  if (found.task !== null) {
    return {
      label: `${found.task.isDoubted ? 'perhaps ' : ''}#${found.task.id}`,
      title: words(found.task.title, 5),
      why: [found.task.why, found.task.priority].filter(part => part !== '').join(' · '),
    }
  }

  // No tracker at all: the dirtiest thing in the working tree is the stone.
  if (found.tracker !== 'itr' && found.dirtiest !== '') {
    return { label: found.dirtiest, title: 'uncommitted work', why: `${found.dirty} dirty, no tracker` }
  }

  if (found.lane.source === 'NEXT.md' || found.lane.source === 'ROADMAP') {
    const pointer = found.pointers.find(one => one.kind === (found.lane.source === 'NEXT.md' ? 'next' : 'roadmap'))
    const isStale = (pointer?.staleDays ?? 0) > 0

    return {
      label: `${isStale ? 'perhaps ' : ''}${pointer?.path ?? found.lane.source}`,
      title: words(found.lane.text, 5),
      why:
        found.lane.source !== 'NEXT.md'
          ? 'first open section'
          : found.tracker === 'itr'
            ? 'rank 1 · nothing ready in itr'
            : 'rank 1',
    }
  }

  return undefined
}

export const STILL = '次 · the water is still.'

/** tsugi's answer: the glyph, the stone, the why. Still water is one line. */
export const tsugiOf = (found: Picture): string[] => {
  const stone = stoneOf(found)

  if (stone === undefined) {
    return [STILL]
  }

  return ['次', `${stone.label} — ${stone.title}`, stone.why].filter(line => line !== '')
}

/** The band's line: the stone and counts, then what has gone stale. Undefined with nothing to show. */
export const bandOf = (found: Picture): { calm: string; alarm: string } | undefined => {
  if (found.tracker !== 'itr' && found.pointers.length === 0) {
    return undefined
  }

  const stone = stoneOf(found)
  const staleClaims = found.claims.filter(claim => claim.staleHours > 0).length
  const others = found.flags.filter(flag => flag.kind !== 'stale' && flag.kind !== 'procedure').length

  return {
    calm: [
      stone === undefined ? '次 the water is still' : `次 ${stone.label} ${stone.title}`,
      found.tracker === 'itr' ? `${found.ready} ready` : '',
      others > 0 ? `${others} flag${others === 1 ? '' : 's'}` : '',
    ]
      .filter(part => part !== '')
      .join(' · '),
    alarm: [
      ...found.pointers
        .filter(pointer => pointer.staleDays > 0)
        .map(pointer => `⚠ ${pointer.path} stale ${pointer.staleDays}d`),
      staleClaims > 0 ? `⚠ ${staleClaims} stale claim${staleClaims === 1 ? '' : 's'}` : '',
    ]
      .filter(part => part !== '')
      .join(' · '),
  }
}
