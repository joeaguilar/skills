import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import { folded, hostOf, joined, leafOf, othersOf, parentOf, wordsOf } from '../hooks/register'

const GLOBAL = { name: 'Someone', email: 'someone@users.noreply.github.com' }
const ME = 'Someone <someone@users.noreply.github.com>'
const OLD = 'Someone <me@example.test>'
const ALIAS = 'alias <me@example.test>'

const PANE = {
  plugin: 'git-pulse',
  component: 'Pane',
  requestId: 'git-pulse-identity',
  props: {
    title: 'Identity audit',
    isFocused: true,
    bodyColumns: 120,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

/** A repository as git would describe it; a test changes it between audits. */
type Fake = {
  /** Its own user.name and user.email. */
  override?: { name?: string; email?: string }
  /** What it resolves to when neither its override nor the global identity decides (an include). */
  resolved?: { name: string; email: string }
  /** The author of each commit on HEAD; absent, it has no commit yet. */
  history?: string[]
  /** The author and committer of each commit no remote has. */
  unpushed?: [author: string, committer: string][]
  remotes?: Record<string, string>
  /** git cannot read it: what git says. */
  broken?: string
  /** It answers only once this settles. */
  hold?: Promise<void>
  /** Listing its history never answers. */
  isHistoryLost?: boolean
}

type Options = {
  repos?: Record<string, Fake>
  /** Folders that are no repository, with their children's names; a `.txt` name is a file. */
  folders?: Record<string, string[]>
  global?: { name: string; email: string }
  /** The session's repository; null when it runs outside one. */
  root?: string | null
  cwd?: string
  variables?: Record<string, string>
}

/** A path as the test spells it: the host hands the file system an absolute one of its own. */
const spelled = (path: string) => path.replace(/^[A-Za-z]:(?=[\\/])/, '').replace(/\\/g, '/')

/** The world beneath the mod: git answered per repository, the folders, and what the mod did. */
const world = (on: On, options: Options = {}) => {
  const repos = options.repos ?? {}
  const folders = options.folders ?? {}
  const identity = options.global ?? GLOBAL
  const root = options.root === undefined ? '/work/skills' : options.root
  const ran: string[] = []
  const toasts: string[] = []
  const opens: string[] = []
  const clock = mock.clock(on)

  mock.env(on, options.variables ?? {})
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: options.cwd ?? root ?? '/work' }))
  on('session.repo', () => ({
    value: root === null ? null : { root, remote: null, internal: false, name: null },
  }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', (_$, e) => {
    opens.push(e.id)

    return { value: { isPlaced: true as const } }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('fs.exists', (_$, e) => {
    const path = spelled(e.path)

    return { value: path.endsWith('/.git') && repos[path.slice(0, -'/.git'.length)] !== undefined }
  })
  on('fs.list', (_$, e) => {
    const names = folders[spelled(e.path)]

    if (names === undefined) throw new Error(`ENOENT: ${e.path}`)

    return {
      value: names.map(name => ({
        name,
        kind: name.endsWith('.txt') ? ('file' as const) : ('dir' as const),
        size: 0,
        mtimeMs: 0,
        isLink: false,
      })),
    }
  })
  on('process.run', async (_$, e) => {
    const answer = (stdout: string, exitCode = 0, stderr = '') => ({
      value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
    })
    const set = (value: string | undefined) => (value === undefined || value === '' ? answer('', 1) : answer(`${value}\n`))

    if (e.argv[2] !== '-C') {
      const [verb, scope, , key] = e.argv.slice(2)

      // The band's own measurements find no repository here: these tests are the audit's.
      return verb === 'config' && scope === '--global'
        ? set(key === 'user.name' ? identity.name : identity.email)
        : answer('', 128, 'fatal: not a git repository')
    }

    const path = e.argv[3] ?? ''
    const args = e.argv.slice(4).join(' ')
    const fake = repos[path]

    ran.push(`${path}: ${args}`)

    if (fake === undefined) return answer('', 128, `fatal: cannot change to '${path}'`)
    if (fake.hold !== undefined) await fake.hold
    if (fake.broken !== undefined) return answer('', 128, `fatal: ${fake.broken}`)

    if (args.startsWith('config --local --get-regexp')) {
      const rows = [
        fake.override?.name === undefined ? '' : `user.name ${fake.override.name}`,
        fake.override?.email === undefined ? '' : `user.email ${fake.override.email}`,
      ].filter(row => row !== '')

      return rows.length === 0 ? answer('', 1) : answer(`${rows.join('\n')}\n`)
    }

    if (args === 'config --get user.name') return set(fake.resolved?.name ?? fake.override?.name ?? identity.name)
    if (args === 'config --get user.email') return set(fake.resolved?.email ?? fake.override?.email ?? identity.email)

    if (args === 'config --local --unset user.name' || args === 'config --local --unset user.email') {
      const { name, email } = fake.override ?? {}

      fake.override = args.endsWith('name') ? { ...(email === undefined ? {} : { email }) } : { ...(name === undefined ? {} : { name }) }

      return answer('')
    }

    if (args === 'remote -v') {
      return answer(
        Object.entries(fake.remotes ?? {})
          .flatMap(([name, url]) => [`${name}\t${url} (fetch)`, `${name}\t${url} (push)`])
          .join('\n'),
      )
    }

    if (args.startsWith('rev-parse')) return fake.history === undefined ? answer('', 1) : answer('abc123\n')

    if (args.startsWith('log') && args.endsWith('HEAD')) {
      if (fake.isHistoryLost === true) return { deny: 'timed out after 30000 ms' }

      return answer(`${(fake.history ?? []).join('\n')}\n`)
    }

    if (args.startsWith('log') && args.includes('--branches --not --remotes')) {
      return answer(`${(fake.unpushed ?? []).map(pair => pair.join('\t')).join('\n')}\n`)
    }

    return answer('', 129, `fatal: unexpected git ${args}`)
  })

  return { repos, ran, toasts, opens, clock }
}

const start = async ($: Engine, clock: MockClock) => {
  await $.session.start({ cwd: '/work/skills', surface: 'terminal', isInteractive: true })
  await clock.settle()
}

const command = async ($: Engine, args: string) =>
  (
    await $.command.run({
      command: 'git-pulse',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 200 },
    })
  ).text ?? ''

/** `/git-pulse identity …`, then the audit as far as it goes without the clock moving. */
const audit = async ($: Engine, clock: MockClock, paths = '') => {
  const text = await command($, `identity ${paths}`.trim())

  await clock.settle()

  return text
}

const mounted = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') => $.ui.mount({ ...PANE, surface })

/** What the pane draws: every line of text, and its buttons' labels. */
const drawn = async ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') => {
  const pane = await mounted($, surface)
  const texts = (await pane.findAll({ type: 'Text' })).map(found => found.text)
  const buttons = (await pane.findAll({ type: 'Button' })).map(found => found.text)

  await pane.unmount()

  return { texts, buttons }
}

const press = async ($: Engine, clock: MockClock, key: string) => {
  const pane = await mounted($)

  await pane.press({ key })
  await clock.settle()
  await pane.unmount()
}

const SIBLINGS = { '/work': ['api', 'notes', 'skills', 'web', 'readme.txt'] }
const CLEAN: Fake = { history: [ME, ME], remotes: { origin: 'git@github.com:someone/x.git' } }

test('/git-pulse alone says what it takes, and opens nothing', async ($, on) => {
  const { clock, opens, ran } = world(on)

  await start($, clock)

  expect(await command($, '')).toContain('/git-pulse identity [path…]')
  expect(await command($, 'status')).toContain('It only reads')
  await clock.settle()
  expect(opens).toEqual([])
  expect(ran).toEqual([])
})

test('with no path the audit reads the repositories beside the session\'s own, and clean ones are a count', async ($, on) => {
  const { clock, opens, ran } = world(on, {
    folders: SIBLINGS,
    repos: { '/work/api': { ...CLEAN }, '/work/skills': { ...CLEAN }, '/work/web': { ...CLEAN } },
  })

  await start($, clock)

  expect(await audit($, clock)).toBe('Identity audit opened.')
  expect(opens).toEqual(['git-pulse-identity'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const { texts, buttons } = await drawn($, surface)

    expect(texts).toEqual([`intended ${ME} · 3 repositories in /work`, '3 clean'])
    expect(buttons).toEqual(['Refresh'])
  }

  // notes holds no .git and readme.txt is a file: neither is asked anything.
  expect(ran.some(row => row.startsWith('/work/notes') || row.startsWith('/work/readme'))).toBe(false)
  // Reading is all the audit does.
  expect(ran.some(row => /--unset|commit|push|filter|rebase/.test(row))).toBe(false)
})

test('a local override that differs is called out with a way to unset it; one that matches is not', async ($, on) => {
  const { clock } = world(on, {
    folders: SIBLINGS,
    repos: {
      '/work/api': { ...CLEAN, override: { email: 'me@example.test' } },
      '/work/skills': { ...CLEAN, override: { name: 'Someone', email: 'Someone@Users.Noreply.GitHub.com' } },
      '/work/web': { ...CLEAN },
    },
  })

  await start($, clock)
  await audit($, clock)

  const { texts, buttons } = await drawn($)

  expect(texts).toEqual([
    `intended ${ME} · 3 repositories in /work`,
    'api',
    'local override user.email=me@example.test',
    'published: origin github.com',
    '2 clean',
  ])
  expect(buttons).toEqual(['Unset override', 'Refresh'])
})

test('an identity that something other than the override decides is named as the next commit\'s', async ($, on) => {
  const { clock } = world(on, {
    folders: SIBLINGS,
    repos: {
      '/work/api': { ...CLEAN, resolved: { name: 'Work Me', email: 'me@work.test' } },
      '/work/skills': { ...CLEAN },
      '/work/web': { remotes: {}, resolved: { name: '', email: '' } },
    },
  })

  await start($, clock)
  await audit($, clock)

  const { texts, buttons } = await drawn($)

  expect(texts).toContain('next commit as Work Me <me@work.test>')
  expect(texts).toContain('next commit as no identity')
  // Nothing in the repository's own config to unset.
  expect(buttons).toEqual(['Refresh'])
})

test('other identities in history are counted, most first, and only shown', async ($, on) => {
  const { clock } = world(on, {
    folders: SIBLINGS,
    repos: {
      '/work/api': {
        history: [OLD, ME, ALIAS, OLD, OLD, 'Third <third@example.test>', ME],
        remotes: { origin: 'https://github.com/someone/api.git' },
      },
      '/work/skills': { ...CLEAN },
      '/work/web': { history: [OLD], remotes: {} },
    },
  })

  await start($, clock)
  await audit($, clock)

  const { texts, buttons } = await drawn($)

  expect(texts).toEqual([
    `intended ${ME} · 3 repositories in /work`,
    'api',
    `history: 3 as ${OLD}, 1 as ${ALIAS} +1 more`,
    'published: origin github.com',
    'web',
    `history: 1 as ${OLD}`,
    'no remote',
    '1 clean',
    'History is shown only: nothing here rewrites a commit.',
  ])
  expect(buttons).toEqual(['Refresh'])
})

test('unpushed commits under another identity, as author or committer, come before history', async ($, on) => {
  const { clock } = world(on, {
    folders: SIBLINGS,
    repos: {
      '/work/api': { history: [OLD], remotes: { origin: 'git@github.com:someone/api.git' } },
      '/work/skills': { ...CLEAN },
      '/work/web': {
        history: [ME, ME, ME],
        unpushed: [
          [OLD, OLD],
          [ME, OLD],
          [ME, ME],
        ],
        remotes: { origin: 'gitea:blue/web.git', nas: 'ssh://git@10.0.0.85:2222/blue/web.git' },
      },
    },
  })

  await start($, clock)
  await audit($, clock)

  const { texts } = await drawn($)

  expect(texts.slice(1, 4)).toEqual([
    'web',
    `unpushed: 2 as ${OLD}`,
    'published: origin gitea, nas 10.0.0.85',
  ])
  expect(texts[4]).toBe('api')
})

test('a repository with no remote is not said to have unpushed commits: its history says it', async ($, on) => {
  const { clock } = world(on, {
    folders: SIBLINGS,
    repos: {
      '/work/api': { history: [OLD], unpushed: [[OLD, OLD]], remotes: {} },
      '/work/skills': { ...CLEAN },
      '/work/web': { ...CLEAN },
    },
  })

  await start($, clock)
  await audit($, clock)

  const { texts } = await drawn($)

  expect(texts.some(text => text.startsWith('unpushed'))).toBe(false)
  expect(texts).toContain(`history: 1 as ${OLD}`)
  expect(texts).toContain('no remote')
})

test('paths name a repository, or a folder whose children are repositories', async ($, on) => {
  const { clock, ran } = world(on, {
    cwd: '/work/skills',
    variables: { USERPROFILE: '/home/someone' },
    folders: { '/elsewhere/my games': ['one', 'two', 'art'], '/home/someone/src': ['dot'] },
    repos: {
      '/work/api': { ...CLEAN },
      '/elsewhere/my games/one': { ...CLEAN },
      '/elsewhere/my games/two': { ...CLEAN },
      '/home/someone/src/dot': { ...CLEAN },
    },
  })

  await start($, clock)
  await audit($, clock, '../api "/elsewhere/my games" ~/src ../api')

  const { texts } = await drawn($)
  const asked = [...new Set(ran.map(row => row.split(': ')[0]))]

  expect(asked).toEqual(['/elsewhere/my games/one', '/elsewhere/my games/two', '/home/someone/src/dot', '/work/api'])
  expect(texts).toEqual([
    `intended ${ME} · 4 repositories in /work/api, /elsewhere/my games, /home/someone/src`,
    '4 clean',
  ])
})

test('a folder with no repository in it says so', async ($, on) => {
  const { clock } = world(on, { root: null, cwd: '/tmp/empty', folders: { '/tmp/empty': ['a'] } })

  await start($, clock)
  await audit($, clock)

  expect((await drawn($)).texts).toEqual(['No repositories in /tmp/empty.'])
})

test('Unset override removes the keys the repository sets, reads it again, and rewrites no history', async ($, on) => {
  const { clock, ran, repos } = world(on, {
    folders: SIBLINGS,
    repos: {
      '/work/api': { history: [OLD, ME], remotes: {}, override: { name: 'Someone', email: 'me@example.test' } },
      '/work/skills': { ...CLEAN },
      '/work/web': { ...CLEAN },
    },
  })

  await start($, clock)
  await audit($, clock)
  expect((await drawn($)).buttons).toEqual(['Unset override', 'Refresh'])

  const before = ran.length

  await press($, clock, 'unset-0')

  const after = ran.slice(before)

  expect(after.slice(0, 2)).toEqual([
    '/work/api: config --local --unset user.name',
    '/work/api: config --local --unset user.email',
  ])
  expect(repos['/work/api']?.override).toEqual({})
  // Only that repository is read again.
  expect(after.every(row => row.startsWith('/work/api: '))).toBe(true)
  expect(after.some(row => row.includes('--get-regexp'))).toBe(true)

  const { texts, buttons } = await drawn($)

  // Its history is still its history.
  expect(texts).toEqual([
    `intended ${ME} · 3 repositories in /work`,
    'api',
    `history: 1 as ${OLD}`,
    'no remote',
    '2 clean',
    'History is shown only: nothing here rewrites a commit.',
  ])
  expect(buttons).toEqual(['Refresh'])
})

test('a repository git cannot read is named with why, and the rest are read', async ($, on) => {
  const { clock } = world(on, {
    folders: SIBLINGS,
    repos: {
      '/work/api': { broken: 'not a git repository: /nowhere' },
      '/work/skills': { ...CLEAN },
      '/work/web': { ...CLEAN, isHistoryLost: true },
    },
  })

  await start($, clock)
  await audit($, clock)

  const { texts } = await drawn($)

  expect(texts[0]).toBe(`intended ${ME} · 3 repositories in /work`)
  expect(texts.slice(1, 3)).toEqual(['api', 'not read: not a git repository: /nowhere'])
  expect(texts[3]).toBe('web')
  expect(texts[4]?.startsWith('history not read: ')).toBe(true)
  expect(texts.at(-1)).toBe('1 clean')
})

test('a slow repository shows as being read and holds none of the others', async ($, on) => {
  const built = world(on, { folders: SIBLINGS })
  const { clock, repos } = built

  repos['/work/api'] = { ...CLEAN, hold: clock.sleep(60_000) }
  repos['/work/skills'] = { ...CLEAN }
  repos['/work/web'] = { ...CLEAN, override: { email: 'me@example.test' } }

  await start($, clock)
  await audit($, clock)

  expect((await drawn($)).texts).toEqual([
    `intended ${ME} · 3 repositories in /work · 2/3 read`,
    'web',
    'local override user.email=me@example.test',
    'published: origin github.com',
    'reading 1: api',
    '1 clean',
  ])

  await clock.advance(60_000)

  expect((await drawn($)).texts).toEqual([
    `intended ${ME} · 3 repositories in /work`,
    'web',
    'local override user.email=me@example.test',
    'published: origin github.com',
    '2 clean',
  ])
})

test('Refresh audits the same paths again', async ($, on) => {
  const { clock, repos } = world(on, {
    folders: { '/elsewhere': ['one'] },
    repos: { '/elsewhere/one': { ...CLEAN } },
  })

  await start($, clock)
  await audit($, clock, '/elsewhere')
  expect((await drawn($)).texts).toEqual([`intended ${ME} · 1 repository in /elsewhere`, '1 clean'])

  repos['/elsewhere/one'] = { ...CLEAN, override: { email: 'me@example.test' } }
  await press($, clock, 'refresh')

  expect((await drawn($)).texts.slice(0, 3)).toEqual([
    `intended ${ME} · 1 repository in /elsewhere`,
    'one',
    'local override user.email=me@example.test',
  ])
})

test('with no global identity nothing is judged, and the pane says why', async ($, on) => {
  const { clock } = world(on, {
    global: { name: '', email: '' },
    folders: SIBLINGS,
    repos: { '/work/api': { history: [OLD], remotes: {}, override: { email: 'me@example.test' } } },
  })

  await start($, clock)
  await audit($, clock)

  const { texts, buttons } = await drawn($)

  expect(texts).toEqual([
    'intended no identity · 1 repository in /work',
    'git has no global user.email: there is nothing to hold these repositories against.',
    '1 not judged',
  ])
  expect(buttons).toEqual(['Refresh'])
})

test('a global identity that is not the no-reply address is said so', async ($, on) => {
  const { clock } = world(on, {
    global: { name: 'Someone', email: 'me@example.test' },
    folders: SIBLINGS,
    repos: { '/work/api': { history: [OLD], remotes: {} } },
  })

  await start($, clock)
  await audit($, clock)

  expect((await drawn($)).texts[1]).toBe('the global identity me@example.test is not the no-reply address.')
})

test('--print answers with the audit as text and opens no pane', async ($, on) => {
  const { clock, opens } = world(on, {
    folders: SIBLINGS,
    repos: {
      '/work/api': { history: [OLD, OLD, ME], remotes: { origin: 'git@github.com:someone/api.git' } },
      '/work/skills': { ...CLEAN },
      '/work/web': { broken: 'bad config' },
    },
  })

  await start($, clock)

  expect(await command($, 'identity --print')).toBe(
    [
      `Identity audit · intended ${ME} · 3 repositories in /work`,
      `api — history: 2 as ${OLD} · published: origin github.com`,
      'web — not read: bad config',
      '1 clean',
      'History is shown only: nothing here rewrites a commit.',
    ].join('\n'),
  )
  expect(opens).toEqual([])
})

test('the pane before any audit says how to start one', async ($, on) => {
  const { clock } = world(on)

  await start($, clock)

  const { texts, buttons } = await drawn($)

  expect(texts).toEqual(['No audit yet: /git-pulse identity [path…], or Refresh for the repositories beside this one.'])
  expect(buttons).toEqual(['Refresh'])
})

test('words, paths, hosts and counts', () => {
  expect(wordsOf('identity "C:\\my repos" ./a  \'b c\'')).toEqual(['identity', 'C:\\my repos', './a', 'b c'])
  expect(folded('C:\\Users\\me\\repo\\..\\other\\')).toBe('C:\\Users\\me\\other')
  expect(joined('C:\\Users\\me', '.git')).toBe('C:\\Users\\me\\.git')
  expect(parentOf('C:\\Users\\me\\repo')).toBe('C:\\Users\\me')
  expect(parentOf('C:\\repo')).toBe('C:\\')
  expect(parentOf('/work/skills/')).toBe('/work')
  expect(parentOf('/work')).toBe('/')
  expect(leafOf('C:\\Users\\me\\repo\\')).toBe('repo')
  expect(hostOf('git@github.com:someone/x.git')).toBe('github.com')
  expect(hostOf('https://someone@github.com/someone/x.git')).toBe('github.com')
  expect(hostOf('ssh://git@10.0.0.85:2222/blue/x.git')).toBe('10.0.0.85')
  expect(hostOf('gitea:blue/x.git')).toBe('gitea')
  expect(hostOf('C:/Users/me/x.git')).toBe('local')
  expect(hostOf('../x.git')).toBe('local')
  expect(othersOf([ME, OLD, 'Someone <SOMEONE@users.noreply.github.com>', OLD, ALIAS], GLOBAL)).toEqual([
    { identity: OLD, commits: 2 },
    { identity: ALIAS, commits: 1 },
  ])
  expect(othersOf([OLD], { name: '', email: '' })).toEqual([])
})
