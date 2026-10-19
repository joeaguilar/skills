import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { askedOf, fillText, folded, joined, leafOf, wordsOf } from '../hooks/register'
import { docsOf } from '../hooks/templates'
import { REFERENCE } from './reference'

const FILES = ['AGENTS.md', 'CLAUDE.md', 'GOSPEL.md', 'SOUL.md', 'APOSTLE.md', 'CONTRIBUTING.md', 'README.md']
const CWD = '/work/scratch-project'

/** A path as the test spells it: the host hands the file system an absolute one of its own. */
const spelled = (path: string) => path.replace(/^[A-Za-z]:(?=[\\/])/, '').replace(/\\/g, '/')

/** The world beneath the mod: a file system of `existing` paths, and what the mod wrote and sent. */
const world = (on: On, existing: readonly string[] = [], variables: Record<string, string> = {}) => {
  const files = new Set(existing.map(spelled))
  const writes: { path: string; text: string }[] = []
  const submitted: string[] = []
  const toasts: string[] = []
  const clock = mock.clock(on)

  mock.env(on, variables)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('fs.exists', (_$, e) => ({ value: files.has(spelled(e.path)) }))
  on('fs.write', (_$, e) => {
    const path = spelled(e.path)

    if (path.includes('/locked/')) throw new Error('EACCES: permission denied')

    files.add(path)
    writes.push({ path, text: e.text })

    return { value: undefined }
  })
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)

    return { text: e.text }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })

  return { files, writes, submitted, toasts, clock }
}

const start = ($: Engine) => $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })

const run = async ($: Engine, args: string) =>
  (
    await $.command.run({
      command: 'bootstrap-docs',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 200 },
    })
  ).text ?? ''

/** The outcome column of the command's rows, keyed by file. */
const outcomes = (text: string) =>
  Object.fromEntries(
    text
      .split('\n')
      .map(row => /^ {2}(\S+)\s{2,}(.+)$/.exec(row))
      .flatMap(found => (found === null ? [] : [[found[1] ?? '', found[2] ?? '']])),
  )

test('the port holds the same text the script writes, with LF endings', () => {
  for (const heading of ['scratch-project', 'My Project']) {
    const reference = REFERENCE[heading] ?? {}
    const docs = docsOf(heading)

    expect(docs.map(([name]) => name)).toEqual(FILES)
    expect(Object.keys(reference).sort()).toEqual([...FILES].sort())

    for (const [name, content] of docs) {
      expect(content).toBe(reference[name] ?? '')
      expect(content.includes('\r')).toBe(false)
      expect(content.endsWith('\n') && !content.endsWith('\n\n')).toBe(true)
    }
  }
})

test('a fresh folder gets all seven files, named after the folder, and no turn starts', async ($, on) => {
  const { writes, submitted, clock } = world(on)

  await start($)

  const text = await run($, '')

  await clock.settle()

  expect(text.split('\n')[0]).toBe(`Scaffold in ${CWD}`)
  expect(outcomes(text)).toEqual(Object.fromEntries(FILES.map(name => [name, 'created'])))
  expect(writes.map(write => write.path)).toEqual(FILES.map(name => `${CWD}/${name}`))

  for (const write of writes) {
    expect(write.text).toBe(REFERENCE['scratch-project']?.[write.path.slice(CWD.length + 1)] ?? '')
  }

  expect(text).toContain('/bootstrap-docs --fill ¤')
  expect(text).toContain('¤ uses tokens')
  expect(submitted).toEqual([])
})

test('a partly filled folder keeps what it has and gets the rest', async ($, on) => {
  const { writes } = world(on, [`${CWD}/AGENTS.md`, `${CWD}/README.md`])

  await start($)

  const found = outcomes(await run($, ''))

  expect(found['AGENTS.md']).toBe('skipped (exists)')
  expect(found['README.md']).toBe('skipped (exists)')
  expect(found['GOSPEL.md']).toBe('created')
  expect(writes.map(write => write.path)).toEqual(
    FILES.filter(name => name !== 'AGENTS.md' && name !== 'README.md').map(name => `${CWD}/${name}`),
  )
})

test('--force overwrites what exists and says so', async ($, on) => {
  const { writes } = world(on, [`${CWD}/AGENTS.md`])

  await start($)

  const found = outcomes(await run($, '--force'))

  expect(found['AGENTS.md']).toBe('overwrote')
  expect(found['CLAUDE.md']).toBe('created')
  expect(writes).toHaveLength(7)
  expect(writes[0]?.text).toBe(REFERENCE['scratch-project']?.['AGENTS.md'] ?? '')
})

test('a folder where everything exists writes nothing and points at --force', async ($, on) => {
  const { writes } = world(on, FILES.map(name => `${CWD}/${name}`))

  await start($)

  const text = await run($, '')

  expect(writes).toEqual([])
  expect(Object.values(outcomes(text))).toEqual(FILES.map(() => 'skipped (exists)'))
  expect(text).toContain('--force overwrites what exists')
})

test('--project-name sets the README heading and nothing else', async ($, on) => {
  const { writes } = world(on)

  await start($)
  await run($, '--project-name "My Project"')

  const reference = REFERENCE['My Project'] ?? {}

  for (const write of writes) {
    expect(write.text).toBe(reference[write.path.slice(CWD.length + 1)] ?? '')
  }

  expect(writes.find(write => write.path.endsWith('/README.md'))?.text.startsWith('# My Project\n')).toBe(true)
})

test('a folder given by name lands under the session folder, an absolute one where it says', async ($, on) => {
  const { writes } = world(on)

  await start($)
  await run($, 'apps/../site')

  expect(writes[0]?.path).toBe(`${CWD}/site/AGENTS.md`)
  expect(writes.at(-1)?.text.startsWith('# site\n')).toBe(true)

  writes.length = 0
  await run($, '"/elsewhere/new repo" --project-name=Thing')

  expect(writes[0]?.path).toBe('/elsewhere/new repo/AGENTS.md')
  expect(writes.at(-1)?.text.startsWith('# Thing\n')).toBe(true)
})

test('~ is the home folder', async ($, on) => {
  const { writes } = world(on, [], { USERPROFILE: '/home/someone' })

  await start($)
  await run($, '~/fresh')

  expect(writes[0]?.path).toBe('/home/someone/fresh/AGENTS.md')
})

test('a file that cannot be written is named, and the others still land', async ($, on) => {
  const { writes } = world(on, [])

  await start($)

  const found = outcomes(await run($, '/locked/'))

  expect(writes).toEqual([])
  expect((found['AGENTS.md'] ?? '').startsWith('failed: ')).toBe(true)
})

test('an option it does not know writes nothing and shows the usage', async ($, on) => {
  const { writes } = world(on)

  await start($)

  const text = await run($, '--overwrite')

  expect(writes).toEqual([])
  expect(text).toContain('--overwrite is not an option.')
  expect(text).toContain('Usage: /bootstrap-docs [dir] [--force] [--project-name NAME]')
  expect(await run($, 'one two')).toContain('one folder at a time')
  expect(await run($, '--fill --force')).toContain('--fill takes a folder and nothing else.')
  expect(await run($, '--project-name')).toContain('--project-name needs a name.')
})

test('--fill hands the main session the request, once the command has answered', async ($, on) => {
  const { writes, submitted, clock } = world(on, [`${CWD}/AGENTS.md`])

  await start($)

  const text = await run($, '--fill')

  expect(text).toBe(`Asked Claude to fill in the scaffold in ${CWD} (¤ uses tokens).`)
  expect(submitted).toEqual([])

  await clock.advance(50)

  expect(submitted).toEqual([fillText(CWD)])
  expect(submitted[0]).toContain('1. GOSPEL.md for hard rules')
  expect(submitted[0]).toContain('CLAUDE.md stays a thin pointer')
  expect(writes).toEqual([])
})

test('--fill with no scaffold there spends nothing and says what to run', async ($, on) => {
  const { submitted, clock } = world(on)

  await start($)

  const text = await run($, '--fill docs')

  await clock.advance(1_000)

  expect(text).toBe(
    `No scaffold in ${CWD}/docs (AGENTS.md is missing). Run /bootstrap-docs "docs" first.`,
  )
  expect(submitted).toEqual([])
})

test('words keep quoted spaces, and a backslash is a path\'s own', () => {
  expect(wordsOf('  a  "b c" --name="d e" \'f g\' ')).toEqual(['a', 'b c', '--name=d e', 'f g'])
  expect(wordsOf('C:\\new\\table --force')).toEqual(['C:\\new\\table', '--force'])
  expect(wordsOf("Bob's")).toEqual(["Bob's"])
  expect(wordsOf('')).toEqual([])
  expect(askedOf('"my dir" --force --project-name X')).toEqual({
    dir: 'my dir',
    isForced: true,
    projectName: 'X',
    isFill: false,
  })
})

test('paths fold in the separator they came with', () => {
  expect(folded('C:\\Users\\me\\.\\work\\..\\repo\\')).toBe('C:\\Users\\me\\repo')
  expect(folded('C:\\Users\\me\\a/b')).toBe('C:\\Users\\me\\a\\b')
  expect(folded('/a//b/../c')).toBe('/a/c')
  expect(folded('/../a')).toBe('/a')
  expect(folded('\\\\nas\\share\\x\\..')).toBe('\\\\nas\\share')
  expect(joined('C:\\repo', 'AGENTS.md')).toBe('C:\\repo\\AGENTS.md')
  expect(joined('/repo/', 'AGENTS.md')).toBe('/repo/AGENTS.md')
  expect(leafOf('C:\\Users\\me\\repo\\')).toBe('repo')
  expect(leafOf('/work/site')).toBe('site')
})
