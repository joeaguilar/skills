import { atom, read, update } from 'claude-code'
import type { EngineInterface, ProcessRunResult, Register } from 'claude-code'

import type { Picture, ScriptRun } from '../types'
import { CLOSING, EMPTY, NO_RUN, bandOf, clip, parseItr, reconcile, reportOf, stateOf, tsugiOf } from './gather'
import type { FileRead, ItrRead, Raw } from './gather'
import { START_BODY, askText, beginText } from './prompts'

const PANE = 'whats-next'
const TITLE = "What's next"
const TOOL = 'mcp__whats-next__report'
/** One read-only git or itr call. */
const RUN_MS = 10_000
/** The project's own next-work command, run only on the person's request. */
const SCRIPT_MS = 60_000
const TOAST_MS = 15_000
/** Long enough for the press or command that set the timer to have settled. */
const SOON_MS = 50
/** Marks an action that spends tokens: it starts a model turn. */
const COST = '¤'
const LEGEND = `${COST} uses tokens`
const FIELDS = 'id,title,status,priority,tags,assigned_to,updated_at,blocked_by'

type Action = 'start' | 'ask'

// Every mod's band shares one site: these letters are no other mod's.
const HOTKEYS: Record<Action, string> = { start: 'g', ask: 'e' }

const TOOL_DESCRIPTION =
  'Answers "what is next", "what\'s left" and "where did we leave off" for the current project: one reconciled, read-only report from the itr tracker, docs/NEXT.md, docs/ROADMAP.md, sprint/CURRENT, the latest handoff, campaign/CURRENT and git, with stale pointers and contradictions flagged. Call this instead of probing those sources one by one. Report only: it starts nothing, claims nothing and writes nothing, and a status question is never permission to begin work.'

const picture = atom({ plugin: 'whats-next', key: 'picture' } as const, EMPTY)
const script = atom({ plugin: 'whats-next', key: 'script' } as const, NO_RUN)

let hasBand = true
/** The folder the last gathering read: the repository's root, else the session's. */
let base = ''
let bashPath: string | undefined
let hasSoughtBash = false

const say = ($: EngineInterface, words: string) => {
  $.ui.toast(`What's next: ${words}`, { timeoutMs: TOAST_MS })
}

/** Runs a command by its arguments; undefined when it cannot start or does not finish. */
const runAt = async (
  $: EngineInterface,
  argv: readonly string[],
  cwd: string | undefined,
  timeoutMs = RUN_MS,
): Promise<ProcessRunResult | undefined> => {
  try {
    return await $.process.run(argv, cwd === undefined ? { timeoutMs } : { cwd, timeoutMs })
  } catch {
    return undefined
  }
}

const outOf = (ran: ProcessRunResult | undefined) => (ran !== undefined && ran.exitCode === 0 ? ran.stdout : '')

/** A file's text and when it last changed; undefined when it is not there. */
const readAt = async ($: EngineInterface, path: string): Promise<FileRead | undefined> => {
  try {
    const stat = await $.fs.stat(path)

    return stat.kind === 'file' ? { text: await $.fs.read(path), mtimeMs: stat.mtimeMs } : undefined
  } catch {
    return undefined
  }
}

/** The most recently changed file of a folder; undefined when the folder is missing or empty. */
const newestIn = async ($: EngineInterface, folder: string) => {
  try {
    const files = (await $.fs.list(folder)).filter(entry => entry.kind === 'file')

    return [...files].sort((one, other) => other.mtimeMs - one.mtimeMs)[0]
  } catch {
    return undefined
  }
}

const isThere = async ($: EngineInterface, path: string) => {
  try {
    return await $.fs.exists(path)
  } catch {
    return false
  }
}

const firstLine = (file: FileRead | undefined) => (file?.text.split(/\r?\n/)[0] ?? '').trim()

/** Reads everything the picture is made of: read-only git and itr calls and a few files. No model call. */
const collect = async ($: EngineInterface): Promise<Raw> => {
  const now = await $.clock.now()
  const top = await runAt($, ['git', '--no-optional-locks', 'rev-parse', '--show-toplevel'], undefined)
  const isRepo = top !== undefined && top.exitCode === 0 && top.stdout.trim() !== ''

  base = (isRepo ? top.stdout.trim() : await $.session.root()).replace(/[\\/]+$/, '')

  const root = base
  const at = (path: string) => `${root}/${path}`
  // No optional locks: agents run git here too, and a status must not hold the index.
  const git = (args: readonly string[]) => (isRepo ? runAt($, ['git', '--no-optional-locks', ...args], root) : undefined)
  const itr = (args: readonly string[]) => runAt($, ['itr', ...args, '-f', 'json', '--fields', FIELDS], root)

  const [
    log,
    status,
    first,
    nextMd,
    sprintCurrent,
    docsRoadmap,
    rootRoadmap,
    handoff,
    stateOfPlay,
    campaignCurrent,
    claudeMd,
    agentsMd,
    justfile,
    capitalJustfile,
    hasNextScript,
  ] = await Promise.all([
    git(['log', '-1', '--format=%h%x09%ct%x09%ad%x09%s', '--date=short']),
    git(['status', '--porcelain']),
    itr(['next']),
    readAt($, at('docs/NEXT.md')),
    readAt($, at('sprint/CURRENT')),
    readAt($, at('docs/ROADMAP.md')),
    readAt($, at('ROADMAP.md')),
    newestIn($, at('docs/handoff')),
    readAt($, at('docs/state-of-play.md')),
    readAt($, at('campaign/CURRENT')),
    readAt($, at('CLAUDE.md')),
    readAt($, at('AGENTS.md')),
    readAt($, at('justfile')),
    readAt($, at('Justfile')),
    isThere($, at('scripts/next-work.sh')),
  ])

  let tracker: ItrRead = { state: 'no-binary' }

  if (first !== undefined) {
    // No database: the other calls would only say so again.
    const lists = parseItr(first.stdout).isMissingDatabase
      ? []
      : await Promise.all([
          itr(['ready']),
          itr(['wip']),
          itr(['list', '--blocked']),
          runAt($, ['itr', 'list', '--all', '--include-blocked', '-f', 'json', '--fields', 'id,status'], root),
        ])

    tracker = {
      state: 'ok',
      next: first.stdout,
      ready: lists[0]?.stdout ?? '',
      wip: lists[1]?.stdout ?? '',
      blocked: lists[2]?.stdout ?? '',
      all: lists[3]?.stdout ?? '',
    }
  }

  const sprint = firstLine(sprintCurrent)
  const campaign = firstLine(campaignCurrent)
  const dirty = outOf(status)
  const [isSprintFolderThere, campaignJson, numstat] = await Promise.all([
    sprint === '' ? false : isThere($, at(`sprint/${sprint}`)),
    campaign === '' ? undefined : readAt($, at(`campaign/${campaign}/campaign.json`)),
    // Only the fallback stone needs it: the dirtiest path, when no tracker names a task.
    dirty.trim() !== '' && tracker.state !== 'ok' ? git(['diff', '--numstat', 'HEAD']) : undefined,
  ])
  const roadmap =
    docsRoadmap !== undefined
      ? { ...docsRoadmap, path: 'docs/ROADMAP.md' }
      : rootRoadmap !== undefined
        ? { ...rootRoadmap, path: 'ROADMAP.md' }
        : undefined

  return {
    now,
    project: root.split(/[\\/]/).pop() ?? '',
    git: isRepo ? { log: outOf(log), status: dirty, numstat: outOf(numstat) } : undefined,
    itr: tracker,
    nextMd,
    roadmap,
    sprintCurrent,
    isSprintFolderThere,
    handoff:
      handoff !== undefined
        ? { path: `docs/handoff/${handoff.name}`, mtimeMs: handoff.mtimeMs }
        : stateOfPlay !== undefined
          ? { path: 'docs/state-of-play.md', mtimeMs: stateOfPlay.mtimeMs }
          : undefined,
    campaignCurrent,
    campaignJson: campaignJson?.text,
    instructions: [
      ...(claudeMd === undefined ? [] : [{ path: 'CLAUDE.md', text: claudeMd.text }]),
      ...(agentsMd === undefined ? [] : [{ path: 'AGENTS.md', text: agentsMd.text }]),
    ],
    hasNextScript,
    justfile: justfile?.text ?? capitalJustfile?.text,
  }
}

/** Git Bash's own bash.exe, never the `bash` on PATH: on Windows that may be WSL's. */
const bashOf = async ($: EngineInterface): Promise<string | undefined> => {
  if (hasSoughtBash) {
    return bashPath
  }

  hasSoughtBash = true

  if ((await $.env.get('OS')) !== 'Windows_NT') {
    bashPath = 'bash'

    return bashPath
  }

  const guesses: string[] = []
  const named = await $.env.get('CLAUDE_CODE_GIT_BASH_PATH')

  if (named !== undefined && named !== '') {
    guesses.push(named)
  }

  for (const row of outOf(await runAt($, ['where.exe', 'git'], undefined)).split(/\r?\n/)) {
    const git = row.trim()
    const root = git.replace(/\\(?:cmd|bin|mingw64\\bin)\\git\.exe$/i, '')

    if (root !== git) {
      guesses.push(`${root}\\bin\\bash.exe`)
    }
  }

  guesses.push('C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe')

  for (const guess of guesses) {
    if (await isThere($, guess)) {
      bashPath = guess

      return bashPath
    }
  }

  return undefined
}

/** Runs the project's own next-work command. Only ever on the person's request: it is the project's code. */
const runScript = async ($: EngineInterface, command: string): Promise<ScriptRun> => {
  const bash = command === 'just next' ? '' : await bashOf($)

  if (bash === undefined) {
    return { command, output: 'Git Bash was not found, so the script was not run.', exitCode: 127 }
  }

  const ran = await runAt($, command === 'just next' ? ['just', 'next'] : [bash, 'scripts/next-work.sh'], base, SCRIPT_MS)

  if (ran === undefined) {
    return { command, output: 'It could not be started, or did not finish within a minute.', exitCode: 127 }
  }

  const isQuiet = ran.exitCode === 0 || ran.stderr.trim() === ''

  return { command, output: clip(isQuiet ? ran.stdout : `${ran.stdout}\n${ran.stderr}`), exitCode: ran.exitCode }
}

// One gathering at a time: a call made while one runs asks for one more after it.
let running: Promise<Picture> | undefined
let isStale = false
let wantsScript = false

/**
 * Gathers and reconciles. `withScript` also runs the project's own next-work
 * command: true only where the person asked (the command, the pane's Refresh).
 */
const refreshNow = async ($: EngineInterface, withScript = false): Promise<Picture> => {
  wantsScript ||= withScript

  if (running !== undefined) {
    isStale = true

    return running
  }

  running = (async () => {
    let found = reconcile(await collect($))

    while (isStale) {
      isStale = false
      found = reconcile(await collect($))
    }

    await update($, picture, () => found)

    if (wantsScript) {
      wantsScript = false

      const ran = found.script === '' ? NO_RUN : await runScript($, found.script)

      await update($, script, () => ran)
    }

    return found
  })()

  try {
    return await running
  } finally {
    running = undefined
  }
}

/** Submits a prompt as the person's own words, once the press or command that asked has settled. */
const submitSoon = ($: EngineInterface, words: string) => {
  $.clock.after(SOON_MS, () => {
    void $.prompt.submit({ text: words, asUser: true }).catch(() => {
      say($, 'the prompt could not be submitted.')
    })
  })
}

/** Start: Claude claims the pick and begins it; with no pick, the generic start. Spends a turn. */
const begin = ($: EngineInterface, found: Picture, given: number | undefined) => {
  const id = given ?? found.task?.id

  if (id === undefined) {
    submitSoon($, START_BODY)

    return
  }

  const claim = found.claims.find(one => one.id === id)
  const title = id === found.task?.id ? found.task.title : (claim?.title ?? '')

  submitSoon($, beginText({ id, title }, claim, stateOf(found).join('\n')))
}

/** A pressed ¤ button: the picture is read again first, so the pick is the current one. */
const press = async ($: EngineInterface, action: Action) => {
  const found = await refreshNow($).catch(() => read($, picture))

  if (action === 'start') {
    begin($, found, undefined)
  } else {
    submitSoon($, askText(stateOf(found).join('\n')))
  }
}

/** One short line for a command's output row. */
const lineOf = (found: Picture) => {
  const band = bandOf(found)

  return band === undefined
    ? 'no tracker and no pointer files here'
    : [band.calm, band.alarm].filter(part => part !== '').join(' · ')
}

export const register: Register = (on, options) => {
  hasBand = options.band !== false

  on('session.start', async ($, e, next) => {
    const refused: string[] = []
    // One refused name must not take the others with it.
    const declare = async (name: string, declared: Promise<unknown>) => {
      try {
        await declared
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)

        // A skill of the person's own may hold the name: the hook below still answers it when typed.
        if (!reason.includes("it is the user's")) {
          refused.push(`${name} (${reason})`)
        }
      }
    }

    await declare(
      '/whats-next',
      $.command.register({
        name: 'whats-next',
        description: `Show what is next: tracker, digest, roadmap, sprint and git, reconciled with no model call. --start [id] begins the top item ${COST}`,
        argumentHint: '[--start [id]]',
        immediate: true,
      }),
    )
    await declare(
      '/tsugi',
      $.command.register({
        name: 'tsugi',
        description: 'Name the single next thing in three lines, with no model call',
        immediate: true,
      }),
    )
    await declare(
      '/start',
      $.command.register({ name: 'start', description: `Start the next thing, whatever it is ${COST}` }),
    )
    await declare(
      'the report tool',
      $.tool.register({
        name: 'report',
        description: TOOL_DESCRIPTION,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      }),
    )

    if (refused.length > 0) {
      say($, `${refused.join(', ')} could not be registered.`)
    }

    // The gathering runs beside the session, never in its way: nothing waits on it.
    void refreshNow($).catch(() => undefined)

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      void refreshNow($).catch(() => undefined)
    }

    return next(e)
  })

  on('command.run', { command: 'whats-next' }, async ($, e) => {
    const begun = /^--start(?:\s+#?(\d+))?$/.exec(e.args.trim())
    const found = await refreshNow($, true)
    const ran = await read($, script)

    if (begun !== null) {
      begin($, found, begun[1] === undefined ? undefined : Number(begun[1]))

      return { text: reportOf(found, ran) }
    }

    const placed = await $.ui.open({ id: PANE, title: TITLE })

    // No room for the pane: the report is the output instead.
    return { text: placed.isPlaced ? lineOf(found) : reportOf(found, ran) }
  })

  on('command.run', { command: 'tsugi' }, async $ => ({ text: tsugiOf(await refreshNow($)).join('\n') }))

  on('command.run', { command: 'start' }, $ => {
    submitSoon($, START_BODY)
    void refreshNow($).catch(() => undefined)

    return {}
  })

  // The model's way to the same report. It runs no project script: that stays the person's to ask for.
  on('tool.call', { tool: TOOL }, async $ => ({ result: reportOf(await refreshNow($)) }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!hasBand || e.props.hasSurvey) {
      return next(e)
    }

    const line = bandOf(await read($, picture))

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
            <Text color="warning" wrap="truncate-end">
              {line.alarm}
            </Text>
          )}
          <Button key="next-start" label={`Start ${COST}`} hotkey={HOTKEYS.start} onPress={() => press($, 'start')} />
          <Button key="next-ask" label={`Ask ${COST}`} hotkey={HOTKEYS.ask} onPress={() => press($, 'ask')} />
          <Text dimColor>{LEGEND}</Text>
        </Box>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Markdown, Text } = $.ui.resolve(e)
    const found = await read($, picture)
    const ran = await read($, script)
    const [heading = '', ...fields] = stateOf(found)

    return (
      <Box flexDirection="column">
        {ran.command !== '' && (
          <Box flexDirection="column">
            <Text bold wrap="truncate-end">
              {`${ran.command}${ran.exitCode === 0 ? '' : ` (exit ${ran.exitCode})`}`}
            </Text>
            {ran.output.split('\n').map(row => (
              <Text dimColor wrap="truncate-end">
                {row === '' ? ' ' : row}
              </Text>
            ))}
            <Text> </Text>
          </Box>
        )}
        <Text bold wrap="truncate-end">
          {heading.replace(/^#+\s*/, '')}
        </Text>
        {found.at === 0 ? (
          <Text dimColor>Not gathered yet.</Text>
        ) : (
          fields.map(field => (field === '' ? <Text> </Text> : <Markdown text={field} />))
        )}
        <Text> </Text>
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Button key="next-refresh" label="Refresh" hotkey="r" onPress={() => refreshNow($, true).then(() => undefined)} />
          <Button key="next-pane-start" label={`Start ${COST}`} hotkey={HOTKEYS.start} onPress={() => press($, 'start')} />
          <Button key="next-pane-ask" label={`Ask ${COST}`} hotkey={HOTKEYS.ask} onPress={() => press($, 'ask')} />
          <Text dimColor>{LEGEND}</Text>
        </Box>
        <Text dimColor wrap="truncate-end">
          {CLOSING}
        </Text>
      </Box>
    )
  })
}
