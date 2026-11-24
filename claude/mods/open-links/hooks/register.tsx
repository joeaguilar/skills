import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Band, LinkedFile } from '../types'
import {
  attemptsOf,
  candidatesOf,
  isRunByOpen,
  isSamePath,
  labelOf,
  launchOf,
  SHOWN_MARK,
  typedCandidate,
} from './links'
import type { Action, Candidate, Platform, Roots } from './links'

const PANE = 'open-links'
const TITLE = 'Links'
/** Files the band draws at once; the rest are a press of Next away. */
const BAND_ROWS = 3
/** The session's list is bounded so the stored value and the pane's tree stay small. */
const HISTORY_FILES = 200
/** `[ Folder ] [ Open ] [ Cat ]` and the indent before the path, with room to spare. */
const BUTTONS_COLUMNS = 32
const LAUNCH_TIMEOUT_MS = 20_000

const ACTIONS = ['folder', 'open', 'cat'] as const

// No button of the band carries a hotkey: every mod's band shares one set of
// letters, and this mod takes none of them.
const LABELS: Record<Action, string> = { folder: 'Folder', open: 'Open', cat: 'Cat' }

const DOING: Record<Action, string> = {
  folder: 'show it in its folder',
  open: 'open it',
  cat: 'print it in a terminal',
}

const USAGE = 'Usage: /links, or /links folder|open|cat <path or number in the list>'

const NO_FILES: Band = { files: [], first: 0, isHidden: false, turn: 0 }

// Change a tag when the value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const band = atom({ plugin: 'open-links', key: 'band' } as const, NO_FILES, { shape: 'band-3' })
const history = atom({ plugin: 'open-links', key: 'history' } as const, [], { shape: 'files-1' })

/**
 * The main loop's turn now running, counted up at each start. A block of a
 * reply is stamped with it when stored, since its files are found later,
 * perhaps after the next turn began. It starts at the clock so that a
 * reloaded module still counts past what the band already holds.
 */
let turnNow = Date.now()

type Place = { roots: Roots; platform: Platform; isCaseBlind: boolean }

const isAction = (word: string): word is Action => (ACTIONS as readonly string[]).includes(word)

/** Where the band's rows start: as stored, pulled back so the last rows are a full window. */
const windowStart = (first: number, count: number) =>
  Math.max(0, Math.min(first, count - BAND_ROWS))

/** Where Next takes the band: the rows after, and from the last rows back to the first. */
const windowAfter = (first: number, count: number) =>
  windowStart(first, count) + BAND_ROWS >= count ? 0 : windowStart(first + BAND_ROWS, count)

/** Where relative spellings are looked for, and which system opens what is found. */
const placeOf = async ($: EngineInterface): Promise<Place> => {
  const cwd = await $.session.cwd()
  const isWindowsSpelled = /^[A-Za-z]:[\\/]/.test(cwd)
  const [root, repo, info, home] = await Promise.all([
    $.session.root().catch(() => undefined),
    $.session.repo().catch(() => null),
    $.session.info().catch(() => undefined),
    (isWindowsSpelled ? $.env.get('USERPROFILE') : $.env.get('HOME')).catch(() => undefined),
  ])
  const others = [root, repo?.root].filter(
    (one, at, all): one is string =>
      one !== undefined && !isSamePath(one, cwd) && all.indexOf(one) === at,
  )
  const named = info?.platform
  const platform: Platform =
    named === 'windows' || named === 'macos'
      ? named
      : named === 'linux' || named === 'wsl'
        ? 'linux'
        : isWindowsSpelled
          ? 'windows'
          : 'linux'

  return {
    roots: { cwd, others, ...(home === undefined ? {} : { home }) },
    platform,
    // Windows and, as it is formatted by default, macOS take `README.md` and `readme.md` for one file.
    isCaseBlind: platform !== 'linux',
  }
}

/** The file a spelling leads to, or nothing: most words spelled like a file are none. */
const locate = async (
  $: EngineInterface,
  candidate: Candidate,
  roots: Roots,
): Promise<LinkedFile | undefined> => {
  for (const path of attemptsOf(candidate.raw, roots)) {
    const stat = await $.fs.stat(path).catch(() => undefined)

    if (stat !== undefined && stat.kind !== 'other') {
      const line = stat.kind === 'file' ? candidate.line : undefined

      return {
        path,
        label: labelOf(path, roots, line),
        kind: stat.kind,
        ...(line === undefined ? {} : { line }),
      }
    }
  }

  return undefined
}

const distinct = (files: readonly LinkedFile[], isCaseBlind: boolean) =>
  files.filter(
    (file, at) => files.findIndex(one => isSamePath(one.path, file.path, isCaseBlind)) === at,
  )

/**
 * The band after a block stored in turn `turn` linked `files`: a new list when
 * that turn is newer than the band's, a longer one when it is the same, and
 * the band as it is when a later turn has already taken it.
 */
const withLinks = (
  held: Band,
  files: readonly LinkedFile[],
  turn: number,
  isCaseBlind: boolean,
): Band => {
  if (turn < held.turn) {
    return held
  }

  if (turn > held.turn) {
    return { ...NO_FILES, files: [...files], turn }
  }

  const all = distinct([...held.files, ...files], isCaseBlind)

  return all.length === held.files.length ? held : { ...held, files: all }
}

/**
 * Reads one block of a reply and keeps the files it links. Runs beside the
 * turn, never in its way; `turn` is the turn the block was stored in.
 */
const noteLinks = async ($: EngineInterface, text: string, turn: number) => {
  const candidates = candidatesOf(text)

  if (candidates.length === 0) {
    return
  }

  const { roots, isCaseBlind } = await placeOf($)
  const located = await Promise.all(candidates.map(candidate => locate($, candidate, roots)))
  const files = distinct(
    located.filter((file): file is LinkedFile => file !== undefined),
    isCaseBlind,
  )

  if (files.length === 0) {
    return
  }

  await update($, band, (held): Band => withLinks(held, files, turn, isCaseBlind))
  await update($, history, (held): LinkedFile[] =>
    distinct([...files, ...held], isCaseBlind).slice(0, HISTORY_FILES),
  )
}

/** Takes a file that is gone off both lists, the band keeping a full window of rows. */
const forget = async ($: EngineInterface, gone: LinkedFile) => {
  const without = (files: readonly LinkedFile[]) => files.filter(file => file.path !== gone.path)

  await update($, band, (held): Band => {
    const files = without(held.files)

    return { ...held, files, first: windowStart(held.first, files.length) }
  })
  await update($, history, (held): LinkedFile[] => without(held))
}

/**
 * Runs the command behind a button. Answers what the person should be told:
 * what went wrong, or that Open showed a program in its folder instead of
 * running it; nothing when the command did as its button says.
 */
const launch = async ($: EngineInterface, action: Action, file: LinkedFile) => {
  // The file was on disk when the reply named it; it may have been deleted since.
  const stat = await $.fs.stat(file.path).catch(() => undefined)

  if (stat === undefined) {
    await forget($, file)

    return `Links: ${file.label} is no longer on disk`
  }

  const { platform } = await placeOf($)
  // What is there now decides, not what was there when the reply named it.
  const found = { path: file.path, kind: stat.kind === 'dir' ? 'dir' : 'file' } as const
  // Open never runs what a reply named: a program is shown where it is.
  const done: Action = action === 'open' && isRunByOpen(found, platform) ? 'folder' : action
  const { argv, env } = launchOf(done, found, platform)

  try {
    const ran = await $.process.run(argv, { env, timeoutMs: LAUNCH_TIMEOUT_MS })

    if (ran.exitCode === 0) {
      // Where only the press can tell (`launchOf`), the command says that it showed the file.
      const isShown = action === 'open' && (done === 'folder' || ran.stdout.trim() === SHOWN_MARK)

      return isShown
        ? `Links: ${file.label} would run if opened, so it is shown in its folder`
        : undefined
    }

    const said = ran.stderr.trim().split(/\r?\n/)[0] ?? ''

    return `Links: could not ${DOING[done]} (${file.label}): ${said === '' ? `exit ${ran.exitCode}` : said}`
  } catch (error) {
    return `Links: could not ${DOING[done]} (${file.label}): ${error instanceof Error ? error.message : String(error)}`
  }
}

const press = async ($: EngineInterface, action: Action, file: LinkedFile) => {
  const told = await launch($, action, file)

  if (told !== undefined) {
    $.ui.toast(told)
  }
}

/** The session's list as text, for a surface that draws no pane. */
const listing = (files: readonly LinkedFile[]) =>
  files.length === 0
    ? 'Links: no reply has linked a file yet.'
    : ['Links (newest first):', ...files.map((file, at) => `${at + 1}. ${file.label}`), USAGE].join(
        '\n',
      )

/** `/links cat 2`, `/links open src/a.ts:12`: the same three actions, typed. */
const runTyped = async ($: EngineInterface, action: Action, named: string) => {
  const spelled = named.replace(/^["'`]|["'`]$/g, '')
  const files = await read($, history)
  const listed = /^\d+$/.test(spelled) ? files[Number(spelled) - 1] : undefined
  const file = listed ?? (await locate($, typedCandidate(spelled), (await placeOf($)).roots))

  if (file === undefined) {
    return spelled === '' ? USAGE : `Links: no file at ${spelled}`
  }

  return (await launch($, action, file)) ?? `Links: ${LABELS[action]} ${file.label}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // A rejection here would skip the whole hook, so it is caught on the spot.
    await $.command
      .register({
        name: 'links',
        description:
          'List the files this session’s replies linked; open one in its folder, its own program, or a terminal',
        argumentHint: '[folder|open|cat <path or number>]',
        immediate: true,
      })
      .catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'links' }, async ($, e) => {
    const typed = e.args.trim()
    const verb = typed.split(/\s+/, 1)[0] ?? ''

    if (isAction(verb)) {
      // The rest is the path as typed, its own spaces kept.
      const named = typed.slice(verb.length).trim()

      return { text: await runTyped($, verb, named), isTextDisplayOnly: true }
    }

    if (verb !== '') {
      return { text: USAGE, isTextDisplayOnly: true }
    }

    const opened = await $.ui
      .open({ id: PANE, title: TITLE, focus: true, closeOnEscape: true })
      .catch(() => ({ isPlaced: false }))

    // Where no pane is drawn (a headless run, a surface without one) the list is printed.
    return opened.isPlaced ? {} : { text: listing(await read($, history)), isTextDisplayOnly: true }
  })

  // Each block of the main loop's reply is read once it is stored. The row is
  // handed on first and nothing is parsed before it is kept: finding the files
  // never holds the turn.
  on('session.append', { door: 'response' }, ($, e, next) => {
    const kept = next(e)

    if (e.agentId === undefined) {
      const turn = turnNow
      const text = e.message.content
        .map(block => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
        .join('\n')

      if (text.trim() !== '') {
        void kept.then(() => noteLinks($, text, turn)).catch(() => undefined)
      }
    }

    return kept
  }).catch((_$, e, next) => next(e))

  // The list stays up while the next turn runs; that turn's first link replaces
  // it. A turn is the unit, however it began (a prompt, a background task's
  // notification): a prompt typed mid-turn is folded into the turn running.
  on('turn.start', (_$, e, next) => {
    if (e.agentId === undefined) {
      turnNow += 1
    }

    return next(e)
  }).catch((_$, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const held = await read($, band)
    const count = held.files.length

    if (count === 0 || held.isHidden) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const first = windowStart(held.first, count)
    const shown = held.files.slice(first, first + BAND_ROWS)
    const room = Math.max(12, e.props.bodyColumns - BUTTONS_COLUMNS - (count === 1 ? 16 : 0))
    const width = Math.min(room, Math.max(...shown.map(file => file.label.length)))
    const hide = (
      <Button
        key="band-hide"
        label="Hide"
        onPress={() => update($, band, (now): Band => ({ ...now, isHidden: true }))}
      />
    )
    const rowOf = (file: LinkedFile, at: number) => (
      <Box flexDirection="row" columnGap={1}>
        {count === 1 ? <Text bold>{TITLE}</Text> : <Text> </Text>}
        <Box width={width}>
          <Text wrap="truncate-start">{file.label}</Text>
        </Box>
        {ACTIONS.map(action => (
          <Button
            key={`band-${action}-${at}`}
            label={LABELS[action]}
            onPress={() => press($, action, file)}
          />
        ))}
        {count === 1 && hide}
      </Box>
    )

    if (count === 1) {
      return rowOf(held.files[0] as LinkedFile, 0)
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Text bold>{TITLE}</Text>
          <Text dimColor>
            {count > BAND_ROWS
              ? `${first + 1}-${first + shown.length} of ${count}`
              : `${count} files`}
          </Text>
          {count > BAND_ROWS && (
            <Button
              key="band-next"
              label="Next"
              onPress={() =>
                update($, band, (now): Band => ({
                  ...now,
                  first: windowAfter(now.first, now.files.length),
                }))
              }
            />
          )}
          {hide}
        </Box>
        {shown.map((file, offset) => rowOf(file, first + offset))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const files = await read($, history)

    return (
      <Box flexDirection="column">
        {files.length === 0 && <Text dimColor>No reply has linked a file yet.</Text>}
        {files.map((file, at) => (
          <Box flexDirection="column">
            <Text wrap="truncate-start">
              {at + 1}. {file.label}
            </Text>
            <Box flexDirection="row" columnGap={1}>
              <Text> </Text>
              {ACTIONS.map(action => (
                <Button
                  key={`pane-${action}-${at}`}
                  label={LABELS[action]}
                  onPress={() => press($, action, file)}
                />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    )
  })
}
