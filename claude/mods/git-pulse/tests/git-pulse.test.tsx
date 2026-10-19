import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

const ME = 'someone@users.noreply.github.com'
const OTHER = 'me@example.test'
const LEGEND = '¤ uses tokens'

const BAND = {
  plugin: 'git-pulse',
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

/** A repository as git would describe it; the test changes it between calls. */
type Repo = {
  isRepo: boolean
  branch: string
  dirty: string[]
  behind: number
  /** Each remote, with how many of HEAD's commits it lacks; null for one never fetched. */
  remotes: Record<string, number | null>
  /** The author email of each commit no remote has. */
  unpushed: string[]
  nextEmail: string
}

const repo = (over: Partial<Repo> = {}): Repo => ({
  isRepo: true,
  branch: 'main',
  dirty: [],
  behind: 0,
  remotes: { origin: 0, gitea: 0 },
  unpushed: [],
  nextEmail: ME,
  ...over,
})

/** The world beneath the mod: git answered from `state`, and what the mod said. */
const world = (on: On, state: Repo) => {
  const toasts: string[] = []
  const submitted: string[] = []
  const ran: string[] = []
  const clock = mock.clock(on)

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: 'ok' }))
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)

    return { text: e.text }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('process.run', (_$, e) => {
    const args = e.argv.slice(2)
    const known = Object.entries(state.remotes).filter(([, ahead]) => ahead !== null)
    let stdout = ''

    ran.push(args.join(' '))

    if (args[0] === 'status') {
      stdout = [
        `# branch.head ${state.branch}`,
        `# branch.ab +${state.unpushed.length} -${state.behind}`,
        ...state.dirty.map(path => `1 .M N... 100644 100644 100644 abc abc ${path}`),
      ].join('\n')
    } else if (args[0] === 'remote') {
      stdout = Object.keys(state.remotes).join('\n')
    } else if (args[0] === 'for-each-ref') {
      stdout = known.map(([name]) => `refs/remotes/${name}/main`).join('\n')
    } else if (args[0] === 'log') {
      stdout = state.unpushed.flatMap(email => [email, email]).join('\n')
    } else if (args[0] === 'var') {
      stdout = `Someone <${state.nextEmail}> 1759449600 -0500`
    } else if (args[0] === 'rev-list') {
      stdout = String(state.remotes[(args.at(-1) ?? '').replace('--remotes=', '')] ?? 0)
    }

    return {
      value: {
        exitCode: state.isRepo ? 0 : 128,
        stdout: state.isRepo ? `${stdout}\n` : '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  // The engine draws nothing of its own in the band.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  return { toasts, submitted, ran, clock }
}

const start = async ($: Engine, clock: MockClock) => {
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await clock.settle()
}

/** A shell command, then whatever the mod measures once it has run. */
const shell = async ($: Engine, clock: MockClock, command: string) => {
  const ran = await $.tool.call({ tool: 'Bash', command })

  await clock.settle()

  return ran
}

/** The band's line, its parts joined, less the cost legend; '' when the mod draws nothing there. */
const bandText = async ($: Engine) => {
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = (await band.findAll({ type: 'Text' })).map(found => found.text)

  await band.unmount()

  return texts.filter(text => text !== LEGEND).join(' | ')
}

/** The labels of the band's buttons, in order. */
const bandButtons = async ($: Engine) => {
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const labels = (await band.findAll({ type: 'Button' })).map(found => found.text)

  await band.unmount()

  return labels
}

test('uncommitted paths and what each remote lacks show as one line', async ($, on) => {
  const { clock } = world(
    on,
    repo({ dirty: ['a.rs', 'b.rs', 'c.rs', 'd.rs'], remotes: { origin: 2, gitea: 5 }, unpushed: [ME, ME] }),
  )

  await start($, clock)

  expect(await bandText($)).toBe('git · main · 4 dirty · origin ↑2 · gitea ↑5 · identity ok')
})

test('a clean tree that every remote has draws nothing', async ($, on) => {
  const { clock } = world(on, repo())

  await start($, clock)

  expect(await bandText($)).toBe('')
})

test('a folder that is no repository draws nothing and raises nothing', async ($, on) => {
  const { clock, toasts } = world(on, repo({ isRepo: false }))

  await start($, clock)

  expect(await bandText($)).toBe('')
  expect(toasts).toEqual([])
})

test('unpushed commits under another email are called out', async ($, on) => {
  const { clock } = world(on, repo({ remotes: { origin: 3, gitea: 3 }, unpushed: [OTHER, ME, OTHER] }))

  await start($, clock)

  expect(await bandText($)).toBe(`git · main · origin ↑3 · gitea ↑3 | identity: 2 as ${OTHER}`)
})

test('a repository with no remote is not judged on its history', async ($, on) => {
  const { clock, ran } = world(on, repo({ remotes: {}, unpushed: [OTHER, OTHER] }))

  await start($, clock)

  expect(await bandText($)).toBe('')
  expect(ran.some(args => args.startsWith('log'))).toBe(false)
})

test('an identity that would mark the next commit is called out before any commit exists', async ($, on) => {
  const { clock } = world(on, repo({ nextEmail: OTHER }))

  await start($, clock)

  expect(await bandText($)).toBe(`git · main | next commit as ${OTHER}`)
})

test('a commit made mid-turn refreshes the line, and a status does not', async ($, on) => {
  const state = repo({ dirty: ['a.rs'] })
  const { clock, ran } = world(on, state)

  await start($, clock)

  const before = ran.length

  await shell($, clock, 'git status --short')

  expect(ran).toHaveLength(before)

  state.dirty = []
  state.unpushed = [ME]
  state.remotes = { origin: 1, gitea: 1 }
  await shell($, clock, 'git add -A && git commit -q -m "feat: one"')

  expect(await bandText($)).toBe('git · main · origin ↑1 · gitea ↑1 · identity ok')
})

test('a push that reaches one remote is never held, and the one left behind is named', async ($, on) => {
  const state = repo({ remotes: { origin: 2, gitea: 2 }, unpushed: [ME, ME] })
  const { clock, toasts } = world(on, state)

  await start($, clock)
  state.remotes = { origin: 0, gitea: 2 }
  state.unpushed = []

  expect(await shell($, clock, 'git push origin main')).toMatchObject({ result: 'ok' })
  expect(toasts).toEqual(['Git Pulse: pushed, but gitea is 2 behind.'])
  expect(await bandText($)).toBe('git · main · gitea ↑2')
})

test('a push carrying another identity is warned about and still runs', async ($, on) => {
  const state = repo({ remotes: { origin: 1, gitea: 1 }, unpushed: [OTHER] })
  const { clock, toasts } = world(on, state)

  await start($, clock)
  state.remotes = { origin: 0, gitea: 0 }
  state.unpushed = []

  expect(await shell($, clock, 'git push origin main && git push gitea main')).toMatchObject({ result: 'ok' })
  expect(toasts).toEqual([
    `Git Pulse: this push carries commits not under the no-reply identity: 1 as ${OTHER}.`,
  ])
})

test('the end of a main turn measures again; a subagent\'s does not', async ($, on) => {
  const state = repo()
  const { clock, ran } = world(on, state)
  const turn = (agentId?: string) =>
    $.turn.complete({
      answer: 'done',
      durationMs: 1,
      isAborted: false,
      turnId: 't1',
      reason: 'answer',
      ...(agentId === undefined ? {} : { agentId }),
    })

  await start($, clock)

  const before = ran.length

  await turn('agent-1')
  await clock.settle()

  expect(ran).toHaveLength(before)

  state.dirty = ['notes.md']
  await turn()
  await clock.settle()

  expect(await bandText($)).toBe('git · main · 1 dirty')
})

test('Commit and Push show only when there is something to commit or push, marked as costing tokens', async ($, on) => {
  const state = repo({ dirty: ['a.rs'] })
  const { clock } = world(on, state)

  await start($, clock)

  expect(await bandButtons($)).toEqual(['Commit ¤'])

  state.dirty = []
  state.remotes = { origin: 1, gitea: 1 }
  state.unpushed = [ME]
  await shell($, clock, 'git commit -q -am "feat: one"')

  expect(await bandButtons($)).toEqual(['Push both ¤'])

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect(await band.find({ type: 'Text', text: LEGEND })).toBeDefined()
  await band.unmount()

  state.remotes = { origin: 1 }
  await shell($, clock, 'git remote remove gitea')

  expect(await bandButtons($)).toEqual(['Push ¤'])
})

test('a pressed button hands the main session the request and runs no git itself', async ($, on) => {
  const state = repo({ dirty: ['a.rs'], remotes: { origin: 2, gitea: 0 }, unpushed: [ME, ME] })
  const { clock, submitted, ran } = world(on, state)

  await start($, clock)

  const before = ran.length
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'git-commit' })
  await clock.advance(50)
  await band.press({ key: 'git-push' })
  await clock.advance(50)
  await band.unmount()

  expect(submitted).toHaveLength(2)
  expect(submitted[0]).toContain('[git-pulse] Commit the finished work in this repository')
  expect(submitted[1]).toContain('[git-pulse] Push main to origin and gitea, fetching first')
  expect(ran).toHaveLength(before)
})
