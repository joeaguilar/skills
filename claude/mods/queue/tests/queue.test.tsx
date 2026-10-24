import type { On, PromptOrigin } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import { brief, noteOf, parseLine, renderLine, stamp, verdictOf } from '../hooks/register'

const NOW = Date.parse('2026-10-03T15:04:00Z')
const WHEN = stamp(NOW)
const PATH = '/repo/.claude/queue.md'
const LEGEND = '¤ uses tokens'
const BENEATH = 'beneath'

const BAND = {
  plugin: 'queue',
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

/** The repository as git would describe it; the test changes it between calls. */
type Repo = {
  isRepo: boolean
  branch: string
  head: string
  /** The project commits the queue file. */
  isTracked: boolean
  /** The project, or the person's global ignores, already hide it. */
  isIgnored: boolean
  /** What `git rev-parse --git-path info/exclude` prints: relative in a plain checkout, absolute in a linked worktree. */
  excludeAt: string
}

/** A path as the mod spelled it: the host makes `/repo` absolute before a hook sees it. */
const spelled = (path: string) => path.replace(/^[A-Za-z]:(?=[\\/]repo)/, '').replace(/\\/g, '/')

/** The world beneath the mod: git, the file system, the commands, and what the mod asked for. */
const world = (on: On, files: Record<string, string> = {}) => {
  const repo: Repo = {
    isRepo: true,
    branch: 'main',
    head: 'abc1234',
    isTracked: false,
    isIgnored: false,
    excludeAt: '.git/info/exclude',
  }
  const disk = new Map(Object.entries(files))
  const toasts: string[] = []
  const submitted: { text: string; origin: unknown }[] = []
  /** Each row as stored: the text of its blocks, in order. */
  const rows: string[][] = []
  const commands: { command: string; args: string }[] = []
  const git: string[] = []
  const clock = mock.clock(on, { now: NOW })

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('command.list', () => ({
    value: [
      { name: 'blitz', description: 'Clear the backlog.', source: 'user' as const },
      { name: 'status', description: 'Shows the status.', source: 'builtin' as const },
      { name: 'queue', description: 'The queue.', source: 'plugin' as const, plugin: 'queue' },
    ],
  }))
  // A slash command the mod ran for a queued task: `blitz` is a skill and hands
  // the model a prompt; `status` prints its own answer and starts no turn.
  on('command.run', (_$, e) => {
    commands.push({ command: e.command, args: e.args })

    return e.command === 'status' ? { text: 'all good' } : {}
  })
  on('session.append', (_$, e, next) => {
    rows.push(e.message.content.map(block => String(block['text'] ?? '')))

    return next(e)
  })
  on('prompt.submit', (_$, e) => {
    submitted.push({ text: e.text, origin: e.origin })

    return { text: e.text }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('fs.exists', (_$, e) => ({ value: disk.has(spelled(e.path)) }))
  on('fs.read', (_$, e) => {
    const text = disk.get(spelled(e.path))

    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)

    return { value: text }
  })
  on('fs.write', (_$, e) => {
    disk.set(spelled(e.path), e.text)

    return { value: undefined }
  })
  on('process.run', (_$, e) => {
    const args = e.argv.slice(2).join(' ')
    const stdout =
      args === 'rev-parse --show-toplevel'
        ? '/repo'
        : args === 'branch --show-current'
          ? repo.branch
          : args === 'rev-parse --short HEAD'
            ? repo.head
            : args === '-C /repo ls-files -- .claude/queue.md'
              ? repo.isTracked
                ? '.claude/queue.md'
                : ''
              : args === '-C /repo check-ignore -- .claude/queue.md'
                ? repo.isIgnored
                  ? '.claude/queue.md'
                  : ''
                : args === '-C /repo rev-parse --git-path info/exclude'
                  ? repo.excludeAt
                  : ''

    git.push(args)

    return {
      value: {
        exitCode: repo.isRepo ? 0 : 128,
        stdout: repo.isRepo ? `${stdout}\n` : '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  // What draws beneath the mod in the band: another mod's line, or the engine's own.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text>{BENEATH}</Text>
      </Box>
    )
  })

  /** The file's lines, less the trailing newline; undefined while there is no file. */
  const file = () => disk.get(PATH)?.replace(/\n$/, '').split('\n')

  return { repo, disk, file, toasts, submitted, rows, commands, git, clock }
}

const OWN: PromptOrigin = { kind: 'plugin', name: 'queue', asUser: true }

/**
 * A prompt's row as the engine appends it when its turn is about to start. The
 * kit keeps no store beneath `session.append`: the test's hook sees the row as
 * the chain handed it down (which is what `rows` records), and the dispatch
 * then rejects for want of a bottom.
 */
const promptRow = ($: Engine, text: string, origin: PromptOrigin = OWN) =>
  $.session
    .append({
      message: { type: 'user', role: 'user', content: [{ type: 'text', text }] },
      door: 'prompt',
      origin,
      uuid: 'row',
    })
    .catch(() => undefined)

const start = async ($: Engine, clock: MockClock, isInteractive = true) => {
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive })
  await clock.settle()
}

const queue = async ($: Engine, args: string) =>
  (
    await $.command.run({
      command: 'queue',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 200 },
    })
  ).text

/** A main turn as the engine runs it: the prompt, then the reply. */
const turn = async (
  $: Engine,
  clock: MockClock,
  text: string,
  answer: string,
  turnId: string,
  reason: 'answer' | 'aborted' = 'answer',
) => {
  await $.turn.start({ text, turnId })
  await $.turn.complete({ answer, durationMs: 1, isAborted: reason === 'aborted', turnId, reason })
  await clock.settle()
}

/** What the band shows: every Text joined, and the Button labels in order. */
const band = async ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') => {
  const drawn = await $.ui.mount({ ...BAND, surface })
  const texts = (await drawn.findAll({ type: 'Text' })).map(found => found.text)
  const buttons = (await drawn.findAll({ type: 'Button' })).map(found => found.text)
  const hotkeys = (await drawn.findAll({ type: 'Button' })).map(found => found.props['hotkey'])

  await drawn.unmount()

  return { texts, buttons, hotkeys }
}

const pressBand = async ($: Engine, clock: MockClock, key: string) => {
  const drawn = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await drawn.press({ key })
  await drawn.unmount()
  await clock.settle()
}

const line = (mark: string, id: number, task: string, tail = '@main') =>
  `- [${mark}] q${id} · ${WHEN} · ${task} · ${tail}`

test('a staged task creates the file and appends one line: id, timestamp, task verbatim, branch', async ($, on) => {
  const { file, disk, submitted, clock } = world(on)

  await start($, clock)

  expect(disk.has(PATH)).toBe(false)
  expect(await queue($, 'Fix the  race in upload · then tell me why')).toBe(
    'queued q1 · Fix the race in upload · then tell… · 1 pending',
  )
  expect(file()).toEqual(['# queue', line(' ', 1, 'Fix the  race in upload · then tell me why')])
  expect(WHEN).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)

  expect(await queue($, '/blitz sprint-3')).toBe('queued q2 · /blitz sprint-3 · 2 pending')
  expect(file()?.[2]).toBe(line(' ', 2, '/blitz sprint-3'))

  await clock.advance(60_000)

  expect(submitted).toEqual([])
})

test('--later stages for another session: [~], never the head, never run by a drain', async ($, on) => {
  const { file, submitted, toasts, clock } = world(on)

  await start($, clock)

  expect(await queue($, '--later tidy the changelog')).toBe('queued q1 · tidy the changelog · 0 pending')
  expect(file()).toEqual(['# queue', line('~', 1, 'tidy the changelog', '@main · later')])
  expect(await queue($, '--drain')).toBe('nothing pending')

  await clock.advance(60_000)

  expect(submitted).toEqual([])
  expect(toasts).toEqual([])
})

test('/queue prints the pending and running lines as written, then the counts and the head', async ($, on) => {
  const lines = [
    '# queue',
    line('x', 1, 'ship it', '@main · done abc1234'),
    line('>', 2, 'port the tests', '@main · running'),
    line(' ', 3, 'write   the docs'),
    line('!', 4, 'bump deps', '@main · failed: lockfile conflict'),
    line('~', 5, 'tidy', '@main · later'),
    'a note written by hand',
  ]
  const { clock } = world(on, { [PATH]: `${lines.join('\n')}\n` })

  // Headless: the running line is another session's, and stays.
  await start($, clock, false)

  expect(await queue($, '')).toBe(
    [lines[2], lines[3], '1 pending · 1 running · 1 failed · 1 later · next: q3'].join('\n'),
  )
})

test('with no file, showing, dropping, clearing and running say so and create nothing', async ($, on) => {
  const { disk, submitted, clock } = world(on)

  await start($, clock)

  expect(await queue($, '')).toBe('queue empty')
  expect(await queue($, '--drop q1')).toBe('queue empty')
  expect(await queue($, '--clear')).toBe('queue empty')
  expect(await queue($, '--run')).toBe('queue empty')
  expect(await queue($, '--drain')).toBe('queue empty')

  await clock.advance(60_000)

  expect(disk.size).toBe(0)
  expect(submitted).toEqual([])
})

test('--drop removes one line and leaves the rest in order; the next id is past the highest left', async ($, on) => {
  const { file, clock } = world(on)

  await start($, clock)
  await queue($, 'one')
  await queue($, 'two')
  await queue($, 'three')

  expect(await queue($, '--drop q2')).toBe('dropped q2 · two · 2 pending')
  expect(file()).toEqual(['# queue', line(' ', 1, 'one'), line(' ', 3, 'three')])
  expect(await queue($, '--drop q9')).toBe('no q9 in the queue')
  expect(await queue($, 'four')).toBe('queued q4 · four · 3 pending')
  expect(await queue($, '--drop')).toMatch(/^usage: \/queue/)
})

test('--clear empties the queue, done and pending alike, and keeps what is not an item', async ($, on) => {
  const { file, clock } = world(on, {
    [PATH]: ['# queue', line('x', 1, 'old', '@main · done abc1234'), 'a note', line(' ', 2, 'new'), ''].join('\n'),
  })

  await start($, clock)

  expect(await queue($, '--clear')).toBe('queue cleared · 2 removed')
  expect(file()).toEqual(['# queue', 'a note'])
  expect(await queue($, '')).toBe('queue empty')
})

test('--run marks the head running and submits the task verbatim; the note joins its row, after the task', async ($, on) => {
  const { file, submitted, rows, git, clock } = world(on)

  await start($, clock)
  await queue($, 'Fix the  race; keep `retry()` as is')
  await queue($, 'second')

  expect(await queue($, '--run')).toBe('running q1 · Fix the race; keep `retry()` as is')
  expect(file()?.[1]).toBe(line('>', 1, 'Fix the  race; keep `retry()` as is', '@main · running'))
  expect(submitted).toEqual([])

  await clock.advance(50)

  expect(submitted).toHaveLength(1)
  expect(submitted[0]?.text).toBe('Fix the  race; keep `retry()` as is')
  expect(submitted[0]?.origin).toMatchObject({ kind: 'plugin', asUser: true })

  // The person's own prompt is never touched; the queue's row gains the note once, the task as written.
  await promptRow($, 'something I typed', { kind: 'composer' })
  await promptRow($, 'Fix the  race; keep `retry()` as is')
  await promptRow($, 'Fix the  race; keep `retry()` as is')

  expect(rows).toEqual([
    ['something I typed'],
    ['Fix the  race; keep `retry()` as is', noteOf(1, 'Fix the  race; keep `retry()` as is')],
    ['Fix the  race; keep `retry()` as is'],
  ])
  expect(rows[1]?.[1]).toContain('`queue: done`, or `queue: failed — <one-line reason>`')
  expect(rows[1]?.[1]).not.toContain('itr')
  // One at a time, and the queue never touches the branch or the index.
  expect(await queue($, '--run')).toBe('q1 is running.')
  // Reads only: where the repository is, its branch, and whether git already knows the queue file.
  expect(
    git.filter(
      args => !/^(rev-parse|branch --show-current|-C \/repo (ls-files|check-ignore|rev-parse --git-path) )/.test(args),
    ),
  ).toEqual([])
})

test('a `#id` task is submitted as typed and the note says it is an itr issue to claim', async ($, on) => {
  const { submitted, rows, clock } = world(on)

  await start($, clock)
  await queue($, '#12')
  await queue($, '--run q1')
  await clock.advance(50)
  await promptRow($, '#12')

  expect(submitted[0]?.text).toBe('#12')
  expect(rows[0]?.[0]).toBe('#12')
  expect(rows[0]?.[1]).toContain('#12 is an itr issue: claim it (itr claim 12)')
})

test('`queue: done` closes the item with the new sha when HEAD moved, and no-commit when it did not', async ($, on) => {
  const { repo, file, submitted, toasts, clock } = world(on)

  await start($, clock)
  await queue($, 'first')
  await queue($, 'second')
  await queue($, '--run')
  await clock.advance(50)
  repo.head = 'def5678'
  await turn($, clock, 'first', 'Fixed and committed.\n\n`queue: done`', 't1')

  expect(file()?.[1]).toBe(line('x', 1, 'first', '@main · done def5678'))
  expect(file()?.[2]).toBe(line(' ', 2, 'second'))
  expect(toasts.at(-1)).toBe('queue: q1 done · def5678')

  await clock.advance(60_000)

  // --run stops after one item.
  expect(submitted).toHaveLength(1)

  await queue($, '--run')
  await clock.advance(50)
  await turn($, clock, 'second', 'Nothing needed changing.\nqueue: done', 't2')

  expect(file()?.[2]).toBe(line('x', 2, 'second', '@main · done no-commit'))
})

test('`queue: failed` marks the item with its reason and leaves the tree alone', async ($, on) => {
  const { file, toasts, git, clock } = world(on)

  await start($, clock)
  await queue($, 'bump the deps')
  await queue($, '--run')
  await clock.advance(50)
  await turn($, clock, 'bump the deps', 'The lockfile conflicts.\n\n**queue: failed — lockfile conflict · @main**', 't1')

  expect(file()?.[1]).toBe(line('!', 1, 'bump the deps', '@main · failed: lockfile conflict · at main'))
  expect(toasts.at(-1)).toBe('queue: q1 failed — lockfile conflict · at main')
  expect(git.some(args => /^(reset|checkout|restore|stash|clean)/.test(args))).toBe(false)
})

test('a turn that ends without the marker leaves the item running and offers Done and Failed', async ($, on) => {
  const { file, toasts, clock } = world(on)

  await start($, clock)
  await queue($, 'look into the flake')
  await queue($, '--run')
  await clock.advance(50)
  await turn($, clock, 'look into the flake', 'It flakes on a slow disk.', 't1')

  expect(file()?.[1]).toBe(line('>', 1, 'look into the flake', '@main · running'))
  expect(await band($)).toEqual({ texts: ['q1 finished?', BENEATH], buttons: ['Done', 'Failed'], hotkeys: ['k', 'f'] })
  expect(await queue($, '--run')).toBe('q1 finished? Press Done or Failed first.')

  await pressBand($, clock, 'queue-done')

  expect(file()?.[1]).toBe(line('x', 1, 'look into the flake', '@main · done no-commit'))
  expect(toasts.at(-1)).toBe('queue: q1 done · no-commit')
  expect((await band($)).buttons).toEqual([])
})

test('an interrupted turn asks for the verdict too, and Failed records it', async ($, on) => {
  const { file, clock } = world(on)

  await start($, clock)
  await queue($, 'refactor the parser')
  await queue($, '--run')
  await clock.advance(50)
  await turn($, clock, 'refactor the parser', 'queue: done', 't1', 'aborted')

  expect(file()?.[1]).toBe(line('>', 1, 'refactor the parser', '@main · running'))

  await pressBand($, clock, 'queue-failed')

  expect(file()?.[1]).toBe(line('!', 1, 'refactor the parser', '@main · failed: marked failed by hand'))
})

test('another prompt finishing first leaves the item waiting for its own turn', async ($, on) => {
  const { file, clock } = world(on)

  await start($, clock)
  await queue($, 'first')
  await queue($, '--run')
  await clock.advance(50)
  await turn($, clock, 'fix the typo', 'Fixed.', 't0')

  expect(file()?.[1]).toBe(line('>', 1, 'first', '@main · running'))
  expect((await band($)).texts).toEqual(['queue · q1 running', BENEATH])

  await turn($, clock, 'first', 'queue: done', 't1')

  expect(file()?.[1]).toBe(line('x', 1, 'first', '@main · done no-commit'))
})

test('--drain runs head to tail, skips [~], and stops at the first failure', async ($, on) => {
  const { file, submitted, toasts, clock } = world(on)

  await start($, clock)
  await queue($, 'one')
  await queue($, '--later two')
  await queue($, 'three')
  await queue($, 'four')

  expect(await queue($, '--drain')).toBe('draining · running q1 · one')

  await clock.advance(50)
  await turn($, clock, 'one', 'queue: done', 't1')

  expect(file()?.slice(1, 4)).toEqual([
    line('x', 1, 'one', '@main · done no-commit'),
    line('~', 2, 'two', '@main · later'),
    line('>', 3, 'three', '@main · running'),
  ])

  await clock.advance(50)

  expect(submitted.map(sent => sent.text)).toEqual(['one', 'three'])

  await turn($, clock, 'three', 'queue: failed — tests red', 't2')
  await clock.advance(60_000)

  expect(file()?.slice(3)).toEqual([line('!', 3, 'three', '@main · failed: tests red'), line(' ', 4, 'four')])
  expect(submitted).toHaveLength(2)
  expect(toasts.at(-1)).toBe('queue: q3 failed — tests red; the drain stopped.')
})

test('a drain that reaches the end says so, and one that gets no verdict stops', async ($, on) => {
  const { file, submitted, toasts, clock } = world(on)

  await start($, clock)
  await queue($, 'one')
  await queue($, 'two')
  await queue($, 'three')
  await queue($, '--drain')
  await clock.advance(50)
  await turn($, clock, 'one', 'queue: done', 't1')
  await clock.advance(50)
  await turn($, clock, 'two', 'I looked into it.', 't2')
  await clock.advance(60_000)

  expect(toasts.at(-1)).toBe('queue: the drain stopped: q2 ended without saying how it went.')
  expect(submitted).toHaveLength(2)

  await pressBand($, clock, 'queue-done')
  await clock.advance(60_000)

  // The verdict closes q2; the stopped drain does not start q3 by itself.
  expect(file()?.slice(2)).toEqual([line('x', 2, 'two', '@main · done no-commit'), line(' ', 3, 'three')])
  expect(submitted).toHaveLength(2)

  await queue($, '--drain')
  await clock.advance(50)
  await turn($, clock, 'three', 'queue: done', 't3')

  expect(toasts.at(-1)).toBe('queue: q3 done · no-commit; drained.')
})

test('an item staged on another branch says so and runs anyway; the branch is never switched', async ($, on) => {
  const { repo, submitted, git, clock } = world(on)

  await start($, clock)
  await queue($, 'port the tests')
  repo.branch = 'feat/parser'

  expect(await queue($, '--run q1')).toBe('running q1 · port the tests · staged on @main, now on @feat/parser')

  await clock.advance(50)

  expect(submitted.map(sent => sent.text)).toEqual(['port the tests'])
  expect(git.some(args => /^(checkout|switch)/.test(args))).toBe(false)
})

test('--now stages and runs that item once the session is idle', async ($, on) => {
  const { file, submitted, clock } = world(on)

  await start($, clock)
  await queue($, 'older')

  expect(await queue($, '--now hotfix the login')).toBe('queued q2 · hotfix the login · runs once the session is idle')
  expect(file()?.slice(1)).toEqual([line(' ', 1, 'older'), line('>', 2, 'hotfix the login', '@main · running')])

  await clock.advance(50)

  expect(submitted.map(sent => sent.text)).toEqual(['hotfix the login'])
  expect(await queue($, '--now another')).toBe('queued q3 · another · 2 pending · q2 is running.')
})

test('a slash-command task runs as the command, the note on the prompt it hands the model; an unknown one fails', async ($, on) => {
  const { file, submitted, rows, commands, toasts, clock } = world(on)

  await start($, clock)
  await queue($, '/blitz sprint-3 --fast')
  await queue($, '/nope now')
  await queue($, '--run')
  await clock.advance(50)

  expect(commands).toEqual([{ command: 'blitz', args: 'sprint-3 --fast' }])
  expect(submitted).toEqual([])

  // The skill's prompt, as the engine appends it for a command a plugin ran.
  await promptRow($, 'Base directory for this skill: ~/.claude/skills/blitz', { kind: 'plugin', name: 'queue' })

  expect(rows).toEqual([
    ['Base directory for this skill: ~/.claude/skills/blitz', noteOf(1, '/blitz sprint-3 --fast')],
  ])

  // Another prompt's turn is not taken for the command's.
  await turn($, clock, 'something I typed', 'ok', 't0')

  expect(file()?.[1]).toBe(line('>', 1, '/blitz sprint-3 --fast', '@main · running'))

  await turn(
    $,
    clock,
    '<command-message>blitz</command-message>\n<command-name>/blitz</command-name>',
    'Wave 2 closed.\nqueue: done',
    't1',
  )

  expect(file()?.[1]).toBe(line('x', 1, '/blitz sprint-3 --fast', '@main · done no-commit'))

  // A prompt may not begin with a slash, so a command this session lacks fails where it stands.
  await queue($, '--run')
  await clock.advance(50)

  expect(commands).toHaveLength(1)
  expect(submitted).toEqual([])
  expect(file()?.[2]).toBe(line('!', 2, '/nope now', '@main · failed: /nope is no command this session can run'))
  expect(toasts.at(-1)).toBe('queue: q2 failed — /nope is no command this session can run')
  expect((await band($)).buttons).toEqual([])
})

test('a slash command that starts no turn asks for the verdict, once the turn it waited behind has ended', async ($, on) => {
  const { commands, clock } = world(on)

  await start($, clock)
  await queue($, '/blitz')
  await $.turn.start({ text: 'something else', turnId: 't0' })
  await queue($, '--run')
  await clock.advance(50)

  // Handed to the engine at once: the engine holds it until the session is idle.
  expect(commands).toEqual([{ command: 'blitz', args: '' }])

  await clock.advance(10_000)

  expect((await band($)).texts).toEqual(['queue · q1 running', BENEATH])

  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't0', reason: 'answer' })
  await clock.advance(3_000)

  expect((await band($)).buttons).toEqual(['Done', 'Failed'])
})

test('a slash command that prints its own answer is done once no turn follows, and a drain goes on', async ($, on) => {
  const { file, commands, toasts, clock } = world(on)

  await start($, clock)
  await queue($, '/status')
  await queue($, '/blitz')
  await queue($, '--drain')
  await clock.advance(50)

  expect(commands).toEqual([{ command: 'status', args: '' }])
  expect(file()?.[1]).toBe(line('>', 1, '/status', '@main · running'))

  await clock.advance(3_000)

  expect(file()?.slice(1)).toEqual([
    line('x', 1, '/status', '@main · done no-commit'),
    line('>', 2, '/blitz', '@main · running'),
  ])
  expect(toasts).toEqual([])

  await clock.advance(50)

  expect(commands).toEqual([
    { command: 'status', args: '' },
    { command: 'blitz', args: '' },
  ])
})

test('a new session marks a leftover [>] interrupted, names what is pending once, and starts nothing', async ($, on) => {
  const { file, toasts, submitted, commands, clock } = world(on, {
    [PATH]: ['# queue', line('>', 1, 'half done', '@main · running'), line(' ', 2, 'next up'), line(' ', 3, 'after'), ''].join('\n'),
  })

  await start($, clock)

  expect(file()).toEqual([
    '# queue',
    line('!', 1, 'half done', '@main · interrupted'),
    line(' ', 2, 'next up'),
    line(' ', 3, 'after'),
  ])
  expect(toasts).toEqual(['queue: 2 pending — /queue --run'])

  // A reload starts the session again: nothing is said or downgraded twice.
  await start($, clock)
  await clock.advance(600_000)

  expect(toasts).toHaveLength(1)
  expect(submitted).toEqual([])
  expect(commands).toEqual([])
})

test('a headless run in the same repository leaves a running line alone', async ($, on) => {
  const lines = ['# queue', line('>', 1, 'in flight elsewhere', '@main · running'), line(' ', 2, 'next')]
  const { file, toasts, clock } = world(on, { [PATH]: `${lines.join('\n')}\n` })

  await start($, clock, false)

  expect(file()).toEqual(lines)
  expect(toasts).toEqual([])
})

test('the band shows the head with Run and Drain, marked as costing tokens, above what is beneath', async ($, on) => {
  const { submitted, file, clock } = world(on)

  await start($, clock)

  // No file, nothing pending: the mod draws nothing and what is beneath stays.
  expect(await band($)).toEqual({ texts: [BENEATH], buttons: [], hotkeys: [] })

  await queue($, 'rewrite the importer so that it streams rows instead')
  await queue($, 'second')

  for (const surface of ['terminal', 'desktop'] as const) {
    expect(await band($, surface)).toEqual({
      texts: ['queue · 2 pending · next q1 rewrite the importer so that it…', LEGEND, BENEATH],
      buttons: ['Run ¤', 'Drain ¤'],
      hotkeys: ['u', 'd'],
    })
  }

  await pressBand($, clock, 'queue-run')

  expect(file()?.[1]).toBe(line('>', 1, 'rewrite the importer so that it streams rows instead', '@main · running'))
  expect(await band($)).toEqual({ texts: ['queue · q1 running', BENEATH], buttons: [], hotkeys: [] })

  await clock.advance(50)

  expect(submitted.map(sent => sent.text)).toEqual(['rewrite the importer so that it streams rows instead'])

  await turn($, clock, 'rewrite the importer so that it streams rows instead', 'queue: done', 't1')
  await queue($, '--drop q2')

  expect(await band($)).toEqual({ texts: [BENEATH], buttons: [], hotkeys: [] })
})

test('Drain pressed in the band drains; a survey in the band is left alone', async ($, on) => {
  const { submitted, clock } = world(on)

  await start($, clock)
  await queue($, 'one')
  await queue($, 'two')

  const survey = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })

  expect(await survey.findAll({ type: 'Button' })).toEqual([])
  await survey.unmount()

  await pressBand($, clock, 'queue-drain')
  await clock.advance(50)
  await turn($, clock, 'one', 'queue: done', 't1')
  await clock.advance(50)

  expect(submitted.map(sent => sent.text)).toEqual(['one', 'two'])
})

test('a hand-edited file is read as it stands: unknown lines kept, a changed head shown after the next turn', async ($, on) => {
  const { disk, file, clock } = world(on)

  await start($, clock)
  await queue($, 'one')
  disk.set(PATH, `# queue\n\nmy own heading\n- [ ] q7 · do the thing\n`)
  await turn($, clock, 'unrelated', 'ok', 't0')

  expect((await band($)).texts[0]).toBe('queue · 1 pending · next q7 do the thing')
  expect(await queue($, 'eight')).toBe('queued q8 · eight · 2 pending')
  expect(file()).toEqual(['# queue', '', 'my own heading', '- [ ] q7 · do the thing', line(' ', 8, 'eight')])
})

test('outside a repository the queue lives under the session directory and the branch reads `-`', async ($, on) => {
  const { repo, file, clock } = world(on)

  repo.isRepo = false
  await start($, clock)

  expect(await queue($, 'note to self')).toBe('queued q1 · note to self · 1 pending')
  expect(file()).toEqual(['# queue', line(' ', 1, 'note to self', '@-')])
})

const EXCLUDE_FILE = '/repo/.git/info/exclude'
const EXCLUDE_LINES = [
  '# queue mod: a personal staging file, kept out of status and commits in this repository only',
  '/.claude/queue.md',
]

test('the first stage hides the queue file from git in this repository only, once, keeping what the exclude file held', async ($, on) => {
  const { disk, clock } = world(on, { [EXCLUDE_FILE]: '# git ls-files --others --exclude-from=.git/info/exclude\n*.local' })

  await start($, clock)
  await queue($, 'first')

  // Anchored to the repository root: no other project's queue, and no queue.md deeper in the tree.
  expect(disk.get(EXCLUDE_FILE)?.split('\n')).toEqual([
    '# git ls-files --others --exclude-from=.git/info/exclude',
    '*.local',
    ...EXCLUDE_LINES,
    '',
  ])

  await queue($, 'second')
  await queue($, '--later third')

  expect(disk.get(EXCLUDE_FILE)?.split('\n').filter(text => text === '/.claude/queue.md')).toHaveLength(1)
})

test('a repository with no exclude file gets one, and a linked worktree writes to the path git names', async ($, on) => {
  const { repo, disk, clock } = world(on)

  await start($, clock)
  await queue($, 'first')

  expect(disk.get(EXCLUDE_FILE)).toBe(`${EXCLUDE_LINES.join('\n')}\n`)

  disk.delete(EXCLUDE_FILE)
  repo.excludeAt = '/main/.git/info/exclude'
  await queue($, 'second')

  expect(disk.has(EXCLUDE_FILE)).toBe(false)

  // The host spells a path outside `/repo` with its drive, so find it by its tail.
  const elsewhere = [...disk.keys()].find(path => path.endsWith('/main/.git/info/exclude'))

  expect(elsewhere).toBeDefined()
  expect(disk.get(elsewhere ?? '')).toBe(`${EXCLUDE_LINES.join('\n')}\n`)
})

test('a project that tracks the queue file, or already ignores it, is left as it chose; so is a folder that is no repository', async ($, on) => {
  const { repo, disk, file, clock } = world(on)

  await start($, clock)
  repo.isTracked = true
  await queue($, 'tracked on purpose')
  repo.isTracked = false
  repo.isIgnored = true
  await queue($, 'ignored already')
  repo.isIgnored = false
  repo.isRepo = false
  await queue($, 'no git here')

  expect(file()).toHaveLength(4)
  expect([...disk.keys()]).toEqual([PATH])
})

test('the pure helpers hold the line format', () => {
  expect(brief('a b  c d e f g h i', 8)).toBe('a b c d e f g h…')
  expect(brief('a b', 8)).toBe('a b')
  expect(verdictOf('work\n\nqueue: done')).toEqual({ isDone: true, reason: '' })
  expect(verdictOf('`queue: failed — no token`\n')).toEqual({ isDone: false, reason: 'no token' })
  expect(verdictOf('queue: done\nthen three\nmore\nlines\nfollowed')).toBeUndefined()
  expect(verdictOf('the queue: done part is prose')).toBeUndefined()

  const staged = '- [ ] q4 · 2026-08-22 14:20 · ping @bob · @alice about it · @feat/x'
  const item = parseLine(staged, 3)

  expect(item).toEqual({
    at: 3,
    mark: ' ',
    id: 4,
    when: '2026-08-22 14:20',
    task: 'ping @bob · @alice about it',
    branch: 'feat/x',
    note: '',
  })
  expect(item === undefined ? '' : renderLine(item)).toBe(staged)
  expect(parseLine('- [x] q3 · 2026-08-22 14:20 · ship · @main · done abc1234', 0)?.note).toBe('done abc1234')
  expect(parseLine('# queue', 0)).toBeUndefined()
  expect(parseLine('- [ ] not an item', 0)).toBeUndefined()
})
