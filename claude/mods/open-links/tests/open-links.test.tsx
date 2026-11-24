import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import { attemptsOf, candidatesOf, labelOf, launchOf, PATH_VAR } from '../hooks/links'
import type { Platform } from '../hooks/links'
import type { Band, LinkedFile } from '../types'

const BAND = {
  plugin: 'open-links',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

const PANE = {
  plugin: 'open-links',
  component: 'Pane',
  requestId: 'open-links',
  props: {
    title: 'Links',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

type Options = {
  files?: readonly string[]
  folders?: readonly string[]
  platform?: Platform
  exitCode?: number
  stderr?: string
  hasPane?: boolean
}

type Ran = { argv: readonly string[]; env: Readonly<Record<string, string>> | undefined }

/** The kit hands a path over in the host's spelling: `/repo` is `C:\repo` on Windows. */
const spelled = (path: string) => path.replace(/^[A-Za-z]:(?=[\\/])/, '').replace(/\\/g, '/')

/** The world beneath the mod: a project on disk, the host's programs, and what was shown. */
const world = (on: On, options: Options = {}) => {
  const files = new Set(options.files ?? ['/repo/src/a.ts', '/repo/README.md', '/repo/docs/b c.md'])
  const folders = new Set(options.folders ?? ['/repo/src', '/repo/docs'])
  const toasts: string[] = []
  const ran: Ran[] = []
  const written = new Map<string, unknown>()
  const clock = mock.clock(on)

  mock.env(on, { HOME: '/home/me', USERPROFILE: '/home/me' })
  mock.session(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.repo', () => ({
    value: { name: 'repo', root: '/repo', remote: null, internal: false },
  }))
  on('session.info', () => ({
    value: { transcriptPath: '/repo/t.jsonl', platform: options.platform ?? 'macos' },
  }))
  on('state.set', (_$, e, next) => {
    written.set(e.key, e.value)

    return next(e)
  })
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('fs.stat', (_$, e) => {
    const path = spelled(e.path)
    const kind = files.has(path) ? 'file' : folders.has(path) ? 'dir' : undefined

    return kind === undefined
      ? { deny: 'ENOENT' }
      : { value: { kind, size: 1, mtimeMs: 0, isLink: false } }
  })
  on('process.run', (_$, e) => {
    ran.push({ argv: e.argv, env: e.init?.env })

    return {
      value: {
        exitCode: options.exitCode ?? 0,
        stdout: '',
        stderr: options.stderr ?? '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.open', () => ({
    value: options.hasPane === false ? { isPlaced: false, reason: 'no-surface' } : { isPlaced: true },
  }))
  // The engine draws nothing of its own in the band.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  const stored = <T,>(key: string) => (written.get(key) as { value: T } | undefined)?.value
  const band = () => stored<Band>('band')
  const history = () => stored<LinkedFile[]>('history') ?? []

  return { toasts, ran, clock, band, history, files }
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

let rows = 0

/** One block of a reply being stored: the main loop's unless an agent is named. */
const stores = async ($: Engine, text: string, agentId?: string) => {
  rows += 1
  await $.session.append({
    message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text }] },
    door: 'response',
    origin: { kind: 'model', model: 'claude-fable-5-2' },
    uuid: `row-${rows}`,
    ...(agentId === undefined ? {} : { agentId }),
  })
}

const says = async ($: Engine, clock: MockClock, text: string, agentId?: string) => {
  await stores($, text, agentId)
  // The mod reads the block beside the turn; the test waits for it.
  await clock.settle()
}

/** A turn beginning: the main loop's unless an agent is named. */
const turn = async ($: Engine, clock: MockClock, turnId: string, agentId?: string) => {
  await $.turn.start({ text: '', turnId, ...(agentId === undefined ? {} : { agentId }) })
  await clock.settle()
}

const typed = ($: Engine, text: string) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

const links = ($: Engine, args: string) =>
  $.command.run({
    command: 'links',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

const labels = (files: readonly LinkedFile[] | undefined) => (files ?? []).map(file => file.label)

// ---- what a reply's text names ----

test('markdown links, code spans and bare paths are candidates, with the line each names', () => {
  const found = candidatesOf(
    [
      'See [the parser](src/parse.ts#L12-L20) and [docs](<docs/b c.md>).',
      'I changed `src/a.ts:42` and `hooks/register.tsx:7:3`, then README.md.',
      'Also (lib/util.py:3-9), **CLAUDE.md**, and ~/notes/todo.txt.',
      'A space in a link: [x](docs/b%20c.md), and in a bare name: `notes one.txt`.',
    ].join('\n'),
  )

  expect(found).toEqual([
    { raw: 'src/parse.ts', line: 12 },
    { raw: 'docs/b c.md' },
    { raw: 'src/a.ts', line: 42 },
    { raw: 'hooks/register.tsx', line: 7 },
    { raw: 'README.md' },
    { raw: 'lib/util.py', line: 3 },
    { raw: 'CLAUDE.md' },
    { raw: '~/notes/todo.txt' },
    { raw: 'notes one.txt' },
  ])
})

test('web addresses, globs, placeholders, numbers and fenced blocks are no candidates', () => {
  const found = candidatesOf(
    [
      'Read https://example.com/a/b.html or [site](http://example.com/x.md), mail mailto:a@b.co.',
      'Globs like `claude/workflows/*.js` and <mod>/hooks name no one file; 3.5 and 1/2 are numbers.',
      '```',
      'src/in-a-fence.ts',
      '```',
      'A plain sentence. With words, and nothing else',
    ].join('\n'),
  )

  expect(found).toEqual([])
})

// ---- where a spelling may lead ----

const WINDOWS = { cwd: 'C:\\repo\\sub', others: ['C:\\repo'], home: 'C:\\Users\\me' }
const POSIX = { cwd: '/repo/sub', others: ['/repo'], home: '/home/me' }

test('on Windows a spelling is tried under the working directory, then the other roots', () => {
  expect(attemptsOf('src/a.ts', WINDOWS)).toEqual(['C:\\repo\\sub\\src\\a.ts', 'C:\\repo\\src\\a.ts'])
  expect(attemptsOf('../x/./y.md', WINDOWS)).toEqual(['C:\\repo\\x\\y.md', 'C:\\x\\y.md'])
  expect(attemptsOf('c:/Users/me/f.txt', WINDOWS)).toEqual(['C:\\Users\\me\\f.txt'])
  expect(attemptsOf('~/notes/todo.txt', WINDOWS)).toEqual(['C:\\Users\\me\\notes\\todo.txt'])
  expect(attemptsOf('file:///C:/a%20b/c.txt', WINDOWS)).toEqual(['C:\\a b\\c.txt'])
  // Git Bash spells a drive as a folder; a leading slash may also mean the project's root.
  expect(attemptsOf('/c/Users/me/f.txt', WINDOWS)).toEqual([
    'C:\\repo\\sub\\c\\Users\\me\\f.txt',
    'C:\\repo\\c\\Users\\me\\f.txt',
    'C:\\Users\\me\\f.txt',
  ])
})

test('a network path and a drive-relative path are never asked about', () => {
  expect(attemptsOf('\\\\server\\share\\f.txt', WINDOWS)).toEqual([])
  expect(attemptsOf('//server/share/f.txt', POSIX)).toEqual([])
  expect(attemptsOf('D:notes.txt', WINDOWS)).toEqual([])
  expect(attemptsOf('~/x', { cwd: '/repo', others: [] })).toEqual([])
})

test('on macOS and Linux an absolute path is tried as written first', () => {
  expect(attemptsOf('/etc/hosts', POSIX)).toEqual(['/etc/hosts', '/repo/sub/etc/hosts', '/repo/etc/hosts'])
  expect(attemptsOf('src/a.ts', POSIX)).toEqual(['/repo/sub/src/a.ts', '/repo/src/a.ts'])
  expect(attemptsOf('file:///home/me/a%20b.txt', POSIX)[0]).toBe('/home/me/a b.txt')
})

test('a file is named from the working directory, else from home, else in full', () => {
  expect(labelOf('C:\\repo\\sub\\src\\a.ts', WINDOWS, 42)).toBe('src/a.ts:42')
  expect(labelOf('c:\\REPO\\sub\\src\\a.ts', WINDOWS)).toBe('src/a.ts')
  expect(labelOf('C:\\Users\\me\\notes\\todo.txt', WINDOWS)).toBe('~/notes/todo.txt')
  expect(labelOf('D:\\other\\x.md', WINDOWS)).toBe('D:/other/x.md')
  expect(labelOf('/repo/sub/README.md', POSIX)).toBe('README.md')
})

// ---- the command behind each button ----

const HOSTILE = "C:\\a b\\it's; calc & $(x) `y`.txt"

test('on Windows the path rides in the environment, never in the script', () => {
  const file = { path: HOSTILE, kind: 'file' } as const

  for (const action of ['folder', 'open', 'cat'] as const) {
    const { argv, env } = launchOf(action, file, 'windows')

    expect(argv.slice(0, 4)).toEqual(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command'])
    expect(argv).toHaveLength(5)
    expect(argv.join(' ')).not.toContain('calc')
    expect(env).toEqual({ [PATH_VAR]: HOSTILE })
  }
})

test('on Windows: Explorer selects the file, Invoke-Item opens it, a new PowerShell prints it', () => {
  const file = { path: 'C:\\repo\\a.ts', kind: 'file' } as const
  const folder = { path: 'C:\\repo\\src', kind: 'dir' } as const
  const script = (action: 'folder' | 'open' | 'cat', target: typeof file | typeof folder) =>
    launchOf(action, target, 'windows').argv[4] ?? ''

  expect(script('folder', file)).toContain(
    "Start-Process explorer.exe -ArgumentList ('/select,' + [char]34 + $env:OPEN_LINKS_PATH + [char]34)",
  )
  expect(script('open', file)).toEndWith('Invoke-Item -LiteralPath $env:OPEN_LINKS_PATH')
  expect(script('cat', file)).toContain("Start-Process powershell.exe -ArgumentList '-NoExit'")
  expect(script('cat', file)).toContain('Get-Content -Encoding UTF8 -LiteralPath $env:OPEN_LINKS_PATH')
  // A linked folder is listed instead of printed.
  expect(script('cat', folder)).toContain('Get-ChildItem -LiteralPath $env:OPEN_LINKS_PATH')
})

test('on macOS: Finder reveals the file, open opens it, Terminal prints it', () => {
  const file = { path: '/repo/a b.ts', kind: 'file' } as const

  expect(launchOf('folder', file, 'macos').argv).toEqual(['open', '-R', '/repo/a b.ts'])
  expect(launchOf('open', file, 'macos').argv).toEqual(['open', '/repo/a b.ts'])
  expect(launchOf('open', { path: '/repo/src', kind: 'dir' }, 'macos').argv).toEqual(['open', '/repo/src'])

  const cat = launchOf('cat', file, 'macos')

  expect(cat.argv[0]).toBe('osascript')
  expect(cat.argv).toContain('tell application "Terminal"')
  expect(cat.argv.join(' ')).not.toContain('/repo/a b.ts')
})

test('on Linux: the file manager opens the folder that holds the file', () => {
  const file = { path: '/repo/src/a.ts', kind: 'file' } as const

  expect(launchOf('folder', file, 'linux').argv).toEqual(['xdg-open', '/repo/src'])
  expect(launchOf('open', file, 'linux').argv).toEqual(['xdg-open', '/repo/src/a.ts'])
  expect(launchOf('cat', file, 'linux').argv.at(-1)).toBe('/repo/src/a.ts')
})

// ---- the mod in a session ----

test('the files a reply links are listed above the prompt; what is not on disk is left out', async ($, on) => {
  const { clock, band, history } = world(on)

  await start($)
  await says(
    $,
    clock,
    'I fixed `src/a.ts:42` and updated [the readme](README.md). `src/missing.ts` is still to do, see docs/.',
  )

  expect(band()?.files).toEqual([
    { path: '/repo/src/a.ts', label: 'src/a.ts:42', kind: 'file', line: 42 },
    { path: '/repo/README.md', label: 'README.md', kind: 'file' },
    { path: '/repo/docs', label: 'docs', kind: 'dir' },
  ])
  expect(labels(history())).toEqual(['src/a.ts:42', 'README.md', 'docs'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const texts = (await ui.findAll({ type: 'Text' })).map(found => found.text)

    expect(texts).toContain('src/a.ts:42')
    expect(texts).toContain('README.md')
    expect(await ui.findAll({ type: 'Button', text: 'Folder' })).toHaveLength(3)
    expect(await ui.findAll({ type: 'Button', text: 'Open' })).toHaveLength(3)
    expect(await ui.findAll({ type: 'Button', text: 'Cat' })).toHaveLength(3)
    await ui.unmount()
  }
})

test('a reply that links nothing, and a subagent’s reply, draw no band', async ($, on) => {
  const { clock, band } = world(on)

  await start($)
  await says($, clock, 'All 14 tests pass. Nothing else changed; see https://example.com/log.html.')
  await says($, clock, 'I edited `src/a.ts`.', 'agent-1')

  expect(band()).toBeUndefined()

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
  await ui.unmount()
})

test('each button runs its command on the file of its row', async ($, on) => {
  const { clock, ran, toasts } = world(on, { platform: 'macos' })

  await start($)
  await says($, clock, 'See `src/a.ts` and `docs/b c.md`.')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await ui.press({ key: 'band-folder-0' })
  await ui.press({ key: 'band-open-1' })
  await ui.press({ key: 'band-cat-1' })
  await ui.unmount()

  expect(ran.map(one => one.argv.slice(0, 3))).toEqual([
    ['open', '-R', '/repo/src/a.ts'],
    ['open', '/repo/docs/b c.md'],
    ['osascript', '-e', 'tell application "Terminal"'],
  ])
  expect(toasts).toEqual([])
})

test('on Windows a press starts PowerShell with the path in the environment', async ($, on) => {
  const { clock, ran } = world(on, { platform: 'windows' })

  await start($)
  await says($, clock, 'See `src/a.ts`.')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await ui.press({ key: 'band-open-0' })
  await ui.unmount()

  expect(ran).toHaveLength(1)
  expect(ran[0]?.argv[0]).toBe('powershell.exe')
  expect(ran[0]?.argv[4]).toEndWith('Invoke-Item -LiteralPath $env:OPEN_LINKS_PATH')
  expect(ran[0]?.env).toEqual({ [PATH_VAR]: '/repo/src/a.ts' })
})

test('a command that fails says so in a toast, with the first line it wrote', async ($, on) => {
  const { clock, toasts } = world(on, { exitCode: 1, stderr: 'No application knows how to open it.\nmore' })

  await start($)
  await says($, clock, 'See `src/a.ts`.')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await ui.press({ key: 'band-open-0' })
  await ui.unmount()

  expect(toasts).toEqual([
    'Links: could not open it (src/a.ts): No application knows how to open it.',
  ])
})

test('the hotkeys act on the selected file, and Next moves the selection', async ($, on) => {
  const { clock, band } = world(on)
  const hotkeys = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const found = (await ui.findAll({ type: 'Button' }))
      .filter(button => button.props['hotkey'] !== undefined)
      .map(button => `${String(button.props['hotkey'])}=${button.key}`)

    await ui.unmount()

    return found
  }

  await start($)
  await says($, clock, 'See `src/a.ts` and `README.md`.')

  expect(await hotkeys()).toEqual(['j=band-next', 'h=band-folder-0', 'l=band-open-0', 'v=band-cat-0'])

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await ui.press({ key: 'band-next' })
  await ui.unmount()

  expect(band()?.selected).toBe(1)
  expect(await hotkeys()).toEqual(['j=band-next', 'h=band-folder-1', 'l=band-open-1', 'v=band-cat-1'])

  const again = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await again.press({ key: 'band-next' })
  await again.unmount()

  expect(band()?.selected).toBe(0)
})

test('one linked file is one row, its hotkeys armed, with no Next', async ($, on) => {
  const { clock } = world(on)

  await start($)
  await says($, clock, 'See `src/a.ts`.')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const keys = (await ui.findAll({ type: 'Button' })).map(button => button.key)

  await ui.unmount()

  expect(keys).toEqual(['band-folder-0', 'band-open-0', 'band-cat-0', 'band-hide'])
})

test('more files than the band draws stay reachable: its window follows the selection', async ($, on) => {
  const names = ['a', 'b', 'c', 'd', 'e'].map(name => `/repo/${name}.md`)
  const { clock } = world(on, { files: names })
  const shown = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const texts = (await ui.findAll({ type: 'Text' })).map(found => found.text)

    await ui.unmount()

    return texts.filter(text => text.endsWith('.md'))
  }
  const next = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

    await ui.press({ key: 'band-next' })
    await ui.unmount()
  }

  await start($)
  await says($, clock, 'Files: a.md b.md c.md d.md e.md')

  expect(await shown()).toEqual(['a.md', 'b.md', 'c.md'])

  await next()
  await next()
  await next()
  await next()

  expect(await shown()).toEqual(['c.md', 'd.md', 'e.md'])
})

test('the list stays through the next turn’s start, and that turn’s first links replace it', async ($, on) => {
  const { clock, band, history } = world(on)

  await start($)
  await says($, clock, 'See `src/a.ts`.')
  await says($, clock, 'And `README.md`, with `src/a.ts` again.')

  // Blocks of one reply add up, a file named twice listed once.
  expect(labels(band()?.files)).toEqual(['src/a.ts', 'README.md'])

  await typed($, 'thanks, now the docs')
  await turn($, clock, 't2')

  expect(labels(band()?.files)).toEqual(['src/a.ts', 'README.md'])

  await says($, clock, 'Working on it, no files yet.')

  expect(labels(band()?.files)).toEqual(['src/a.ts', 'README.md'])

  await says($, clock, 'Wrote `docs/b c.md`.')

  expect(labels(band()?.files)).toEqual(['docs/b c.md'])
  expect(band()?.selected).toBe(0)
  // The session's list keeps them all, newest first.
  expect(labels(history())).toEqual(['docs/b c.md', 'README.md', 'src/a.ts'])
})

test('Hide takes the band down until a later reply links a file', async ($, on) => {
  const { clock } = world(on)
  const buttons = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const count = (await ui.findAll({ type: 'Button' })).length

    await ui.unmount()

    return count
  }

  await start($)
  await says($, clock, 'See `src/a.ts`.')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await ui.press({ key: 'band-hide' })
  await ui.unmount()

  expect(await buttons()).toBe(0)

  await says($, clock, 'Also `README.md`.')

  expect(await buttons()).toBe(0)

  await turn($, clock, 't2')
  await says($, clock, 'See `README.md`.')

  expect(await buttons()).toBe(4)
})

test('/links opens the pane, which lists the session’s files with the three buttons each', async ($, on) => {
  const { clock, ran } = world(on, { platform: 'macos' })

  await start($)
  await says($, clock, 'See `src/a.ts` and `README.md`.')

  expect(await links($, '')).toEqual({})

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const texts = (await ui.findAll({ type: 'Text' })).map(found => found.text)

  expect(texts).toContain('1. src/a.ts')
  expect(texts).toContain('2. README.md')
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(6)

  await ui.press({ key: 'pane-open-1' })
  await ui.unmount()

  expect(ran.map(one => one.argv)).toEqual([['open', '/repo/README.md']])
})

test('where no pane is drawn, /links prints the list', async ($, on) => {
  const { clock } = world(on, { hasPane: false })

  await start($)

  expect((await links($, '')).text).toBe('Links: no reply has linked a file yet.')

  await says($, clock, 'See `src/a.ts:42` and `README.md`.')

  expect((await links($, '')).text).toStartWith('Links (newest first):\n1. src/a.ts:42\n2. README.md\n')
})

test('/links <action> takes a path or a number in the list', async ($, on) => {
  const { clock, ran } = world(on, { platform: 'macos' })

  await start($)
  await says($, clock, 'See `src/a.ts` and `README.md`.')

  expect((await links($, 'open 2')).text).toBe('Links: Open README.md')
  expect((await links($, 'folder docs/b c.md')).text).toBe('Links: Folder docs/b c.md')
  expect((await links($, 'cat "src/a.ts:42"')).text).toBe('Links: Cat src/a.ts:42')
  expect((await links($, 'open src/missing.ts')).text).toBe('Links: no file at src/missing.ts')
  expect((await links($, 'open')).text).toStartWith('Usage: /links')
  expect((await links($, 'delete src/a.ts')).text).toStartWith('Usage: /links')

  expect(ran.map(one => one.argv.slice(0, 3))).toEqual([
    ['open', '/repo/README.md'],
    ['open', '-R', '/repo/docs/b c.md'],
    ['osascript', '-e', 'tell application "Terminal"'],
  ])
})

test('a list an earlier version stored is declined', async ($, on) => {
  on('state.get', () => ({ value: { value: [{ file: 'old' }], version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text' }))?.text).toBe('No reply has linked a file yet.')
  await ui.unmount()
})

// ---- found by review, each written as a test before its repair ----

test('between backticks or in a link any name is a candidate: the file system decides', () => {
  const found = candidatesOf(
    [
      'See [Makefile](Makefile), `LICENSE`, `hooks`, `notes (1).txt`, `it\'s.md` and `résumé.pdf`.',
      'Also [r](<a&b$c.md>), a bare naïve.txt, and `docs/say "hi".md`.',
    ].join('\n'),
  )

  expect(found.map(one => one.raw)).toEqual([
    'Makefile',
    'LICENSE',
    'hooks',
    'notes (1).txt',
    "it's.md",
    'résumé.pdf',
    'a&b$c.md',
    'naïve.txt',
    'docs/say "hi".md',
  ])
})

test('a link’s target may hold a # or parentheses of its own', () => {
  const raws = (text: string) => candidatesOf(text).map(one => one.raw)

  expect(raws('[n](notes/C#.md)')).toContain('notes/C#.md')
  expect(raws('[n](docs/a(1).md)')).toEqual(['docs/a(1).md'])
  // A heading's anchor: the file is asked about with it and without it.
  expect(raws('[install](README.md#install)')).toEqual(['README.md#install', 'README.md'])
})

test('a fence ends only on its own mark: a longer fence, a blockquote, an info string', () => {
  const fenced = (rows: string[]) => candidatesOf(rows.join('\n'))

  expect(fenced(['````md', '```ts', 'src/inside.ts', '```', 'src/still-inside.ts', '````'])).toEqual([])
  expect(fenced(['```', 'src/one.ts', '```ts', 'src/two.ts', '```'])).toEqual([])
  expect(fenced(['> ```', '> src/in-quote.ts', '> ```'])).toEqual([])
  expect(fenced(['~~~', 'src/tilde.ts', '```', 'src/tilde-two.ts', '~~~', 'after `src/a.ts`'])).toEqual([
    { raw: 'src/a.ts' },
  ])
})

test('a file named after many words that are no file is still found', () => {
  const noise = Array.from({ length: 100 }, (_, at) => `read${at}/write`).join(' ')

  expect(candidatesOf(`${noise} then \`src/a.ts\``).at(-1)).toEqual({ raw: 'src/a.ts' })
})

test('with the working directory at a root, a file is still named from it', () => {
  expect(labelOf('C:\\a.ts', { cwd: 'C:\\', others: [] })).toBe('a.ts')
  expect(labelOf('/etc/hosts', { cwd: '/', others: [] })).toBe('etc/hosts')
})

test('Folder selects a linked folder in the folder that holds it; Open opens it', () => {
  const windows = (action: 'folder' | 'open') =>
    launchOf(action, { path: 'C:\\repo\\src', kind: 'dir' }, 'windows').argv[4] ?? ''

  expect(windows('folder')).toContain("'/select,'")
  expect(windows('open')).toEndWith('Invoke-Item -LiteralPath $env:OPEN_LINKS_PATH')
  expect(launchOf('folder', { path: '/repo/src', kind: 'dir' }, 'macos').argv).toEqual(['open', '-R', '/repo/src'])
  expect(launchOf('folder', { path: '/repo/src', kind: 'dir' }, 'linux').argv).toEqual(['xdg-open', '/repo'])
})

test('on macOS the terminal is typed a command no shell can read a path out of', () => {
  // In fish a backslash escapes the quote inside single quotes: `id` would run.
  const hostile = "/repo/x\\';id;#"
  const { argv } = launchOf('cat', { path: hostile, kind: 'file' }, 'macos')
  const typed = argv.find(part => part.startsWith('do script ')) ?? ''

  expect(argv.join(' ')).not.toContain('id;')
  expect(typed).toMatch(/^do script "\/bin\/sh -c 'cat -- \\"\$\(printf %b \\"\$0\\"\)\\"' '(?:\\\\0[0-7]{3})+'"$/)

  // The octal bytes spell the path, as `printf %b` will print it.
  const bytes = [...typed.matchAll(/\\\\0([0-7]{3})/g)].map(found => Number.parseInt(found[1] ?? '', 8))

  expect(new TextDecoder().decode(new Uint8Array(bytes))).toBe(hostile)
  expect(launchOf('cat', { path: '/repo/Résumé.txt', kind: 'file' }, 'macos').argv.join(' ')).not.toContain(
    'system attribute',
  )
})

test('on Linux the terminal gets the path as an argument, not through the environment', () => {
  const { argv } = launchOf('cat', { path: '/repo/a b.ts', kind: 'file' }, 'linux')

  expect(argv.at(-1)).toBe('/repo/a b.ts')
  expect(argv.at(-2)).toContain('cat -- "$0"')
  expect(argv.at(-2)).toContain(' "$0" >/dev/null')
})

test('a reply’s files stay together when the person types mid-turn; the next turn starts a new list', async ($, on) => {
  const { clock, band } = world(on)

  await start($)
  await turn($, clock, 't1')
  await says($, clock, 'See `src/a.ts`.')
  // Typed while the turn runs: folded into it, no new turn.
  await typed($, 'also check the readme')
  await says($, clock, 'And `README.md`.')

  expect(labels(band()?.files)).toEqual(['src/a.ts', 'README.md'])

  // A turn nobody typed for (a background task's notification) starts a new list too.
  await turn($, clock, 't2')

  expect(labels(band()?.files)).toEqual(['src/a.ts', 'README.md'])

  await says($, clock, 'Wrote `docs/b c.md`.')

  expect(labels(band()?.files)).toEqual(['docs/b c.md'])

  // A subagent's turn is not the conversation's.
  await turn($, clock, 't3', 'agent-1')
  await says($, clock, 'And `src/a.ts`.')

  expect(labels(band()?.files)).toEqual(['docs/b c.md', 'src/a.ts'])
})

test('every file of a long reply is in the band, and the session keeps more than a screenful', async ($, on) => {
  const names = Array.from({ length: 45 }, (_, at) => `/repo/f${at}.md`)
  const { clock, band, history } = world(on, { files: names })

  await start($)
  await says($, clock, names.slice(0, 25).map(name => `\`${name.slice(6)}\``).join(' '))

  expect(band()?.files).toHaveLength(25)

  await turn($, clock, 't2')
  await says($, clock, names.slice(25).map(name => `\`${name.slice(6)}\``).join(' '))

  expect(band()?.files).toHaveLength(20)
  expect(history()).toHaveLength(45)
})

test('a file deleted since it was linked is said to be gone, and leaves the lists', async ($, on) => {
  const { clock, band, history, ran, toasts, files } = world(on)

  await start($)
  await says($, clock, 'See `src/a.ts` and `README.md`.')
  files.delete('/repo/src/a.ts')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await ui.press({ key: 'band-folder-0' })
  await ui.unmount()

  expect(ran).toEqual([])
  expect(toasts).toEqual(['Links: src/a.ts is no longer on disk'])
  expect(labels(band()?.files)).toEqual(['README.md'])
  expect(labels(history())).toEqual(['README.md'])
})

test('/links keeps the spaces of a typed path, and its pane numbers the list', async ($, on) => {
  const { clock, ran } = world(on, { files: ['/repo/docs/a  b.md', '/repo/src/a.ts'], platform: 'macos' })

  await start($)

  expect((await links($, 'open docs/a  b.md')).text).toBe('Links: Open docs/a  b.md')
  expect(ran.map(one => one.argv)).toEqual([['open', '/repo/docs/a  b.md']])

  await says($, clock, 'See `src/a.ts`.')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const texts = (await ui.findAll({ type: 'Text' })).map(found => found.text)

  await ui.unmount()

  expect(texts).toContain('1. src/a.ts')
})

// ---- found by the second review ----

test('a block still being read when the next turn starts stays with its own turn', async ($, on) => {
  const { clock, band, history } = world(on, {
    files: ['/repo/a.md', '/repo/b.md', '/repo/c.md'],
  })

  await start($)
  await turn($, clock, 't1')
  await says($, clock, 'First block: `a.md`.')
  // The reply's last block is stored and the next turn starts before it is read.
  await stores($, 'Summary: `b.md`.')
  await $.turn.start({ text: 'queued', turnId: 't2' })
  await clock.settle()

  expect(labels(band()?.files)).toEqual(['a.md', 'b.md'])

  await says($, clock, 'Turn 2 wrote `c.md`.')

  expect(labels(band()?.files)).toEqual(['c.md'])
  expect(labels(history())).toEqual(['c.md', 'b.md', 'a.md'])
})

test('a file named after hundreds of code spans that are no file is still found', () => {
  const noise = Array.from({ length: 420 }, (_, at) => `\`ident${at}\``).join(' ')
  const found = candidatesOf(`${noise} Changed \`src/target.ts\` and [the notes](notes).`)

  expect(found.map(one => one.raw)).toContain('src/target.ts')
  expect(found.map(one => one.raw)).toContain('notes')
  // Still in the order the reply names them.
  expect(found[0]).toEqual({ raw: 'ident0' })
})

test('emphasis, curly quotes, a possessive, a dash and a table cell do not hide a bare path', () => {
  const raws = (text: string) => candidatesOf(text).map(one => one.raw)

  expect(raws('_CLAUDE.md_ and _src/a.ts_')).toEqual(['CLAUDE.md', '_src/a.ts_', 'src/a.ts'])
  expect(raws('“src/a.ts” and ‘README.md’')).toEqual(['src/a.ts', 'README.md'])
  expect(raws("README.md's header, CLAUDE.md’s rules")).toEqual(['README.md', 'CLAUDE.md'])
  expect(raws('src/a.ts—it works… src/b.ts…')).toEqual(['src/a.ts', 'src/b.ts'])
  expect(raws('|src/a.ts|src/b.ts|')).toEqual(['src/a.ts', 'src/b.ts'])
  // A name's own underscores stay.
  expect(raws('__init__.py and _config.yml')).toEqual(['__init__.py', '_config.yml'])
})

test('a link with a single-quoted or parenthesised title is still a link', () => {
  expect(candidatesOf("[a](src/a.ts 'T') and [b](src/b.ts (T)) and [c](src/c.ts \"T\")")).toEqual([
    { raw: 'src/a.ts' },
    { raw: 'src/b.ts' },
    { raw: 'src/c.ts' },
  ])
})

test('on Windows a slash before the drive letter is dropped', () => {
  expect(attemptsOf('/C:/Users/me/f.txt', WINDOWS)).toEqual(['C:\\Users\\me\\f.txt'])
})

test('on Linux the terminal is started detached, so the launch returns and the window stays', () => {
  const { argv } = launchOf('cat', { path: '/repo/a b.ts', kind: 'file' }, 'linux')

  expect(argv.slice(0, 2)).toEqual(['sh', '-c'])
  expect(argv[2]).toStartWith('setsid -f x-terminal-emulator -e sh -c ')
  expect(argv[2]).toEndWith('>/dev/null 2>&1 </dev/null')
  expect(argv).toHaveLength(4)
})

test('a typed path is taken as typed: a backtick in it names no other file', async ($, on) => {
  const { ran } = world(on, { files: ['/repo/a', '/repo/src/a.ts'], platform: 'macos' })

  await start($)

  expect((await links($, 'open a`b.txt')).text).toBe('Links: no file at a`b.txt')
  expect(ran).toEqual([])
  expect((await links($, 'open src/a.ts:12')).text).toBe('Links: Open src/a.ts:12')
})

test('on macOS two spellings that differ only in case are one file; on Linux they are two', async ($, on) => {
  const { clock, band } = world(on, {
    files: ['/repo/README.md', '/repo/readme.md'],
    platform: 'macos',
  })

  await start($)
  await says($, clock, 'See `README.md` (also spelled `readme.md`).')

  expect(labels(band()?.files)).toEqual(['README.md'])
})

test('on Linux two spellings that differ only in case are two files', async ($, on) => {
  const { clock, band } = world(on, {
    files: ['/repo/README.md', '/repo/readme.md'],
    platform: 'linux',
  })

  await start($)
  await says($, clock, 'See `README.md` and `readme.md`.')

  expect(labels(band()?.files)).toEqual(['README.md', 'readme.md'])
})
