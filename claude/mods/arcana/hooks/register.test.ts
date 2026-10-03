import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = '/work/project'
const STARTED = Date.parse('2026-10-03T12:00:00Z')
const SETTINGS_HOOKS = {
  hooks: {
    PreToolUse: [{ hooks: [{ type: 'command', command: 'arcana hook pre' }] }],
  },
}
const EDIT = {
  tool: 'Edit',
  file_path: `${CWD}/src/parser.rs`,
  old_string: 'a',
  new_string: 'b',
} as const
const PANE = {
  plugin: 'arcana',
  component: 'Pane',
  requestId: 'arcana-feed',
  props: {
    title: 'arcana feed',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

// One line of `arcana lore recent`, as the binary prints it.
const recorded = (
  seq: number,
  session: string,
  path: string,
  ts: string,
  prompt: string,
) =>
  JSON.stringify({
    seq,
    session_id: session,
    agent_id: 'claude',
    tool: 'Edit',
    path,
    op: 'edit',
    parent_hash: null,
    content_hash: 'c0ffee',
    scope: [],
    prompt,
    prompt_hash: 'feed',
    intent: 'Fix',
    priority: 'High',
    blocking: false,
    ts,
  })

// The engine hands a hook the path made absolute for the platform it runs on.
const endsWith = (path: string, tail: string) =>
  path.replaceAll('\\', '/').endsWith(tail)

type World = {
  hasProject?: boolean
  hasBinary?: boolean
  settings?: Record<string, unknown>
  isArcanaFailing?: boolean
  stored?: Record<string, unknown>
  // The lines `arcana lore recent` prints.
  recent?: string[]
}

// The world beneath the mod: what it stats, runs, stores and draws, kept for the test to read.
const world = (on: On, given: World = {}) => {
  const runs: { argv: readonly string[]; stdin?: string }[] = []
  const status: (string | undefined)[] = []
  const toasts: string[] = []
  const stored: Record<string, unknown> = { ...given.stored }
  const log = { mtimeMs: 1, recent: given.recent ?? [] }
  const time = mock.clock(on, { now: STARTED })

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: 'edited' }))
  on('session.id', () => ({ value: 'session-1' }))
  on('session.cwd', () => ({ value: CWD }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('settings.read', () => ({ value: given.settings ?? {} }))
  on('store.get', (_$, e) => ({ value: stored[e.key] }))
  on('store.set', (_$, e) => {
    stored[e.key] = e.value

    return { value: undefined }
  })
  on('ui.status', (_$, e) => {
    status.push(e.text)

    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('fs.stat', (_$, e) => {
    if (given.hasProject === false) return { deny: `no such path: ${e.path}` }
    if (endsWith(e.path, `${CWD}/.arcana`)) {
      return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } }
    }
    if (endsWith(e.path, `${CWD}/.arcana/changesets.jsonl`)) {
      return {
        value: { kind: 'file', size: 1, mtimeMs: log.mtimeMs, isLink: false },
      }
    }

    return { deny: `no such path: ${e.path}` }
  })
  on('process.run', (_$, e) => {
    runs.push({ argv: e.argv, stdin: e.init?.stdin })
    if (given.hasBinary === false) return { deny: 'arcana: command not found' }
    const isHook = e.argv[1] === 'hook'
    const isFeed = e.argv[1] === 'lore'

    return {
      value: {
        exitCode: isHook && given.isArcanaFailing === true ? 1 : 0,
        stdout: isFeed ? log.recent.join('\n') : '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })

  const hooks = () => runs.filter(run => run.argv[1] === 'hook')
  const feeds = () => runs.filter(run => run.argv[1] === 'lore')
  // Another line lands in the changeset log, as another session's hook writes it.
  const land = (line: string) => {
    log.recent = [...log.recent, line]
    log.mtimeMs += 1
  }

  return { runs, hooks, feeds, status, toasts, stored, time, land }
}

const start = { cwd: CWD, surface: 'terminal', isInteractive: true } as const
const typed = (args: string) =>
  ({
    command: 'arcana',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  }) as const

test('captures the prompt and the edit when no settings hook does', async ($, on) => {
  const { hooks, status } = world(on)

  await $.session.start(start)
  await $.turn.start({ text: 'fix the parser', turnId: 'turn-1' })
  await $.tool.call(EDIT)

  expect(hooks().map(run => run.argv.join(' '))).toEqual([
    'arcana hook prompt',
    'arcana hook pre',
    'arcana hook post',
  ])
  const [prompt, pre, post] = hooks().map(run => JSON.parse(run.stdin ?? '{}'))
  expect(prompt).toEqual({
    session_id: 'session-1',
    prompt_id: 'turn-1',
    prompt: 'fix the parser',
  })
  expect(pre.prompt_id).toBe('turn-1')
  expect(pre.tool_name).toBe('Edit')
  expect(post.tool_input.file_path).toBe(EDIT.file_path)
  expect(status.at(-1)).toBe('arcana: 1 edit this session (mod captures)')
})

test('stands down when the settings hooks already capture', async ($, on) => {
  const { hooks, status } = world(on, { settings: SETTINGS_HOOKS })

  await $.session.start(start)
  await $.turn.start({ text: 'fix the parser', turnId: 'turn-1' })
  await $.tool.call(EDIT)

  expect(hooks()).toHaveLength(0)
  expect(status.at(-1)).toBe('arcana: 1 edit this session (hooks capture)')
})

test('/arcana off stops capture, the feed and the status line', async ($, on) => {
  const { hooks, feeds, status, stored, time } = world(on)

  await $.session.start(start)
  const answer = await $.command.run(typed('off'))
  await $.turn.start({ text: 'fix the parser', turnId: 'turn-1' })
  await $.tool.call(EDIT)
  const before = feeds().length
  await time.advance(60_000)

  expect(answer.text).toMatch(/is off/)
  expect(hooks()).toHaveLength(0)
  expect(feeds()).toHaveLength(before)
  expect(status.at(-1)).toBeUndefined()
  expect(stored.enabled).toBe(false)
})

test('stays off in a session that starts after /arcana off', async ($, on) => {
  const { runs, status } = world(on, { stored: { enabled: false } })

  await $.session.start(start)
  await $.tool.call(EDIT)

  expect(runs).toHaveLength(0)
  expect(status.at(-1)).toBeUndefined()
})

test('a failing arcana never fails the tool call', async ($, on) => {
  const { status } = world(on, { isArcanaFailing: true })

  await $.session.start(start)
  const ran = await $.tool.call(EDIT)

  expect(ran.deny).toBeUndefined()
  expect(ran.result).toBe('edited')
  expect(status.at(-1)).toBe(
    'arcana: 1 edit this session (mod captures, 2 not recorded)',
  )
})

test('says so when the binary is missing', async ($, on) => {
  const { hooks, status } = world(on, {
    hasBinary: false,
    settings: SETTINGS_HOOKS,
  })

  await $.session.start(start)
  await $.tool.call(EDIT)

  expect(hooks()).toHaveLength(0)
  expect(status.at(-1)).toBe('arcana: binary not found, nothing is captured')
})

test('stays quiet outside an arcana project', async ($, on) => {
  const { runs, status } = world(on, { hasProject: false })

  await $.session.start(start)
  await $.tool.call(EDIT)

  expect(runs).toHaveLength(0)
  expect(status.at(-1)).toBeUndefined()
})

test('the feed lists what was recorded, on every surface that draws a pane', async ($, on) => {
  world(on, {
    settings: SETTINGS_HOOKS,
    recent: [
      recorded(3, 'session-1', `${CWD}/src/parser.rs`, '2026-10-03T12:05:00Z', 'fix the parser'),
      recorded(4, 'session-2', `${CWD}/src/lexer.rs`, '2026-10-03T12:06:00Z', 'tighten\nthe lexer'),
    ],
  })

  await $.session.start(start)
  const answer = await $.command.run(typed('feed'))
  expect(answer.text).toBe('arcana feed opened.')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Text', text: /edit +src\/parser\.rs/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\* edit +src\/lexer\.rs/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'fix "tighten the lexer"' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'changed by another session' })).toBeDefined()
    await ui.unmount()
  }
})

test('the feed picks up what another session records while it is open', async ($, on) => {
  const { time, land } = world(on, { settings: SETTINGS_HOOKS })

  await $.session.start(start)
  await $.command.run(typed('feed'))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No writes or edits recorded yet.' })).toBeDefined()

  land(recorded(9, 'session-2', `${CWD}/src/lexer.rs`, '2026-10-03T12:06:00Z', 'tighten the lexer'))
  await time.advance(3000)

  expect(await ui.find({ type: 'Text', text: /src\/lexer\.rs/ })).toBeDefined()
  await ui.unmount()
})

test('warns once when another session changed the file since this one started', async ($, on) => {
  const { toasts } = world(on, {
    settings: SETTINGS_HOOKS,
    recent: [
      recorded(7, 'session-2', EDIT.file_path, '2026-10-03T12:41:00Z', 'tighten the lexer'),
    ],
  })

  await $.session.start(start)
  const ran = await $.tool.call(EDIT)
  await $.tool.call(EDIT)

  expect(ran.result).toBe('edited')
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toMatch(/another session changed src\/parser\.rs at \d\d:\d\d for "tighten the lexer"/)
})

test('does not warn about its own edits, other files or older changes', async ($, on) => {
  const { toasts } = world(on, {
    settings: SETTINGS_HOOKS,
    recent: [
      recorded(5, 'session-1', EDIT.file_path, '2026-10-03T12:30:00Z', 'ours'),
      recorded(6, 'session-2', `${CWD}/src/lexer.rs`, '2026-10-03T12:31:00Z', 'another file'),
      recorded(4, 'session-2', EDIT.file_path, '2026-10-03T11:00:00Z', 'before this session'),
    ],
  })

  await $.session.start(start)
  await $.tool.call(EDIT)

  expect(toasts).toHaveLength(0)
})
