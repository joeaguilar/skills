import type { On, ProcessSpawnRequest } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { clean, transcriptOf, unmark } from '../hooks/register'
import type { Entry } from '../types'

const PANE = {
  plugin: 'shell-pane',
  component: 'Pane',
  requestId: 'shell',
  props: {
    title: 'Shell',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'

/** A child the test stands in for: what it writes, how it ends, and whether it stays up. */
type Child = {
  /** Written before the wrapper's last line. */
  out?: string
  err?: string
  /** Where the shell ended up; absent, the wrapper's last line never comes. */
  landed?: string
  code?: number
  /** The child stays running until this settles. */
  hold?: Promise<void>
  /** The child cannot start. */
  refusal?: string
}

type Options = {
  /** Paths that exist; every other one is missing. */
  folders?: readonly string[]
  variables?: Record<string, string>
}

/** A path as the test spells it: the host hands the file system an absolute one of its own. */
const spelled = (path: string) => path.replace(/^[A-Za-z]:(?=[\\/]repo)/, '').replace(/\\/g, '/')

/** The world beneath the mod: the host's shells, its files, the prompt box, and what was shown. */
const world = (on: On, options: Options = {}) => {
  const folders = new Set((options.folders ?? ['/repo', '/repo/src', GIT_BASH]).map(spelled))
  const toasts: string[] = []
  const spawned: ProcessSpawnRequest[] = []
  const children: Child[] = []
  const opens: { id: string; focus: true | undefined }[] = []
  const prompts: string[] = []
  const written = new Map<string, unknown>()
  const box = { text: '' }
  const clock = mock.clock(on)

  mock.env(on, options.variables ?? { OS: 'Windows_NT' })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('state.set', (_$, e, next) => {
    written.set(e.key, e.value)

    return next(e)
  })
  on('ui.open', (_$, e) => {
    opens.push({ id: e.id, focus: e.focus })

    return { value: { isPlaced: true as const } }
  })
  on('ui.scroll', () => ({}))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('prompt.submit', (_$, e) => {
    prompts.push(e.text)

    return { text: e.text }
  })
  on('prompt.fill', (_$, e) => {
    box.text = e.mode === 'append' ? box.text + e.text : e.text

    return { isFilled: true }
  })
  on('fs.exists', (_$, e) => ({ value: folders.has(spelled(e.path)) }))
  on('fs.stat', (_$, e) => {
    if (!folders.has(spelled(e.path))) throw new Error(`ENOENT: ${e.path}`)

    return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }
  })
  on('process.run', () => ({
    value: {
      exitCode: 0,
      stdout: 'C:\\Program Files\\Git\\cmd\\git.exe\r\n',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('process.spawn', async function* (_$, e) {
    spawned.push(e)

    const child = children.shift() ?? {}

    if (child.refusal !== undefined) return { deny: child.refusal }
    if (child.out !== undefined) yield { stream: 'stdout' as const, text: child.out }
    if (child.err !== undefined) yield { stream: 'stderr' as const, text: child.err }
    if (child.hold !== undefined) await child.hold

    if (child.landed !== undefined) {
      yield { stream: 'stdout' as const, text: `${e.env?.SHELL_PANE_MARK}${child.landed}\r\n` }
    }

    return { value: { code: child.code ?? 0, signal: null } }
  })

  const entries = () => (written.get('entries') as Entry[] | undefined) ?? []
  const live = () => (written.get('live') as Entry | null | undefined) ?? null

  return { clock, toasts, spawned, children, opens, prompts, box, written, folders, entries, live }
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

const shellCommand = ($: Engine) =>
  $.command.run({
    command: 'shell',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

const mounted = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({ ...PANE, surface })

type Pane = Awaited<ReturnType<typeof mounted>>

/** Every line of text the pane draws, top to bottom. */
const texts = async (pane: Pane) =>
  (await pane.findAll({ type: 'Text' })).map(found => found.text)

/** The key of the field as drawn now. */
const field = async (pane: Pane) => (await pane.find({ type: 'Input' }))?.key ?? ''

/** A line typed into the field and Enter, then the run it starts as far as it goes. */
const enter = async (pane: Pane, clock: { settle: () => Promise<void> }, text: string) => {
  await pane.input({ key: await field(pane), text })
  await clock.settle()
}

test('/shell opens the pane with the keys, and it draws the shell, the folder and a field', async ($, on) => {
  const { opens } = world(on)

  await start($)

  expect((await shellCommand($)).text).toBe('Shell pane opened.')
  expect(opens).toEqual([{ id: 'shell', focus: true }])

  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await mounted($, surface)

    expect((await texts(pane))[0]).toBe('PowerShell · /repo')

    const input = await pane.find({ type: 'Input' })

    expect(input?.key).toBe('line-0')
    expect(input?.props.autoFocus).toBe(true)
    expect(input?.props.label).toBe('PS repo>')
    expect(await pane.find({ type: 'Button', text: 'Switch to Git Bash' })).toBeDefined()
    expect(await pane.find({ type: 'Button', text: 'Stop' })).toBeUndefined()
    await pane.unmount()
  }
})

test('a line runs in PowerShell, its output stays in the pane, and no prompt is sent', async ($, on) => {
  const { clock, spawned, children, prompts, entries, live } = world(on)

  children.push({ out: 'On branch main\r\nnothing to commit\r\n', landed: '/repo' })
  await start($)

  const pane = await mounted($)

  await enter(pane, clock, '  git status -m "a b"  ')

  const child = spawned[0]

  expect(child?.argv.slice(0, 5)).toEqual([
    'powershell.exe',
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
  ])
  // The script loads the person's profiles itself, so their aliases work and a greeting is not repeated.
  expect(child?.argv[5]).toContain('$PROFILE.CurrentUserCurrentHost')
  expect(child?.argv[5]).toContain('. $__p')
  // The line rides the environment, never the command line.
  expect(child?.argv.join(' ')).not.toContain('git status')
  expect(child?.env?.SHELL_PANE_LINE).toBe('git status -m "a b"')
  expect(child?.cwd).toBe('/repo')

  expect(live()).toBeNull()
  expect(entries()).toHaveLength(1)
  expect(entries()[0]).toMatchObject({
    shell: 'powershell',
    cwd: '/repo',
    line: 'git status -m "a b"',
    output: 'On branch main\nnothing to commit\n',
    status: 'done',
    code: 0,
  })

  const drawn = await texts(pane)

  expect(drawn).toContain('PS repo> git status -m "a b"')
  expect(drawn).toContain('On branch main')
  expect(drawn).toContain('nothing to commit')
  expect(drawn.join('\n')).not.toContain('shell-pane-')
  expect(prompts).toEqual([])
})

test('a cd carries over to the next line', async ($, on) => {
  const { clock, spawned, children, written } = world(on)

  children.push({ landed: '/repo/src' }, { out: 'a.ts\n', landed: '/repo/src' })
  await start($)

  const pane = await mounted($)

  await enter(pane, clock, 'cd src')

  expect(written.get('cwd')).toBe('/repo/src')
  expect((await texts(pane))[0]).toBe('PowerShell · /repo/src')
  expect((await pane.find({ type: 'Input' }))?.props.label).toBe('PS src>')

  await enter(pane, clock, 'ls')

  expect(spawned[1]?.cwd).toBe('/repo/src')
  expect(await texts(pane)).toContain('PS src> ls')
})

test('a folder that is gone falls back to the session folder', async ($, on) => {
  const { clock, spawned, children, written, folders } = world(on)

  // The shell says it landed in a folder the host does not find: not believed.
  children.push({ landed: '/repo/nowhere' }, { landed: '/repo/src' }, { out: 'x\n' })
  await start($)

  const pane = await mounted($)

  await enter(pane, clock, 'cd nowhere')
  expect(written.get('cwd')).toBe('/repo')

  await enter(pane, clock, 'cd src')
  expect(written.get('cwd')).toBe('/repo/src')

  // The folder is deleted under the shell: the next line still runs, from the session's.
  folders.delete('/repo/src')
  await enter(pane, clock, 'ls')
  expect(spawned[2]?.cwd).toBe('/repo')
  expect(written.get('cwd')).toBe('/repo')
  expect((await texts(pane))[0]).toBe('PowerShell · /repo')
})

test('the switch runs the next line in Git Bash, found beside git', async ($, on) => {
  const { clock, spawned, children, entries } = world(on)

  children.push({ out: 'hi\n', landed: 'C:/repo' })
  await start($)

  const pane = await mounted($)

  await pane.press({ key: 'shell' })

  expect((await texts(pane))[0]).toBe('Git Bash · /repo')
  expect(await pane.find({ type: 'Button', text: 'Switch to PowerShell' })).toBeDefined()

  await enter(pane, clock, 'echo hi')

  expect(spawned[0]?.argv.slice(0, 2)).toEqual([GIT_BASH, '-c'])
  expect(spawned[0]?.env?.SHELL_PANE_LINE).toBe('echo hi')
  expect(entries()[0]).toMatchObject({ shell: 'bash', output: 'hi\n', status: 'done' })
  expect(await texts(pane)).toContain('repo $ echo hi')
})

test('Git Bash that is not installed is said in the pane, and nothing starts', async ($, on) => {
  const { clock, spawned, entries } = world(on, { folders: ['/repo'] })

  await start($)

  const pane = await mounted($)

  await pane.press({ key: 'shell' })
  await enter(pane, clock, 'ls')

  expect(spawned).toEqual([])
  expect(entries()[0]?.status).toBe('failed')
  expect(entries()[0]?.output).toContain('Git Bash was not found')
})

test('a failing command shows what it wrote and its exit code', async ($, on) => {
  const { clock, children, entries } = world(on)

  children.push({ err: "git: 'nope' is not a git command.\n", landed: '/repo', code: 1 })
  await start($)

  const pane = await mounted($)

  await enter(pane, clock, 'git nope')

  expect(entries()[0]).toMatchObject({ status: 'done', code: 1 })

  const drawn = await texts(pane)

  expect(drawn).toContain("git: 'nope' is not a git command.")
  expect(drawn).toContain('exit 1')
})

test('a shell that cannot start is said in the pane', async ($, on) => {
  const { clock, children, entries, live } = world(on)

  children.push({ refusal: 'failed to start: ENOENT' })
  await start($)

  const pane = await mounted($)

  await enter(pane, clock, 'ls')

  expect(live()).toBeNull()
  expect(entries()[0]).toMatchObject({ status: 'failed', code: null })
  expect((await texts(pane)).join('\n')).toContain('failed to start: ENOENT')
})

test('output is drawn while the command runs; a second line waits; Stop ends it', async ($, on) => {
  const { clock, toasts, spawned, children, entries, live } = world(on)

  // Up until the clock is moved an hour on, as a server left running is.
  children.push({ out: 'listening on 3000\n', landed: '/repo', hold: clock.sleep(3_600_000) })
  await start($)

  const pane = await mounted($)

  await enter(pane, clock, 'npm run dev')
  await clock.advance(200)

  expect(live()).toMatchObject({ status: 'running', output: 'listening on 3000\n' })

  const drawn = await texts(pane)

  expect(drawn).toContain('listening on 3000')
  expect(drawn).toContain('running…')
  expect(await pane.find({ type: 'Button', text: 'Stop' })).toBeDefined()

  await enter(pane, clock, 'ls')

  expect(spawned).toHaveLength(1)
  expect(toasts).toEqual(['shell-pane: a command is still running. Stop it first.'])

  await pane.press({ key: 'stop' })
  await clock.advance(3_600_000)

  expect(live()).toBeNull()
  expect(entries()).toHaveLength(1)
  expect(entries()[0]).toMatchObject({ status: 'stopped', code: null })
  expect(await texts(pane)).toContain('stopped')
  expect(await pane.find({ type: 'Button', text: 'Stop' })).toBeUndefined()
})

test('each line taken draws a new, empty field', async ($, on) => {
  const { clock, children } = world(on)

  children.push({ landed: '/repo' })
  await start($)

  const pane = await mounted($)

  await pane.input({ key: 'line-0', text: 'git st', kind: 'change' })
  // A draw while typing keeps what was typed.
  await pane.redraw()
  expect((await pane.find({ type: 'Input' }))?.props.value).toBe('git st')

  await enter(pane, clock, 'git st')

  const input = await pane.find({ type: 'Input' })

  expect(input?.key).toBe('line-1')
  expect(input?.props.value).toBe('')

  // An empty Enter takes nothing.
  await enter(pane, clock, '   ')
  expect(await field(pane)).toBe('line-1')
})

test('clear, cls and the Clear button empty the pane without starting anything', async ($, on) => {
  const { clock, spawned, children, entries } = world(on)

  children.push({ out: 'one\n', landed: '/repo' }, { out: 'two\n', landed: '/repo' })
  await start($)

  const pane = await mounted($)

  await enter(pane, clock, 'echo one')
  expect(entries()).toHaveLength(1)

  await enter(pane, clock, 'clear')
  expect(entries()).toEqual([])
  expect(spawned).toHaveLength(1)

  await enter(pane, clock, 'echo two')
  await enter(pane, clock, 'cls')
  expect(entries()).toEqual([])
  expect(spawned).toHaveLength(2)
  expect(await pane.find({ type: 'Button', text: 'Clear' })).toBeUndefined()
})

test('Quote puts the last command and its output in the prompt box and sends nothing', async ($, on) => {
  const { clock, toasts, children, prompts, box } = world(on)

  children.push({ out: 'FAIL src/a.test.ts\n```\ncode\n```\n', landed: '/repo', code: 1 })
  await start($)

  const pane = await mounted($)

  expect(await pane.find({ type: 'Button', text: 'Quote to prompt' })).toBeUndefined()

  await enter(pane, clock, 'npm test')
  box.text = 'why? '
  await pane.press({ key: 'quote' })

  expect(box.text).toBe(
    [
      'why? I ran this in PowerShell from /repo (exit code 1):',
      '',
      '````',
      'PS repo> npm test',
      'FAIL src/a.test.ts',
      '```',
      'code',
      '```',
      '````',
      '',
      '',
    ].join('\n'),
  )
  expect(prompts).toEqual([])
  expect(toasts[0]).toContain('quoted into the prompt box')
})

test('Quote entire transcript puts every command in the pane in the prompt box and sends nothing', async ($, on) => {
  const { clock, toasts, children, prompts, box } = world(on)

  children.push(
    { out: 'On branch main\n', landed: '/repo' },
    { err: 'FAIL src/a.test.ts\n', landed: '/repo', code: 1 },
    { out: 'listening on 3000\n', hold: clock.sleep(3_600_000) },
  )
  await start($)

  const pane = await mounted($)

  expect(await pane.find({ type: 'Button', text: 'Quote entire transcript to prompt' })).toBeUndefined()

  await enter(pane, clock, 'git status')
  await enter(pane, clock, 'npm test')
  await pane.press({ key: 'shell' })
  await enter(pane, clock, 'npm run dev')
  await clock.advance(200)

  // Both buttons stand side by side: the last command, or all of them.
  expect(await pane.find({ type: 'Button', text: 'Quote to prompt' })).toBeDefined()

  await pane.press({ key: 'quote-all' })

  const quoted = [
    'This is the transcript of my shell pane (3 commands):',
    '',
    '```',
    'PS repo> git status',
    'On branch main',
    'PS repo> npm test',
    'FAIL src/a.test.ts',
    '[exit code 1]',
    'repo $ npm run dev',
    'listening on 3000',
    '[still running]',
    '```',
    '',
    '',
  ].join('\n')

  expect(box.text).toBe(quoted)
  expect(prompts).toEqual([])
  expect(toasts).toEqual([
    `shell-pane: quoted 3 commands (${quoted.length} characters) into the prompt box. Nothing is sent until you press Enter there.`,
  ])
})

test('a transcript too long for the prompt keeps its newest commands and says what it cut', () => {
  const entry = (id: number): Entry => ({
    id,
    shell: 'powershell',
    cwd: '/repo',
    line: `step ${id}`,
    output: `${'x'.repeat(11_000)}\n`,
    isCut: false,
    status: 'done',
    code: 0,
  })
  const { text, count } = transcriptOf([1, 2, 3, 4, 5, 6].map(entry))

  expect(count).toBe(5)
  expect(text).toContain('(5 commands)')
  expect(text).toContain('[1 earlier command cut]')
  expect(text).not.toContain('PS repo> step 1\n')
  expect(text).toContain('PS repo> step 2\n')
  expect(text).toContain('PS repo> step 6\n')
})

test('escape sequences, carriage returns and tabs are drawn as a terminal would leave them', () => {
  expect(clean('\u001b[32mok\u001b[0m\r\n')).toBe('ok\n')
  expect(clean('10%\r50%\r100%\ndone\r\n')).toBe('100%\ndone\n')
  expect(clean('a\tb\u0007\n')).toBe('a    b\n')
  expect(clean('\u001b]0;title\u0007text')).toBe('text')
})

test("the wrapper's last line is taken out, whole or still arriving", () => {
  const mark = '::shell-pane-x::'

  expect(unmark(`out\n${mark}C:\\repo\r\n`, mark, true)).toEqual({ shown: 'out\n', landed: 'C:\\repo' })
  // An error written after it stays.
  expect(unmark(`${mark}/repo\nboom\n`, mark, true)).toEqual({ shown: 'boom\n', landed: '/repo' })
  expect(unmark('out\n::shell-pa', mark, false)).toEqual({ shown: 'out\n', landed: undefined })
  expect(unmark(`out\n${mark}/re`, mark, false)).toEqual({ shown: 'out\n', landed: undefined })
  expect(unmark('plain :: text', mark, true)).toEqual({ shown: 'plain :: text', landed: undefined })
})
