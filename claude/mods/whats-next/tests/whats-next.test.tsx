import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import {
  CLOSING,
  DAY_MS,
  HOUR_MS,
  STILL,
  bandOf,
  clip,
  hasNextRecipe,
  parseItr,
  parseNext,
  parseRoadmap,
  procedureOf,
  reconcile,
  reportOf,
  staleDaysOf,
  staleHoursOf,
  stateOf,
  tsugiOf,
} from '../hooks/gather'
import type { Raw } from '../hooks/gather'
import { START_BODY } from '../hooks/prompts'

const LEGEND = '¤ uses tokens'
const NOW = Date.UTC(2026, 9, 3, 12)
/** The last commit: a day before now. */
const COMMIT = NOW - DAY_MS
const LOG = `abc1234\t${COMMIT / 1000}\t2026-10-02\tfeat: add upload queue`
const iso = (ms: number) => new Date(ms).toISOString()

/** An issue as `itr -f json` writes one. */
const issue = (id: number, title: string, over: Record<string, unknown> = {}) => ({
  id,
  title,
  status: 'open',
  priority: 'high',
  tags: [],
  assigned_to: '',
  updated_at: iso(NOW - HOUR_MS),
  blocked_by: [],
  ...over,
})

type Lists = { next?: unknown; ready?: unknown[]; wip?: unknown[]; blocked?: unknown[]; all?: unknown[] }

const itr = (lists: Lists = {}): Raw['itr'] => ({
  state: 'ok',
  next: JSON.stringify(lists.next ?? []),
  ready: JSON.stringify(lists.ready ?? []),
  wip: JSON.stringify(lists.wip ?? []),
  blocked: JSON.stringify(lists.blocked ?? []),
  all: JSON.stringify(lists.all ?? []),
})

const NO_DATABASE = '{"error":"No .itr.db found. Run \'itr init\' to create one.","code":"NO_DATABASE"}\n'

const NEXT_MD = [
  '# Next Work',
  '',
  '## Current Pull Order',
  '',
  '| Rank | Lane | Tracker IDs | Why next |',
  '|------|------|-------------|----------|',
  '| 1 | **Upload hardening** | #13 → #12; epic #8 | The queue drops jobs under load. |',
  '| 2 | Dashboard | #20 | After uploads. |',
].join('\n')

const ROADMAP = [
  '# Roadmap — demo',
  '',
  '## Status legend',
  '- ✅ — section is feature-complete',
  '- ❌ — not started',
  '',
  '## Sections — v1',
  '',
  '| Section | Status | Size | Linked itr | Notes |',
  '|---------|--------|------|------------|-------|',
  '| §A.1 Core | ✅ <!-- auto --> | S | #30 (done), #31 (open, v2) <!-- auto --> | shipped; see #99 |',
  '| §A.2 **Upload** | 🟡 | M | #12 | in flight |',
  '| §A.3 Dashboard | ❌ | L | #20 | |',
  '',
  '## Sections — v2 (tracked, deferred)',
  '',
  '### Sync',
  '',
  '| Section | Status | Size | Linked itr | Notes |',
  '|---------|--------|------|------------|-------|',
  '| §B.1 Sync | ❌ | XL | | later |',
].join('\n')

/** Everything read, for the pure reconciliation; a test overrides what it is about. */
const raw = (over: Partial<Raw> = {}): Raw => ({
  now: NOW,
  project: 'demo',
  git: { log: LOG, status: '', numstat: '' },
  itr: itr(),
  nextMd: undefined,
  roadmap: undefined,
  sprintCurrent: undefined,
  isSprintFolderThere: false,
  handoff: undefined,
  campaignCurrent: undefined,
  campaignJson: undefined,
  instructions: [],
  hasNextScript: false,
  justfile: undefined,
  ...over,
})

/** The tracker of the worked example: a ranked lane, a stale claim, a blocked issue whose blocker closed. */
const TRACKED: Lists = {
  next: issue(12, 'Fix upload race in the queue worker'),
  ready: [issue(12, 'Fix upload race in the queue worker'), issue(13, 'Add the retry budget'), issue(14, 'Tidy logs')],
  wip: [issue(9, 'Wire the retry budget', { status: 'in-progress', assigned_to: 'codex', updated_at: iso(NOW - 49 * HOUR_MS) })],
  blocked: [issue(20, 'Ship the dashboard', { blocked_by: [5] })],
  all: [
    { id: 5, status: 'done' },
    { id: 9, status: 'in-progress' },
    { id: 12, status: 'open' },
    { id: 13, status: 'open' },
    { id: 14, status: 'open' },
    { id: 20, status: 'open' },
    { id: 30, status: 'open' },
    { id: 31, status: 'open' },
  ],
}

const worked = () =>
  raw({
    git: { log: LOG, status: ' M src/a.rs\n?? notes.md\n', numstat: '' },
    itr: itr(TRACKED),
    nextMd: { text: NEXT_MD, mtimeMs: COMMIT },
    roadmap: { path: 'docs/ROADMAP.md', text: ROADMAP, mtimeMs: COMMIT - 9 * DAY_MS },
    sprintCurrent: { text: 'sprint-3-2026-09-20-upload\n', mtimeMs: COMMIT - DAY_MS },
    isSprintFolderThere: true,
    handoff: { path: 'docs/handoff/2026-10-01-upload.md', mtimeMs: COMMIT },
  })

// ---- the parsers ----

test('itr output is read in each shape it comes in', () => {
  expect(parseItr(JSON.stringify(issue(7, 'One'))).issues.map(one => one.id)).toEqual([7])
  expect(parseItr(JSON.stringify([issue(1, 'A'), issue(2, 'B')])).issues.map(one => one.title)).toEqual(['A', 'B'])
  expect(parseItr('[]')).toEqual({ issues: [], isMissingDatabase: false })
  expect(parseItr(NO_DATABASE)).toEqual({ issues: [], isMissingDatabase: true })
  expect(parseItr('{"error":"locked","code":"BUSY"}')).toEqual({ issues: [], isMissingDatabase: false })
  // itr may say a line of its own before the JSON.
  expect(parseItr('REVIEW: issue 9 not found; skipped\n[{"id":4,"status":"done"}]').issues[0]).toMatchObject({
    id: 4,
    status: 'done',
    title: '',
  })
  expect(parseItr('not json at all').issues).toEqual([])

  const read = parseItr(
    JSON.stringify(issue(3, 'T', { tags: ['next-lane'], assigned_to: 'claude', blocked_by: [1, 2], updated_at: '2026-07-16T05:37:58Z' })),
  ).issues[0]

  expect(read).toMatchObject({ tags: ['next-lane'], assignee: 'claude', blockedBy: [1, 2] })
  expect(read?.updatedAt).toBe(Date.parse('2026-07-16T05:37:58Z'))
})

test('the rank-1 lane is read from the digest table, or from its first numbered item', () => {
  expect(parseNext(NEXT_MD)).toEqual({
    name: 'Upload hardening',
    ids: [13, 12, 8],
    why: 'The queue drops jobs under load.',
  })
  // The row ranked 1 wins wherever it sits.
  expect(
    parseNext(['| Rank | Lane |', '|---|---|', '| 2 | Later (#5) |', '| 1 | Sooner (#6) |'].join('\n')),
  ).toMatchObject({ name: 'Sooner (#6)', ids: [6] })
  expect(parseNext('# Next\n\n1. **Ship the importer** (#41, #42)\n2. Then docs\n')).toEqual({
    name: 'Ship the importer (#41, #42)',
    ids: [41, 42],
    why: '',
  })
  expect(parseNext('# Next\n\nNothing ranked here.\n')).toBeUndefined()
})

test('roadmap rows carry their status, their linked issues and whether they are past the release', () => {
  expect(parseRoadmap(ROADMAP)).toEqual([
    // #31 is said to be open in the row itself, and #99 sits in the notes: neither is a linked claim of done.
    { title: '§A.1 Core', status: 'done', ids: [30], isDeferred: false },
    { title: '§A.2 Upload', status: 'partial', ids: [12], isDeferred: false },
    { title: '§A.3 Dashboard', status: 'todo', ids: [20], isDeferred: false },
    { title: '§B.1 Sync', status: 'todo', ids: [], isDeferred: true },
  ])
  expect(parseRoadmap('## Plan\n- [x] Importer (#41)\n- [ ] Exporter (itr#42)\n- plain bullet ✅\n')).toEqual([
    { title: 'Importer (#41)', status: 'done', ids: [41], isDeferred: false },
    { title: 'Exporter (itr#42)', status: 'todo', ids: [42], isDeferred: false },
  ])
})

test('a documented procedure and a next recipe are recognised by their heading and their name', () => {
  expect(procedureOf('# Project\n\n## Finding Next Work\n\nRun the script.\n')).toBe('Finding Next Work')
  expect(procedureOf("## What's next\n")).toBe("What's next")
  expect(procedureOf('## Testing\n\nwhat is next work\n')).toBeUndefined()
  expect(hasNextRecipe('build:\n    cargo build\n\n# Show next\nnext:\n    itr ready\n')).toBe(true)
  expect(hasNextRecipe('next := "1.2.3"\nnext-work:\n    true\n')).toBe(false)
})

// ---- staleness, at its boundaries ----

test('a pointer is stale past seven days behind the last commit, not at seven', () => {
  expect(staleDaysOf(COMMIT - 7 * DAY_MS, COMMIT)).toBe(0)
  expect(staleDaysOf(COMMIT - 7 * DAY_MS - 1, COMMIT)).toBe(7)
  expect(staleDaysOf(COMMIT - 9 * DAY_MS - HOUR_MS, COMMIT)).toBe(9)
  // A file newer than the commit, or no commit at all, is never stale.
  expect(staleDaysOf(COMMIT + DAY_MS, COMMIT)).toBe(0)
  expect(staleDaysOf(1, 0)).toBe(0)

  const at = (mtimeMs: number) =>
    reconcile(raw({ sprintCurrent: { text: 'sprint-3-x\n', mtimeMs }, isSprintFolderThere: true })).flags.map(flag => flag.text)

  expect(at(COMMIT - 7 * DAY_MS)).toEqual([])
  expect(at(COMMIT - 7 * DAY_MS - 1)).toEqual(['⚠ sprint/CURRENT stale (7d behind git)'])
})

test('each pointer the cross-check names gets the badge: the sprint pointer, the roadmap, the latest handoff', () => {
  const old = COMMIT - 10 * DAY_MS
  const found = reconcile(
    raw({
      sprintCurrent: { text: 'sprint-3-x\n', mtimeMs: old },
      isSprintFolderThere: true,
      roadmap: { path: 'ROADMAP.md', text: ROADMAP, mtimeMs: old },
      handoff: { path: 'docs/state-of-play.md', mtimeMs: old },
      nextMd: { text: NEXT_MD, mtimeMs: old },
      campaignCurrent: { text: 'campaign-002-x\n', mtimeMs: old },
      campaignJson: '{"status":"complete"}',
    }),
  )

  expect(found.flags.filter(flag => flag.kind === 'stale').map(flag => flag.text)).toEqual([
    '⚠ sprint/CURRENT stale (10d behind git)',
    '⚠ ROADMAP.md stale (10d behind git)',
    '⚠ docs/state-of-play.md stale (10d behind git)',
  ])
  expect(found.pointers.find(pointer => pointer.kind === 'campaign')?.detail).toBe('campaign-002-x (complete)')
})

test('a claim is stale past 48 hours without an update, not at 48', () => {
  expect(staleHoursOf(NOW - 48 * HOUR_MS, NOW)).toBe(0)
  expect(staleHoursOf(NOW - 48 * HOUR_MS - 1, NOW)).toBe(48)
  expect(staleHoursOf(0, NOW)).toBe(0)

  const claimed = (idleMs: number) =>
    stateOf(reconcile(raw({ itr: itr({ wip: [issue(9, 'Wire it', { assigned_to: 'codex', updated_at: iso(NOW - idleMs) })] }) })))[6]

  expect(claimed(48 * HOUR_MS)).toBe('**In progress:** #9 Wire it (codex)')
  expect(claimed(48 * HOUR_MS + 1000)).toBe('**In progress:** #9 Wire it (codex) ⚠ stale claim (48h idle)')
})

// ---- the reconciliation and its report ----

test('the report gives the fields of the template in its order', () => {
  const found = reconcile(worked())

  expect(stateOf(found)).toEqual([
    '## demo — state of play',
    'Last commit: abc1234 2026-10-02 feat: add upload queue · working tree: 2 dirty',
    'Handoff/sprint: sprint sprint-3-2026-09-20-upload · handoff docs/handoff/2026-10-01-upload.md',
    '',
    '**Lane/section next:** Upload hardening  (source: NEXT.md)',
    '**Task next:** #13 Add the retry budget  (why: rank-1 lane in docs/NEXT.md)',
    '**In progress:** #9 Wire the retry budget (codex) ⚠ stale claim (49h idle)',
    '**Ready behind it:** 3 ready, 1 blocked',
    '**Flags:** ⚠ docs/ROADMAP.md stale (9d behind git); roadmap marks "§A.1 Core" done, but #30 still open; #20 actually unblocked (#5 closed)',
  ])
  expect(reportOf(found).split('\n').at(-1)).toBe(CLOSING)
  expect(reportOf(found, { command: 'just next', output: 'one\ntwo', exitCode: 0 }).split('\n').slice(0, 6)).toEqual([
    '### just next',
    '```text',
    'one',
    'two',
    '```',
    '',
  ])
  expect(reportOf(found, { command: 'just next', output: 'boom', exitCode: 2 }).split('\n')[0]).toBe('### just next (exit 2)')
})

test('a long script output is cut to what a report can carry', () => {
  const cut = clip(`${Array.from({ length: 45 }, (_, at) => `line ${at + 1}`).join('\r\n')}\n\n`).split('\n')

  expect(cut).toHaveLength(31)
  expect(cut[29]).toBe('line 30')
  expect(cut[30]).toBe('… 15 more lines')
  expect(clip('x'.repeat(250))).toBe(`${'x'.repeat(200)}…`)
})

test('the pick follows the lane order, then the lane tag, then itr next', () => {
  const ready = [issue(12, 'Twelve'), issue(13, 'Thirteen', { tags: ['next-lane'] }), issue(14, 'Fourteen')]
  const all = [12, 13, 14].map(id => ({ id, status: 'open' }))
  const pick = (over: Partial<Raw>) => reconcile(raw({ itr: itr({ next: ready[0], ready, all }), ...over })).task

  expect(pick({ nextMd: { text: '| Rank | Lane | Tracker IDs |\n|---|---|---|\n| 1 | L | #14, #12 |\n', mtimeMs: COMMIT } })).toMatchObject({
    id: 14,
    why: 'rank-1 lane in docs/NEXT.md',
  })
  expect(pick({})).toMatchObject({ id: 13, why: 'next-lane tag' })
  expect(reconcile(raw({ itr: itr({ next: issue(12, 'Twelve'), ready: [issue(12, 'Twelve')] }) })).task).toMatchObject({
    id: 12,
    why: 'itr next',
  })
  expect(reconcile(raw({ itr: itr() })).task).toBeNull()

  // An issue somebody holds now is passed over; one whose claim went stale is still the pick, with doubt.
  const lane = { text: '| Rank | Lane | Tracker IDs |\n|---|---|---|\n| 1 | L | #12, #14 |\n', mtimeMs: COMMIT }
  const held = (idleMs: number) =>
    reconcile(
      raw({ nextMd: lane, itr: itr({ next: ready[0], ready, all, wip: [issue(12, 'Twelve', { updated_at: iso(NOW - idleMs) })] }) }),
    ).task

  expect(held(HOUR_MS)).toMatchObject({ id: 14, isDoubted: false })
  expect(held(72 * HOUR_MS)).toMatchObject({ id: 12, isDoubted: true })
})

test('a digest and a tracker that disagree are flagged, and the tracker is the one trusted', () => {
  const digest = { text: '| Rank | Lane | Tracker IDs |\n|---|---|---|\n| 1 | Old lane | #5, #6 |\n', mtimeMs: COMMIT }
  const closed = reconcile(
    raw({
      nextMd: digest,
      itr: itr({ next: issue(12, 'Twelve'), ready: [issue(12, 'Twelve')], all: [{ id: 5, status: 'done' }, { id: 6, status: 'wontfix' }] }),
    }),
  )

  expect(closed.task).toMatchObject({ id: 12, why: 'itr next' })
  expect(closed.flags).toEqual([
    { kind: 'digest', text: 'docs/NEXT.md rank 1 lists only tickets itr has closed: trust itr, fix the digest' },
  ])

  const held = reconcile(
    raw({ nextMd: digest, itr: itr({ next: issue(12, 'Twelve'), ready: [issue(12, 'Twelve')], all: [{ id: 5, status: 'open' }] }) }),
  )

  expect(held.flags.map(flag => flag.text)).toEqual(['docs/NEXT.md rank 1 has no ready ticket (blocked or claimed)'])
})

test('a sprint pointer that names no folder is flagged', () => {
  const found = reconcile(raw({ sprintCurrent: { text: 'sprint-9-gone\n', mtimeMs: COMMIT }, isSprintFolderThere: false }))

  expect(found.flags).toEqual([{ kind: 'pointer', text: 'sprint/CURRENT names sprint/sprint-9-gone, which is not there' }])
})

test('a project that documents its own procedure, or ships its own command, is pointed at rather than interpreted', () => {
  const found = reconcile(
    raw({
      instructions: [
        { path: 'CLAUDE.md', text: '# Demo\n\n## Finding Next Work\n\nRun the script.\n' },
        { path: 'AGENTS.md', text: '## Finding Next Work\n' },
      ],
      hasNextScript: true,
      justfile: 'next:\n    itr ready\n',
    }),
  )

  expect(found.flags).toEqual([
    {
      kind: 'procedure',
      text: 'this project documents its own procedure (CLAUDE.md § Finding Next Work): Ask ¤ has Claude follow it',
    },
  ])
  expect(found.script).toBe('scripts/next-work.sh')
  expect(reconcile(raw({ justfile: 'next:\n    itr ready\n' })).script).toBe('just next')
  expect(reportOf(found).split('\n')[0]).toBe('Project script: scripts/next-work.sh (not run for this report; /whats-next runs it)')
})

test('with no database the report says so and invents no tracker state', () => {
  const found = reconcile(
    raw({
      itr: { state: 'ok', next: NO_DATABASE, ready: '', wip: '', blocked: '', all: '' },
      roadmap: { path: 'docs/ROADMAP.md', text: ROADMAP, mtimeMs: COMMIT },
    }),
  )

  expect(found.tracker).toBe('no-database')
  expect(found.task).toBeNull()
  expect(stateOf(found).slice(4)).toEqual([
    '**Lane/section next:** 🟡 §A.2 Upload  (source: ROADMAP)',
    '**Task next:** no tracker (no .itr.db here): reconciled from the files and git alone',
    '**In progress:** —',
    '**Ready behind it:** —',
    '**Flags:** none',
  ])
  expect(stateOf(reconcile(raw({ itr: { state: 'no-binary' } })))[5]).toBe(
    '**Task next:** no tracker (itr is not on PATH): reconciled from the files and git alone',
  )
})

// ---- tsugi and the band ----

test('tsugi names one stone in three lines, and says so when the water is still', () => {
  expect(tsugiOf(reconcile(worked()))).toEqual(['次', '#13 — Add the retry budget', 'rank-1 lane in docs/NEXT.md · high'])
  // More than five words are cut; doubt is spoken as doubt.
  expect(
    tsugiOf(
      reconcile(
        raw({
          itr: itr({
            next: issue(9, 'Wire the retry budget into the queue worker'),
            wip: [issue(9, 'Wire the retry budget into the queue worker', { updated_at: iso(NOW - 72 * HOUR_MS) })],
          }),
        }),
      ),
    ),
  ).toEqual(['次', 'perhaps #9 — Wire the retry budget into…', 'itr next · high'])
  // No tracker at all: the dirtiest thing in the working tree is the stone.
  expect(
    tsugiOf(
      reconcile(
        raw({
          itr: { state: 'no-binary' },
          git: { log: LOG, status: ' M a.rs\n M src/big.rs\n?? new.md\n', numstat: '2\t1\ta.rs\n40\t12\tsrc/big.rs\n' },
        }),
      ),
    ),
  ).toEqual(['次', 'src/big.rs — uncommitted work', '3 dirty, no tracker'])
  // Paper alone: the first section the roadmap has not finished.
  expect(
    tsugiOf(reconcile(raw({ itr: { state: 'no-binary' }, roadmap: { path: 'docs/ROADMAP.md', text: ROADMAP, mtimeMs: COMMIT } }))),
  ).toEqual(['次', 'docs/ROADMAP.md — 🟡 §A.2 Upload', 'first open section'])
  expect(tsugiOf(reconcile(raw({ itr: itr() })))).toEqual([STILL])
  expect(tsugiOf(reconcile(raw({ itr: { state: 'no-binary' } })))).toEqual(['次 · the water is still.'])
})

test('the band line carries the stone, the counts and what has gone stale', () => {
  expect(bandOf(reconcile(worked()))).toEqual({
    calm: '次 #13 Add the retry budget · 3 ready · 2 flags',
    alarm: '⚠ docs/ROADMAP.md stale 9d · ⚠ 1 stale claim',
  })
  expect(bandOf(reconcile(raw({ itr: itr() })))).toEqual({ calm: '次 the water is still · 0 ready', alarm: '' })
  // Neither a tracker nor any pointer file: nothing to draw.
  expect(bandOf(reconcile(raw({ itr: { state: 'no-binary' } })))).toBeUndefined()
  expect(bandOf(reconcile(raw({ itr: { state: 'ok', next: NO_DATABASE, ready: '', wip: '', blocked: '', all: '' } })))).toBeUndefined()
})

// ---- through the engine ----

const BAND = {
  plugin: 'whats-next',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 160,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const PANE = {
  plugin: 'whats-next',
  component: 'Pane',
  requestId: 'whats-next',
  props: {
    title: "What's next",
    isFocused: true,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'

/** A project as the host would answer for it; a test changes it between calls. */
type Project = {
  isRepo: boolean
  dirty: string[]
  numstat: string
  tracker: 'missing' | 'no-database' | Lists
  /** Files by their path from the root. */
  files: Record<string, { text: string; mtimeMs: number }>
  folders: string[]
  scriptOut: string
  isPanePlaced: boolean
  /** Command names the engine refuses to register, each with its reason. */
  refusals: Record<string, string>
}

const project = (over: Partial<Project> = {}): Project => ({
  isRepo: true,
  dirty: [],
  numstat: '',
  tracker: { next: issue(12, 'Fix upload race'), ready: [issue(12, 'Fix upload race'), issue(13, 'Add the retry budget')], all: [] },
  files: {},
  folders: [],
  scriptOut: '',
  isPanePlaced: true,
  refusals: {},
  ...over,
})

/** A path as the test spells it: the host hands the file system an absolute one of its own. */
const spelled = (path: string) => path.replace(/^[A-Za-z]:(?=[\\/]repo)/, '').replace(/\\/g, '/')
const inRepo = (path: string) => spelled(path).replace(/^\/repo\/?/, '')

/** The world beneath the mod: git, itr and the files answered from `state`, and what the mod did. */
const world = (on: On, state: Project) => {
  const toasts: string[] = []
  const submitted: string[] = []
  const ran: string[] = []
  const opened: string[] = []
  const clock = mock.clock(on, { now: NOW })
  const out = (stdout: string, exitCode = 0) => ({
    value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  })

  mock.env(on, { OS: 'Windows_NT' })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/repo' }))
  on('command.register', (_$, e) => {
    const refusal = state.refusals[e.name]

    // A throw here would read as "no implementation": a deny is what rejects the caller with its reason.
    if (refusal !== undefined) return { deny: `"/${e.name}" refused: ${refusal}` }

    return { value: { command: e.name } }
  })
  on('tool.register', (_$, e) => ({ value: { tool: `mcp__whats-next__${e.name}` } }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)

    return { text: e.text }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.open', (_$, e) => {
    opened.push(e.id)

    return { value: state.isPanePlaced ? { isPlaced: true as const } : { isPlaced: false as const, reason: 'no room' } }
  })
  on('process.run', (_$, e) => {
    const [exe = '', ...rest] = e.argv
    const args = rest.filter(arg => arg !== '--no-optional-locks')

    ran.push([exe, ...args].join(' '))

    if (exe === 'git') {
      if (!state.isRepo) return out('', 128)
      if (args[0] === 'rev-parse') return out('/repo\n')
      if (args[0] === 'log') return out(`${LOG}\n`)
      if (args[0] === 'status') return out(state.dirty.join('\n'))
      if (args[0] === 'diff') return out(state.numstat)
    }

    if (exe === 'itr') {
      if (state.tracker === 'missing') throw new Error('spawn itr ENOENT')
      if (state.tracker === 'no-database') return out(NO_DATABASE)
      if (args[0] === 'next') return out(JSON.stringify(state.tracker.next ?? []))
      if (args[0] === 'ready') return out(JSON.stringify(state.tracker.ready ?? []))
      if (args[0] === 'wip') return out(JSON.stringify(state.tracker.wip ?? []))
      if (args.includes('--blocked')) return out(JSON.stringify(state.tracker.blocked ?? []))
      if (args.includes('--all')) return out(JSON.stringify(state.tracker.all ?? []))
    }

    if (exe === 'where.exe') return out('C:\\Program Files\\Git\\cmd\\git.exe\r\n')
    if (exe === 'just' || exe === GIT_BASH) return out(state.scriptOut)

    return out('', 1)
  })
  on('fs.stat', (_$, e) => {
    const file = state.files[inRepo(e.path)]

    if (file === undefined) throw new Error(`ENOENT: ${e.path}`)

    return { value: { kind: 'file' as const, size: file.text.length, mtimeMs: file.mtimeMs, isLink: false } }
  })
  on('fs.read', (_$, e) => {
    const file = state.files[inRepo(e.path)]

    if (file === undefined) throw new Error(`ENOENT: ${e.path}`)

    return { value: file.text }
  })
  on('fs.list', (_$, e) => {
    const folder = `${inRepo(e.path ?? '')}/`
    const names = Object.keys(state.files).filter(path => path.startsWith(folder) && !path.slice(folder.length).includes('/'))

    if (names.length === 0) throw new Error(`ENOENT: ${e.path}`)

    return {
      value: names.map(path => ({
        name: path.slice(folder.length),
        kind: 'file' as const,
        size: 1,
        mtimeMs: state.files[path]?.mtimeMs ?? 0,
        isLink: false,
      })),
    }
  })
  on('fs.exists', (_$, e) => ({
    value: e.path === GIT_BASH || inRepo(e.path) in state.files || state.folders.includes(inRepo(e.path)),
  }))
  // What another mod, or the engine, draws in the band beneath this one.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text>beneath</Text>
      </Box>
    )
  })

  return { toasts, submitted, ran, opened, clock }
}

const start = async ($: Engine, clock: MockClock) => {
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await clock.settle()
}

const command = ($: Engine, name: string, args = '') =>
  $.command.run({
    command: name,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

/** Every line of text the band draws, in order. */
const bandTexts = async ($: Engine) => {
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = (await band.findAll({ type: 'Text' })).map(found => found.text)

  await band.unmount()

  return texts
}

const ranScripts = (ran: readonly string[]) => ran.filter(line => line.startsWith('just ') || line.startsWith(GIT_BASH))

test('the band shows the next item above whatever is drawn beneath it', async ($, on) => {
  const { clock } = world(on, project())

  await start($, clock)

  expect(await bandTexts($)).toEqual(['次 #12 Fix upload race · 2 ready', LEGEND, 'beneath'])

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect((await band.findAll({ type: 'Button' })).map(found => [found.text, found.props['hotkey']])).toEqual([
    ['Start ¤', 'g'],
    ['Ask ¤', 'e'],
  ])
  await band.unmount()
})

test('with neither a tracker nor a pointer file the band draws nothing of its own', async ($, on) => {
  const { clock, toasts } = world(on, project({ tracker: 'missing' }))

  await start($, clock)

  expect(await bandTexts($)).toEqual(['beneath'])
  expect(toasts).toEqual([])
})

test('a stale pointer and a stale claim stand out in the band', async ($, on) => {
  const { clock } = world(
    on,
    project({
      dirty: [' M src/a.rs', '?? notes.md'],
      tracker: {
        next: issue(12, 'Fix upload race'),
        ready: [issue(12, 'Fix upload race')],
        wip: [issue(9, 'Wire it', { assigned_to: 'codex', updated_at: iso(NOW - 60 * HOUR_MS) })],
      },
      files: { 'sprint/CURRENT': { text: 'sprint-3-x\n', mtimeMs: COMMIT - 9 * DAY_MS } },
      folders: ['sprint/sprint-3-x'],
    }),
  )

  await start($, clock)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const alarm = await band.find({ type: 'Text', text: '⚠' })

  expect(alarm?.text).toBe('⚠ sprint/CURRENT stale 9d · ⚠ 1 stale claim')
  expect(alarm?.props['color']).toBe('warning')
  await band.unmount()
  expect((await command($, 'whats-next', '--start')).text?.split('\n')[1]).toBe(
    'Last commit: abc1234 2026-10-02 feat: add upload queue · working tree: 2 dirty',
  )
})

test('names a skill of the person\'s own still holds are answered all the same, and only a real refusal is said', async ($, on) => {
  // The engine's refusals, as it words them.
  const { clock, toasts } = world(on, project({ refusals: { tsugi: "it is the user's /tsugi", start: 'it is a built-in' } }))

  await start($, clock)

  expect(toasts).toEqual([
    'What\'s next: /start (whats-next: $.command.register: "/start" refused: it is a built-in) could not be registered.',
  ])
  expect((await command($, 'tsugi')).text).toBe('次\n#12 — Fix upload race\nitr next · high')
})

test('a folder that is no repository is still read, and with no commit nothing is called stale', async ($, on) => {
  const { clock } = world(
    on,
    project({
      isRepo: false,
      tracker: 'no-database',
      files: { 'docs/ROADMAP.md': { text: ROADMAP, mtimeMs: COMMIT - 30 * DAY_MS } },
    }),
  )

  await start($, clock)

  // No commit to lag behind: the roadmap is read, and nothing is called stale.
  expect(await bandTexts($)).toEqual(['次 docs/ROADMAP.md 🟡 §A.2 Upload', LEGEND, 'beneath'])
})

test('the band switch in the options turns the line off and leaves the commands', { options: { band: false } }, async ($, on) => {
  const { clock } = world(on, project())

  await start($, clock)

  expect(await bandTexts($)).toEqual(['beneath'])
  expect((await command($, 'tsugi')).text).toBe('次\n#12 — Fix upload race\nitr next · high')
})

test('/tsugi answers in three lines with no turn, and names still water', async ($, on) => {
  const state = project({
    files: { 'sprint/CURRENT': { text: 'sprint-3-x\n', mtimeMs: COMMIT } },
    folders: ['sprint/sprint-3-x'],
  })
  const { clock, submitted } = world(on, state)

  await start($, clock)

  expect((await command($, 'tsugi')).text).toBe('次\n#12 — Fix upload race\nitr next · high')

  state.tracker = {}
  expect((await command($, 'tsugi')).text).toBe('次 · the water is still.')
  await clock.advance(1000)
  expect(submitted).toEqual([])
})

test('/whats-next opens the pane with the report, and only then runs the project\'s own command', async ($, on) => {
  const state = project({
    files: {
      justfile: { text: 'next:\n    itr ready\n', mtimeMs: COMMIT },
      'docs/handoff/2026-09-01-old.md': { text: 'old', mtimeMs: COMMIT - 20 * DAY_MS },
      'docs/handoff/2026-10-01-new.md': { text: 'new', mtimeMs: COMMIT },
    },
    scriptOut: 'lane one\nlane two\n',
  })
  const { clock, ran, opened, submitted } = world(on, state)

  await start($, clock)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.settle()

  // Neither the start of the session nor the end of a turn runs the project's code.
  expect(ranScripts(ran)).toEqual([])

  expect((await command($, 'whats-next')).text).toBe('次 #12 Fix upload race · 2 ready')
  expect(opened).toEqual(['whats-next'])
  expect(ranScripts(ran)).toEqual(['just next'])

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const texts = (await pane.findAll({ type: 'Text' })).map(found => found.text)
  const fields = (await pane.findAll({ type: 'Markdown' })).map(found => found.text)

  expect(texts.slice(0, 4)).toEqual(['just next', 'lane one', 'lane two', ' '])
  expect(texts).toContain('repo — state of play')
  expect(fields).toEqual([
    'Last commit: abc1234 2026-10-02 feat: add upload queue · working tree: clean',
    'Handoff/sprint: handoff docs/handoff/2026-10-01-new.md',
    '**Lane/section next:** —  (source: itr-only)',
    '**Task next:** #12 Fix upload race  (why: itr next)',
    '**In progress:** nothing claimed',
    '**Ready behind it:** 2 ready, 0 blocked',
    '**Flags:** none',
  ])
  expect((await pane.findAll({ type: 'Button' })).map(found => found.text)).toEqual(['Refresh', 'Start ¤', 'Ask ¤'])
  expect(await pane.find({ type: 'Text', text: LEGEND })).toBeDefined()

  state.scriptOut = 'lane three\n'
  await pane.press({ key: 'next-refresh' })
  expect((await pane.findAll({ type: 'Text' })).map(found => found.text).slice(0, 2)).toEqual(['just next', 'lane three'])
  await pane.unmount()
  expect(submitted).toEqual([])
})

test('with no room for the pane the report is the command\'s output, a shell script run through Git Bash', async ($, on) => {
  const { clock, ran } = world(
    on,
    project({
      isPanePlaced: false,
      files: { 'scripts/next-work.sh': { text: '#!/usr/bin/env bash\n', mtimeMs: COMMIT } },
      scriptOut: 'digest\n',
    }),
  )

  await start($, clock)

  const lines = ((await command($, 'whats-next')).text ?? '').split('\n')

  expect(lines.slice(0, 4)).toEqual(['### scripts/next-work.sh', '```text', 'digest', '```'])
  expect(lines).toContain('**Task next:** #12 Fix upload race  (why: itr next)')
  expect(lines.at(-1)).toBe(CLOSING)
  expect(ranScripts(ran)).toEqual([`${GIT_BASH} scripts/next-work.sh`])
})

test('the report tool answers the model with the same report and runs no project command', async ($, on) => {
  const { clock, ran, submitted } = world(
    on,
    project({ files: { justfile: { text: 'next:\n    itr ready\n', mtimeMs: COMMIT } }, scriptOut: 'x' }),
  )

  await start($, clock)

  const answer = await $.tool.call({ tool: 'mcp__whats-next__report' })
  const lines = String(answer.result).split('\n')

  expect(lines[0]).toBe('Project script: just next (not run for this report; /whats-next runs it)')
  expect(lines).toContain('**Task next:** #12 Fix upload race  (why: itr next)')
  expect(lines.at(-1)).toBe(CLOSING)
  expect(ranScripts(ran)).toEqual([])
  await clock.advance(1000)
  expect(submitted).toEqual([])
})

test('Start hands Claude the pick to claim, and names a stale claim on it', async ($, on) => {
  const state = project({
    tracker: {
      next: issue(12, 'Fix upload race'),
      ready: [issue(12, 'Fix upload race')],
      wip: [issue(12, 'Fix upload race', { assigned_to: 'codex', updated_at: iso(NOW - 50 * HOUR_MS) })],
    },
  })
  const { clock, submitted, ran } = world(on, state)

  await start($, clock)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'next-start' })
  expect(submitted).toEqual([])
  await clock.advance(50)
  await band.unmount()

  expect(submitted).toHaveLength(1)

  const lines = (submitted[0] ?? '').split('\n')

  expect(lines[0]).toBe(
    "[whats-next] Begin #12 Fix upload race. Claim it first with `itr claim 12`, the only tracker write before real work begins, then do the work per this project's conventions: verification gates through gatr, evidence before close, and commit the work as it lands unless told otherwise.",
  )
  expect(lines[1]).toBe('#12 carries a stale claim by codex (no update in 50h): say so before taking it.')
  expect(lines).toContain('**Task next:** perhaps #12 Fix upload race  (why: itr next)')
  // The mod itself claims nothing: every itr call it made is a read.
  expect(ran.filter(line => line.startsWith('itr ')).every(line => /^itr (next|ready|wip|list) /.test(line))).toBe(true)
})

test('Start with no pick, and /start, hand Claude the generic start', async ($, on) => {
  const { clock, submitted } = world(on, project({ tracker: {}, files: { 'ROADMAP.md': { text: '# Roadmap\n', mtimeMs: COMMIT } } }))

  await start($, clock)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'next-start' })
  await clock.advance(50)
  await band.unmount()

  expect(submitted).toEqual([START_BODY])

  expect((await command($, 'start')).text).toBeUndefined()
  await clock.advance(50)
  expect(submitted).toEqual([START_BODY, START_BODY])
  expect(START_BODY.split('\n')[0]).toBe('Start the next thing, whatever it is.')
})

test('/whats-next --start prints the report, then begins the top item or the one named', async ($, on) => {
  const { clock, submitted } = world(on, project())

  await start($, clock)

  const shown = (await command($, 'whats-next', '--start')).text ?? ''

  expect(shown.split('\n')).toContain('**Task next:** #12 Fix upload race  (why: itr next)')
  expect(submitted).toEqual([])
  await clock.advance(50)
  expect(submitted[0]?.startsWith('[whats-next] Begin #12 Fix upload race. Claim it first with `itr claim 12`')).toBe(true)

  await command($, 'whats-next', '--start #13')
  await clock.advance(50)
  expect(submitted[1]?.startsWith('[whats-next] Begin #13. Claim it first with `itr claim 13`')).toBe(true)
})

test('Ask hands Claude the report-only instructions with what was gathered', async ($, on) => {
  const { clock, submitted } = world(
    on,
    project({ files: { 'CLAUDE.md': { text: '# Demo\n\n## Finding Next Work\n\nRun the script.\n', mtimeMs: COMMIT } } }),
  )

  await start($, clock)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'next-ask' })
  await clock.advance(50)
  await band.unmount()

  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toContain('[whats-next] Answer "what is next / what\'s left / where did we leave off" for this project')
  expect(submitted[0]).toContain('NEVER claim, close, edit, or begin anything here')
  expect(submitted[0]).toContain(
    '**Flags:** this project documents its own procedure (CLAUDE.md § Finding Next Work): Ask ¤ has Claude follow it',
  )
})

test('the end of a main turn gathers again; a subagent\'s does not', async ($, on) => {
  const state = project()
  const { clock, ran } = world(on, state)
  const turn = (agentId?: string) =>
    $.turn.complete({
      answer: 'done',
      durationMs: 1,
      isAborted: false,
      turnId: 't1',
      reason: 'answer',
      ...(agentId === undefined ? {} : { agentId }),
    })

  await start($, clock)

  const before = ran.length

  await turn('agent-1')
  await clock.settle()
  expect(ran).toHaveLength(before)

  state.tracker = { next: issue(13, 'Add the retry budget'), ready: [issue(13, 'Add the retry budget')] }
  await turn()
  await clock.settle()
  expect((await bandTexts($))[0]).toBe('次 #13 Add the retry budget · 1 ready')
})
