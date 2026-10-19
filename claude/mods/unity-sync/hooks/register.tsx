import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { CompileError, UnityStatus } from '../types'

/** The bridge's script, and the package that answers it, both beneath the project root. */
const SCRIPT = 'tools/unity.ps1'
const PACKAGE = 'com.blue.claude-bridge'
/** Windows PowerShell first; PowerShell 7 where that is all there is. */
const SHELLS = ['powershell', 'pwsh'] as const
const SHELL_FLAGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File'] as const
/** One sync this long after the last .cs edit of a burst. */
const DEBOUNCE_MS = 1_500
/**
 * How long a ping may wait on the editor, in seconds. The script takes its
 * request back off the queue when this runs out, so a dead editor is left
 * with nothing to run when it comes back.
 */
const PING_S = 5
/** Past the script's own timeouts, so the script ends by itself and clears its request. */
const PING_MS = 20_000
const SYNC_MS = 300_000
/** Long enough for the press that set the timer to have settled. */
const SOON_MS = 50
/** How many errors the band spells out under its count. */
const SHOWN = 2
/** Marks an action that spends tokens: it starts a model turn. */
const COST = '¤'
const LEGEND = `${COST} uses tokens`

type Action = 'sync' | 'send'

// Every mod's band shares one site: these letters are no other mod's.
const HOTKEYS: Record<Action, string> = { sync: 'y', send: 'b' }

const IDLE: UnityStatus = { phase: 'idle', at: 0, errors: [], unsynced: 0, reason: '' }

const project = atom({ plugin: 'unity-sync', key: 'project' } as const, '')
const status = atom({ plugin: 'unity-sync', key: 'status' } as const, IDLE)

/** The Unity project's root; '' while the session is not in one with the bridge. */
let root = ''
/** The PowerShell that started last time. */
let shell: string | undefined
/** Edits to .cs files that no finished sync has covered. */
let edits = 0
let timer: Timer | undefined
// One sync at a time: an edit made while one runs asks for one more after it.
let running: Promise<UnityStatus> | undefined
let isStale = false

const slashed = (path: string) => path.replace(/\\/g, '/')

/** Whether a tool wrote a C# script of the project: any .cs beneath its root, or a relative one. */
export const isScriptOf = (path: string, base: string) => {
  const file = slashed(path).toLowerCase()

  if (!file.endsWith('.cs')) {
    return false
  }

  const isAbsolute = /^(?:[a-z]:)?\//.test(file)

  return !isAbsolute || file.startsWith(`${slashed(base).toLowerCase().replace(/\/+$/, '')}/`)
}

const firstLine = (text: string) =>
  text
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line !== '') ?? ''

/** One console entry as `sync` printed it: Unity's `file(line,column): message`, or a bare message. */
const errorOf = (entry: string): CompileError => {
  const placed = /^(.+?)\((\d+),(\d+)\):\s*([\s\S]*)$/.exec(entry)

  return placed === null
    ? { file: '', line: 0, column: 0, message: entry }
    : { file: slashed(placed[1] ?? ''), line: Number(placed[2]), column: Number(placed[3]), message: placed[4] ?? '' }
}

/**
 * Reads what `unity.ps1 sync` printed: `Compile clean.`, or `N error(s):` and
 * one `  [Error] message` or `  [Exception] message` per console entry, an
 * entry's further lines following it unmarked. Undefined when it printed neither.
 */
export const parseSync = (stdout: string): CompileError[] | undefined => {
  const rows = stdout.split(/\r?\n/)
  const head = rows.findIndex(row => /^\d+ error\(s\):\s*$/.test(row.trim()))

  if (head === -1) {
    return rows.some(row => row.trim() === 'Compile clean.') ? [] : undefined
  }

  const entries: string[] = []

  for (const row of rows.slice(head + 1)) {
    const opened = /^\s*\[(?:Error|Exception)\] (.*)$/.exec(row)

    if (opened !== null) {
      entries.push(opened[1] ?? '')
    } else if (entries.length > 0 && row.trim() !== '') {
      entries[entries.length - 1] += `\n${row.trimEnd()}`
    }
  }

  // Unity logs a compile error once per assembly that hit it: one line each here.
  return [...new Set(entries.map(entry => entry.trim()))].map(errorOf)
}

/** An error as the band shows it: `file:line message`, the message's first line. */
export const briefOf = (error: CompileError) => {
  const message = firstLine(error.message)

  return error.file === '' ? message : `${error.file}:${error.line} ${message}`
}

/** An error in full, as Unity wrote it. */
const wholeOf = (error: CompileError) =>
  error.file === '' ? error.message : `${error.file}(${error.line},${error.column}): ${error.message}`

const countOf = (errors: readonly CompileError[]) => (errors.length === 1 ? '1 error' : `${errors.length} errors`)

const two = (value: number) => String(value).padStart(2, '0')

/** HH:MM on this machine's clock. */
export const clockText = (at: number) => {
  const when = new Date(at)

  return `${two(when.getHours())}:${two(when.getMinutes())}`
}

/** The root of the session's project when it is a Unity project with the bridge; '' otherwise. */
const findProject = async ($: EngineInterface) => {
  try {
    const base = await $.session.root()

    if (!(await $.fs.exists(`${base}/${SCRIPT}`))) {
      return ''
    }

    if (await $.fs.exists(`${base}/Packages/${PACKAGE}`)) {
      return base
    }

    const manifest = await $.fs.read(`${base}/Packages/manifest.json`)

    return manifest.includes(`"${PACKAGE}"`) ? base : ''
  } catch {
    return ''
  }
}

type Ran = { exitCode: number; stdout: string; stderr: string; isMissing: boolean }

/** Runs the bridge's script with these arguments; never throws. */
const runBridge = async ($: EngineInterface, args: readonly string[], timeoutMs: number): Promise<Ran> => {
  for (const candidate of shell === undefined ? SHELLS : [shell]) {
    try {
      const ran = await $.process.run([candidate, ...SHELL_FLAGS, `${root}/${SCRIPT}`, ...args], {
        cwd: root,
        timeoutMs,
      })

      shell = candidate

      return { exitCode: ran.exitCode, stdout: ran.stdout, stderr: ran.stderr, isMissing: false }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)

      // Only a shell that is not on this machine moves on to the next one.
      if (!/ENOENT|failed to start/i.test(text)) {
        return { exitCode: 1, stdout: '', stderr: text, isMissing: false }
      }
    }
  }

  return { exitCode: 1, stdout: '', stderr: 'PowerShell was not found (powershell, pwsh)', isMissing: true }
}

/** Pings the editor, and only when it answers runs one sync. No model call. */
const measureUnity = async ($: EngineInterface): Promise<Omit<UnityStatus, 'unsynced'>> => {
  const ping = await runBridge($, ['ping', '-TimeoutSec', String(PING_S)], PING_MS)

  if (ping.isMissing) {
    return { phase: 'failed', at: await $.clock.now(), errors: [], reason: ping.stderr }
  }

  // A dead editor is sent no sync: the request would sit on disk and run when it came back.
  if (ping.exitCode !== 0 || !/"pong"\s*:\s*true/.test(ping.stdout)) {
    return { phase: 'dead', at: await $.clock.now(), errors: [], reason: firstLine(ping.stderr) }
  }

  const ran = await runBridge($, ['sync'], SYNC_MS)
  const at = await $.clock.now()

  if (ran.exitCode !== 0) {
    const reason = firstLine(ran.stderr) || firstLine(ran.stdout) || `the script exited ${ran.exitCode}`

    // The script's own words when the editor stopped answering part way.
    return { phase: /^Timed out after/i.test(reason) ? 'dead' : 'failed', at, errors: [], reason }
  }

  const errors = parseSync(ran.stdout)

  if (errors === undefined) {
    return { phase: 'failed', at, errors: [], reason: 'the script printed neither a clean compile nor errors' }
  }

  return { phase: errors.length === 0 ? 'clean' : 'errors', at, errors, reason: '' }
}

/** Syncs now, or joins the sync that is running; again for edits made meanwhile. */
const syncUnity = async ($: EngineInterface): Promise<UnityStatus> => {
  if (running !== undefined) {
    return running
  }

  running = (async () => {
    let found = IDLE

    do {
      isStale = false

      const covered = edits

      await update($, status, (last): UnityStatus => ({ ...last, phase: 'syncing' }))

      const measured = await measureUnity($)

      if (measured.phase === 'clean' || measured.phase === 'errors') {
        edits = Math.max(0, edits - covered)
      } else {
        // Nothing ran: the edits stay unsynced, and the editor is not asked again until one more arrives.
        isStale = false
      }

      found = { ...measured, unsynced: edits }
      await update($, status, () => found)
    } while (isStale)

    return found
  })()

  try {
    return await running
  } finally {
    running = undefined
  }
}

/** A .cs file of the project was written: one sync once the burst of edits has ended. */
const noteEdit = ($: EngineInterface) => {
  edits += 1

  if (running !== undefined) {
    isStale = true

    return
  }

  timer?.cancel()
  timer = $.clock.after(DEBOUNCE_MS, () => {
    timer = undefined
    void syncUnity($).catch(() => undefined)
  })
}

/** The Sync button: free, and never waited on. */
const pressSync = ($: EngineInterface) => {
  timer?.cancel()
  timer = undefined
  void syncUnity($).catch(() => undefined)
}

const sendText = (errors: readonly CompileError[]) =>
  [
    `[unity-sync] Unity reports ${countOf(errors)} after the last script edits:`,
    ...errors.map(error => `- ${wholeOf(error)}`),
    'Fix them, then run `tools/unity.ps1 sync` to confirm the project compiles clean.',
  ].join('\n')

/** Submits a prompt as the person's own words: they pressed the button. */
const submitErrors = async ($: EngineInterface, text: string) => {
  try {
    await $.prompt.submit({ text, asUser: true })
  } catch {
    $.ui.toast('Unity Sync: the prompt could not be submitted.')
  }
}

/** The Send button: hands the main session every error. Spends a turn. */
const pressSend = async ($: EngineInterface) => {
  const { errors } = await read($, status)

  if (errors.length === 0) {
    return
  }

  $.clock.after(SOON_MS, () => {
    void submitErrors($, sendText(errors))
  })
}

/** What the command prints for a status. */
export const reportOf = (found: UnityStatus) => {
  const waiting = found.unsynced === 0 ? '' : ` (${found.unsynced} .cs ${found.unsynced === 1 ? 'edit' : 'edits'} unsynced)`

  switch (found.phase) {
    case 'idle':
      return 'Unity Sync: no sync has run this session. /unity-sync runs one.'
    case 'syncing':
      return 'Unity Sync: a sync is running.'
    case 'clean':
      return `Unity Sync: compiled clean at ${clockText(found.at)}.`
    case 'errors':
      return [
        `Unity Sync: ${countOf(found.errors)} at ${clockText(found.at)}`,
        // An entry's further lines (an exception's first frames) sit under its first.
        ...found.errors.map(error => `  ${wholeOf(error).split('\n').join('\n    ')}`),
      ].join('\n')
    case 'dead':
      return `Unity Sync: the editor is not answering${waiting}, so no sync was queued. Is Unity open on this project?`
    case 'failed':
      return `Unity Sync: the sync failed${waiting}: ${found.reason}`
  }
}

type Band = {
  head: string
  /** `calm` draws dim: nothing needs the person. */
  tone: 'calm' | 'error' | 'warning'
  /** The first errors, one row each. */
  rows: readonly string[]
  actions: readonly Action[]
}

/** The band for a status; undefined when there is nothing to show. */
const bandOf = (found: UnityStatus): Band | undefined => {
  const unsynced = found.unsynced === 0 ? [] : [`${found.unsynced} ${found.unsynced === 1 ? 'edit' : 'edits'} unsynced`]

  switch (found.phase) {
    case 'idle':
      return undefined
    case 'syncing':
      return { head: 'unity · syncing…', tone: 'calm', rows: [], actions: [] }
    case 'clean':
      return { head: `unity · compiled clean ${clockText(found.at)}`, tone: 'calm', rows: [], actions: [] }
    case 'errors':
      return {
        head: `unity · ${countOf(found.errors)}`,
        tone: 'error',
        rows: found.errors.slice(0, SHOWN).map(briefOf),
        actions: ['sync', 'send'],
      }
    case 'dead':
      return { head: ['unity', 'editor not answering', ...unsynced].join(' · '), tone: 'warning', rows: [], actions: ['sync'] }
    case 'failed':
      return { head: `unity · sync failed: ${found.reason}`, tone: 'warning', rows: [], actions: ['sync'] }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    root = await findProject($)
    await update($, project, () => root)

    // Outside a Unity project with the bridge the mod adds no command and draws nothing.
    if (root !== '') {
      await $.command
        .register({
          name: 'unity-sync',
          description: 'Recompile the Unity project and show its compile errors',
          argumentHint: '[status]',
          immediate: true,
        })
        .catch(() => undefined)
    }

    return next(e)
  })

  on('command.run', { command: 'unity-sync' }, async ($, e) => {
    const word = e.args.trim().toLowerCase()

    if (root === '') {
      return { text: `Unity Sync: this is not a Unity project with the Claude Bridge (${SCRIPT} and Packages/${PACKAGE}).` }
    }

    if (word === 'status') {
      return { text: reportOf(await read($, status)) }
    }

    if (word !== '') {
      return { text: `Unity Sync: "${word}" is not something it does. /unity-sync runs a sync; /unity-sync status shows the last one.` }
    }

    timer?.cancel()
    timer = undefined

    return { text: reportOf(await syncUnity($)) }
  })

  // The edit is never held or changed: its own result goes back first, and the
  // sync it causes runs beside the turn.
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)

    if (root !== '' && ran.deny === undefined && ran.isError !== true && isScriptOf(e.file_path, root)) {
      noteEdit($)
    }

    return ran
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)

    if (root !== '' && ran.deny === undefined && ran.isError !== true && isScriptOf(e.file_path, root)) {
      noteEdit($)
    }

    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, project)) === '') {
      return next(e)
    }

    const band = bandOf(await read($, status))

    if (band === undefined) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // Another mod's band, when one draws beneath this one, stays under it.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {band.tone === 'calm' ? (
            <Text dimColor wrap="truncate-end">
              {band.head}
            </Text>
          ) : (
            <Text color={band.tone} wrap="truncate-end">
              {band.head}
            </Text>
          )}
          {band.actions.includes('sync') && (
            <Button key="unity-sync" label="Sync" hotkey={HOTKEYS.sync} onPress={() => pressSync($)} />
          )}
          {band.actions.includes('send') && (
            <Button key="unity-send" label={`Send ${COST}`} hotkey={HOTKEYS.send} onPress={() => pressSend($)} />
          )}
          {band.actions.includes('send') && <Text dimColor>{LEGEND}</Text>}
        </Box>
        {band.rows.map((row, at) => (
          <Text key={`unity-error-${at}`} dimColor wrap="truncate-end">
            {row}
          </Text>
        ))}
        {below}
      </Box>
    )
  })
}
