import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import { briefOf, clockText, isScriptOf, parseSync, reportOf } from '../hooks/register'
import type { UnityStatus } from '../types'

const ROOT = '/proj'
const NOW = Date.parse('2026-10-03T12:00:00Z')
const LEGEND = '¤ uses tokens'

/** What tools/unity.ps1 printed for `sync` against a stand-in editor holding five console entries. */
const SYNC_ERRORS = String.raw`Refreshing assets and waiting for compile...
4 error(s):
  [Error] Assets\Scripts\Player.cs(42,17): error CS1002: ; expected
  [Error] Assets\Scripts\Enemy.cs(8,1): error CS0103: The name 'hp' does not exist in the current context
  [Exception] NullReferenceException: Object reference not set to an instance of an object
Game.Boot.Start () (at Assets/Scripts/Boot.cs:12)
  [Error] Assets\Scripts\Player.cs(42,17): error CS1002: ; expected
`
const SYNC_CLEAN = 'Refreshing assets and waiting for compile...\nCompile clean.\n'
/** `ping`, as the script prints the editor's answer. */
const PONG = '{\n    "pong":  true,\n    "unityVersion":  "6000.0.0f1",\n    "project":  "Fake",\n    "editorTime":  12.5\n}\n'
/** What PowerShell writes to standard error when the script's wait on the editor runs out. */
const timedOut = (cmd: string, seconds: number) =>
  [
    `Timed out after ${seconds}s waiting for '${cmd}'. Is the Unity Editor open on this project? Check .claude-bridge/bridge-alive.json`,
    String.raw`At C:\proj\tools\unity.ps1:75 char:5`,
    '+     throw "Timed out after ${Timeout}s waiting for \'$Cmd\'. Is the Uni ...',
    '    + CategoryInfo          : OperationStopped: (Timed out after...idge-alive.json:String) [], RuntimeException',
  ].join('\n')

const BAND = {
  plugin: 'unity-sync',
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

/** The project and the editor as the mod meets them; a test changes them between calls. */
type Unity = {
  hasScript: boolean
  /** Packages/com.blue.claude-bridge is a folder of the project. */
  hasPackage: boolean
  /** Packages/manifest.json, when the project has one. */
  manifest: string | undefined
  isAlive: boolean
  /** What `sync` prints, how it exits, and what it writes to standard error. */
  syncOut: string
  syncExit: number
  syncErr: string
  /** How long a sync takes, on the mocked clock. */
  syncMs: number
  /** The PowerShells this machine has. */
  shells: string[]
}

const unity = (over: Partial<Unity> = {}): Unity => ({
  hasScript: true,
  hasPackage: true,
  manifest: undefined,
  isAlive: true,
  syncOut: SYNC_CLEAN,
  syncExit: 0,
  syncErr: '',
  syncMs: 0,
  shells: ['powershell', 'pwsh'],
  ...over,
})

const ran = (exitCode: number, stdout: string, stderr: string) => ({
  value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

/** The world beneath the mod: the project's files, the bridge's script, and what the mod said. */
const world = (on: On, state: Unity) => {
  const toasts: string[] = []
  const submitted: string[] = []
  const commands: string[] = []
  /** Each run of the script: its shell and the script's own arguments. */
  const runs: string[] = []
  const written = new Map<string, unknown>()
  const clock = mock.clock(on, { now: NOW })
  // The test kit hands a path over as the host spells it: compare from the project down.
  const under = (path: string) => path.replace(/\\/g, '/').replace(/^.*\/proj\//, '')

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: ROOT }))
  on('command.register', (_$, e) => {
    commands.push(e.name)

    return { value: { command: e.name } }
  })
  on('state.set', (_$, e, next) => {
    written.set(e.key, e.value)

    return next(e)
  })
  on('fs.exists', (_$, e) => {
    const path = under(e.path)

    return {
      value:
        (path === 'tools/unity.ps1' && state.hasScript) ||
        (path === 'Packages/com.blue.claude-bridge' && state.hasPackage),
    }
  })
  on('fs.read', (_$, e) => {
    if (under(e.path) !== 'Packages/manifest.json' || state.manifest === undefined) {
      throw new Error('ENOENT')
    }

    return { value: state.manifest }
  })
  on('process.run', async (_$, e) => {
    const [shell = '', ...rest] = e.argv
    const args = rest.slice(rest.indexOf('-File') + 2)

    if (!state.shells.includes(shell)) {
      return { deny: `${shell} failed to start: ENOENT` }
    }

    runs.push(`${shell} ${args.join(' ')}`)

    if (args[0] === 'ping') {
      return state.isAlive ? ran(0, PONG, '') : ran(1, '', timedOut('ping', 5))
    }

    if (state.syncMs > 0) {
      await clock.sleep(state.syncMs)
    }

    return ran(state.syncExit, state.syncOut, state.syncErr)
  })
  on('tool.call', (_$, e) => {
    const args: Record<string, unknown> = e

    return String(args['file_path']).includes('refused')
      ? ({ result: 'the edit failed', isError: true } as never)
      : { result: 'ok' }
  })
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)

    return { text: e.text }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  // The engine draws one row of its own in the band, so a test sees it kept.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text>beneath</Text>
      </Box>
    )
  })

  const statusNow = () => written.get('status') as UnityStatus | undefined

  return { toasts, submitted, commands, runs, clock, statusNow }
}

const start = async ($: Engine, clock: MockClock) => {
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.settle()
}

const edit = ($: Engine, path: string, agentId?: string) =>
  $.tool.call({
    tool: 'Edit',
    file_path: path,
    old_string: 'a',
    new_string: 'b',
    ...(agentId === undefined ? {} : { agentId }),
  } as never)

const write = ($: Engine, path: string) => $.tool.call({ tool: 'Write', file_path: path, content: 'class A {}' })

const unitySync = ($: Engine, args: string) =>
  $.command.run({
    command: 'unity-sync',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

/** What the band shows: its texts, less the cost legend and the engine's own row, and its buttons. */
const band = async ($: Engine) => {
  const mounted = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const all = (await mounted.findAll({ type: 'Text' })).map(found => found.text)
  const buttons = (await mounted.findAll({ type: 'Button' })).map(found => found.text)

  await mounted.unmount()

  return {
    texts: all.filter(text => text !== LEGEND && text !== 'beneath'),
    buttons,
    hasLegend: all.includes(LEGEND),
    keepsBeneath: all.at(-1) === 'beneath',
  }
}

test('the script\'s own output parses: errors with their place, an exception with its frame, duplicates once', () => {
  expect(parseSync(SYNC_ERRORS)).toEqual([
    { file: 'Assets/Scripts/Player.cs', line: 42, column: 17, message: 'error CS1002: ; expected' },
    {
      file: 'Assets/Scripts/Enemy.cs',
      line: 8,
      column: 1,
      message: "error CS0103: The name 'hp' does not exist in the current context",
    },
    {
      file: '',
      line: 0,
      column: 0,
      message:
        'NullReferenceException: Object reference not set to an instance of an object\nGame.Boot.Start () (at Assets/Scripts/Boot.cs:12)',
    },
  ])
  expect(parseSync(SYNC_ERRORS.replace(/\n/g, '\r\n'))).toHaveLength(3)
  expect(parseSync(SYNC_CLEAN)).toEqual([])
  expect(parseSync(SYNC_CLEAN.replace(/\n/g, '\r\n'))).toEqual([])
  expect(parseSync('')).toBeUndefined()
  expect(parseSync('Refreshing assets and waiting for compile...\n')).toBeUndefined()
})

test('an error reads as file:line and its first line in the band', () => {
  const errors = parseSync(SYNC_ERRORS) ?? []

  expect(errors.map(briefOf)).toEqual([
    'Assets/Scripts/Player.cs:42 error CS1002: ; expected',
    "Assets/Scripts/Enemy.cs:8 error CS0103: The name 'hp' does not exist in the current context",
    'NullReferenceException: Object reference not set to an instance of an object',
  ])
  expect(clockText(NOW)).toMatch(/^\d\d:\d\d$/)
})

test('which paths are a script of the project', () => {
  expect(isScriptOf('/proj/Assets/Scripts/Player.cs', '/proj')).toBe(true)
  expect(isScriptOf(String.raw`C:\Proj\Assets\Scripts\Player.CS`, 'c:/proj/')).toBe(true)
  expect(isScriptOf('Assets/Scripts/Player.cs', '/proj')).toBe(true)
  expect(isScriptOf('/elsewhere/Assets/Player.cs', '/proj')).toBe(false)
  expect(isScriptOf('/proj-two/Assets/Player.cs', '/proj')).toBe(false)
  expect(isScriptOf('/proj/Assets/Shaders/Lit.shader', '/proj')).toBe(false)
  expect(isScriptOf('/proj/notes.css', '/proj')).toBe(false)
})

const NOT_UNITY: [string, Unity][] = [
  ['no bridge script', unity({ hasScript: false })],
  ['no bridge package', unity({ hasPackage: false })],
  ['a manifest that does not list the bridge', unity({ hasPackage: false, manifest: '{ "dependencies": {} }' })],
]

for (const [what, state] of NOT_UNITY) {
  test(`with ${what} the mod registers nothing, runs nothing and draws nothing`, async ($, on) => {
    const { clock, commands, runs, toasts } = world(on, state)

    await start($, clock)
    await edit($, '/proj/Assets/Scripts/Player.cs')
    await clock.advance(5_000)

    expect(commands).toEqual([])
    expect(runs).toEqual([])
    expect(toasts).toEqual([])
    expect(await band($)).toMatchObject({ texts: [], buttons: [], keepsBeneath: true })
    expect(await unitySync($, '')).toMatchObject({
      text: 'Unity Sync: this is not a Unity project with the Claude Bridge (tools/unity.ps1 and Packages/com.blue.claude-bridge).',
    })
  })
}

test('the bridge counts as installed from the manifest alone', async ($, on) => {
  const { clock, commands } = world(
    on,
    unity({ hasPackage: false, manifest: '{ "dependencies": { "com.blue.claude-bridge": "https://example.test/bridge.git" } }' }),
  )

  await start($, clock)

  expect(commands).toEqual(['unity-sync'])
})

test('a burst of script edits causes one sync, 1.5 s after the last, and each edit returns at once unchanged', async ($, on) => {
  const { clock, runs, statusNow } = world(on, unity())

  await start($, clock)

  expect(await edit($, '/proj/Assets/Scripts/Player.cs')).toMatchObject({ result: 'ok' })
  await clock.advance(1_000)
  expect(await write($, '/proj/Assets/Scripts/Enemy.cs')).toMatchObject({ result: 'ok' })
  await clock.advance(1_000)
  expect(await edit($, '/proj/Assets/Scripts/Boot.cs', 'agent-7')).toMatchObject({ result: 'ok' })
  await clock.advance(1_499)

  expect(runs).toEqual([])
  expect(await band($)).toMatchObject({ texts: [], buttons: [] })

  await clock.advance(1)

  expect(runs).toEqual(['powershell ping -TimeoutSec 5', 'powershell sync'])
  expect(statusNow()).toMatchObject({ phase: 'clean', unsynced: 0, errors: [] })
  expect(await band($)).toEqual({
    texts: [`unity · compiled clean ${clockText(NOW + 3_500)}`],
    buttons: [],
    hasLegend: false,
    keepsBeneath: true,
  })
})

test('an edit that is no script of the project, or that failed, causes no sync', async ($, on) => {
  const { clock, runs } = world(on, unity())

  await start($, clock)
  await edit($, '/proj/Assets/Shaders/Lit.shader')
  await edit($, '/elsewhere/Tools/Build.cs')
  await write($, '/proj/README.md')
  await edit($, '/proj/Assets/Scripts/refused.cs')
  await clock.advance(10_000)

  expect(runs).toEqual([])
})

test('compile errors show as a count, the first two, and Sync and Send, marked as costing tokens', async ($, on) => {
  const { clock } = world(on, unity({ syncOut: SYNC_ERRORS }))

  await start($, clock)
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await clock.advance(1_500)

  expect(await band($)).toEqual({
    texts: [
      'unity · 3 errors',
      'Assets/Scripts/Player.cs:42 error CS1002: ; expected',
      "Assets/Scripts/Enemy.cs:8 error CS0103: The name 'hp' does not exist in the current context",
    ],
    buttons: ['Sync', 'Send ¤'],
    hasLegend: true,
    keepsBeneath: true,
  })

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect(await desktop.find({ type: 'Button', text: 'Send ¤' })).toBeDefined()
  await desktop.unmount()
})

test('nothing reaches the conversation until Send is pressed; then every error goes as the person\'s prompt', async ($, on) => {
  const { clock, submitted, runs } = world(on, unity({ syncOut: SYNC_ERRORS }))

  await start($, clock)
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await clock.advance(60_000)

  expect(submitted).toEqual([])

  const before = runs.length
  const mounted = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await mounted.press({ key: 'unity-send' })
  await clock.advance(50)
  await mounted.unmount()

  expect(submitted).toEqual([
    [
      '[unity-sync] Unity reports 3 errors after the last script edits:',
      '- Assets/Scripts/Player.cs(42,17): error CS1002: ; expected',
      "- Assets/Scripts/Enemy.cs(8,1): error CS0103: The name 'hp' does not exist in the current context",
      '- NullReferenceException: Object reference not set to an instance of an object',
      'Game.Boot.Start () (at Assets/Scripts/Boot.cs:12)',
      'Fix them, then run `tools/unity.ps1 sync` to confirm the project compiles clean.',
    ].join('\n'),
  ])
  expect(runs).toHaveLength(before)
})

test('Sync runs one again at no cost, and a fixed project reads clean', async ($, on) => {
  const state = unity({ syncOut: SYNC_ERRORS })
  const { clock, runs, submitted } = world(on, state)

  await start($, clock)
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await clock.advance(1_500)
  state.syncOut = SYNC_CLEAN

  const mounted = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await mounted.press({ key: 'unity-sync' })
  await clock.settle()
  await mounted.unmount()

  expect(runs).toEqual(['powershell ping -TimeoutSec 5', 'powershell sync', 'powershell ping -TimeoutSec 5', 'powershell sync'])
  expect(submitted).toEqual([])
  expect((await band($)).texts).toEqual([`unity · compiled clean ${clockText(NOW + 1_500)}`])
})

test('a dead editor is sent no sync, the unsynced edits are counted, and the next edit asks again', async ($, on) => {
  const state = unity({ isAlive: false })
  const { clock, runs, statusNow } = world(on, state)

  await start($, clock)
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await edit($, '/proj/Assets/Scripts/Enemy.cs')
  await clock.advance(1_500)

  expect(runs).toEqual(['powershell ping -TimeoutSec 5'])
  expect(statusNow()).toMatchObject({ phase: 'dead', unsynced: 2 })
  expect(await band($)).toEqual({
    texts: ['unity · editor not answering · 2 edits unsynced'],
    buttons: ['Sync'],
    hasLegend: false,
    keepsBeneath: true,
  })

  await clock.advance(600_000)

  expect(runs).toHaveLength(1)

  state.isAlive = true
  await edit($, '/proj/Assets/Scripts/Boot.cs')
  await clock.advance(1_500)

  expect(runs).toEqual(['powershell ping -TimeoutSec 5', 'powershell ping -TimeoutSec 5', 'powershell sync'])
  expect(statusNow()).toMatchObject({ phase: 'clean', unsynced: 0 })
})

test('an edit made while a sync runs causes exactly one more sync after it', async ($, on) => {
  const state = unity({ syncMs: 10_000, syncOut: SYNC_ERRORS })
  const { clock, runs, statusNow } = world(on, state)

  await start($, clock)
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await clock.advance(1_500)

  expect(runs).toEqual(['powershell ping -TimeoutSec 5', 'powershell sync'])
  expect((await band($)).texts).toEqual(['unity · syncing…'])

  await edit($, '/proj/Assets/Scripts/Enemy.cs')
  await edit($, '/proj/Assets/Scripts/Boot.cs')
  await clock.advance(5_000)

  expect(runs).toHaveLength(2)

  state.syncOut = SYNC_CLEAN
  await clock.advance(5_000)

  expect(runs).toEqual([
    'powershell ping -TimeoutSec 5',
    'powershell sync',
    'powershell ping -TimeoutSec 5',
    'powershell sync',
  ])
  expect(statusNow()).toMatchObject({ phase: 'syncing' })

  await clock.advance(10_000)

  expect(statusNow()).toMatchObject({ phase: 'clean', unsynced: 0 })

  await clock.advance(600_000)

  expect(runs).toHaveLength(4)
})

test('/unity-sync runs one now and prints it; /unity-sync status prints the last without running', async ($, on) => {
  const state = unity({ syncOut: SYNC_ERRORS })
  const { clock, runs, commands } = world(on, state)

  await start($, clock)

  expect(commands).toEqual(['unity-sync'])
  expect(await unitySync($, 'status')).toMatchObject({
    text: 'Unity Sync: no sync has run this session. /unity-sync runs one.',
  })
  expect(runs).toEqual([])

  const printed = [
    `Unity Sync: 3 errors at ${clockText(NOW)}`,
    '  Assets/Scripts/Player.cs(42,17): error CS1002: ; expected',
    "  Assets/Scripts/Enemy.cs(8,1): error CS0103: The name 'hp' does not exist in the current context",
    '  NullReferenceException: Object reference not set to an instance of an object',
    '    Game.Boot.Start () (at Assets/Scripts/Boot.cs:12)',
  ].join('\n')

  expect(await unitySync($, '')).toMatchObject({ text: printed })
  expect(runs).toEqual(['powershell ping -TimeoutSec 5', 'powershell sync'])
  expect(await unitySync($, ' Status ')).toMatchObject({ text: printed })
  expect(runs).toHaveLength(2)
  expect((await unitySync($, 'harder')).text).toContain('is not something it does')
  expect(runs).toHaveLength(2)

  state.isAlive = false

  expect(await unitySync($, '')).toMatchObject({
    text: 'Unity Sync: the editor is not answering, so no sync was queued. Is Unity open on this project?',
  })
})

test('what the command prints for each state', () => {
  const at = NOW
  const base = { at, errors: [], unsynced: 0, reason: '' }

  expect(reportOf({ ...base, phase: 'clean' })).toBe(`Unity Sync: compiled clean at ${clockText(at)}.`)
  expect(reportOf({ ...base, phase: 'syncing' })).toBe('Unity Sync: a sync is running.')
  expect(reportOf({ ...base, phase: 'dead', unsynced: 1 })).toBe(
    'Unity Sync: the editor is not answering (1 .cs edit unsynced), so no sync was queued. Is Unity open on this project?',
  )
  expect(reportOf({ ...base, phase: 'failed', reason: 'boom', unsynced: 3 })).toBe(
    'Unity Sync: the sync failed (3 .cs edits unsynced): boom',
  )
})

test('an editor that stops answering part way reads as not answering; any other failure is named', async ($, on) => {
  const state = unity({ syncExit: 1, syncOut: '', syncErr: timedOut('refresh', 30) })
  const { clock, statusNow } = world(on, state)

  await start($, clock)
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await clock.advance(1_500)

  expect(statusNow()).toMatchObject({ phase: 'dead', unsynced: 1 })
  expect((await band($)).texts).toEqual(['unity · editor not answering · 1 edit unsynced'])

  state.syncErr = "Unity returned an error for 'refresh':\nunknown cmd 'refresh'. Try {\"cmd\":\"commands\"}."
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await clock.advance(1_500)

  expect(statusNow()).toMatchObject({ phase: 'failed', unsynced: 2, reason: "Unity returned an error for 'refresh':" })
  expect(await band($)).toMatchObject({
    texts: ["unity · sync failed: Unity returned an error for 'refresh':"],
    buttons: ['Sync'],
  })

  state.syncExit = 0
  state.syncOut = 'something else entirely\n'
  state.syncErr = ''
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await clock.advance(1_500)

  expect(statusNow()).toMatchObject({ phase: 'failed', reason: 'the script printed neither a clean compile nor errors' })
})

test('PowerShell 7 is used where Windows PowerShell is missing', async ($, on) => {
  const { clock, runs, statusNow } = world(on, unity({ shells: ['pwsh'] }))

  await start($, clock)
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await clock.advance(1_500)

  expect(runs).toEqual(['pwsh ping -TimeoutSec 5', 'pwsh sync'])
  expect(statusNow()).toMatchObject({ phase: 'clean' })
})

test('a machine with no PowerShell is told so, and the editor is not called dead', async ($, on) => {
  const { clock, runs, statusNow } = world(on, unity({ shells: [] }))

  await start($, clock)
  await edit($, '/proj/Assets/Scripts/Player.cs')
  await clock.advance(1_500)

  expect(runs).toEqual([])
  expect(statusNow()).toMatchObject({
    phase: 'failed',
    unsynced: 1,
    reason: 'PowerShell was not found (powershell, pwsh)',
  })
})
