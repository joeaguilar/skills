import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Entry, ShellName } from '../types'

const PANE = 'shell'
const OTHER: Record<ShellName, ShellName> = { powershell: 'bash', bash: 'powershell' }

/** How often a running command's output is drawn, in milliseconds. */
const FLUSH_MS = 120
/** The most of one command's output that is kept, in characters: its tail. */
const OUTPUT_CAP = 120_000
/** The most finished commands kept, and the most output across them. */
const HISTORY_ENTRIES = 40
const HISTORY_CHARS = 400_000
/** The most rows the pane draws: the newest. */
const ROWS = 300
/** The most output a quote puts in the prompt box for one command, in characters: its tail. */
const QUOTE_CAP = 12_000
/** The most a quote of the whole pane puts there: the newest commands that fit. */
const TRANSCRIPT_CAP = 60_000

const BUSY = 'shell-pane: a command is still running. Stop it first.'
const NO_BASH =
  'Git Bash was not found. Install Git for Windows, or set CLAUDE_CODE_GIT_BASH_PATH to its bash.exe.'

/**
 * What each shell is started with. The line never rides the command line: it
 * arrives in SHELL_PANE_LINE, so no quoting of it can go wrong. The last thing
 * written is SHELL_PANE_MARK and the folder the shell ended in, which is how a
 * `cd` carries over to the next line (each line is a process of its own).
 */
const POWERSHELL = [
  "$ProgressPreference = 'SilentlyContinue'",
  'try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}',
  // The person's profiles, for their aliases and functions. A profile greets a
  // shell once; here every line is a new shell, so what it prints is dropped
  // (its errors are not).
  'foreach ($__p in @($PROFILE.AllUsersAllHosts, $PROFILE.AllUsersCurrentHost, $PROFILE.CurrentUserAllHosts, $PROFILE.CurrentUserCurrentHost)) {',
  '  if ($__p -and (Test-Path -LiteralPath $__p)) { . $__p 3>$null 4>$null 5>$null 6>$null | Out-Null }',
  '}',
  '$__sp = 0',
  '$__e = $Error.Count',
  'try {',
  // Out-Default formats a table to its end before the exit below can cut it.
  '  Invoke-Expression $env:SHELL_PANE_LINE | Out-Default',
  '  if ($Error.Count -gt $__e) { $__sp = 1 }',
  '  if ($LASTEXITCODE) { $__sp = $LASTEXITCODE }',
  '} catch {',
  '  $__sp = 1',
  '  $_ | Out-Default',
  '} finally {',
  '  Write-Output ($env:SHELL_PANE_MARK + (Get-Location -PSProvider FileSystem).ProviderPath)',
  '}',
  'exit $__sp',
].join('\n')

const BASH = [
  'eval "$SHELL_PANE_LINE"',
  '__sp=$?',
  // pwd -W is Git Bash's Windows spelling, which the next line's start needs.
  'printf \'%s%s\\n\' "$SHELL_PANE_MARK" "$(pwd -W 2>/dev/null || pwd)"',
  'exit $__sp',
].join('\n')

const chosen = atom({ plugin: 'shell-pane', key: 'shell' } as const, 'powershell')
const where = atom({ plugin: 'shell-pane', key: 'cwd' } as const, '')
const history = atom({ plugin: 'shell-pane', key: 'entries' } as const, [])
const live = atom({ plugin: 'shell-pane', key: 'live' } as const, null)
const epoch = atom({ plugin: 'shell-pane', key: 'epoch' } as const, 0)

type Running = { id: number; isStopped: boolean; stop: () => void }
type Row = { text: string; tone: 'prompt' | 'plain' | 'dim' | 'bad' }

/** The command in flight, one at a time; the module's own, since a reload ends the child. */
let running: Running | undefined
/** What is typed and not yet run. Not state, so typing draws nothing. */
let draft = ''
let nextId = Date.now()
let isWindows = true
/** The session's folder: where a line runs when the shell's own folder is gone. */
let home = ''
let bashPath: string | undefined
let hasSoughtBash = false

const titleOf = (shell: ShellName) =>
  shell === 'powershell' ? 'PowerShell' : isWindows ? 'Git Bash' : 'Bash'

const leafOf = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path

const promptOf = (shell: ShellName, cwd: string) =>
  shell === 'powershell' ? `PS ${leafOf(cwd)}>` : `${leafOf(cwd)} $`

const fieldKey = (turn: number) => `line-${turn}`

/** Escape sequences a command writes for a terminal: colours, cursor moves, titles. */
const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?|[@-Z\\-_])/g

/** Output as the pane draws it: no escape sequences, `\n` between lines, a `\r` rewriting its line. */
export const clean = (raw: string): string =>
  raw
    .replace(ANSI, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(row => {
      const body = row.replace(/\r+$/, '')

      return body.slice(body.lastIndexOf('\r') + 1)
    })
    .join('\n')
    .replace(/\t/g, '    ')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')

/** Takes the wrapper's last line out of the output: what is shown, and where the shell ended up. */
export const unmark = (raw: string, mark: string, isOver: boolean) => {
  const at = raw.lastIndexOf(mark)

  if (at < 0) {
    // The mark may be arriving: hold back a tail that is its beginning.
    for (let size = mark.length - 1; size > 2; size -= 1) {
      if (raw.endsWith(mark.slice(0, size))) {
        return { shown: raw.slice(0, -size), landed: undefined }
      }
    }

    return { shown: raw, landed: undefined }
  }

  const end = raw.indexOf('\n', at)
  const rest = end < 0 ? '' : raw.slice(end + 1)
  const landed =
    end < 0 && !isOver
      ? undefined
      : raw.slice(at + mark.length, end < 0 ? undefined : end).trim()

  return { shown: raw.slice(0, at) + rest, landed }
}

const rowsOf = (entry: Entry): Row[] => {
  const rows: Row[] = [
    { text: `${promptOf(entry.shell, entry.cwd)} ${entry.line}`, tone: 'prompt' },
  ]
  const body = entry.output.replace(/\n+$/, '')

  if (entry.isCut) rows.push({ text: '… earlier output not kept', tone: 'dim' })

  if (body !== '') {
    for (const text of body.split('\n')) {
      // A row of nothing draws no row: a space keeps the blank line.
      rows.push({ text: text.trimEnd() || ' ', tone: entry.status === 'failed' ? 'bad' : 'plain' })
    }
  }

  if (entry.status === 'running') rows.push({ text: 'running…', tone: 'dim' })
  if (entry.status === 'stopped') rows.push({ text: 'stopped', tone: 'dim' })

  if (entry.status === 'done' && entry.code !== 0) {
    rows.push({
      text: entry.code === null ? 'ended without an exit code' : `exit ${entry.code}`,
      tone: 'bad',
    })
  }

  return rows
}

/** The newest finished commands, within both caps. */
const kept = (list: readonly Entry[]): Entry[] => {
  const out = list.slice(-HISTORY_ENTRIES)
  let size = out.reduce((sum, one) => sum + one.output.length, 0)

  while (out.length > 1 && size > HISTORY_CHARS) {
    size -= out.shift()?.output.length ?? 0
  }

  return out
}

/** A command and its output as text for the prompt box, fenced past any fence of its own. */
const quoteOf = (entry: Entry): string => {
  const body = entry.output.replace(/\n+$/, '')
  const tail = body.length > QUOTE_CAP ? body.slice(-QUOTE_CAP) : body
  const isShort = tail.length < body.length || entry.isCut
  const ticks = (tail.match(/`+/g) ?? []).reduce((most, run) => Math.max(most, run.length), 2)
  const fence = '`'.repeat(ticks + 1)
  const ending =
    entry.status === 'done' ? `exit code ${entry.code ?? 'unknown'}` : entry.status

  return [
    `I ran this in ${titleOf(entry.shell)} from ${entry.cwd} (${ending}):`,
    '',
    fence,
    `${promptOf(entry.shell, entry.cwd)} ${entry.line}`,
    ...(isShort ? ['[earlier output cut]'] : []),
    ...(tail === '' ? ['[no output]'] : [tail]),
    fence,
    '',
    '',
  ].join('\n')
}

/** A count with its thousands apart: 12,345. */
const grouped = (count: number) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** One command as the pane shows it: its prompt line, its output's tail, and how it ended. */
const blockOf = (entry: Entry): string => {
  const body = entry.output.replace(/\n+$/, '')
  const tail = body.length > QUOTE_CAP ? body.slice(-QUOTE_CAP) : body
  const ending =
    entry.status === 'done'
      ? entry.code === 0
        ? []
        : [`[exit code ${entry.code ?? 'unknown'}]`]
      : [`[${entry.status === 'running' ? 'still running' : entry.status}]`]

  return [
    `${promptOf(entry.shell, entry.cwd)} ${entry.line}`,
    ...(tail.length < body.length || entry.isCut ? ['[earlier output cut]'] : []),
    ...(tail === '' ? [] : [tail]),
    ...ending,
  ].join('\n')
}

/** Every command in the pane as text for the prompt box, oldest first: the newest that fit. */
export const transcriptOf =(list: readonly Entry[]): { text: string; count: number } => {
  const blocks = list.map(blockOf)
  let size = blocks.reduce((sum, block) => sum + block.length, 0)
  let dropped = 0

  while (blocks.length > 1 && size > TRANSCRIPT_CAP) {
    size -= blocks.shift()?.length ?? 0
    dropped += 1
  }

  const body = blocks.join('\n')
  const ticks = (body.match(/`+/g) ?? []).reduce((most, run) => Math.max(most, run.length), 2)
  const fence = '`'.repeat(ticks + 1)
  const count = blocks.length
  const text = [
    `This is the transcript of my shell pane (${count} ${count === 1 ? 'command' : 'commands'}):`,
    '',
    fence,
    ...(dropped === 0 ? [] : [`[${dropped} earlier ${dropped === 1 ? 'command' : 'commands'} cut]`]),
    body,
    fence,
    '',
    '',
  ].join('\n')

  return { text, count }
}

const isFolder = async ($: EngineInterface, path: string): Promise<boolean> => {
  try {
    return (await $.fs.stat(path)).kind === 'dir'
  } catch {
    return false
  }
}

/** Git Bash's own bash.exe, never the `bash` on PATH: on Windows that may be WSL's. */
const findBash = async ($: EngineInterface): Promise<string | undefined> => {
  if (hasSoughtBash) return bashPath
  hasSoughtBash = true

  if (!isWindows) {
    bashPath = 'bash'

    return bashPath
  }

  const guesses: string[] = []
  const named = await $.env.get('CLAUDE_CODE_GIT_BASH_PATH')

  if (named !== undefined && named !== '') guesses.push(named)

  try {
    const found = await $.process.run(['where.exe', 'git'])

    for (const row of found.stdout.split(/\r?\n/)) {
      const git = row.trim()
      const root = git.replace(/\\(?:cmd|bin|mingw64\\bin)\\git\.exe$/i, '')

      if (root !== git) guesses.push(`${root}\\bin\\bash.exe`)
    }
  } catch {
    // No git on PATH: the usual folders are still worth a look.
  }

  guesses.push('C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe')

  for (const guess of guesses) {
    if (await $.fs.exists(guess)) {
      bashPath = guess

      return bashPath
    }
  }

  return undefined
}

const argvFor = async ($: EngineInterface, shell: ShellName): Promise<string[] | undefined> => {
  if (shell === 'powershell') {
    const exe = isWindows ? 'powershell.exe' : 'pwsh'

    // -NoProfile because the script loads the profiles itself, quietly.
    return [exe, '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', POWERSHELL]
  }

  const bash = await findBash($)

  return bash === undefined ? undefined : [bash, '-c', BASH]
}

/** A command the state still shows running with no child behind it (a reload ended it). */
const settleStale = async ($: EngineInterface): Promise<void> => {
  const held = await read($, live)

  if (held === null || running !== undefined) return

  const ended: Entry = { ...held, status: 'stopped', code: null }

  await update($, history, list => kept([...list.filter(one => one.id !== ended.id), ended]))
  await update($, live, (now): Entry | null => (now !== null && now.id === ended.id ? null : now))
}

/** Runs one line to its end, drawing what it writes as it comes. */
const runLine = async ($: EngineInterface, own: Running, line: string): Promise<void> => {
  const shell = await read($, chosen)
  const asked = await read($, where)
  // A folder deleted under the shell would fail every line, `cd` included.
  const cwd = asked === '' || (await isFolder($, asked)) ? asked : home
  const mark = `::shell-pane-${own.id.toString(36)}-${Math.random().toString(36).slice(2, 8)}::`
  const base: Entry = {
    id: own.id,
    shell,
    cwd,
    line,
    output: '',
    isCut: false,
    status: 'running',
    code: null,
  }
  let raw = ''
  let isCut = false
  let code: number | null = null
  let failure: string | undefined
  let timer: Timer | undefined

  const draw = () => {
    timer = undefined
    void update($, live, (now): Entry | null =>
      now === null || now.id !== own.id
        ? now
        : { ...now, output: clean(unmark(raw, mark, false).shown), isCut },
    )
  }

  await update($, live, (): Entry | null => base)
  void $.ui.scroll({ in: PANE, to: 'end' }).catch(() => undefined)

  try {
    const argv = await argvFor($, shell)

    if (argv === undefined) throw new Error(NO_BASH)

    const child = $.process.spawn({
      argv,
      ...(cwd === '' ? {} : { cwd }),
      env: { SHELL_PANE_LINE: line, SHELL_PANE_MARK: mark },
    })

    own.stop = () => {
      own.isStopped = true
      // Ending the stream is what kills the child, and what it started. From a
      // timer, so the press that asked is answered without waiting on the kill.
      $.clock.after(0, () => {
        void child.return({ code: null, signal: null }).catch(() => undefined)
      })
    }

    if (own.isStopped) own.stop()

    for (;;) {
      const step = await child.next()

      if (step.done) {
        code = step.value?.code ?? null
        break
      }

      raw += step.value.text

      if (raw.length > OUTPUT_CAP) {
        const tail = raw.slice(-OUTPUT_CAP)

        // From a line's start, so no escape sequence is left cut in two.
        raw = tail.slice(tail.indexOf('\n') + 1)
        isCut = true
      }

      timer ??= $.clock.after(FLUSH_MS, draw)
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }

  timer?.cancel()

  const { shown, landed } = unmark(raw, mark, true)
  const output = clean(shown)
  const status = failure !== undefined ? 'failed' : own.isStopped ? 'stopped' : 'done'
  const ended: Entry = {
    ...base,
    output: failure === undefined ? output : [output.replace(/\n+$/, ''), failure].filter(Boolean).join('\n'),
    isCut,
    status,
    code: status === 'done' ? code : null,
  }

  if (landed !== undefined && landed !== '' && landed !== asked && (await isFolder($, landed))) {
    await update($, where, () => landed)
  } else if (cwd !== asked) {
    await update($, where, () => cwd)
  }

  await update($, history, list => kept([...list, ended]))
  await update($, live, (now): Entry | null => (now !== null && now.id === own.id ? null : now))

  if (running === own) running = undefined

  void $.ui.scroll({ in: PANE, to: 'end' }).catch(() => undefined)
}

/** Enter in the field: takes the line, empties the field, and runs it. */
const submitLine = async ($: EngineInterface, text: string): Promise<void> => {
  const line = text.trim()

  if (line === '') return

  if (running !== undefined) {
    $.ui.toast(BUSY)

    return
  }

  const isClear = line === 'clear' || line === 'cls'
  const own: Running = { id: nextId, isStopped: false, stop: () => undefined }

  own.stop = () => {
    own.isStopped = true
  }
  nextId += 1

  // Claimed before the first wait, so a second Enter cannot start a second child.
  if (!isClear) running = own

  draft = ''

  // A new key is a new field: empty, whatever the surface does with a submitted one.
  const turn = await update($, epoch, count => count + 1)

  void $.ui.focus({ requestId: PANE, key: fieldKey(turn) }).catch(() => undefined)

  if (isClear) {
    await update($, history, () => [])

    return
  }

  await runLine($, own, line)
}

const quoteLast = async ($: EngineInterface): Promise<void> => {
  const list = await read($, history)
  const last = list[list.length - 1]

  if (last === undefined) return

  const filled = await $.prompt.fill({ text: quoteOf(last), mode: 'append' })

  $.ui.toast(
    filled.isFilled
      ? 'shell-pane: quoted into the prompt box. Nothing is sent until you press Enter there.'
      : 'shell-pane: the prompt box did not take the quote.',
  )
}

const quoteAll = async ($: EngineInterface): Promise<void> => {
  const list = await read($, history)
  const held = await read($, live)
  // What the pane shows: the finished commands, then the one in flight.
  const shown = held !== null && !list.some(one => one.id === held.id) ? [...list, held] : list

  if (shown.length === 0) return

  const { text, count } = transcriptOf(shown)
  const filled = await $.prompt.fill({ text, mode: 'append' })

  $.ui.toast(
    filled.isFilled
      ? `shell-pane: quoted ${count} ${count === 1 ? 'command' : 'commands'} (${grouped(text.length)} characters) into the prompt box. Nothing is sent until you press Enter there.`
      : 'shell-pane: the prompt box did not take the quote.',
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    isWindows = (await $.env.get('OS')) === 'Windows_NT'
    home = e.cwd

    await $.command.register({
      name: 'shell',
      description: 'Open the shell pane: commands you type run in PowerShell or Git Bash, and stay out of the conversation',
    })

    if ((await read($, where)) === '') await update($, where, () => e.cwd)

    await settleStale($)

    return next(e)
  })

  on('command.run', { command: 'shell' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Shell', focus: true })

    return {
      text: opened.isPlaced
        ? 'Shell pane opened.'
        : 'Shell pane is open, but this surface has not drawn it.',
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const shell = await read($, chosen)
    const cwd = await read($, where)
    const list = await read($, history)
    const held = await read($, live)
    const turn = await read($, epoch)
    // Between the two writes that end a command it is in both: draw it once.
    const current = held !== null && !list.some(one => one.id === held.id) ? held : null
    const rows = [...list, ...(current === null ? [] : [current])].flatMap(rowsOf)
    const hidden = Math.max(0, rows.length - ROWS)
    const header = `${titleOf(shell)} · ${cwd}`

    if (e.surface === 'mobile') {
      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
          <Text dimColor>{header}</Text>
          {rows.slice(-ROWS).map(row => (
            <Text dimColor={row.tone === 'dim'}>{row.text}</Text>
          ))}
          <Text dimColor>This surface has no text field: type commands from the terminal.</Text>
        </Box>
      )
    }

    const { Box, Button, Input, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text dimColor wrap="truncate-start">
          {header}
        </Text>
        {rows.length === 0 && (
          <Text dimColor>
            Type a command and press Enter. It runs here, not in the conversation. cd carries over;
            variables do not. clear empties the pane.
          </Text>
        )}
        {hidden > 0 && <Text dimColor>… {hidden} earlier rows not drawn</Text>}
        {rows.slice(-ROWS).map(row =>
          row.tone === 'bad' ? (
            <Text color="error">{row.text}</Text>
          ) : (
            <Text bold={row.tone === 'prompt'} dimColor={row.tone === 'dim'}>
              {row.text}
            </Text>
          ),
        )}
        <Input
          key={fieldKey(turn)}
          label={promptOf(shell, cwd)}
          placeholder="command"
          value={draft}
          submitLabel="run"
          autoFocus
          onInput={value => {
            draft = value
          }}
          onSubmit={value => {
            // Off the dispatch: a command may run long after this Enter is answered.
            $.clock.after(0, () => {
              void submitLine($, value)
            })
          }}
        />
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Button
            key="shell"
            label={`Switch to ${titleOf(OTHER[shell])}`}
            onPress={() => update($, chosen, now => OTHER[now])}
          />
          {current !== null && (
            <Button
              key="stop"
              label="Stop"
              variant="primary"
              onPress={() => (running === undefined ? settleStale($) : running.stop())}
            />
          )}
          {list.length > 0 && (
            <Button key="quote" label="Quote to prompt" onPress={() => quoteLast($)} />
          )}
          {rows.length > 0 && (
            <Button
              key="quote-all"
              label="Quote entire transcript to prompt"
              onPress={() => quoteAll($)}
            />
          )}
          {list.length > 0 && (
            <Button key="clear" label="Clear" onPress={() => update($, history, () => [])} />
          )}
        </Box>
      </Box>
    )
  })
}
