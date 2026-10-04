import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Change } from '../types'

const BIN = 'arcana'
const TIMEOUT_MS = 5000
const ENABLED = 'enabled'
const PANE = 'arcana-feed'
const FEED_ROWS = 40
const POLL_MS = 3000

// The tools `arcana hook post` turns into changesets; it ignores the rest.
const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'Read'])
const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit'])

const feed = atom({ plugin: 'arcana', key: 'feed' } as const, [])

// off: switched off with /arcana off.
// no-project: no .arcana/ above the working directory, so the mod stays quiet.
// no-binary: `arcana` is not on PATH, so nothing is captured by anyone.
// hooks: the settings hooks capture; the mod only reports, so nothing is recorded twice.
// mod: the mod captures.
type Mode = 'off' | 'no-project' | 'no-binary' | 'hooks' | 'mod'

type HookName = 'prompt' | 'pre' | 'post'

type Capture = {
  mode: Mode
  sessionId: string
  promptId?: string
  edits: number
  failures: number
  // The .arcana/ directory found above the working directory.
  arcanaDir?: string
  startedAt: number
  // The changeset log's mtime when the feed was last read.
  logStamp: number
  // The feed's rows, for the hooks that do not draw.
  changes: Change[]
  // Files already warned about, so one clash is one toast.
  warned: string[]
  poll?: Timer
}

const isLive = (mode: Mode) => mode === 'hooks' || mode === 'mod'

const findArcanaDir = async ($: EngineInterface, cwd: string) => {
  let dir = cwd.replace(/[\\/]+$/, '')

  for (;;) {
    const found = await $.fs.stat(`${dir}/.arcana`).catch(() => undefined)
    if (found?.kind === 'dir') return `${dir}/.arcana`

    const cut = Math.max(dir.lastIndexOf('/'), dir.lastIndexOf('\\'))
    if (cut <= 0) return undefined
    dir = dir.slice(0, cut)
  }
}

const detect = async (
  $: EngineInterface,
  capture: Capture,
): Promise<Mode> => {
  if ((await $.store.get(ENABLED)) === false) return 'off'

  capture.arcanaDir = await findArcanaDir($, await $.session.cwd())
  if (capture.arcanaDir === undefined) return 'no-project'

  const version = await $.process
    .run([BIN, '--version'], { timeoutMs: TIMEOUT_MS })
    .catch(() => undefined)
  if (version?.exitCode !== 0) return 'no-binary'

  const { hooks } = await $.settings.read()

  return JSON.stringify(hooks ?? {}).includes(`${BIN} hook`) ? 'hooks' : 'mod'
}

// Learns the session and where the mod stands. A command can arrive before
// session.start has finished doing this, so both go through here.
const settle = async ($: EngineInterface, capture: Capture) => {
  if (capture.sessionId === '') {
    capture.sessionId = await $.session.id()
    capture.startedAt = await $.clock.now()
  }
  capture.mode = await detect($, capture)
}

const count = ({ edits }: Capture) =>
  `${edits} ${edits === 1 ? 'edit' : 'edits'} this session`

const show = ($: EngineInterface, capture: Capture) => {
  const failed =
    capture.failures > 0 ? `, ${capture.failures} not recorded` : ''
  const lines: Record<Mode, string | undefined> = {
    off: undefined,
    'no-project': undefined,
    'no-binary': 'arcana: binary not found, nothing is captured',
    hooks: `arcana: ${count(capture)} (hooks capture)`,
    mod: `arcana: ${count(capture)} (mod captures${failed})`,
  }

  $.ui.status(lines[capture.mode])
}

const describe = (capture: Capture) => {
  const texts: Record<Mode, string> = {
    off: 'arcana mod is off. /arcana on turns it back on.',
    'no-project':
      'No .arcana/ directory here or above, so the arcana mod stays quiet. Run `arcana init` to start capturing.',
    'no-binary':
      'The `arcana` binary is not on PATH, so nothing is captured, by the settings hooks or by the mod. Install it with `cargo install --path crates/arcana-cli`.',
    hooks: `The settings hooks capture this session, so the arcana mod only reports: ${count(capture)}. /arcana feed shows what was recorded. /arcana off hides the mod; the hooks keep capturing.`,
    mod: `The arcana mod captures this session: ${count(capture)}, ${capture.failures} not recorded. /arcana feed shows what was recorded. /arcana off stops it.`,
  }

  return texts[capture.mode]
}

// Never throws: a capture that fails is counted, and the tool call goes on.
const record = async (
  $: EngineInterface,
  capture: Capture,
  hook: HookName,
  payload: object,
) => {
  const ran = await $.process
    .run([BIN, 'hook', hook], {
      stdin: JSON.stringify(payload),
      timeoutMs: TIMEOUT_MS,
    })
    .catch(() => undefined)

  if (ran?.exitCode !== 0) {
    capture.failures += 1
  }
}

const toChange = (line: string, sessionId: string): Change | undefined => {
  try {
    const cs = JSON.parse(line)

    return {
      seq: Number(cs.seq),
      at: Date.parse(cs.ts),
      op: String(cs.op),
      path: String(cs.path),
      intent: String(cs.intent).toLowerCase(),
      prompt: String(cs.prompt ?? ''),
      isOurs: cs.session_id === sessionId,
    }
  } catch {
    return undefined
  }
}

// Reads the feed again when the changeset log has changed since the last read.
// Never throws: a feed that cannot be read keeps the rows it had.
const refresh = async ($: EngineInterface, capture: Capture) => {
  if (capture.arcanaDir === undefined) return

  const log = await $.fs
    .stat(`${capture.arcanaDir}/changesets.jsonl`)
    .catch(() => undefined)
  if (log === undefined || log.mtimeMs === capture.logStamp) return

  const ran = await $.process
    .run([BIN, 'lore', 'recent', '--limit', String(FEED_ROWS)], {
      timeoutMs: TIMEOUT_MS,
    })
    .catch(() => undefined)
  if (ran?.exitCode !== 0) return

  capture.logStamp = log.mtimeMs
  capture.changes = ran.stdout
    .split('\n')
    .map(line => toChange(line, capture.sessionId))
    .filter(change => change !== undefined)
  await update($, feed, () => capture.changes)
}

// Polls the log while the mod is live, so the feed also shows other sessions.
const watch = ($: EngineInterface, capture: Capture) => {
  capture.poll?.cancel()
  capture.poll = isLive(capture.mode)
    ? $.clock.every(POLL_MS, () => void refresh($, capture))
    : undefined
}

const tidy = (path: string) => {
  const slashed = path.replaceAll('\\', '/')

  return /^[a-z]:/i.test(slashed) ? slashed.toLowerCase() : slashed
}

const cut = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`

const cutStart = (text: string, max: number) =>
  text.length <= max ? text : `…${text.slice(text.length - Math.max(0, max - 1))}`

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

const clock = (at: number) => {
  const when = new Date(at)
  const two = (n: number) => String(n).padStart(2, '0')

  return `${two(when.getHours())}:${two(when.getMinutes())}`
}

// The path as the feed shows it: relative to the project the log belongs to.
const shown = (path: string, arcanaDir: string | undefined) => {
  const root = tidy(arcanaDir ?? '').replace(/\/\.arcana$/, '')
  const full = path.replaceAll('\\', '/')

  return root !== '' && tidy(path).startsWith(`${root}/`)
    ? full.slice(root.length + 1)
    : full
}

// Warns, once per file, when another session has written the file since this
// session started. It never blocks the edit.
const warn = ($: EngineInterface, capture: Capture, path: string) => {
  if (path === '' || capture.warned.includes(tidy(path))) return

  const clash = capture.changes.findLast(
    change =>
      !change.isOurs &&
      change.at >= capture.startedAt &&
      tidy(change.path) === tidy(path),
  )
  if (clash === undefined) return

  capture.warned.push(tidy(path))
  const why =
    clash.prompt === '' ? '' : ` for "${cut(oneLine(clash.prompt), 48)}"`
  $.ui.toast(
    `arcana: another session changed ${shown(path, capture.arcanaDir)} at ${clock(clash.at)}${why}`,
    { timeoutMs: 8000 },
  )
}

export const register: Register = on => {
  const capture: Capture = {
    mode: 'no-project',
    sessionId: '',
    edits: 0,
    failures: 0,
    startedAt: 0,
    logStamp: -1,
    changes: [],
    warned: [],
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'arcana',
      description:
        "Show arcana's capture state or its feed, or switch the mod on or off",
      argumentHint: '[feed|on|off]',
    })
    await settle($, capture)
    show($, capture)
    watch($, capture)

    return next(e)
  })

  on('command.run', { command: 'arcana' }, async ($, e) => {
    const wanted = e.args.trim().toLowerCase()

    if (wanted === 'off') {
      await $.store.set(ENABLED, false)
      capture.mode = 'off'
      await $.ui.close({ id: PANE }).catch(() => undefined)
    } else if (wanted === 'on' || wanted === 'feed' || wanted === '') {
      if (wanted === 'on') await $.store.set(ENABLED, true)
      // Looked up afresh: the answer is right even while session.start is
      // still running, or after `arcana init` or an install mid-session.
      await settle($, capture)
    } else {
      return { text: 'Usage: /arcana [feed|on|off]' }
    }
    show($, capture)
    watch($, capture)

    if (wanted === 'feed') {
      if (!isLive(capture.mode)) return { text: describe(capture) }

      await refresh($, capture)
      const opened = await $.ui.open({ id: PANE, title: 'arcana feed' })

      return {
        text: opened.isPlaced
          ? 'arcana feed opened.'
          : `arcana feed is open but not drawn yet: ${opened.reason}`,
      }
    }

    return { text: describe(capture) }
  })

  on('turn.start', async ($, e, next) => {
    // A turn with no text continues the prompt before it, and so does one a
    // finished background task started: the harness wrote that text.
    const isPrompt =
      e.text !== '' && !e.text.trimStart().startsWith('<task-notification>')

    if (capture.mode === 'mod' && isPrompt) {
      capture.promptId = e.turnId
      await record($, capture, 'prompt', {
        session_id: capture.sessionId,
        prompt_id: capture.promptId,
        prompt: e.text,
      })
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (!isLive(capture.mode)) return next(e)

    const { tool, tool_use_id, agentId, ...tool_input } = e
    const name = String(tool)
    const payload = {
      session_id: capture.sessionId,
      prompt_id: capture.promptId,
      tool_name: name,
      tool_input,
      tool_use_id,
    }
    const shownBefore = capture.edits + capture.failures

    if (EDIT_TOOLS.has(name)) {
      await refresh($, capture)
      warn($, capture, String((tool_input as { file_path?: unknown }).file_path ?? ''))
    }
    if (capture.mode === 'mod') await record($, capture, 'pre', payload)
    const ran = await next(e)
    const hasSucceeded = ran.deny === undefined && ran.isError !== true

    if (hasSucceeded && capture.mode === 'mod' && FILE_TOOLS.has(name)) {
      await record($, capture, 'post', payload)
    }
    if (hasSucceeded && EDIT_TOOLS.has(name)) {
      capture.edits += 1
    }
    if (capture.edits + capture.failures !== shownBefore) show($, capture)

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const changes = await read($, feed)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 5)
    const width = Math.max(24, e.props.bodyColumns)
    const pathRoom = Math.max(12, Math.floor(width * 0.45))
    const hasOthers = changes.some(change => !change.isOurs)

    return (
      <Box flexDirection="column">
        {changes.length === 0 && (
          <Text dimColor>No writes or edits recorded yet.</Text>
        )}
        {changes.slice(-room).map(change => {
          const what = `${clock(change.at)} ${change.isOurs ? ' ' : '*'} ${change.op.padEnd(5)} ${cutStart(shown(change.path, capture.arcanaDir), pathRoom)}`
          const why = `  ${change.intent} "${oneLine(change.prompt)}"`

          return (
            <Box>
              <Text>{what}</Text>
              <Text dimColor>
                {cut(why, Math.max(0, width - what.length))}
              </Text>
            </Box>
          )
        })}
        {hasOthers && <Text dimColor>* changed by another session</Text>}
      </Box>
    )
  })
}
