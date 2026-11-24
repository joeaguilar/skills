import type { LinkedFile } from '../types'

/** A piece of a reply that may name a file, before the file system is asked. */
export type Candidate = { raw: string; line?: number }

/** Where in the reply a spelling stood: a markdown link's target, a code span, or a bare word. */
type Source = 'link' | 'span' | 'word'

/** Where a relative spelling is looked for, and whose home `~` stands for. */
export type Roots = { cwd: string; others: readonly string[]; home?: string }

export type Action = 'folder' | 'open' | 'cat'
export type Platform = 'windows' | 'macos' | 'linux'
export type Launch = { argv: string[]; env: Record<string, string> }

/** On Windows the path rides in this variable, never in a script's text: no quoting can break. */
export const PATH_VAR = 'OPEN_LINKS_PATH'

/** Spellings one block of a reply may have asked about; most cost one `stat` and are no file. */
const MAX_CANDIDATES = 400
const MAX_LENGTH = 400

// A target may hold one level of parentheses of its own (`docs/a(1).md`), and
// a title may follow it in double quotes, single quotes or parentheses.
const MARKDOWN_LINK =
  /\]\(\s*(?:<([^>\n]+)>|((?:[^()\s]|\([^()\s]*\))+))(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?\s*\)/g
const CODE_SPAN = /`([^`\n]+)`/g
const LINE_SUFFIX = /^(.+?)(?::(\d+)(?::\d+)?(?:-\d+)?|#L(\d+)(?:C\d+)?(?:-L?\d+(?:C\d+)?)?)$/
/** A bare word is a file's name only when it ends in an extension: `CLAUDE.md`, `résumé.pdf`. */
const BARE_NAME = /^[\p{L}\p{N}_@+~.-]*\.[\p{L}\p{N}]{1,10}$/u

const isDrivePath = (path: string) => /^[A-Za-z]:[\\/]/.test(path)

/**
 * The reply without its fenced blocks: a tree or a command listing links
 * nothing. A fence ends on a line of its own mark, at least as long, with
 * nothing after it; one inside a blockquote counts too.
 */
const proseOf = (text: string) => {
  const kept: string[] = []
  let fence: { mark: string; length: number } | undefined

  for (const row of text.split(/\r?\n/)) {
    const found = /^(`{3,}|~{3,})(.*)$/.exec(row.replace(/^(?:\s*>)*\s*/, ''))
    const run = found?.[1] ?? ''
    const after = found?.[2] ?? ''
    const mark = run[0]

    if (fence === undefined) {
      // ```code``` on one line is a code span, not a fence.
      if (mark === undefined || (mark === '`' && after.includes('`'))) {
        kept.push(row)
      } else {
        fence = { mark, length: run.length }
      }
    } else if (mark === fence.mark && run.length >= fence.length && after.trim() === '') {
      fence = undefined
    }
  }

  return kept.join('\n')
}

const decoded = (text: string) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * Whether a spelling is worth asking the file system about. Between backticks
 * or in a link's target any name is, whatever it holds (`Makefile`,
 * `notes (1).txt`): its ends are marked. A bare word must look like a path.
 */
const isPlausible = (spelled: string, isMarked: boolean) =>
  spelled.length >= (isMarked ? 1 : 2) &&
  spelled.length <= MAX_LENGTH &&
  /[\p{L}\p{N}]/u.test(spelled) &&
  !/^[\d.,:/-]+$/.test(spelled) &&
  !/[*?]/.test(spelled) &&
  !/^(?!file:)[a-z][a-z0-9+.-]*:\/\//i.test(spelled) &&
  !/^(?:mailto:|www\.)/i.test(spelled) &&
  (isMarked ||
    (!/[<>|"]/.test(spelled) &&
      (/[\\/]/.test(spelled) || spelled.startsWith('~') || BARE_NAME.test(spelled))))

/**
 * `src/a.ts:12`, `src/a.ts:12:5`, `src/a.ts:12-30` and `src/a.ts#L12` name
 * line 12 of `src/a.ts`. A link's target spells a space as %20 and may end in
 * a heading's anchor, which a file's own name may hold too (`C#.md`): it is
 * asked about with the anchor and without.
 */
const readingsOf = (spelled: string, from: Source): Candidate[] => {
  const { raw, line } = typedCandidate(spelled)
  // A bare word in `_emphasis_` is asked about with its underscores and without.
  const inner = /^_(.+)_$/.exec(raw)?.[1]
  const spellings =
    from === 'link'
      ? [decoded(raw), decoded(raw.replace(/#[^\\/#]*$/, ''))]
      : from === 'word' && inner !== undefined
        ? [raw, inner]
        : [raw]

  return spellings
    .filter((one, at) => spellings.indexOf(one) === at && isPlausible(one, from !== 'word'))
    .map(one => (line === undefined ? { raw: one } : { raw: one, line }))
}

/** A spelling the person typed, taken as typed: only a line suffix is cut from it. */
export const typedCandidate = (spelled: string): Candidate => {
  const cut = LINE_SUFFIX.exec(spelled)
  const line = cut === null ? undefined : Number(cut[2] ?? cut[3])
  const raw = cut?.[1] ?? spelled

  return line === undefined || line === 0 ? { raw } : { raw, line }
}

/** Whether a spelling looks like a path by itself: these are asked about first in a long reply. */
const isPathLike = (raw: string) => /[\\/]/.test(raw) || BARE_NAME.test(raw)

/**
 * Everything in a reply's prose that may name a file: the targets of its
 * markdown links, its code spans, and bare words with a separator or an
 * extension. Most are no file at all: the file system decides.
 */
export const candidatesOf = (text: string): Candidate[] => {
  // Each spelling once, at the place the reply first names it.
  const found = new Map<string, { at: number; one: Candidate; isStrong: boolean }>()
  const keep = (at: number, spelled: string, from: Source) => {
    for (const one of readingsOf(spelled.trim(), from)) {
      const held = found.get(one.raw)

      if (held === undefined) {
        found.set(one.raw, { at, one, isStrong: from === 'link' || isPathLike(one.raw) })
      } else if (at < held.at) {
        found.set(one.raw, { ...held, at, one })
      }
    }
  }
  // What is read is blanked in place, so every later match keeps its offset.
  const blank = (whole: string) => ' '.repeat(whole.length)
  let rest = proseOf(text).replace(
    MARKDOWN_LINK,
    (whole: string, angled: string | undefined, bare: string | undefined, at: number) => {
      keep(at, angled ?? bare ?? '', 'link')

      return blank(whole)
    },
  )

  rest = rest.replace(CODE_SPAN, (whole: string, span: string, at: number) => {
    keep(at, span, 'span')

    return blank(whole)
  })

  // A word ends at a space, a table's bar, a dash or an ellipsis; what wraps
  // it (brackets, quotes, emphasis, closing punctuation, a possessive) is cut.
  for (const word of rest.matchAll(/[^\s|—…]+/g)) {
    const bare = word[0]
      .replace(/^[([{<"'*“‘]+/, '')
      .replace(/[)\]}>"'*.,;:!?”’]+$/, '')
      .replace(/['’]s$/, '')

    keep(word.index, bare, 'word')
  }

  // A reply too long to ask about in full keeps what looks like a path first.
  const seen = [...found.values()]
  const strong = seen.filter(one => one.isStrong).slice(0, MAX_CANDIDATES)
  const weak = seen.filter(one => !one.isStrong).slice(0, MAX_CANDIDATES - strong.length)

  // In the order the reply names them. The sort is stable, so a spelling's
  // two readings stay in the order they were made.
  return [...strong, ...weak].sort((one, other) => one.at - other.at).map(({ one }) => one)
}

/** `.` and `..` resolved, one separator between names, the host's own. */
const normalized = (path: string, isWindows: boolean) => {
  const drive = isWindows ? (/^[A-Za-z]:/.exec(path)?.[0] ?? '') : ''
  const body = path.slice(drive.length)
  const separator = isWindows ? '\\' : '/'
  const names: string[] = []

  for (const name of body.split(isWindows ? /[\\/]+/ : /\/+/)) {
    if (name === '..') {
      names.pop()
    } else if (name !== '' && name !== '.') {
      names.push(name)
    }
  }

  const isRooted = isWindows ? /^[\\/]/.test(body) : body.startsWith('/')

  return `${drive.toUpperCase()}${isRooted ? separator : ''}${names.join(separator)}`
}

/**
 * The absolute paths a spelling may stand for, likeliest first: itself when
 * absolute, else under the working directory and then each other root.
 * A network or device path (`\\server`, `//server`) is never asked about.
 */
export const attemptsOf = (raw: string, roots: Roots): string[] => {
  const isWindows = isDrivePath(roots.cwd)
  const separator = isWindows ? '\\' : '/'
  const bases = [roots.cwd, ...roots.others]
  const under = (tail: string) => bases.map(base => normalized(`${base}${separator}${tail}`, isWindows))
  let spelled = raw

  if (/^file:\/\//i.test(spelled)) {
    spelled = decoded(spelled.replace(/^file:\/\/(?:localhost)?/i, ''))

    if (/^\/[A-Za-z]:/.test(spelled)) {
      spelled = spelled.slice(1)
    }
  }

  // A link may spell a Windows path the way a URL does: `/C:/Users/me/f.txt`.
  if (isWindows && /^\/[A-Za-z]:[\\/]/.test(spelled)) {
    spelled = spelled.slice(1)
  }

  let attempts: string[]

  if (/^[\\/]{2}/.test(spelled)) {
    attempts = []
  } else if (spelled === '~' || /^~[\\/]/.test(spelled)) {
    attempts =
      roots.home === undefined
        ? []
        : [normalized(`${roots.home}${separator}${spelled.slice(2)}`, isWindows)]
  } else if (isWindows && isDrivePath(spelled)) {
    attempts = [normalized(spelled, true)]
  } else if (isWindows && /^[A-Za-z]:/.test(spelled)) {
    // `D:notes.txt` is relative to a directory this module cannot know.
    attempts = []
  } else if (isWindows && /^[\\/]/.test(spelled)) {
    // `/src/a.ts` from the project's root, or Git Bash's `/c/Users/...`.
    const drive = /^\/([A-Za-z])(?:\/(.*))?$/.exec(spelled)

    attempts = under(spelled.slice(1))

    if (drive !== null) {
      attempts.push(normalized(`${drive[1]}:\\${drive[2] ?? ''}`, true))
    }
  } else if (spelled.startsWith('/')) {
    attempts = [normalized(spelled, false), ...under(spelled.slice(1))]
  } else {
    attempts = under(spelled)
  }

  return attempts.filter((path, at) => path !== '' && attempts.indexOf(path) === at)
}

/**
 * Whether two absolute paths name one file, as the host's file system compares
 * names: without regard to case on Windows and, by default, on macOS.
 */
export const isSamePath = (one: string, other: string, isCaseBlind = isDrivePath(one)) =>
  isCaseBlind ? one.toLowerCase() === other.toLowerCase() : one === other

/** How a file is named on screen: from the working directory, else from `~`, else in full. */
export const labelOf = (path: string, roots: Roots, line?: number) => {
  const isWindows = isDrivePath(roots.cwd)
  const separator = isWindows ? '\\' : '/'
  const fold = (text: string) => (isWindows ? text.toLowerCase() : text)
  const tailUnder = (root: string | undefined) => {
    if (root === undefined) {
      return undefined
    }

    // A root (`C:\`, `/`) already ends in its separator.
    const base = normalized(root, isWindows)
    const lead = base.endsWith(separator) ? base : `${base}${separator}`

    return fold(path).startsWith(fold(lead)) ? path.slice(lead.length) : undefined
  }
  const inProject = tailUnder(roots.cwd)
  const inHome = tailUnder(roots.home)
  const shown = inProject ?? (inHome === undefined ? path : `~${separator}${inHome}`)

  return `${shown.replaceAll('\\', '/')}${line === undefined ? '' : `:${line}`}`
}

/** The folder that holds a path; a root holds itself. */
export const parentOf = (path: string) => {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))

  if (cut < 0) {
    return path
  }

  const parent = path.slice(0, cut)

  return parent === '' || /^[A-Za-z]:$/.test(parent) ? path.slice(0, cut + 1) : parent
}

const powershell = (script: string) => [
  'powershell.exe',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  `$ErrorActionPreference = 'Stop'; ${script}`,
]

/** A path as `printf %b` prints it back: every byte an octal escape, nothing a shell reads. */
const octalOf = (path: string) =>
  Array.from(new TextEncoder().encode(path), byte => `\\0${byte.toString(8).padStart(3, '0')}`).join('')

/**
 * The command behind each button, by argument vector (no shell reads it).
 *
 * - `folder`: the file manager with the file (or the linked folder) selected:
 *   Explorer, Finder.
 * - `open`: the program the system opens that kind of file with (`ii`, `open`).
 * - `cat`: a new terminal window that prints the file and stays open.
 */
export const launchOf = (
  action: Action,
  file: Pick<LinkedFile, 'path' | 'kind'>,
  platform: Platform,
): Launch => {
  const isFolder = file.kind === 'dir'

  if (platform === 'windows') {
    const env = { [PATH_VAR]: file.path }
    const held = `$env:${PATH_VAR}`

    if (action === 'cat') {
      const print = isFolder
        ? `Get-ChildItem -LiteralPath ${held}`
        : `Get-Content -Encoding UTF8 -LiteralPath ${held}`

      // The new window inherits the variable; `-NoProfile` keeps a profile's own output out of it.
      return {
        argv: powershell(
          `Start-Process powershell.exe -ArgumentList '-NoExit','-NoProfile','-Command','$Host.UI.RawUI.WindowTitle = ${held}; ${print}'`,
        ),
        env,
      }
    }

    if (action === 'folder') {
      // Explorer wants the quotes inside the argument: /select,"C:\a b\c.txt"
      return {
        argv: powershell(
          `Start-Process explorer.exe -ArgumentList ('/select,' + [char]34 + ${held} + [char]34)`,
        ),
        env,
      }
    }

    return { argv: powershell(`Invoke-Item -LiteralPath ${held}`), env }
  }

  if (platform === 'macos') {
    if (action === 'cat') {
      // Terminal types the command into the person's own shell, whichever it
      // is (zsh, fish, tcsh), so the path goes in as octal digits that only
      // the `sh` it starts turns back into a name.
      const typed = `/bin/sh -c '${isFolder ? 'ls -la' : 'cat'} -- "$(printf %b "$0")"' '${octalOf(file.path)}'`
      const quoted = typed.replaceAll('\\', '\\\\').replaceAll('"', '\\"')

      return {
        argv: [
          'osascript',
          '-e',
          'tell application "Terminal"',
          '-e',
          'activate',
          '-e',
          `do script "${quoted}"`,
          '-e',
          'end tell',
        ],
        env: {},
      }
    }

    return { argv: action === 'folder' ? ['open', '-R', file.path] : ['open', file.path], env: {} }
  }

  if (action === 'cat') {
    // The terminal is started detached with nothing left open to it, so this
    // call returns at once and the window outlives it. The path is `$0` of
    // both shells: an argument, never part of a script.
    const print = `${isFolder ? 'ls -la' : 'cat'} -- "$0"; exec "\${SHELL:-sh}"`

    return {
      argv: [
        'sh',
        '-c',
        `setsid -f x-terminal-emulator -e sh -c '${print}' "$0" >/dev/null 2>&1 </dev/null`,
        file.path,
      ],
      env: {},
    }
  }

  return { argv: ['xdg-open', action === 'folder' ? parentOf(file.path) : file.path], env: {} }
}
