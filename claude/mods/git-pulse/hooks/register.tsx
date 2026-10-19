import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Audit, Identity, Pulse, Remote, RepoAudit, Seen, Stray } from '../types'

/**
 * The identity every commit should carry: GitHub's no-reply address. An
 * unpushed commit under any other email is called out, never blocked.
 */
const IDENTITY = /@users\.noreply\.github\.com$/i
const SHELLS = new Set(['Bash', 'PowerShell'])
/** A git command that can change what the pulse shows, where a command starts. */
const CHANGES =
  /(?:^|[;&|(]|\n)\s*git\s+(?:-C\s+\S+\s+)?(add|am|apply|branch|checkout|cherry-pick|commit|config|fetch|merge|mv|pull|push|rebase|remote|reset|restore|revert|rm|stash|switch)\b/
const PUSH = /(?:^|[;&|(]|\n)\s*git\s+(?:-C\s+\S+\s+)?push\b/
/** How many unpushed commits are read for their emails. */
const MAX_COMMITS = 200
const GIT_MS = 10_000
const TOAST_MS = 15_000
/** Long enough for the press that set the timer to have settled. */
const SOON_MS = 50
/** Marks an action that spends tokens: it starts a model turn. */
const COST = '¤'
const LEGEND = `${COST} uses tokens`

type Action = 'commit' | 'push'

// Every mod's band shares one site: these letters are no other mod's.
const HOTKEYS: Record<Action, string> = { commit: 'm', push: 'p' }

const NONE: Pulse = {
  isRepo: false,
  branch: '',
  dirty: 0,
  behind: 0,
  remotes: [],
  unpushed: 0,
  strays: [],
  nextEmail: '',
}

const pulse = atom({ plugin: 'git-pulse', key: 'pulse' } as const, NONE)

const COMMAND = 'git-pulse'
/** The pane the identity audit draws in. */
const AUDIT_PANE = 'git-pulse-identity'
/** A whole history can take a while to list. */
const HISTORY_MS = 30_000
/** Repositories read at once: a slow one holds its own lane, never the rest. */
const LANES = 4
/** Other identities named on one row; the rest are counted. */
const NAMED = 2
const USAGE =
  '/git-pulse identity [path…] audits commit identity across repositories in a pane (--print writes it here instead). It only reads: no commit is ever rewritten.'

const NOBODY: Identity = { name: '', email: '' }
const NO_AUDIT: Audit = { intended: NOBODY, asked: [], looked: [], phase: 'idle', repos: [] }

const audit = atom({ plugin: 'git-pulse', key: 'audit' } as const, NO_AUDIT)

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '')

/** Runs git in the session's directory; '' when it fails or has nothing to say. */
const git = async ($: EngineInterface, args: readonly string[]) => {
  try {
    // No optional locks: agents run git here too, and a status must not hold the index.
    const ran = await $.process.run(['git', '--no-optional-locks', ...args], { timeoutMs: GIT_MS })

    return ran.exitCode === 0 ? ran.stdout : ''
  } catch {
    return ''
  }
}

const isStray = (email: string) => email !== '' && !IDENTITY.test(email)

/** The emails on unpushed commits that are not the public identity, with how many commits each. */
const straysOf = (emails: readonly string[]): Stray[] => {
  const counts = new Map<string, number>()

  // Two lines per commit: its author, then its committer.
  for (let at = 0; at < emails.length; at += 2) {
    for (const email of new Set([emails[at] ?? '', emails[at + 1] ?? ''])) {
      if (isStray(email)) {
        counts.set(email, (counts.get(email) ?? 0) + 1)
      }
    }
  }

  return [...counts].map(([email, commits]) => ({ email, commits }))
}

/** Measures the repository: a handful of read-only git calls, no model call. */
const measure = async ($: EngineInterface): Promise<Pulse> => {
  const status = await git($, ['status', '--porcelain=v2', '--branch'])

  if (status === '') {
    return NONE
  }

  const rows = lines(status)
  const head = rows.find(row => row.startsWith('# branch.head '))?.slice('# branch.head '.length) ?? ''
  const ab = /^# branch\.ab \+\d+ -(\d+)$/.exec(rows.find(row => row.startsWith('# branch.ab ')) ?? '')
  const names = lines(await git($, ['remote']))
  const refs = lines(await git($, ['for-each-ref', '--format=%(refname)', 'refs/remotes']))
  const [emails, ident, ...counts] = await Promise.all([
    // With no remote there is nowhere to push: the history is not judged until one is added.
    names.length === 0
      ? ''
      : git($, ['log', `--max-count=${MAX_COMMITS}`, '--format=%ae%n%ce', 'HEAD', '--not', '--remotes']),
    git($, ['var', 'GIT_AUTHOR_IDENT']),
    ...names.map(name => git($, ['rev-list', '--count', 'HEAD', '--not', `--remotes=${name}`])),
  ])
  const remotes: Remote[] = names.map((name, at) => {
    const isKnown = refs.some(ref => ref.startsWith(`refs/remotes/${name}/`))

    return { name, isKnown, ahead: isKnown ? Number(counts[at]?.trim() ?? '0') || 0 : 0 }
  })
  const unpushedEmails = lines(emails ?? '')

  return {
    isRepo: true,
    branch: head,
    dirty: rows.filter(row => !row.startsWith('#')).length,
    behind: Number(ab?.[1] ?? '0'),
    remotes,
    unpushed: unpushedEmails.length / 2,
    strays: straysOf(unpushedEmails),
    nextEmail: /<([^>]*)>/.exec(ident ?? '')?.[1] ?? '',
  }
}

// One measurement at a time: a call made while one runs asks for one more after it.
let running: Promise<Pulse> | undefined
let isStale = false

const refresh = async ($: EngineInterface): Promise<Pulse> => {
  if (running !== undefined) {
    isStale = true

    return running
  }

  running = (async () => {
    let found = await measure($)

    while (isStale) {
      isStale = false
      found = await measure($)
    }

    await update($, pulse, () => found)

    return found
  })()

  try {
    return await running
  } finally {
    running = undefined
  }
}

const say = ($: EngineInterface, text: string) => {
  $.ui.toast(`Git Pulse: ${text}`, { timeoutMs: TOAST_MS })
}

const strayText = (strays: readonly Stray[]) =>
  strays
    .map(stray => `${stray.commits} as ${stray.email}`)
    .join(', ')

/** Before a push runs: says so when it carries commits under another identity. Never holds it. */
const warnBeforePush = async ($: EngineInterface) => {
  const { strays } = await read($, pulse)

  if (strays.length > 0) {
    say($, `this push carries commits not under the no-reply identity: ${strayText(strays)}.`)
  }
}

/** After a push: says which remotes it did not reach. */
const reportAfterPush = async ($: EngineInterface) => {
  const found = await refresh($)
  const missed = found.remotes.filter(remote => !remote.isKnown || remote.ahead > 0)

  if (missed.length > 0 && missed.length < found.remotes.length) {
    say(
      $,
      `pushed, but ${missed.map(remote => (remote.isKnown ? `${remote.name} is ${remote.ahead} behind` : `${remote.name} has nothing yet`)).join(' and ')}.`,
    )
  }
}

/** The band's line, split so the identity part can stand out; undefined when all is clean and pushed. */
const lineOf = (found: Pulse) => {
  if (!found.isRepo) {
    return undefined
  }

  const remotes = found.remotes
    .filter(remote => !remote.isKnown || remote.ahead > 0)
    .map(remote => (remote.isKnown ? `${remote.name} ↑${remote.ahead}` : `${remote.name} new`))
  const parts = [
    found.dirty > 0 ? `${found.dirty} dirty` : '',
    ...remotes,
    found.behind > 0 ? `upstream ↓${found.behind}` : '',
  ].filter(part => part !== '')
  const alarm =
    found.strays.length > 0
      ? `identity: ${strayText(found.strays)}`
      : isStray(found.nextEmail)
        ? `next commit as ${found.nextEmail}`
        : ''

  if (parts.length === 0 && alarm === '') {
    return undefined
  }

  const identity = alarm === '' && found.unpushed > 0 ? 'identity ok' : ''
  const actions: { action: Action; label: string }[] = []

  if (found.dirty > 0) {
    actions.push({ action: 'commit', label: `Commit ${COST}` })
  }

  if (remotes.length > 0) {
    const reach = found.remotes.length === 1 ? 'Push' : found.remotes.length === 2 ? 'Push both' : 'Push all'

    actions.push({ action: 'push', label: `${reach} ${COST}` })
  }

  return {
    calm: ['git', found.branch, ...parts, identity].filter(part => part !== '').join(' · '),
    alarm,
    actions,
  }
}

const commitText =
  '[git-pulse] Commit the finished work in this repository, following its commit rules. Leave out anything that should not be committed, and say what you left and why.'

const pushText = (found: Pulse) =>
  `[git-pulse] Push ${found.branch} to ${found.remotes.map(remote => remote.name).join(' and ')}, fetching first and following this repository's rules for pushing. Say where each remote ended.`

/** Submits a prompt as the person's own words: they pressed the button. */
const submit = async ($: EngineInterface, text: string) => {
  try {
    await $.prompt.submit({ text, asUser: true })
  } catch {
    say($, 'the prompt could not be submitted.')
  }
}

/** A pressed button: the main session is asked to commit or push. Spends a turn. */
const act = async ($: EngineInterface, action: Action) => {
  const text = action === 'commit' ? commitText : pushText(await read($, pulse))

  $.clock.after(SOON_MS, () => {
    void submit($, text)
  })
}

// ── The identity audit: the same question the band asks of one repository, asked of many. ──

/**
 * Splits what was typed into words. A quote keeps spaces together where it
 * opens a word; a backslash is a Windows path's own, never an escape.
 */
export const wordsOf = (args: string): string[] => {
  const words: string[] = []
  let word = ''
  let isOpen = false
  let quote = ''

  for (const char of args) {
    if (quote !== '') {
      if (char === quote) {
        quote = ''
      } else {
        word += char
      }
    } else if ((char === '"' || char === "'") && !isOpen) {
      quote = char
      isOpen = true
    } else if (/\s/.test(char)) {
      if (isOpen) {
        words.push(word)
      }

      word = ''
      isOpen = false
    } else {
      word += char
      isOpen = true
    }
  }

  if (isOpen) {
    words.push(word)
  }

  return words
}

const isAbsolute = (path: string) => /^(?:[A-Za-z]:[\\/]|[\\/])/.test(path)

/** The separator a path is written with: its first one, `/` when it has none. */
const separatorOf = (path: string) => /[\\/]/.exec(path)?.[0] ?? '/'

/** The path with `.`, `..` and doubled separators folded, in the separator it came with. */
export const folded = (path: string): string => {
  const separator = separatorOf(path)
  const drive = /^[A-Za-z]:(?=[\\/])/.exec(path)?.[0] ?? ''
  const rest = path.slice(drive.length)
  // A network path keeps both of its leading separators.
  const root = /^[\\/]{2}[^\\/]/.test(rest) ? separator + separator : /^[\\/]/.test(rest) ? separator : ''
  const kept: string[] = []

  for (const part of rest.split(/[\\/]+/)) {
    if (part === '..' && kept.length > 0 && kept[kept.length - 1] !== '..') {
      kept.pop()
    } else if (part === '..' && root !== '') {
      // Above the root there is only the root.
    } else if (part !== '' && part !== '.') {
      kept.push(part)
    }
  }

  return `${drive}${root}${kept.join(separator)}` || '.'
}

/** A name under a folder, joined by the folder's own separator. */
export const joined = (folder: string, name: string): string =>
  /[\\/]$/.test(folder) ? `${folder}${name}` : `${folder}${separatorOf(folder)}${name}`

/** The last part of a path: the folder's own name. */
export const leafOf = (path: string): string => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path

/** The folder that holds a path; a root holds itself. */
export const parentOf = (path: string): string => {
  const whole = folded(path)
  const cut = Math.max(whole.lastIndexOf('/'), whole.lastIndexOf('\\'))

  if (cut < 0) {
    return whole
  }

  // The separator stays where cutting it would leave a bare drive or nothing: that is the root.
  const above = whole.slice(0, cut)

  return above === '' || /^[A-Za-z]:$/.test(above) ? whole.slice(0, cut + 1) : above
}

const spell = (who: Identity) => (who.name === '' && who.email === '' ? 'no identity' : `${who.name} <${who.email}>`)

const isSame = (one: Identity, other: Identity) =>
  one.name === other.name && one.email.toLowerCase() === other.email.toLowerCase()

/** `Name <email>` back into its parts. */
const identityOf = (text: string): Identity => {
  const found = /^(.*?)\s*<([^>]*)>$/.exec(text.trim())

  return found === null ? { name: text.trim(), email: '' } : { name: found[1] ?? '', email: found[2] ?? '' }
}

/** The identities that are not the intended one, with how many commits carry each, most first. */
export const othersOf = (identities: readonly string[], intended: Identity): Seen[] => {
  const counts = new Map<string, number>()

  // With no global identity there is nothing to hold a commit against.
  if (intended.email === '') {
    return []
  }

  for (const identity of identities) {
    if (identity !== '' && !isSame(identityOf(identity), intended)) {
      counts.set(identity, (counts.get(identity) ?? 0) + 1)
    }
  }

  return [...counts]
    .map(([identity, commits]) => ({ identity, commits }))
    .sort(
      (one, other) =>
        other.commits - one.commits || (one.identity.toLowerCase() < other.identity.toLowerCase() ? -1 : 1),
    )
}

/** The host a remote's URL points at; `local` for a path on this machine. */
export const hostOf = (url: string): string => {
  const web = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?([^/:]+)/i.exec(url)

  if (web !== null) {
    return web[1] ?? url
  }

  // git@host:path or an ssh alias; a drive letter is followed by a separator and is no host.
  return /^(?:[^@/\\]+@)?([^:/\\]+):(?![\\/])/.exec(url)?.[1] ?? 'local'
}

/** Each remote of `git remote -v`, once, with its host. */
const remotesOf = (listing: string): string[] => {
  const hosts = new Map<string, string>()

  for (const row of lines(listing)) {
    const [name = '', url = ''] = row.split(/\s+/)

    if (name !== '' && !hosts.has(name)) {
      hosts.set(name, hostOf(url))
    }
  }

  return [...hosts].map(([name, host]) => `${name} ${host}`)
}

type Ran = { code: number; out: string; err: string; isCut: boolean }

const NOTHING: Ran = { code: 0, out: '', err: '', isCut: false }

/** Runs git in a folder, any exit code; code -1 when it could not run or ran out of time. */
const gitAt = async (
  $: EngineInterface,
  folder: string,
  args: readonly string[],
  timeoutMs = GIT_MS,
): Promise<Ran> => {
  try {
    const ran = await $.process.run(['git', '--no-optional-locks', '-C', folder, ...args], { timeoutMs })

    return { code: ran.exitCode, out: ran.stdout, err: ran.stderr, isCut: ran.isStdoutTruncated }
  } catch (error) {
    return { code: -1, out: '', err: error instanceof Error ? error.message : String(error), isCut: false }
  }
}

const whyOf = (ran: Ran) => (lines(ran.err)[0] ?? `git exited ${ran.code}`).replace(/^fatal:\s*/, '')

const blankRepo = (path: string): RepoAudit => ({
  path,
  status: 'reading',
  reason: '',
  override: { name: null, email: null },
  resolved: NOBODY,
  history: [],
  isHistoryCut: false,
  unpushed: [],
  remotes: [],
})

/** Reads one repository's identity: its config, its history, what it has not pushed. Changes nothing. */
const readRepo = async ($: EngineInterface, path: string, intended: Identity): Promise<RepoAudit> => {
  const blank = blankRepo(path)
  const local = await gitAt($, path, ['config', '--local', '--get-regexp', '^user\\.(name|email)$'])

  // 0: it sets one of them; 1: it sets neither; anything else: git cannot read the repository.
  if (local.code !== 0 && local.code !== 1) {
    return { ...blank, status: 'failed', reason: whyOf(local) }
  }

  const override: RepoAudit['override'] = { name: null, email: null }

  for (const row of lines(local.out)) {
    const found = /^user\.(name|email)(?:\s+(.*))?$/i.exec(row)

    if (found !== null) {
      override[found[1]?.toLowerCase() === 'name' ? 'name' : 'email'] = found[2] ?? ''
    }
  }

  const [name, email, remote, head] = await Promise.all([
    gitAt($, path, ['config', '--get', 'user.name']),
    gitAt($, path, ['config', '--get', 'user.email']),
    gitAt($, path, ['remote', '-v']),
    gitAt($, path, ['rev-parse', '--verify', '--quiet', 'HEAD']),
  ])
  // A repository with no commit yet has no history to read.
  const hasCommits = head.code === 0
  const [history, unpushed] = await Promise.all([
    hasCommits ? gitAt($, path, ['log', '--format=%an <%ae>', 'HEAD'], HISTORY_MS) : NOTHING,
    hasCommits
      ? gitAt($, path, ['log', '--format=%an <%ae>%x09%cn <%ce>', '--branches', '--not', '--remotes'], HISTORY_MS)
      : NOTHING,
  ])
  const unread = [history.code === 0 ? '' : 'history', unpushed.code === 0 ? '' : 'unpushed commits'].filter(
    part => part !== '',
  )

  return {
    path,
    status: 'read',
    reason: unread.length === 0 ? '' : `${unread.join(' and ')} not read: ${whyOf(history.code === 0 ? unpushed : history)}`,
    override,
    resolved: { name: name.code === 0 ? name.out.trim() : '', email: email.code === 0 ? email.out.trim() : '' },
    history: history.code === 0 ? othersOf(lines(history.out), intended) : [],
    isHistoryCut: history.isCut,
    // One commit counts once for each other identity on it, as author or as committer.
    unpushed:
      unpushed.code === 0
        ? othersOf(
            lines(unpushed.out).flatMap(row => [...new Set(row.split('\t').map(part => part.trim()))]),
            intended,
          )
        : [],
    remotes: remotesOf(remote.out),
  }
}

const hasGit = ($: EngineInterface, folder: string) => $.fs.exists(joined(folder, '.git')).catch(() => false)

/** The folder itself when it is a repository, else its direct children that are. */
const repositoriesIn = async ($: EngineInterface, folder: string): Promise<string[]> => {
  if (await hasGit($, folder)) {
    return [folder]
  }

  const entries = await $.fs.list(folder).catch(() => [])
  const children = entries.filter(entry => entry.kind === 'dir').map(entry => joined(folder, entry.name))
  const kept = await Promise.all(children.map(async child => ((await hasGit($, child)) ? child : '')))

  return kept.filter(child => child !== '')
}

/** Where the audit looks: the paths asked for, or the folder that holds the session's repository. */
const foldersAsked = async ($: EngineInterface, asked: readonly string[]): Promise<string[]> => {
  const cwd = await $.session.cwd()

  if (asked.length === 0) {
    const repo = await $.session.repo().catch(() => null)

    return [repo === null ? folded(cwd) : parentOf(repo.root)]
  }

  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''

  return asked.map(path => {
    if (home !== '' && (path === '~' || /^~[\\/]/.test(path))) {
      return folded(path === '~' ? home : joined(home, path.slice(2)))
    }

    return folded(isAbsolute(path) ? path : joined(cwd, path))
  })
}

const globalIdentity = async ($: EngineInterface): Promise<Identity> => {
  const [name, email] = await Promise.all([
    git($, ['config', '--global', '--get', 'user.name']),
    git($, ['config', '--global', '--get', 'user.email']),
  ])

  return { name: name.trim(), email: email.trim() }
}

// A newer audit makes an older one's answers void. The module's own: a reload ends the audit it interrupts.
let auditRun = 0

/** Puts one repository's reading in its row, unless a newer audit has taken the pane. */
const landRepo = async ($: EngineInterface, run: number, found: RepoAudit) => {
  if (run === auditRun) {
    await update($, audit, (now): Audit => ({
      ...now,
      repos: now.repos.map(repo => (repo.path === found.path ? found : repo)),
    }))
  }
}

/** Audits every repository asked for, a few at a time; each row lands as its repository answers. */
const runAudit = async ($: EngineInterface, asked: readonly string[]): Promise<Audit> => {
  auditRun += 1

  const run = auditRun

  await update($, audit, (): Audit => ({ ...NO_AUDIT, asked: [...asked], phase: 'finding' }))

  const [intended, folders] = await Promise.all([globalIdentity($), foldersAsked($, asked)])
  const looked = [...new Set(folders)]
  const found = await Promise.all(looked.map(folder => repositoriesIn($, folder)))
  const paths = [...new Set(found.flat())].sort((one, other) =>
    one.toLowerCase() < other.toLowerCase() ? -1 : 1,
  )

  if (run !== auditRun) {
    return read($, audit)
  }

  await update($, audit, (): Audit => ({
    intended,
    asked: [...asked],
    looked,
    phase: paths.length === 0 ? 'done' : 'reading',
    repos: paths.map(blankRepo),
  }))

  let next = 0
  const lane = async () => {
    while (next < paths.length && run === auditRun) {
      const path = paths[next] ?? ''

      next += 1
      await landRepo($, run, await readRepo($, path, intended))
    }
  }

  await Promise.all(Array.from({ length: Math.min(LANES, paths.length) }, lane))

  if (run === auditRun) {
    await update($, audit, (now): Audit => ({ ...now, phase: 'done' }))
  }

  return read($, audit)
}

/** Audits again what was last asked for. */
const rerunAudit = async ($: EngineInterface) => {
  await runAudit($, (await read($, audit)).asked)
}

/** An audit a reload cut short is said to be so, rather than left reading for ever. */
const settleAudit = async ($: EngineInterface) => {
  const held = await read($, audit)

  if (auditRun === 0 && (held.phase === 'finding' || held.phase === 'reading')) {
    await update($, audit, (now): Audit => ({
      ...now,
      phase: 'done',
      repos: now.repos.map(repo =>
        repo.status === 'reading' ? { ...repo, status: 'failed', reason: 'the audit was interrupted; Refresh reads it again' } : repo,
      ),
    }))
  }
}

/** Takes the repository's own user.name and user.email out of its config, then reads it again. */
const unsetOverride = async ($: EngineInterface, path: string) => {
  const held = await read($, audit)
  const repo = held.repos.find(one => one.path === path)

  if (repo === undefined) {
    return
  }

  const run = auditRun

  for (const key of ['name', 'email'] as const) {
    if (repo.override[key] !== null) {
      let ran = await gitAt($, path, ['config', '--local', '--unset', `user.${key}`])

      // 5: the key is set more than once, which a plain unset refuses.
      if (ran.code === 5) {
        ran = await gitAt($, path, ['config', '--local', '--unset-all', `user.${key}`])
      }

      if (ran.code !== 0) {
        say($, `could not unset user.${key} in ${leafOf(path)}: ${whyOf(ran)}.`)
      }
    }
  }

  await landRepo($, run, await readRepo($, path, held.intended))
  // The session's own repository may be the one that changed.
  void refresh($).catch(() => undefined)
}

const seenText = (seen: readonly Seen[]) =>
  [
    seen
      .slice(0, NAMED)
      .map(one => `${one.commits} as ${one.identity}`)
      .join(', '),
    seen.length > NAMED ? `+${seen.length - NAMED} more` : '',
  ]
    .filter(part => part !== '')
    .join(' ')

/** One repository's row: what is wrong now, what its past holds, and the rest. */
type AuditRow = {
  path: string
  name: string
  /** Wrong for the next commit or the next push. */
  alarm: string
  /** In history: shown, never acted on. */
  past: string
  calm: string
  /** Its local override differs from the global identity. */
  canUnset: boolean
  /** Lower comes first; undefined for a repository with nothing to say. */
  rank: number | undefined
}

const rowOf = (repo: RepoAudit, intended: Identity, name: string): AuditRow => {
  const base = { path: repo.path, name, past: '', calm: '', canUnset: false }

  if (repo.status === 'failed') {
    return { ...base, alarm: `not read: ${repo.reason}`, rank: 3 }
  }

  // With no global identity there is nothing an override could differ from.
  const hasIntended = intended.email !== ''
  const off = [
    hasIntended && repo.override.name !== null && repo.override.name !== intended.name
      ? `user.name=${repo.override.name}`
      : '',
    hasIntended && repo.override.email !== null && repo.override.email.toLowerCase() !== intended.email.toLowerCase()
      ? `user.email=${repo.override.email}`
      : '',
  ].filter(part => part !== '')
  const isOverridden = repo.override.name !== null || repo.override.email !== null
  const isPublished = repo.remotes.length > 0
  // Something other than a local override decides it: an include, a system config, the environment.
  const isResolvedOff = off.length === 0 && hasIntended && !isSame(repo.resolved, intended)
  // With no remote nothing is pushed at all: the history line says it.
  const hasUnpushed = isPublished && repo.unpushed.length > 0
  const alarm = [
    off.length > 0 ? `local override ${off.join(', ')}` : '',
    isResolvedOff ? `next commit as ${spell(repo.resolved)}` : '',
    hasUnpushed ? `unpushed: ${seenText(repo.unpushed)}` : '',
    repo.reason,
  ].filter(part => part !== '')
  const past =
    repo.history.length > 0
      ? `history: ${seenText(repo.history)}${repo.isHistoryCut ? ' (only its first part was read)' : ''}`
      : ''
  const calm = [
    hasIntended && off.length === 0 && isOverridden ? 'local override matches global' : '',
    isPublished ? `published: ${repo.remotes.join(', ')}` : 'no remote',
  ].filter(part => part !== '')

  return {
    ...base,
    alarm: alarm.join(' · '),
    past,
    calm: calm.join(' · '),
    canUnset: off.length > 0,
    // The next commit first, then the next push, then the past, then what git did not answer for.
    rank: off.length > 0 || isResolvedOff ? 0 : hasUnpushed ? 1 : past !== '' ? 2 : repo.reason !== '' ? 3 : undefined,
  }
}

/** What the pane and the printed audit both say. */
const auditView = (held: Audit) => {
  // A folder's name stands for it unless two repositories share one.
  const leaves = held.repos.map(repo => leafOf(repo.path))
  const answered = held.repos.filter(repo => repo.status !== 'reading')
  const rows = answered.map(repo => {
    const leaf = leafOf(repo.path)

    return rowOf(repo, held.intended, leaves.filter(one => one === leaf).length > 1 ? repo.path : leaf)
  })
  const count = held.repos.length
  const where = held.looked.join(', ')
  const head =
    held.phase === 'idle'
      ? 'No audit yet: /git-pulse identity [path…], or Refresh for the repositories beside this one.'
      : held.phase === 'finding'
        ? 'finding repositories…'
        : count === 0
          ? `No repositories in ${where}.`
          : [
              `intended ${spell(held.intended)}`,
              `${count} ${count === 1 ? 'repository' : 'repositories'} in ${where}`,
              held.phase === 'reading' ? `${answered.length}/${count} read` : '',
            ]
              .filter(part => part !== '')
              .join(' · ')
  const warning =
    held.phase === 'idle' || held.phase === 'finding'
      ? ''
      : held.intended.email === ''
        ? 'git has no global user.email: there is nothing to hold these repositories against.'
        : isStray(held.intended.email)
          ? `the global identity ${held.intended.email} is not the no-reply address.`
          : ''
  const quiet = rows.filter(row => row.rank === undefined).length
  const pending = held.repos.filter(repo => repo.status === 'reading').map(repo => leafOf(repo.path))

  return {
    head,
    warning,
    rows: rows
      .filter(row => row.rank !== undefined)
      .sort(
        (one, other) =>
          (one.rank ?? 0) - (other.rank ?? 0) || (one.name.toLowerCase() < other.name.toLowerCase() ? -1 : 1),
      ),
    // With no global identity nothing was held against anything: that is not the same as clean.
    clean: quiet === 0 ? '' : `${quiet} ${held.intended.email === '' ? 'not judged' : 'clean'}`,
    reading: pending.length === 0 ? '' : `reading ${pending.length}: ${pending.join(', ')}`,
    hasPast: rows.some(row => row.past !== ''),
  }
}

const PAST_NOTE = 'History is shown only: nothing here rewrites a commit.'

/** The audit as text, for a run with no pane to draw in. */
export const auditText = (held: Audit): string => {
  const view = auditView(held)

  return [
    `Identity audit · ${view.head}`,
    view.warning,
    ...view.rows.map(row => `${row.name} — ${[row.alarm, row.past, row.calm].filter(part => part !== '').join(' · ')}`),
    view.reading,
    view.clean,
    view.hasPast ? PAST_NOTE : '',
  ]
    .filter(part => part !== '')
    .join('\n')
}

export const register: Register = on => {
  // Every measurement runs beside the work, never in its way: nothing waits on git here.
  on('session.start', async ($, e, next) => {
    void refresh($).catch(() => undefined)
    void settleAudit($).catch(() => undefined)

    await $.command.register({
      name: COMMAND,
      description: 'Git Pulse: `identity [path…]` audits commit identity across repositories, read-only',
      argumentHint: 'identity [--print] [path…]',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const [verb, ...rest] = wordsOf(e.args)

    if (verb !== 'identity') {
      return { text: USAGE }
    }

    const paths = rest.filter(word => word !== '--print')

    // With no pane to draw in (a headless run), the audit is the command's own answer.
    if (paths.length < rest.length) {
      return { text: auditText(await runAudit($, paths)) }
    }

    // Off the dispatch: reading many repositories outlives this command's answer.
    $.clock.after(0, () => {
      void runAudit($, paths).catch(() => undefined)
    })

    const opened = await $.ui.open({ id: AUDIT_PANE, title: 'Identity audit', focus: true })

    return {
      text: opened.isPlaced
        ? 'Identity audit opened.'
        : 'Identity audit is running, but this surface has not drawn its pane.',
    }
  })

  on('ui.render', { component: 'Pane', requestId: AUDIT_PANE }, async ($, e) => {
    const held = await read($, audit)
    const view = auditView(held)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text dimColor wrap="wrap">
          {view.head}
        </Text>
        {view.warning !== '' && (
          <Text color="error" wrap="wrap">
            {view.warning}
          </Text>
        )}
        {view.rows.map((row, at) => (
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            <Text bold>{row.name}</Text>
            {row.alarm !== '' && (
              <Text color="error" wrap="wrap">
                {row.alarm}
              </Text>
            )}
            {row.past !== '' && (
              <Text color="warning" wrap="wrap">
                {row.past}
              </Text>
            )}
            {row.calm !== '' && (
              <Text dimColor wrap="wrap">
                {row.calm}
              </Text>
            )}
            {row.canUnset && (
              <Button
                key={`unset-${at}`}
                label="Unset override"
                onPress={() => {
                  // Off the dispatch: reading the repository again may take a while.
                  $.clock.after(0, () => {
                    void unsetOverride($, row.path).catch(() => undefined)
                  })
                }}
              />
            )}
          </Box>
        ))}
        {view.reading !== '' && (
          <Text dimColor wrap="wrap">
            {view.reading}
          </Text>
        )}
        {view.clean !== '' && <Text dimColor>{view.clean}</Text>}
        {view.hasPast && <Text dimColor>{PAST_NOTE}</Text>}
        <Box flexDirection="row" columnGap={1}>
          <Button
            key="refresh"
            label="Refresh"
            hotkey="r"
            onPress={() => {
              $.clock.after(0, () => {
                void rerunAudit($).catch(() => undefined)
              })
            }}
          />
        </Box>
      </Box>
    )
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      void refresh($).catch(() => undefined)
    }

    return next(e)
  })

  // Git commands are never held or refused: the pulse is read once they have run.
  on('tool.call', async ($, e, next) => {
    const args: Record<string, unknown> = e
    const command = SHELLS.has(String(e.tool)) && typeof args['command'] === 'string' ? args['command'] : ''

    if (!CHANGES.test(command)) {
      return next(e)
    }

    const isPush = PUSH.test(command)

    if (isPush) {
      await warnBeforePush($)
    }

    const ran = await next(e)

    void (isPush ? reportAfterPush($) : refresh($)).catch(() => undefined)

    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const line = lineOf(await read($, pulse))

    if (line === undefined) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // Another mod's band, when one draws beneath this one, stays under it.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Text dimColor wrap="truncate-end">
            {line.calm}
          </Text>
          {line.alarm !== '' && (
            <Text color="error" wrap="truncate-end">
              {line.alarm}
            </Text>
          )}
          {line.actions.map(({ action, label }) => (
            <Button
              key={`git-${action}`}
              label={label}
              hotkey={HOTKEYS[action]}
              onPress={() => act($, action)}
            />
          ))}
          {line.actions.length > 0 && <Text dimColor>{LEGEND}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
