import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage, Timer } from 'claude-code'

import type { Parked, Pulse, Run } from '../types'

const PANE = 'run-watch'
const TITLE = 'Run Watch'
/** Quiet this long, a run gets the soft warning: its row turns and one toast says so. */
const SOFT_MS = 30 * 60_000
/** Quiet this long, it holds the band above the prompt until it moves or is dealt with. */
const MAIN_MS = 60 * 60_000
const TICK_MS = 30_000
/** How long a finished run stays listed. */
const KEEP_ENDED_MS = 10 * 60_000
const MAX_RUNS = 60
const TOAST_MS = 15_000
/** Long enough for the press that set the timer to have settled. */
const SOON_MS = 50
/** Marks an action that spends tokens: it starts a model turn. */
const COST = '¤'
const LEGEND = `${COST} uses tokens`
/** The statuses `$.agent.list()` gives an agent that is over. */
const OVER = new Set(['completed', 'failed', 'killed'])

type Action = 'wake' | 'inspect' | 'close' | 'resubmit'

const LABELS: Record<Action, string> = {
  wake: `Wake ${COST}`,
  inspect: 'Inspect',
  close: 'Close',
  resubmit: `Resubmit ${COST}`,
}

const HOTKEYS: Record<Action, string> = { wake: 'w', inspect: 'i', close: 'c', resubmit: 'r' }

const runs = atom({ plugin: 'run-watch', key: 'runs' } as const, [])
const parkedTasks = atom({ plugin: 'run-watch', key: 'parked' } as const, [])
const pulse = atom({ plugin: 'run-watch', key: 'pulse' } as const, {
  now: 0,
  activeAt: 0,
  idleSince: 0,
  stallLevel: 0,
  stallAck: 0,
})
const hasOpened = atom({ plugin: 'run-watch', key: 'hasOpened' } as const, false)
const inspection = atom({ plugin: 'run-watch', key: 'inspection' } as const, { id: '', lines: [] })

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

/** Compact duration, as the status line spells it: `<1m`, `45m`, `3h12`. */
const span = (ms: number) => {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)

  if (minutes < 1) {
    return '<1m'
  }

  if (minutes < 60) {
    return `${minutes}m`
  }

  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

/**
 * 0 while moving, 1 past the soft warning, 2 past the main threshold, then
 * one more each time the quiet time doubles.
 */
const levelOf = (quietMs: number) => {
  if (quietMs < SOFT_MS) {
    return 0
  }

  return quietMs < MAIN_MS ? 1 : 2 + Math.floor(Math.log2(quietMs / MAIN_MS))
}

const modelName = (id: string) => id.replace(/^claude-/, '').replace(/-\d{8}$/, '')

/** What a tool call is about, for the row: its command, its file, its task. */
const detailOf = (args: Record<string, unknown>) => {
  for (const name of ['command', 'file_path', 'description']) {
    const value = args[name]

    if (typeof value === 'string' && value !== '') {
      return clip(oneLine(value), 60)
    }
  }

  return ''
}

const doing = (run: Run) =>
  run.busyTool === ''
    ? ''
    : `, in ${run.busyTool}${run.busyDetail === '' ? '' : `: ${run.busyDetail}`}`

/** The background tasks no row already stands for. */
const unwatched = (tasks: readonly Parked[], list: readonly Run[]) =>
  tasks.filter(task => !list.some(run => run.id === task.id))

/**
 * What can be done about a run. A loop no list names lives inside its
 * workflow, so it can be neither stopped nor restarted by itself.
 */
const actionsFor = (run: Run): Action[] => {
  if (run.kind === 'unlisted') {
    return ['wake', 'inspect']
  }

  return run.status === 'failed'
    ? ['inspect', 'close', 'resubmit']
    : ['wake', 'inspect', 'close', 'resubmit']
}

/**
 * The one line that holds the band, with what it is about: a run past the
 * main threshold, a run that failed, or a session where nothing has moved.
 * Undefined while all is moving or the person has already acted on it.
 */
const alarm = (list: readonly Run[], tasks: readonly Parked[], held: Pulse) => {
  const quiet = list
    .filter(run => {
      const level = run.status === 'running' ? levelOf(held.now - run.lastAt) : 0

      return level >= 2 && level > run.ackLevel
    })
    .sort((a, b) => a.lastAt - b.lastAt)
  const worst = quiet[0]

  if (worst !== undefined) {
    const more = quiet.length > 1 ? ` (+${quiet.length - 1} more)` : ''

    return {
      line: `Run Watch: “${clip(worst.label, 40)}” quiet ${span(held.now - worst.lastAt)}${doing(worst)}${more}`,
      id: worst.id,
      actions: actionsFor(worst),
    }
  }

  const failed = list.find(run => run.status === 'failed' && run.ackLevel === 0)

  if (failed !== undefined) {
    return {
      line: `Run Watch: “${clip(failed.label, 40)}” failed ${span(held.now - failed.endedAt)} ago`,
      id: failed.id,
      actions: actionsFor(failed),
    }
  }

  const others = unwatched(tasks, list)
  const first = others[0]
  const still = held.now - held.activeAt
  const level = held.idleSince > 0 ? levelOf(still) : 0

  if (first !== undefined && level >= 2 && level > held.stallAck) {
    const count = others.length === 1 ? '1 background task' : `${others.length} background tasks`
    const actions: Action[] = ['wake', 'close']

    return {
      line: `Run Watch: nothing has moved for ${span(still)}, waiting on ${count} (${first.type}: ${clip(first.label, 40)})`,
      id: first.id,
      actions,
    }
  }

  return undefined
}

const factsOf = (run: Run, now: number) => {
  const model = run.model === '' ? '' : `${modelName(run.model)} · `

  if (run.status !== 'running') {
    return `${model}${run.status} ${span(now - run.endedAt)} ago · ran ${span(run.endedAt - run.startedAt)}`
  }

  const last =
    run.busyTool === ''
      ? `last call ${span(now - run.lastAt)} ago`
      : `in ${run.busyTool} ${span(now - run.lastAt)}${run.busyDetail === '' ? '' : `: ${run.busyDetail}`}`

  return `${model}up ${span(now - run.startedAt)} · ${last}`
}

/** How a run stands, as a prompt to the main session says it. */
const plight = (run: Run, now: number) =>
  run.status === 'failed'
    ? `stopped without finishing ${span(now - run.endedAt)} ago`
    : `has made no tool call for ${span(now - run.lastAt)}${doing(run)}`

const wakeText = (run: Run, now: number) =>
  `[run-watch] The agent “${run.label}” (${run.id}) ${plight(run, now)}. Check on it without restarting it: read its latest output, say what it is doing or where it is stuck, and recommend whether to keep waiting, message it, or stop it.`

const resubmitText = (run: Run, now: number) =>
  `[run-watch] The agent “${run.label}” (${run.id}) ${plight(run, now)}. Stop it if it is still running, then hand its task to a fresh agent, carrying over whatever it had already finished.`

const wakeTaskText = (task: Parked, stillMs: number) =>
  `[run-watch] Nothing in this session has moved for ${span(stillMs)}. It is waiting on a background ${task.type} (${task.id}): ${task.label}. Check whether that is still making progress, and say whether to keep waiting or stop it.`

/** The last of an agent's transcript, a line per thing it said or called. */
const tailOf = (messages: readonly SessionMessage[]) => {
  const lines: string[] = []

  for (const message of messages.slice(-6)) {
    if (message.role !== 'assistant') {
      continue
    }

    if (message.text.trim() !== '') {
      lines.push(`says: ${clip(oneLine(message.text), 160)}`)
    }

    for (const use of message.toolUses) {
      const detail = detailOf(use.input)
      const outcome = use.text === undefined ? 'still running' : clip(oneLine(use.text), 80)

      lines.push(
        `${use.tool}${detail === '' ? '' : ` ${detail}`} → ${use.isError === true ? 'error: ' : ''}${outcome}`,
      )
    }
  }

  return lines.length === 0 ? ['Nothing in its transcript yet.'] : lines.slice(-8)
}

// The working copy: tool calls touch it with no host call but the clock's,
// and `publish` hands the drawings a snapshot.
const live = new Map<string, Run>()
const inFlight = new Map<string, number>()
let parked: Parked[] = []
let activeAt = 0
let idleSince = 0
let stallLevel = 0
let stallAck = 0
let timer: Timer | undefined

const blank = (id: string, at: number): Run => ({
  id,
  label: `agent ${id.slice(0, 8)}`,
  kind: 'unlisted',
  model: '',
  startedAt: at,
  lastAt: at,
  busyTool: '',
  busyDetail: '',
  status: 'running',
  endedAt: 0,
  alertLevel: 0,
  ackLevel: 0,
})

const finish = (run: Run, status: 'ended' | 'failed', at: number) => {
  run.status = status
  run.endedAt = at
  run.busyTool = ''
  run.busyDetail = ''
  run.alertLevel = 0
  run.ackLevel = 0
  inFlight.delete(run.id)
}

const prune = (at: number) => {
  for (const [id, run] of live) {
    if (run.status !== 'running' && at - run.endedAt > KEEP_ENDED_MS) {
      live.delete(id)
    }
  }

  const over = [...live.values()]
    .filter(run => run.status !== 'running')
    .sort((a, b) => a.endedAt - b.endedAt)

  for (const run of over) {
    if (live.size <= MAX_RUNS) {
      break
    }

    live.delete(run.id)
  }
}

const publish = async ($: EngineInterface, at: number) => {
  prune(at)
  await update($, runs, () => [...live.values()].map(run => ({ ...run })))
  await update($, parkedTasks, () => parked.map(task => ({ ...task })))
  await update($, pulse, () => ({ now: at, activeAt, idleSince, stallLevel, stallAck }))
}

/** Opens the pane the first time the session has something to watch. */
const reveal = async ($: EngineInterface) => {
  if (await read($, hasOpened)) {
    return
  }

  await update($, hasOpened, () => true)
  await $.ui.open({ id: PANE, title: TITLE })
}

/** Squares the rows with the engine's own list of the session's agents. */
const reconcile = async ($: EngineInterface, at: number) => {
  for (const info of await $.agent.list()) {
    const run = live.get(info.id)
    const label = oneLine(info.description) || info.type

    if (run === undefined) {
      if (info.status === 'running') {
        live.set(info.id, { ...blank(info.id, at), label, kind: 'agent' })
      }

      continue
    }

    if (run.kind === 'unlisted') {
      run.kind = 'agent'
      run.label = label
    }

    if (run.status === 'running' && OVER.has(info.status)) {
      const hasFailed = info.status !== 'completed'

      finish(run, hasFailed ? 'failed' : 'ended', at)

      if (hasFailed) {
        $.ui.toast(`Run Watch: “${clip(run.label, 40)}” ended as ${info.status}`, {
          timeoutMs: TOAST_MS,
        })
      }
    }
  }
}

const tick = async ($: EngineInterface) => {
  const at = await $.clock.now()
  const isLive = parked.length > 0 || [...live.values()].some(run => run.status === 'running')

  if (!isLive && live.size === 0) {
    return
  }

  if (isLive) {
    await reconcile($, at)
  }

  for (const run of live.values()) {
    if (run.status !== 'running') {
      continue
    }

    const level = levelOf(at - run.lastAt)

    if (level > run.alertLevel) {
      $.ui.toast(
        `Run Watch: “${clip(run.label, 40)}” quiet ${span(at - run.lastAt)}${doing(run)}`,
        { timeoutMs: TOAST_MS },
      )
    }

    run.alertLevel = level
  }

  const others = unwatched(parked, [...live.values()])
  const first = others[0]
  const level = idleSince > 0 && first !== undefined ? levelOf(at - activeAt) : 0

  if (level > stallLevel && first !== undefined) {
    $.ui.toast(
      `Run Watch: nothing has moved for ${span(at - activeAt)}, waiting on ${first.type}: ${clip(first.label, 40)}`,
      { timeoutMs: TOAST_MS },
    )
  }

  stallLevel = level

  if (level === 0) {
    stallAck = 0
  }

  await publish($, at)
}

/** Submits a prompt as the person's own words: they pressed the button. */
const submit = async ($: EngineInterface, text: string) => {
  try {
    await $.prompt.submit({ text, asUser: true })
  } catch {
    $.ui.toast('Run Watch: the prompt could not be submitted.', { timeoutMs: TOAST_MS })
  }
}

/** Shows or hides the end of a run's transcript in the pane. Spends nothing. */
const inspect = async ($: EngineInterface, id: string) => {
  if ((await read($, inspection)).id === id) {
    await update($, inspection, () => ({ id: '', lines: [] }))

    return
  }

  const found = await $.session.messages({ agentId: id })
  const lines = Array.isArray(found)
    ? tailOf(found)
    : [`Its transcript cannot be read: ${clip(oneLine(found.deny), 120)}`]

  await update($, inspection, () => ({ id, lines }))
  await update($, hasOpened, () => true)
  await $.ui.open({ id: PANE, title: TITLE })
}

/** Stops a running agent or background task, or dismisses a finished row. Spends nothing. */
const close = async ($: EngineInterface, id: string, at: number) => {
  const run = live.get(id)
  const label = clip(run?.label ?? parked.find(task => task.id === id)?.label ?? id, 40)

  if (run !== undefined && run.status !== 'running') {
    live.delete(id)
    await publish($, at)

    return
  }

  const stopped = await $.tool.call({
    tool: 'TaskStop',
    task_id: id,
    consent: `The user pressed "Close" on “${label}” in Run Watch.`,
  })
  const failure =
    stopped.deny ?? (stopped.isError === true ? (stopped.text ?? 'the engine refused') : undefined)

  if (failure !== undefined) {
    $.ui.toast(`Run Watch: could not stop “${label}”: ${clip(oneLine(failure), 80)}`, {
      timeoutMs: TOAST_MS,
    })

    return
  }

  if (run !== undefined) {
    finish(run, 'ended', at)
  }

  parked = parked.filter(task => task.id !== id)
  await publish($, at)
  $.ui.toast(`Run Watch: stopped “${label}”`, { timeoutMs: TOAST_MS })
}

/**
 * A pressed button. Wake and Resubmit hand the main session a prompt, which
 * spends a turn; the band then stays down until the quiet passes another level.
 */
const act = async ($: EngineInterface, action: Action, id: string) => {
  const at = await $.clock.now()

  if (action === 'inspect') {
    await inspect($, id)

    return
  }

  if (action === 'close') {
    await close($, id, at)

    return
  }

  const run = live.get(id)
  const task = parked.find(one => one.id === id)
  let text: string | undefined

  if (run !== undefined) {
    text = action === 'wake' ? wakeText(run, at) : resubmitText(run, at)
    run.ackLevel = Math.max(1, levelOf(at - run.lastAt))
  } else if (task !== undefined && action === 'wake') {
    text = wakeTaskText(task, at - activeAt)
    stallAck = levelOf(at - activeAt)
  }

  if (text === undefined) {
    return
  }

  const prompt = text

  await publish($, at)
  $.clock.after(SOON_MS, () => {
    void submit($, prompt)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // A reload starts the module over: take the rows back from the session.
    for (const run of await read($, runs)) {
      live.set(run.id, { ...run, ackLevel: run.ackLevel ?? 0, busyTool: '', busyDetail: '' })
    }

    const held = await read($, pulse)

    parked = (await read($, parkedTasks)).map(task => ({ ...task }))
    activeAt = held.activeAt
    idleSince = held.idleSince
    stallLevel = held.stallLevel
    stallAck = held.stallAck ?? 0

    await $.command.register({
      name: 'run-watch',
      description: 'Show live agents and background runs, and how long each has been quiet',
      immediate: true,
    })

    timer?.cancel()
    timer = $.clock.every(TICK_MS, () => {
      void tick($).catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'run-watch' }, async $ => {
    await tick($)
    await update($, hasOpened, () => true)

    const placed = await $.ui.open({ id: PANE, title: TITLE })
    const list = await read($, runs)
    const held = await read($, pulse)
    const running = list.filter(run => run.status === 'running')
    const quiet = running.filter(run => held.now - run.lastAt >= SOFT_MS).length
    const line =
      alarm(list, await read($, parkedTasks), held)?.line ??
      `Run Watch: ${running.length} running, ${quiet} quiet over ${span(SOFT_MS)}.`

    return { text: placed.isPlaced ? line : `${line} (${placed.reason})` }
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)

    if (spawned.agentId === undefined) {
      return spawned
    }

    const at = await $.clock.now()
    const known = live.get(spawned.agentId) ?? blank(spawned.agentId, at)

    live.set(spawned.agentId, {
      ...known,
      label: oneLine(e.description) || e.subagentType,
      kind: 'agent',
      model: spawned.model ?? known.model,
      status: 'running',
      endedAt: 0,
    })
    activeAt = at
    await publish($, at)
    await reveal($)

    return spawned
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId

    if (id === undefined) {
      if (e.tool === 'Workflow') {
        void reveal($).catch(() => undefined)
      }

      return next(e)
    }

    const at = await $.clock.now()
    const run = live.get(id) ?? blank(id, at)

    live.set(id, run)
    run.status = 'running'
    run.endedAt = 0
    run.lastAt = at
    run.ackLevel = 0
    run.busyTool = String(e.tool)
    run.busyDetail = detailOf(e)
    inFlight.set(id, (inFlight.get(id) ?? 0) + 1)
    activeAt = at

    try {
      return await next(e)
    } finally {
      const left = (inFlight.get(id) ?? 1) - 1
      const done = await $.clock.now().catch(() => at)

      inFlight.set(id, left)
      activeAt = Math.max(activeAt, done)

      // Pruned or finished meanwhile: leave the row as it stands.
      if (live.get(id) === run && run.status === 'running') {
        run.lastAt = done

        if (left <= 0) {
          run.busyTool = ''
          run.busyDetail = ''
        }
      }
    }
  })

  on('turn.start', async ($, e, next) => {
    activeAt = await $.clock.now()
    idleSince = 0

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const at = await $.clock.now()

    activeAt = at

    if (e.agentId === undefined) {
      return next(e)
    }

    const run = live.get(e.agentId)

    if (run !== undefined) {
      if (run.model === '' && e.usage !== undefined) {
        run.model = e.usage.model
      }

      const hasFailed = e.reason === 'error'

      finish(run, hasFailed ? 'failed' : 'ended', at)

      if (hasFailed) {
        $.ui.toast(`Run Watch: “${clip(run.label, 40)}” stopped on an API error`, {
          timeoutMs: TOAST_MS,
        })
      }

      await publish($, at)
    }

    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    const at = await $.clock.now()
    const before = new Map(parked.map(task => [task.id, task.since]))
    const tasks = e.background_tasks

    activeAt = at
    idleSince = at

    if (tasks !== undefined) {
      parked = tasks.map(task => ({
        id: task.id,
        type: task.type,
        label: clip(oneLine(task.command ?? task.name ?? task.description), 80),
        since: before.get(task.id) ?? at,
      }))

      // A loop no list names lives inside a workflow: with none in flight,
      // whatever is still marked running there is over.
      if (!tasks.some(task => /workflow/i.test(task.type))) {
        for (const run of live.values()) {
          if (run.kind === 'unlisted' && run.status === 'running') {
            finish(run, 'ended', at)
          }
        }
      }
    }

    await publish($, at)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, runs)
    const tasks = await read($, parkedTasks)
    const held = await read($, pulse)
    const shown = await read($, inspection)
    const others = unwatched(tasks, list)
    const running = list
      .filter(run => run.status === 'running')
      .sort((a, b) => a.lastAt - b.lastAt)
    const over = list
      .filter(run => run.status !== 'running')
      .sort((a, b) => b.endedAt - a.endedAt)
    const quietOf = (run: Run) => (run.status === 'running' ? held.now - run.lastAt : 0)
    const isFlagged = (run: Run) => run.status === 'failed' || quietOf(run) >= SOFT_MS
    const isStalled = held.idleSince > 0 && held.now - held.activeAt >= SOFT_MS
    const quiet = running.filter(run => quietOf(run) >= SOFT_MS).length
    const hasActions = list.some(isFlagged) || (isStalled && others.length > 0)
    const head = [
      `${running.length} running`,
      quiet > 0 ? `${quiet} quiet` : '',
      held.idleSince > 0 ? `main idle ${span(held.now - held.idleSince)}` : 'main working',
    ]
      .filter(part => part !== '')
      .join(' · ')

    const toneOf = (run: Run) => {
      if (run.status === 'failed' || quietOf(run) >= MAIN_MS) {
        return 'error'
      }

      return quietOf(run) >= SOFT_MS ? 'warning' : undefined
    }

    const markOf = (run: Run) => {
      if (run.status === 'failed') {
        return '✗'
      }

      if (run.status === 'ended') {
        return '✓'
      }

      return quietOf(run) >= SOFT_MS ? '!' : '●'
    }

    return (
      <Box flexDirection="column">
        <Text bold wrap="truncate-end">
          {head}
        </Text>
        {list.length === 0 && others.length === 0 && (
          <Text dimColor>No agents or background runs yet.</Text>
        )}
        {[...running, ...over].map(run => (
          <Box flexDirection="column">
            <Text color={toneOf(run)} dimColor={run.status === 'ended'} wrap="truncate-end">
              {markOf(run)} {run.label}
            </Text>
            <Text dimColor wrap="truncate-end">
              {'  '}
              {factsOf(run, held.now)}
            </Text>
            {isFlagged(run) && (
              <Box flexDirection="row" flexWrap="wrap" columnGap={1} paddingLeft={2}>
                {actionsFor(run).map(action => (
                  <Button
                    key={`${action}-${run.id}`}
                    label={LABELS[action]}
                    onPress={() => act($, action, run.id)}
                  />
                ))}
              </Box>
            )}
            {shown.id === run.id &&
              shown.lines.map(line => (
                <Text dimColor wrap="wrap">
                  {'    '}
                  {line}
                </Text>
              ))}
          </Box>
        ))}
        {others.length > 0 && <Text bold>Background, as of the last stop</Text>}
        {others.map(task => (
          <Box flexDirection="column">
            <Text dimColor wrap="truncate-end">
              {'  '}
              {task.type} · {span(held.now - task.since)} · {task.label}
            </Text>
            {isStalled && (
              <Box flexDirection="row" columnGap={1} paddingLeft={2}>
                <Button
                  key={`wake-${task.id}`}
                  label={LABELS.wake}
                  onPress={() => act($, 'wake', task.id)}
                />
                <Button
                  key={`close-${task.id}`}
                  label={LABELS.close}
                  onPress={() => act($, 'close', task.id)}
                />
              </Box>
            )}
          </Box>
        ))}
        {hasActions && <Text dimColor>{LEGEND}</Text>}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const found = alarm(await read($, runs), await read($, parkedTasks), await read($, pulse))

    if (found === undefined) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // Another mod's band, when one draws beneath this one, stays under it.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Text color="warning" wrap="truncate-end">
          {found.line}
        </Text>
        <Box flexDirection="row" columnGap={1}>
          {found.actions.map(action => (
            <Button
              key={`band-${action}`}
              label={LABELS[action]}
              hotkey={HOTKEYS[action]}
              onPress={() => act($, action, found.id)}
            />
          ))}
          <Text dimColor>
            {LEGEND} · /run-watch
          </Text>
        </Box>
        {below}
      </Box>
    )
  })
}
